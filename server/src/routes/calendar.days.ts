import { z } from "zod";
import { ResultAsync } from "neverthrow";
import { sql } from "kysely";
import { publicProcedure, unwrapResult } from "../trpc/trpc.js";
import { dbError } from "../lib/errors.js";

export const calendarDaysInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM"),
});

/**
 * Server-local dates (YYYY-MM-DD) in the given month that have at least one
 * live note. Never filtered by the current stream filters.
 */
export const calendarDays = publicProcedure
  .input(calendarDaysInput)
  .query(async ({ ctx, input }) => {
    const day = sql<string>`substr(created_at, 1, 10)`;
    const result = ResultAsync.fromPromise(
      ctx.db
        .selectFrom("notes")
        .where("deleted_at", "is", null)
        .where(sql<string>`substr(created_at, 1, 7)`, "=", input.month)
        .select(day.as("day"))
        .groupBy(day)
        .orderBy(day)
        .execute(),
      (cause) => dbError("Failed to load calendar days", cause),
    ).map((rows) => rows.map((r) => r.day));

    return unwrapResult(result);
  });
