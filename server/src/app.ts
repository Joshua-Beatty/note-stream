import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { serveStatic } from "@hono/node-server/serve-static";
import path from "node:path";
import fs from "node:fs";
import type { Kysely } from "kysely";
import type { Database } from "./db/schema.js";
import type { Env } from "./env.js";
import { appRouter } from "./trpc/router.js";
import { createContextFactory } from "./trpc/context.js";
import { createUploadHandler, sanitizeFilename } from "./upload/upload.js";
import { eventsHandler } from "./events/events.js";
import { getPdfThumbnail } from "./lib/pdfThumbnail.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createApp(db: Kysely<Database>, env: Env): Hono {
  const app = new Hono();
  const createContext = createContextFactory(db, env);

  app.use(
    "/api/trpc/*",
    trpcServer({
      router: appRouter,
      endpoint: "/api/trpc",
      createContext,
    }),
  );

  app.post("/api/upload", createUploadHandler(db, env));

  // Live updates: SSE stream of data-version events.
  app.get("/api/events", eventsHandler);

  // PDF thumbnails: /user_content/{uuid}/thumb -> first page as WebP.
  // Registered before the generic file route so "thumb" isn't treated as a
  // filename. Generation is on-demand and cached in-memory (see pdfThumbnail).
  app.get("/user_content/:id/thumb", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) {
      return c.notFound();
    }

    const attachment = await db
      .selectFrom("attachments")
      .select(["filename", "mime_type"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (attachment === undefined || attachment.mime_type !== "application/pdf") {
      return c.notFound();
    }

    const safeName = sanitizeFilename(attachment.filename);
    const filePath = path.join(env.userContentDir, id, safeName);
    if (!filePath.startsWith(env.userContentDir + path.sep)) {
      return c.notFound();
    }

    const result = await getPdfThumbnail(id, filePath);
    if (result.isErr()) {
      // Best-effort: on failure the client falls back to a generic icon.
      return c.notFound();
    }

    return new Response(new Blob([new Uint8Array(result.value)]), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(result.value.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  // Uploaded files: /user_content/{uuid}/{filename}
  app.get("/user_content/:id/:filename", async (c) => {
    const id = c.req.param("id");
    const filename = c.req.param("filename");
    if (!UUID_RE.test(id)) {
      return c.notFound();
    }
    // Re-sanitize; combined with the uuid dir this prevents traversal.
    const safeName = sanitizeFilename(decodeURIComponent(filename));
    const filePath = path.join(env.userContentDir, id, safeName);
    if (!filePath.startsWith(env.userContentDir + path.sep)) {
      return c.notFound();
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return c.notFound();
    }
    if (!stat.isFile()) {
      return c.notFound();
    }

    // Serve the stored MIME type so browsers render (e.g.) PDFs inline in an
    // iframe rather than guessing and showing the raw bytes as text.
    const record = await db
      .selectFrom("attachments")
      .select("mime_type")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    const contentType = record?.mime_type ?? "application/octet-stream";

    const stream = fs.createReadStream(filePath);
    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    if (c.req.query("download") !== undefined) {
      headers.set(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      );
    }
    return new Response(
      // Node stream -> web stream
      (await import("node:stream")).Readable.toWeb(
        stream,
      ) as ReadableStream,
      { headers },
    );
  });

  // Static client build with SPA fallback.
  if (env.staticDir !== "" && fs.existsSync(env.staticDir)) {
    const relativeRoot = path.relative(process.cwd(), env.staticDir);
    app.use(
      "/*",
      serveStatic({
        root: relativeRoot,
      }),
    );
    app.get("*", (c) => {
      const indexPath = path.join(env.staticDir, "index.html");
      if (fs.existsSync(indexPath)) {
        return c.html(fs.readFileSync(indexPath, "utf-8"));
      }
      return c.notFound();
    });
  }

  return app;
}
