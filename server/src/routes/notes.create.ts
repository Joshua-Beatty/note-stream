import { z } from "zod";
import { ResultAsync } from "neverthrow";
import { v7 as uuidv7 } from "uuid";
import { extractTags } from "@note-stream/shared";
import { publicProcedure, unwrapResult } from "../trpc/trpc.js";
import { dbError } from "../lib/errors.js";
import { nowLocalIso } from "../lib/time.js";
import {
  getNoteById,
  syncNoteAttachments,
  syncNoteTags,
} from "../lib/notes.js";

export const notesCreateInput = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
  attachmentIds: z.array(z.string().uuid()).default([]),
});

export const notesCreate = publicProcedure
  .input(notesCreateInput)
  .mutation(async ({ ctx, input }) => {
    const id = uuidv7();
    const now = nowLocalIso();

    const result = ResultAsync.fromPromise(
      ctx.db
        .insertInto("notes")
        .values({
          id,
          content: input.content,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .execute(),
      (cause) => dbError("Failed to insert note", cause),
    )
      .andThen(() => syncNoteTags(ctx.db, id, extractTags(input.content)))
      .andThen(() =>
        syncNoteAttachments(ctx.db, id, input.attachmentIds, now),
      )
      .andThen(() => getNoteById(ctx.db, id));

    return unwrapResult(result);
  });
