import type { Kysely } from "kysely";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "../db/schema.js";
import { openDatabase } from "../db/database.js";
import { migrateToLatest } from "../db/migrator.js";
import type { Env } from "../env.js";
import { appRouter } from "../trpc/router.js";

/** Fresh in-memory database with all migrations applied. */
export async function createTestDb(): Promise<Kysely<Database>> {
  const dbResult = openDatabase(":memory:");
  if (dbResult.isErr()) {
    throw new Error(`Failed to open test db: ${dbResult.error.message}`);
  }
  const db = dbResult.value;
  const migrated = await migrateToLatest(db);
  if (migrated.isErr()) {
    throw new Error(`Failed to migrate test db: ${migrated.error.message}`);
  }
  return db;
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "note-stream-test-"));
  return {
    port: 0,
    dataDir,
    dbPath: ":memory:",
    userContentDir: path.join(dataDir, "user_content"),
    maxFileSizeBytes: 100 * 1024 * 1024,
    maxFilesPerNote: 20,
    staticDir: "",
    ...overrides,
  };
}

/** A tRPC caller wired to a fresh test database. */
export async function createTestCaller(overrides: Partial<Env> = {}) {
  const db = await createTestDb();
  const env = createTestEnv(overrides);
  const caller = appRouter.createCaller({ db, env });
  return { caller, db, env };
}
