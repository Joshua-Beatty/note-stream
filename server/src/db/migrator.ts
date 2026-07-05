import {
  Migrator,
  type Kysely,
  type MigrationProvider,
  type Migration,
} from "kysely";
import { ResultAsync, ok, err } from "neverthrow";
import { migrations } from "./migrations/index.js";
import { dbError, type AppError } from "../lib/errors.js";
import type { Database } from "./schema.js";

/** Embedded provider: returns the statically imported migration record. */
class EmbeddedMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}

/** Runs all pending migrations. Fails fast on any error. */
export function migrateToLatest(
  db: Kysely<Database>,
): ResultAsync<void, AppError> {
  const migrator = new Migrator({
    db,
    provider: new EmbeddedMigrationProvider(),
  });

  return ResultAsync.fromPromise(migrator.migrateToLatest(), (cause) =>
    dbError("Migration run failed", cause),
  ).andThen(({ error, results }) => {
    if (error !== undefined) {
      const failed = results?.find((r) => r.status === "Error");
      return err(
        dbError(
          `Migration ${failed?.migrationName ?? "unknown"} failed`,
          error,
        ),
      );
    }
    return ok(undefined);
  });
}
