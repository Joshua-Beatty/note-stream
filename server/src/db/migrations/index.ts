import type { Migration } from "kysely";
import { migration0001Initial } from "./0001_initial.js";

/**
 * All migrations, embedded in the bundle. Keys determine execution order.
 * Append-only: never edit a shipped migration; add a new numbered file.
 */
export const migrations: Record<string, Migration> = {
  "0001_initial": migration0001Initial,
};
