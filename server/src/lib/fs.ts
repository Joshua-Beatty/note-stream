import { ResultAsync } from "neverthrow";
import fs from "node:fs/promises";
import { fsError, type AppError } from "./errors.js";

export function mkdir(dir: string): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(
    fs.mkdir(dir, { recursive: true }).then(() => undefined),
    (cause) => fsError(`Failed to create directory ${dir}`, cause),
  );
}

export function writeFile(
  filePath: string,
  data: Uint8Array,
): ResultAsync<void, AppError> {
  return ResultAsync.fromPromise(fs.writeFile(filePath, data), (cause) =>
    fsError(`Failed to write file ${filePath}`, cause),
  );
}

export function stat(
  filePath: string,
): ResultAsync<import("node:fs").Stats, AppError> {
  return ResultAsync.fromPromise(fs.stat(filePath), (cause) =>
    fsError(`Failed to stat ${filePath}`, cause),
  );
}
