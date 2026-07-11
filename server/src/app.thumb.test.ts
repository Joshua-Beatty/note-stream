import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v7 as uuidv7 } from "uuid";
import type { Kysely } from "kysely";
import { createApp } from "./app.js";
import { createTestDb, createTestEnv } from "./test/helpers.js";
import type { Database } from "./db/schema.js";
import type { Env } from "./env.js";
import { nowLocalIso } from "./lib/time.js";
import { _clearThumbnailCache } from "./lib/pdfThumbnail.js";

const SAMPLE_PDF = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "test",
  "fixtures",
  "sample.pdf",
);

/** Inserts an attachment row and writes a file into the user_content dir. */
async function addAttachment(
  db: Kysely<Database>,
  env: Env,
  opts: {
    filename: string;
    mimeType: string;
    contentPath?: string;
    content?: string;
    deleted?: boolean;
  },
): Promise<string> {
  const id = uuidv7();
  const dir = path.join(env.userContentDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, opts.filename);
  if (opts.contentPath !== undefined) {
    fs.copyFileSync(opts.contentPath, dest);
  } else {
    fs.writeFileSync(dest, opts.content ?? "");
  }
  await db
    .insertInto("attachments")
    .values({
      id,
      note_id: null,
      filename: opts.filename,
      mime_type: opts.mimeType,
      size_bytes: fs.statSync(dest).size,
      created_at: nowLocalIso(),
      deleted_at: opts.deleted === true ? nowLocalIso() : null,
    })
    .execute();
  return id;
}

describe("PDF thumbnail route", () => {
  beforeEach(() => {
    _clearThumbnailCache();
  });

  it("renders a WebP thumbnail for a PDF attachment", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const id = await addAttachment(db, env, {
      filename: "sample.pdf",
      mimeType: "application/pdf",
      contentPath: SAMPLE_PDF,
    });

    const res = await app.request(`/user_content/${id}/thumb`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(0);
    // RIFF....WEBP container magic.
    expect(buf.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buf.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("serves a cached thumbnail on a second request", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const id = await addAttachment(db, env, {
      filename: "sample.pdf",
      mimeType: "application/pdf",
      contentPath: SAMPLE_PDF,
    });

    const first = await app.request(`/user_content/${id}/thumb`);
    const firstBytes = Buffer.from(await first.arrayBuffer());
    const second = await app.request(`/user_content/${id}/thumb`);
    const secondBytes = Buffer.from(await second.arrayBuffer());
    expect(second.status).toBe(200);
    expect(secondBytes.equals(firstBytes)).toBe(true);
  });

  it("404s for a non-PDF attachment", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const id = await addAttachment(db, env, {
      filename: "note.txt",
      mimeType: "text/plain",
      content: "not a pdf",
    });

    const res = await app.request(`/user_content/${id}/thumb`);
    expect(res.status).toBe(404);
  });

  it("404s for a soft-deleted attachment", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const id = await addAttachment(db, env, {
      filename: "sample.pdf",
      mimeType: "application/pdf",
      contentPath: SAMPLE_PDF,
      deleted: true,
    });

    const res = await app.request(`/user_content/${id}/thumb`);
    expect(res.status).toBe(404);
  });

  it("404s for an unknown id", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const res = await app.request(`/user_content/${uuidv7()}/thumb`);
    expect(res.status).toBe(404);
  });

  it("404s for a malformed id", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const res = await app.request(`/user_content/not-a-uuid/thumb`);
    expect(res.status).toBe(404);
  });

  it("404s when the PDF is recorded but missing on disk", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const id = uuidv7();
    await db
      .insertInto("attachments")
      .values({
        id,
        note_id: null,
        filename: "gone.pdf",
        mime_type: "application/pdf",
        size_bytes: 100,
        created_at: nowLocalIso(),
        deleted_at: null,
      })
      .execute();

    const res = await app.request(`/user_content/${id}/thumb`);
    expect(res.status).toBe(404);
  });
});

describe("file-serving route Content-Type", () => {
  it("serves a PDF with its stored application/pdf MIME type", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    const id = await addAttachment(db, env, {
      filename: "sample.pdf",
      mimeType: "application/pdf",
      contentPath: SAMPLE_PDF,
    });

    const res = await app.request(`/user_content/${id}/sample.pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("falls back to octet-stream for an unrecorded file", async () => {
    const db = await createTestDb();
    const env = createTestEnv();
    const app = createApp(db, env);
    // Write a file on disk without a matching DB row.
    const id = uuidv7();
    const dir = path.join(env.userContentDir, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "orphan.bin"), "data");

    const res = await app.request(`/user_content/${id}/orphan.bin`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
  });
});
