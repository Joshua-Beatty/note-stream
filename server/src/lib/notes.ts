import type { Kysely } from "kysely";
import { ResultAsync, ok, err } from "neverthrow";
import type { Note, Attachment } from "@note-stream/shared";
import type { Database, NotesTable } from "../db/schema.js";
import { dbError, notFound, type AppError } from "./errors.js";

export function attachmentUrl(id: string, filename: string): string {
  return `/user_content/${id}/${encodeURIComponent(filename)}`;
}

/** URL for a PDF attachment's server-rendered thumbnail. */
export function attachmentThumbUrl(id: string): string {
  return `/user_content/${id}/thumb`;
}

type NoteRow = Pick<
  NotesTable,
  "id" | "content" | "created_at" | "updated_at"
>;

/** Loads tags and attachments for a set of note rows and assembles Notes. */
export function assembleNotes(
  db: Kysely<Database>,
  rows: NoteRow[],
): ResultAsync<Note[], AppError> {
  if (rows.length === 0) {
    return ResultAsync.fromSafePromise(Promise.resolve([]));
  }
  const ids = rows.map((r) => r.id);

  return ResultAsync.fromPromise(
    Promise.all([
      db
        .selectFrom("note_tags")
        .select(["note_id", "tag"])
        .where("note_id", "in", ids)
        .execute(),
      db
        .selectFrom("attachments")
        .select(["id", "note_id", "filename", "mime_type", "size_bytes"])
        .where("note_id", "in", ids)
        .where("deleted_at", "is", null)
        .orderBy("created_at", "asc")
        .execute(),
    ]),
    (cause) => dbError("Failed to load note details", cause),
  ).map(([tagRows, attachmentRows]) => {
    const tagsByNote = new Map<string, string[]>();
    for (const t of tagRows) {
      const list = tagsByNote.get(t.note_id) ?? [];
      list.push(t.tag);
      tagsByNote.set(t.note_id, list);
    }
    const attachmentsByNote = new Map<string, Attachment[]>();
    for (const a of attachmentRows) {
      if (a.note_id === null) continue;
      const list = attachmentsByNote.get(a.note_id) ?? [];
      list.push({
        id: a.id,
        filename: a.filename,
        mimeType: a.mime_type,
        sizeBytes: a.size_bytes,
        url: attachmentUrl(a.id, a.filename),
      });
      attachmentsByNote.set(a.note_id, list);
    }
    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tags: (tagsByNote.get(row.id) ?? []).sort(),
      attachments: attachmentsByNote.get(row.id) ?? [],
    }));
  });
}

/** Loads a single live note (with tags and attachments) or NotFound. */
export function getNoteById(
  db: Kysely<Database>,
  id: string,
): ResultAsync<Note, AppError> {
  return ResultAsync.fromPromise(
    db
      .selectFrom("notes")
      .select(["id", "content", "created_at", "updated_at"])
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst(),
    (cause) => dbError("Failed to load note", cause),
  )
    .andThen((row) =>
      row === undefined ? err(notFound(`Note ${id} not found`)) : ok(row),
    )
    .andThen((row) =>
      assembleNotes(db, [row]).andThen((notes) => {
        const note = notes[0];
        return note === undefined
          ? err(dbError("Note assembly returned no result"))
          : ok(note);
      }),
    );
}

/** Rewrites the note_tags rows for a note from its content. */
export function syncNoteTags(
  db: Kysely<Database>,
  noteId: string,
  tags: string[],
): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      await db.deleteFrom("note_tags").where("note_id", "=", noteId).execute();
      if (tags.length > 0) {
        await db
          .insertInto("note_tags")
          .values(tags.map((tag) => ({ note_id: noteId, tag })))
          .execute();
      }
    })(),
    (cause) => dbError("Failed to sync note tags", cause),
  );
}

/**
 * Claims pending attachments for a note: sets note_id on the given ids and
 * soft-deletes any attachments currently on the note that are not in the list.
 */
export function syncNoteAttachments(
  db: Kysely<Database>,
  noteId: string,
  attachmentIds: string[],
  now: string,
): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      // Soft-remove attachments no longer referenced.
      let removeQuery = db
        .updateTable("attachments")
        .set({ deleted_at: now })
        .where("note_id", "=", noteId)
        .where("deleted_at", "is", null);
      if (attachmentIds.length > 0) {
        removeQuery = removeQuery.where("id", "not in", attachmentIds);
      }
      await removeQuery.execute();

      if (attachmentIds.length > 0) {
        // Claim pending uploads (or keep existing ones on this note).
        await db
          .updateTable("attachments")
          .set({ note_id: noteId })
          .where("id", "in", attachmentIds)
          .where("deleted_at", "is", null)
          .where((eb) =>
            eb.or([
              eb("note_id", "is", null),
              eb("note_id", "=", noteId),
            ]),
          )
          .execute();
      }
    })(),
    (cause) => dbError("Failed to sync note attachments", cause),
  );
}
