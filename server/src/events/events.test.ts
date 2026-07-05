import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  eventsHandler,
  notifyDataChanged,
  resetEventBus,
  getDataVersion,
  subscriberCount,
} from "./events.js";
import { createTestCaller } from "../test/helpers.js";

function makeApp() {
  const app = new Hono();
  app.get("/api/events", eventsHandler);
  return app;
}

/** Reads SSE frames from a response body until predicate matches or timeout. */
async function readUntil(
  res: Response,
  predicate: (buffer: string) => boolean,
  timeoutMs = 2000,
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline && !predicate(buffer)) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("read timeout")), deadline - Date.now()),
        ),
      ]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return buffer;
}

beforeEach(() => {
  resetEventBus();
});

describe("GET /api/events", () => {
  it("responds with an SSE stream and sends the current version on connect", async () => {
    const app = makeApp();
    const res = await app.request("/api/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const body = await readUntil(res, (b) => b.includes("data: 0"));
    expect(body).toContain("event: data-version");
    expect(body).toContain("data: 0");
  });

  it("broadcasts a new version when notifyDataChanged is called", async () => {
    const app = makeApp();
    const res = await app.request("/api/events");

    const received = readUntil(res, (b) => b.includes("data: 1"));
    // Wait for subscription to register before notifying.
    await new Promise((r) => setTimeout(r, 50));
    notifyDataChanged();

    const body = await received;
    expect(body).toContain("data: 1");
  });

  it("increments the version on every change", () => {
    expect(getDataVersion()).toBe(0);
    notifyDataChanged();
    notifyDataChanged();
    expect(getDataVersion()).toBe(2);
  });

  it("removes subscribers after the stream is cancelled", async () => {
    const app = makeApp();
    const res = await app.request("/api/events");
    await readUntil(res, (b) => b.includes("data: 0"));
    // readUntil cancels the reader; give cleanup a moment.
    await new Promise((r) => setTimeout(r, 100));
    expect(subscriberCount()).toBe(0);
  });
});

describe("mutation integration", () => {
  it("bumps the data version on create, update, and delete", async () => {
    const { caller } = await createTestCaller();
    expect(getDataVersion()).toBe(0);

    const note = await caller.notes.create({
      content: "live",
      attachmentIds: [],
    });
    expect(getDataVersion()).toBe(1);

    await caller.notes.update({
      id: note.id,
      content: "live v2",
      attachmentIds: [],
    });
    expect(getDataVersion()).toBe(2);

    await caller.notes.delete({ id: note.id });
    expect(getDataVersion()).toBe(3);
  });

  it("does not bump the version on failed mutations", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.notes.delete({ id: "01920000-0000-7000-8000-00000000dead" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getDataVersion()).toBe(0);
  });
});
