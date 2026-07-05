import type { Kysely } from "kysely";
import type { Database } from "../db/schema.js";
import type { Env } from "../env.js";

// A type alias (not an interface) so it satisfies Record<string, unknown>
// as required by @hono/trpc-server's createContext option.
export type Context = {
  db: Kysely<Database>;
  env: Env;
};

export function createContextFactory(db: Kysely<Database>, env: Env) {
  return function createContext(): Context {
    return { db, env };
  };
}
