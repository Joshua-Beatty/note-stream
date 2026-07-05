import type { Context as HonoContext } from "hono";
import { streamSSE } from "hono/streaming";

/**
 * In-process event bus for live updates. The app is single-process by
 * design, so a module-level subscriber set is sufficient.
 *
 * Clients connect to GET /api/events (SSE) and receive a `data-version`
 * event on connect and after every mutation. The version is a monotonically
 * increasing counter — clients invalidate their queries whenever it changes.
 */

type Subscriber = (version: number) => void;

const subscribers = new Set<Subscriber>();
let dataVersion = 0;

export function getDataVersion(): number {
  return dataVersion;
}

/** Called by mutation routes after a successful write. */
export function notifyDataChanged(): void {
  dataVersion += 1;
  for (const notify of subscribers) {
    notify(dataVersion);
  }
}

/** Test-only: reset module state between tests. */
export function resetEventBus(): void {
  subscribers.clear();
  dataVersion = 0;
}

export function subscriberCount(): number {
  return subscribers.size;
}

const HEARTBEAT_MS = 25_000;

export function eventsHandler(c: HonoContext): Response {
  return streamSSE(c, async (stream) => {
    let resolveClosed: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });

    const send = (version: number): void => {
      void stream
        .writeSSE({
          event: "data-version",
          data: String(version),
          id: String(version),
        })
        .catch(() => resolveClosed());
    };

    subscribers.add(send);

    // Proxies and browsers may idle-kill silent streams; heartbeat comments
    // keep the connection alive without triggering client events.
    const heartbeat = setInterval(() => {
      void stream.write(`: heartbeat\n\n`).catch(() => resolveClosed());
    }, HEARTBEAT_MS);

    stream.onAbort(() => resolveClosed());

    // Initial version so clients can detect missed changes on reconnect.
    send(dataVersion);

    await closed;
    clearInterval(heartbeat);
    subscribers.delete(send);
  });
}
