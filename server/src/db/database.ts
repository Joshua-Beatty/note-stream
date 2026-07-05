import SqliteDatabase from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { Result } from "neverthrow";
import fs from "node:fs";
import path from "node:path";
import { dbError, type AppError } from "../lib/errors.js";
import type { Database } from "./schema.js";

/**
 * Opens (creating if necessary) the SQLite database at dbPath and returns a
 * configured Kysely instance. Pass ":memory:" for tests.
 */
export function openDatabase(dbPath: string): Result<Kysely<Database>, AppError> {
  return Result.fromThrowable(
    () => {
      if (dbPath !== ":memory:") {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }
      const sqlite = new SqliteDatabase(dbPath);
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      sqlite.pragma("busy_timeout = 5000");
      return new Kysely<Database>({
        dialect: new SqliteDialect({ database: sqlite }),
      });
    },
    (cause) => dbError(`Failed to open database at ${dbPath}`, cause),
  )();
}
