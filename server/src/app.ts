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

    const stream = fs.createReadStream(filePath);
    const headers = new Headers({
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
