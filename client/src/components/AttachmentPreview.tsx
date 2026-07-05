import { FileIcon, FileTextIcon } from "lucide-react";
import type { Attachment } from "@note-stream/shared";
import { formatBytes } from "@/lib/format";
import { isImage, isTextFile } from "@/lib/uploads";

export function AttachmentPreview({
  attachment,
  onClick,
}: {
  attachment: Attachment;
  onClick: () => void;
}) {
  if (isImage(attachment.mimeType)) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group overflow-hidden rounded-md border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={attachment.filename}
      >
        <img
          src={attachment.url}
          alt={attachment.filename}
          loading="lazy"
          className="h-28 w-28 object-cover transition-transform group-hover:scale-105"
        />
      </button>
    );
  }

  const Icon = isTextFile(attachment.mimeType, attachment.filename)
    ? FileTextIcon
    : FileIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-28 w-40 flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 p-2 text-center hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={attachment.filename}
    >
      <Icon className="h-7 w-7 text-muted-foreground" />
      <span className="w-full truncate text-xs">{attachment.filename}</span>
      <span className="text-[10px] text-muted-foreground">
        {formatBytes(attachment.sizeBytes)}
      </span>
    </button>
  );
}
