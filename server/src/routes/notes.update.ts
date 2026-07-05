import { z } from "zod";
import { ResultAsync, ok, err } from "neverthrow";
import { extractTags } from "@note-stream/shared";
import { publicProcedure, unwrapResult } from "../trpc/trpc.js";
import { dbError, notFound } from "../lib/errors.js";
import { nowLocalIso } from "../lib/time.js";
import {
  getNoteById,
  syncNoteAttachments,
  syncNoteTags,
} from "../lib/notes.js";
import { notifyDataChanged } from "../events/events.js";

export const notesUpdateInput = z.object({
  id: z.string().uuid(),
  content: z.string().min(1, "Note content cannot be empty"),
  attachmentIds: z.array(z.string().uuid()).default([]),
});

export const notesUpdate = publicProcedure
  .input(notesUpdateInput)
  .mutation(async ({ ctx, input }) => {
    const now = nowLocalIso();

    const result = ResultAsync.fromPromise(
      ctx.db
        .updateTable("notes")
        .set({ content: input.content, updated_at: now })
        .where("id", "=", input.id)
        .where("deleted_at", "is", null)
        .executeTakeFirst(),
      (cause) => dbError("Failed to update note", cause),
    )
      .andThen((res) =>
        res.numUpdatedRows === 0n
          ? err(notFound(`Note ${input.id} not found`))
          : ok(undefined),
      )
      .andThen(() =>
        syncNoteTags(ctx.db, input.id, extractTags(input.content)),
      )
      .andThen(() =>
        syncNoteAttachments(ctx.db, input.id, input.attachmentIds, now),
      )
      .andThen(() => getNoteById(ctx.db, input.id))
      .map((note) => {
        notifyDataChanged();
        return note;
      });

    return unwrapResult(result);
  });
