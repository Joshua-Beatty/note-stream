/** Tagged error union used with neverthrow throughout the server. */

export interface NotFoundError {
  type: "NotFound";
  message: string;
}

export interface ValidationError {
  type: "ValidationFailed";
  message: string;
}

export interface DbError {
  type: "DbError";
  message: string;
  cause?: unknown;
}

export interface FsError {
  type: "FsError";
  message: string;
  cause?: unknown;
}

export interface PayloadTooLargeError {
  type: "PayloadTooLarge";
  message: string;
}

export interface ConfigError {
  type: "ConfigError";
  message: string;
}

export type AppError =
  | NotFoundError
  | ValidationError
  | DbError
  | FsError
  | PayloadTooLargeError
  | ConfigError;

export const notFound = (message: string): NotFoundError => ({
  type: "NotFound",
  message,
});

export const validationFailed = (message: string): ValidationError => ({
  type: "ValidationFailed",
  message,
});

export const dbError = (message: string, cause?: unknown): DbError => ({
  type: "DbError",
  message,
  cause,
});

export const fsError = (message: string, cause?: unknown): FsError => ({
  type: "FsError",
  message,
  cause,
});

export const payloadTooLarge = (message: string): PayloadTooLargeError => ({
  type: "PayloadTooLarge",
  message,
});

export const configError = (message: string): ConfigError => ({
  type: "ConfigError",
  message,
});

/** Maps an AppError to an HTTP status code (for non-tRPC endpoints). */
export function appErrorToHttpStatus(error: AppError): number {
  switch (error.type) {
    case "NotFound":
      return 404;
    case "ValidationFailed":
      return 400;
    case "PayloadTooLarge":
      return 413;
    case "DbError":
    case "FsError":
    case "ConfigError":
      return 500;
  }
}

/** Maps an AppError to a tRPC error code. */
export function appErrorToTrpcCode(
  error: AppError,
):
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_SERVER_ERROR" {
  switch (error.type) {
    case "NotFound":
      return "NOT_FOUND";
    case "ValidationFailed":
      return "BAD_REQUEST";
    case "PayloadTooLarge":
      return "PAYLOAD_TOO_LARGE";
    case "DbError":
    case "FsError":
    case "ConfigError":
      return "INTERNAL_SERVER_ERROR";
  }
}
