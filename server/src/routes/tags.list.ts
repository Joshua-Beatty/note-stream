import { ResultAsync } from "neverthrow";
import type { TagCount } from "@note-stream/shared";
import { publicProcedure, unwrapResult } from "../trpc/trpc.js";
import { dbError } from "../lib/errors.js";

/** All tags with live-note counts, over the entire store (never filtered). */
export const tagsList = publicProcedure.query(async ({ ctx }) => {
  const result = ResultAsync.fromPromise(
    ctx.db
      .selectFrom("note_tags")
      .innerJoin("notes", "notes.id", "note_tags.note_id")
      .where("notes.deleted_at", "is", null)
      .select(({ fn }) => ["note_tags.tag", fn.countAll<number>().as("count")])
      .groupBy("note_tags.tag")
      .orderBy("count", "desc")
      .orderBy("note_tags.tag", "asc")
      .execute(),
    (cause) => dbError("Failed to list tags", cause),
  ).map((rows): TagCount[] =>
    rows.map((r) => ({ tag: r.tag, count: Number(r.count) })),
  );

  return unwrapResult(result);
});
