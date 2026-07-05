import * as React from "react";
import { Paperclip, SendHorizonal, X, Loader2 } from "lucide-react";
import type { Note, UploadedFile } from "@note-stream/shared";
import { trpc } from "@/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadFiles, isImage } from "@/lib/uploads";
import { formatBytes } from "@/lib/format";

export interface EditingNote {
  note: Note;
}

export function Composer({
  editing,
  onCancelEdit,
  onSaved,
}: {
  editing: Note | null;
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  const [content, setContent] = React.useState("");
  const [attachments, setAttachments] = React.useState<UploadedFile[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const invalidateAll = () => {
    void utils.notes.list.invalidate();
    void utils.tags.list.invalidate();
    void utils.calendar.days.invalidate();
  };
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      invalidateAll();
      reset();
      onSaved();
    },
    onError: (e) => setError(e.message),
  });
  const updateMutation = trpc.notes.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      reset();
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  // Load a note into the composer when editing starts.
  React.useEffect(() => {
    if (editing !== null) {
      setContent(editing.content);
      setAttachments(
        editing.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          url: a.url,
        })),
      );
      setError(null);
      textareaRef.current?.focus();
    }
  }, [editing]);

  function reset() {
    setContent("");
    setAttachments([]);
    setError(null);
  }

  const pending = createMutation.isPending || updateMutation.isPending;
  const canSend = content.trim().length > 0 && !pending && !uploading;

  function send() {
    if (!canSend) return;
    setError(null);
    const attachmentIds = attachments.map((a) => a.id);
    if (editing !== null) {
      updateMutation.mutate({ id: editing.id, content, attachmentIds });
    } else {
      createMutation.mutate({ content, attachmentIds });
    }
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadFiles(files);
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card
      className="p-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void addFiles([...e.dataTransfer.files]);
      }}
    >
      {editing !== null && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-accent px-3 py-1.5 text-xs">
          <span>Editing note</span>
          <button
            type="button"
            className="font-medium underline underline-offset-2 hover:text-primary"
            onClick={() => {
              reset();
              onCancelEdit();
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            send();
          }
        }}
        onPaste={(e) => {
          const files = [...e.clipboardData.files];
          if (files.length > 0) {
            e.preventDefault();
            void addFiles(files);
          }
        }}
        placeholder="What's on your mind? Use #tags to organize. Ctrl+Enter to send."
        rows={3}
        className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />

      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 py-1 pl-1 pr-2 text-xs"
            >
              {isImage(a.mimeType) ? (
                <img
                  src={a.url}
                  alt={a.filename}
                  className="h-8 w-8 rounded object-cover"
                />
              ) : (
                <Paperclip className="mx-1.5 h-4 w-4 text-muted-foreground" />
              )}
              <span className="max-w-40 truncate">{a.filename}</span>
              <span className="text-muted-foreground">
                {formatBytes(a.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((p) => p.id !== a.id))
                }
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${a.filename}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error !== null && (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          Attach
        </Button>
        <Button size="sm" disabled={!canSend} onClick={send}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
          {editing !== null ? "Save" : "Send"}
        </Button>
      </div>
    </Card>
  );
}
