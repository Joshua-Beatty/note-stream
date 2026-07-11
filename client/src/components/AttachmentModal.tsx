import * as React from "react";
import { Download, FileIcon } from "lucide-react";
import type { Attachment } from "@note-stream/shared";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/format";
import { isImage, isPdf, isTextFile } from "@/lib/uploads";

export function AttachmentModal({
  attachment,
  onClose,
}: {
  attachment: Attachment | null;
  onClose: () => void;
}) {
  const [textContent, setTextContent] = React.useState<string | null>(null);

  const isText =
    attachment !== null &&
    isTextFile(attachment.mimeType, attachment.filename);

  React.useEffect(() => {
    setTextContent(null);
    if (attachment !== null && isText) {
      let cancelled = false;
      fetch(attachment.url)
        .then((r) => r.text())
        .then((t) => {
          if (!cancelled) setTextContent(t);
        })
        .catch(() => {
          if (!cancelled) setTextContent("(failed to load file)");
        });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [attachment, isText]);

  if (attachment === null) return null;

  const image = isImage(attachment.mimeType);
  const pdf = isPdf(attachment.mimeType);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent fullscreen={image || isText || pdf}>
        <DialogTitle className="pr-10 text-sm font-medium break-all">
          {attachment.filename}
          <span className="ml-2 text-xs text-muted-foreground">
            {formatBytes(attachment.sizeBytes)}
          </span>
        </DialogTitle>

        {image ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : pdf ? (
          <iframe
            src={attachment.url}
            title={attachment.filename}
            className="min-h-0 flex-1 rounded-md border border-border bg-white"
          />
        ) : isText ? (
          <pre className="min-h-0 flex-1 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {textContent ?? "Loading…"}
          </pre>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <FileIcon className="h-12 w-12 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <div>{attachment.mimeType}</div>
              <div>{formatBytes(attachment.sizeBytes)}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <a
            href={`${attachment.url}?download=1`}
            className="inline-flex h-8 items-center gap-2 rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
