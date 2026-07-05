import { serve } from "@hono/node-server";
import { parseEnv } from "./env.js";
import { openDatabase } from "./db/database.js";
import { migrateToLatest } from "./db/migrator.js";
import { createApp } from "./app.js";
import { sweepOrphanedUploads } from "./upload/upload.js";
import { mkdir } from "./lib/fs.js";

async function main(): Promise<void> {
  const boot = await parseEnv()
    .asyncAndThen((env) =>
      openDatabase(env.dbPath)
        .asyncAndThen((db) => migrateToLatest(db).map(() => ({ env, db })))
        .andThen(({ env, db }) =>
          mkdir(env.userContentDir).map(() => ({ env, db })),
        )
        .andThen(({ env, db }) =>
          sweepOrphanedUploads(db).map((swept) => {
            if (swept > 0) {
              console.log(`Swept ${swept} orphaned upload(s)`);
            }
            return { env, db };
          }),
        ),
    );

  if (boot.isErr()) {
    console.error(
      `Fatal startup error [${boot.error.type}]: ${boot.error.message}`,
      "cause" in boot.error ? (boot.error.cause ?? "") : "",
    );
    process.exit(1);
  }

  const { env, db } = boot.value;
  const app = createApp(db, env);

  serve({ fetch: app.fetch, port: env.port }, (info) => {
    console.log(`note-stream listening on http://localhost:${info.port}`);
    console.log(`Data directory: ${env.dataDir}`);
  });
}

void main();
