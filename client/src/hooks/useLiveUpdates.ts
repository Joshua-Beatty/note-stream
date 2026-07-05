import * as React from "react";
import { trpc } from "@/trpc";

/**
 * Keeps the app live:
 *
 * 1. Subscribes to GET /api/events (SSE). The server pushes a `data-version`
 *    event on connect and after every mutation; when the version advances,
 *    all data queries are invalidated so other clients' changes appear.
 * 2. On wake (visibilitychange -> visible, or pageshow from the iOS bfcache)
 *    the OS has usually killed the connection without firing onerror, so we
 *    reconnect immediately and invalidate everything. Cached data renders
 *    instantly while fresh data loads in the background, making reopening
 *    the PWA feel seamless.
 *
 * EventSource handles background reconnection (with backoff) on network
 * blips and server restarts by itself.
 */
export function useLiveUpdates(): void {
  const utils = trpc.useUtils();
  const utilsRef = React.useRef(utils);
  utilsRef.current = utils;

  React.useEffect(() => {
    let source: EventSource | null = null;
    let lastVersion: number | null = null;

    const invalidateAll = (): void => {
      void utilsRef.current.notes.list.invalidate();
      void utilsRef.current.tags.list.invalidate();
      void utilsRef.current.calendar.days.invalidate();
    };

    const connect = (): void => {
      source?.close();
      source = new EventSource("/api/events");
      source.addEventListener("data-version", (event) => {
        const version = Number((event as MessageEvent).data);
        if (Number.isNaN(version)) return;
        // First event after (re)connect: only refetch if we missed changes.
        if (lastVersion !== null && version !== lastVersion) {
          invalidateAll();
        }
        lastVersion = version;
      });
      // Note: on error EventSource reconnects automatically; no handler needed.
    };

    const onWake = (): void => {
      if (document.visibilityState !== "visible") return;
      // The old connection is likely dead after sleep; replace it and
      // refetch immediately rather than waiting for a version event.
      connect();
      invalidateAll();
    };

    connect();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);
    window.addEventListener("online", onWake);

    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
      window.removeEventListener("online", onWake);
      source?.close();
    };
  }, []);
}
