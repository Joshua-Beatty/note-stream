import { Result, ok, err } from "neverthrow";
import { z } from "zod";
import path from "node:path";
import { configError, type AppError } from "./lib/errors.js";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATA_DIR: z.string().default("./data"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(100),
  MAX_FILES_PER_NOTE: z.coerce.number().int().positive().default(20),
  /** Directory of built client files to serve; empty disables static serving. */
  STATIC_DIR: z.string().default(""),
});

export interface Env {
  port: number;
  dataDir: string;
  dbPath: string;
  userContentDir: string;
  maxFileSizeBytes: number;
  maxFilesPerNote: number;
  staticDir: string;
}

export function parseEnv(
  raw: Record<string, string | undefined> = process.env,
): Result<Env, AppError> {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    return err(
      configError(
        `Invalid environment: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      ),
    );
  }
  const dataDir = path.resolve(parsed.data.DATA_DIR);
  return ok({
    port: parsed.data.PORT,
    dataDir,
    dbPath: path.join(dataDir, "notes.db"),
    userContentDir: path.join(dataDir, "user_content"),
    maxFileSizeBytes: Math.floor(parsed.data.MAX_FILE_SIZE_MB * 1024 * 1024),
    maxFilesPerNote: parsed.data.MAX_FILES_PER_NOTE,
    staticDir: parsed.data.STATIC_DIR
      ? path.resolve(parsed.data.STATIC_DIR)
      : "",
  });
}
