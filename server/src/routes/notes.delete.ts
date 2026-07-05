import { z } from "zod";
import { ResultAsync, ok, err } from "neverthrow";
import { publicProcedure, unwrapResult } from "../trpc/trpc.js";
import { dbError, notFound } from "../lib/errors.js";
import { nowLocalIso } from "../lib/time.js";

export const notesDeleteInput = z.object({
  id: z.string().uuid(),
});

export const notesDelete = publicProcedure
  .input(notesDeleteInput)
  .mutation(async ({ ctx, input }) => {
    const now = nowLocalIso();

    const result = ResultAsync.fromPromise(
      (async () => {
        const res = await ctx.db
          .updateTable("notes")
          // Soft delete. Set content sync via trigger removes it from FTS.
          .set({ deleted_at: now, updated_at: now })
          .where("id", "=", input.id)
          .where("deleted_at", "is", null)
          .executeTakeFirst();
        if (res.numUpdatedRows === 0n) {
          return null;
        }
        await ctx.db
          .updateTable("attachments")
          .set({ deleted_at: now })
          .where("note_id", "=", input.id)
          .where("deleted_at", "is", null)
          .execute();
        // Remove tag rows so tag counts stay accurate.
        await ctx.db
          .deleteFrom("note_tags")
          .where("note_id", "=", input.id)
          .execute();
        return { id: input.id };
      })(),
      (cause) => dbError("Failed to delete note", cause),
    ).andThen((res) =>
      res === null ? err(notFound(`Note ${input.id} not found`)) : ok(res),
    );

    return unwrapResult(result);
  });
