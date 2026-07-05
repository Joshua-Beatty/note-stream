import { z } from "zod";
import { ResultAsync } from "neverthrow";
import { sql } from "kysely";
import type { NotesPage } from "@note-stream/shared";
import { publicProcedure, unwrapResult } from "../trpc/trpc.js";
import { dbError } from "../lib/errors.js";
import { assembleNotes } from "../lib/notes.js";

export const notesListInput = z.object({
  cursor: z
    .object({ createdAt: z.string(), id: z.string() })
    .nullish(),
  limit: z.number().int().min(1).max(100).default(50),
  search: z.string().trim().min(1).optional(),
  tags: z.array(z.string().min(1)).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
    .optional(),
});

/**
 * Escapes user input for FTS5 MATCH: each whitespace-separated term becomes a
 * quoted prefix query, so users get intuitive substring-ish search without
 * being able to inject FTS syntax.
 */
export function buildFtsQuery(search: string): string {
  return search
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"*`)
    .join(" ");
}

export const notesList = publicProcedure
  .input(notesListInput)
  .query(async ({ ctx, input }) => {
    const { cursor, limit, search, tags, date } = input;

    const result = ResultAsync.fromPromise(
      (async () => {
        let query = ctx.db
          .selectFrom("notes")
          .select(["id", "content", "created_at", "updated_at"])
          .where("deleted_at", "is", null)
          .orderBy("created_at", "desc")
          .orderBy("id", "desc")
          .limit(limit + 1);

        if (cursor !== null && cursor !== undefined) {
          query = query.where((eb) =>
            eb.or([
              eb("created_at", "<", cursor.createdAt),
              eb.and([
                eb("created_at", "=", cursor.createdAt),
                eb("id", "<", cursor.id),
              ]),
            ]),
          );
        }

        if (search !== undefined) {
          const fts = buildFtsQuery(search);
          if (fts.length > 0) {
            query = query.where(
              sql<boolean>`notes.rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ${fts})`,
            );
          }
        }

        if (tags !== undefined && tags.length > 0) {
          // AND semantics: note must have every selected tag.
          for (const tag of tags) {
            query = query.where("id", "in", (eb) =>
              eb
                .selectFrom("note_tags")
                .select("note_id")
                .where("tag", "=", tag.toLowerCase()),
            );
          }
        }

        if (date !== undefined) {
          // created_at is stored as server-local ISO; first 10 chars = date.
          query = query.where(sql<string>`substr(created_at, 1, 10)`, "=", date);
        }

        return query.execute();
      })(),
      (cause) => dbError("Failed to list notes", cause),
    ).andThen((rows) => {
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;
      return assembleNotes(ctx.db, page).map((notes): NotesPage => {
        const last = page[page.length - 1];
        return {
          notes,
          nextCursor:
            hasMore && last !== undefined
              ? { createdAt: last.created_at, id: last.id }
              : null,
        };
      });
    });

    return unwrapResult(result);
  });
