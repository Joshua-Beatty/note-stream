import type { Context as HonoContext } from "hono";
import { ResultAsync, ok, err } from "neverthrow";
import { v7 as uuidv7 } from "uuid";
import path from "node:path";
import type { Kysely } from "kysely";
import type { UploadedFile } from "@note-stream/shared";
import type { Database } from "../db/schema.js";
import type { Env } from "../env.js";
import {
  appErrorToHttpStatus,
  dbError,
  payloadTooLarge,
  validationFailed,
  type AppError,
} from "../lib/errors.js";
import { mkdir, writeFile } from "../lib/fs.js";
import { nowLocalIso } from "../lib/time.js";
import { attachmentUrl } from "../lib/notes.js";

/** Strips any path components / traversal from a client-supplied filename. */
export function sanitizeFilename(name: string): string {
  const base = path.basename(name.replaceAll("\\", "/")).trim();
  const cleaned = base.replaceAll(/[\0<>:"|?*]/g, "_");
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    return "file";
  }
  return cleaned;
}

function saveOne(
  db: Kysely<Database>,
  env: Env,
  file: File,
): ResultAsync<UploadedFile, AppError> {
  if (file.size > env.maxFileSizeBytes) {
    return ResultAsync.fromSafePromise(Promise.resolve(null)).andThen(() =>
      err(
        payloadTooLarge(
          `File "${file.name}" exceeds the ${Math.floor(env.maxFileSizeBytes / (1024 * 1024))}MB limit`,
        ),
      ),
    );
  }

  const id = uuidv7();
  const filename = sanitizeFilename(file.name);
  const dir = path.join(env.userContentDir, id);
  const now = nowLocalIso();

  return mkdir(dir)
    .andThen(() =>
      ResultAsync.fromPromise(
        file.arrayBuffer(),
        (cause): AppError => ({
          type: "FsError",
          message: "Failed to read uploaded file",
          cause,
        }),
      ),
    )
    .andThen((buf) => writeFile(path.join(dir, filename), new Uint8Array(buf)))
    .andThen(() =>
      ResultAsync.fromPromise(
        db
          .insertInto("attachments")
          .values({
            id,
            note_id: null,
            filename,
            mime_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            created_at: now,
            deleted_at: null,
          })
          .execute(),
        (cause) => dbError("Failed to record attachment", cause),
      ),
    )
    .map(
      (): UploadedFile => ({
        id,
        filename,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        url: attachmentUrl(id, filename),
      }),
    );
}

export function createUploadHandler(db: Kysely<Database>, env: Env) {
  return async (c: HonoContext): Promise<Response> => {
    const result = await ResultAsync.fromPromise(
      c.req.formData(),
      (): AppError => validationFailed("Invalid multipart form data"),
    )
      .andThen((form) => {
        const files = form
          .getAll("files")
          .filter((f): f is File => f instanceof File);
        if (files.length === 0) {
          return err(validationFailed('No files provided (field "files")'));
        }
        if (files.length > env.maxFilesPerNote) {
          return err(
            validationFailed(
              `Too many files: max ${env.maxFilesPerNote} per note`,
            ),
          );
        }
        return ok(files);
      })
      .andThen((files) =>
        ResultAsync.combine(files.map((f) => saveOne(db, env, f))),
      );

    if (result.isErr()) {
      const error = result.error;
      if (error.type === "DbError" || error.type === "FsError") {
        console.error(`[${error.type}] ${error.message}`, error.cause ?? "");
      }
      return c.json(
        { error: error.message },
        appErrorToHttpStatus(error) as 400,
      );
    }
    return c.json({ files: result.value });
  };
}

/**
 * Soft-deletes pending attachments (note_id IS NULL) older than maxAgeHours.
 * Run once on boot.
 */
export function sweepOrphanedUploads(
  db: Kysely<Database>,
  maxAgeHours = 24,
): ResultAsync<number, AppError> {
  const cutoff = nowLocalIso(new Date(Date.now() - maxAgeHours * 3600 * 1000));
  return ResultAsync.fromPromise(
    db
      .updateTable("attachments")
      .set({ deleted_at: nowLocalIso() })
      .where("note_id", "is", null)
      .where("deleted_at", "is", null)
      .where("created_at", "<", cutoff)
      .executeTakeFirst(),
    (cause) => dbError("Failed to sweep orphaned uploads", cause),
  ).map((res) => Number(res.numUpdatedRows));
}
