import { initTRPC, TRPCError } from "@trpc/server";
import type { ResultAsync } from "neverthrow";
import { appErrorToTrpcCode, type AppError } from "../lib/errors.js";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * The single boundary where neverthrow Results become tRPC errors.
 * Route handlers return ResultAsync; this unwraps ok values and maps err
 * values to TRPCError with the proper code.
 */
export async function unwrapResult<T>(
  result: ResultAsync<T, AppError>,
): Promise<T> {
  const r = await result;
  if (r.isErr()) {
    const error = r.error;
    if (
      error.type === "DbError" ||
      error.type === "FsError" ||
      error.type === "ConfigError"
    ) {
      // Log internal causes server-side; don't leak them to clients.
      console.error(
        `[${error.type}] ${error.message}`,
        "cause" in error ? (error.cause ?? "") : "",
      );
    }
    throw new TRPCError({
      code: appErrorToTrpcCode(error),
      message: error.message,
    });
  }
  return r.value;
}
