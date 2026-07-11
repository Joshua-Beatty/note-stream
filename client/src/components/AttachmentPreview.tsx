import * as React from "react";
import { FileIcon, FileTextIcon } from "lucide-react";
import type { Attachment } from "@note-stream/shared";
import { formatBytes } from "@/lib/format";
import { attachmentThumbUrl, isImage, isPdf, isTextFile } from "@/lib/uploads";

export function AttachmentPreview({
  attachment,
  onClick,
}: {
  attachment: Attachment;
  onClick: () => void;
}) {
  // PDFs whose server thumbnail failed to render fall back to the generic tile.
  const [pdfThumbFailed, setPdfThumbFailed] = React.useState(false);

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

  if (isPdf(attachment.mimeType) && !pdfThumbFailed) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative overflow-hidden rounded-md border border-border bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={attachment.filename}
      >
        <img
          src={attachmentThumbUrl(attachment.id)}
          alt={attachment.filename}
          loading="lazy"
          onError={() => setPdfThumbFailed(true)}
          className="h-28 w-28 bg-white object-cover object-top transition-transform group-hover:scale-105"
        />
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-medium tracking-wide text-white">
          PDF
        </span>
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
