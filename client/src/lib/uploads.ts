import type { UploadedFile } from "@note-stream/shared";

export async function uploadFiles(files: File[]): Promise<UploadedFile[]> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error !== undefined) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  const body = (await res.json()) as { files: UploadedFile[] };
  return body.files;
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

const TEXT_EXTENSIONS =
  /\.(txt|md|markdown|json|js|jsx|ts|tsx|css|html|xml|ya?ml|toml|csv|log|sh|py|rb|go|rs|java|c|h|cpp|hpp|sql)$/i;

export function isTextFile(mimeType: string, filename: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    TEXT_EXTENSIONS.test(filename)
  );
}
