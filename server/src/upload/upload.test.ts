import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { createTestDb, createTestEnv } from "../test/helpers.js";
import {
  createUploadHandler,
  sanitizeFilename,
  sweepOrphanedUploads,
} from "./upload.js";
import { nowLocalIso } from "../lib/time.js";

async function setup(envOverrides = {}) {
  const db = await createTestDb();
  const env = createTestEnv(envOverrides);
  const app = new Hono();
  app.post("/api/upload", createUploadHandler(db, env));
  return { db, env, app };
}

function makeForm(files: Array<{ name: string; content: string; type?: string }>) {
  const form = new FormData();
  for (const f of files) {
    form.append(
      "files",
      new File([f.content], f.name, { type: f.type ?? "text/plain" }),
    );
  }
  return form;
}

describe("upload handler", () => {
  it("uploads a file, writes it to disk, and records a pending attachment", async () => {
    const { db, env, app } = await setup();
    const res = await app.request("/api/upload", {
      method: "POST",
      body: makeForm([{ name: "hello.txt", content: "hi there" }]),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      files: Array<{ id: string; filename: string; url: string }>;
    };
    expect(body.files).toHaveLength(1);
    const file = body.files[0]!;
    expect(file.filename).toBe("hello.txt");

    const onDisk = fs.readFileSync(
      path.join(env.userContentDir, file.id, "hello.txt"),
      "utf-8",
    );
    expect(onDisk).toBe("hi there");

    const row = await db
      .selectFrom("attachments")
      .selectAll()
      .where("id", "=", file.id)
      .executeTakeFirst();
    expect(row?.note_id).toBeNull();
    expect(row?.size_bytes).toBe(8);
  });

  it("uploads multiple files at once", async () => {
    const { app } = await setup();
    const res = await app.request("/api/upload", {
      method: "POST",
      body: makeForm([
        { name: "a.txt", content: "aaa" },
        { name: "b.txt", content: "bbb" },
      ]),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { files: unknown[] };
    expect(body.files).toHaveLength(2);
  });

  it("rejects an empty upload", async () => {
    const { app } = await setup();
    const res = await app.request("/api/upload", {
      method: "POST",
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  it("rejects files over the size limit", async () => {
    const { app } = await setup({ maxFileSizeBytes: 4 });
    const res = await app.request("/api/upload", {
      method: "POST",
      body: makeForm([{ name: "big.txt", content: "too big for limit" }]),
    });
    expect(res.status).toBe(413);
  });

  it("rejects too many files", async () => {
    const { app } = await setup({ maxFilesPerNote: 1 });
    const res = await app.request("/api/upload", {
      method: "POST",
      body: makeForm([
        { name: "a.txt", content: "a" },
        { name: "b.txt", content: "b" },
      ]),
    });
    expect(res.status).toBe(400);
  });

  it("sanitizes path traversal in filenames", async () => {
    const { env, app } = await setup();
    const res = await app.request("/api/upload", {
      method: "POST",
      body: makeForm([{ name: "../../evil.txt", content: "nope" }]),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      files: Array<{ id: string; filename: string }>;
    };
    expect(body.files[0]!.filename).toBe("evil.txt");
    expect(
      fs.existsSync(path.join(env.userContentDir, body.files[0]!.id, "evil.txt")),
    ).toBe(true);
  });
});

describe("sanitizeFilename", () => {
  it("strips directories", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\windows\\evil.exe")).toBe("evil.exe");
  });

  it("replaces reserved characters", () => {
    expect(sanitizeFilename('a<b>:c"|?*.txt')).toBe("a_b__c____.txt");
  });

  it("falls back for empty or dot names", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("..")).toBe("file");
  });
});

describe("sweepOrphanedUploads", () => {
  it("soft-deletes old pending attachments but keeps recent and claimed ones", async () => {
    const db = await createTestDb();
    const old = nowLocalIso(new Date(Date.now() - 48 * 3600 * 1000));
    const recent = nowLocalIso();
    await db
      .insertInto("attachments")
      .values([
        {
          id: "old-pending",
          note_id: null,
          filename: "a.txt",
          mime_type: "text/plain",
          size_bytes: 1,
          created_at: old,
          deleted_at: null,
        },
        {
          id: "recent-pending",
          note_id: null,
          filename: "b.txt",
          mime_type: "text/plain",
          size_bytes: 1,
          created_at: recent,
          deleted_at: null,
        },
      ])
      .execute();

    const swept = await sweepOrphanedUploads(db, 24);
    expect(swept._unsafeUnwrap()).toBe(1);

    const rows = await db.selectFrom("attachments").selectAll().execute();
    expect(
      rows.find((r) => r.id === "old-pending")?.deleted_at,
    ).not.toBeNull();
    expect(rows.find((r) => r.id === "recent-pending")?.deleted_at).toBeNull();
  });
});
