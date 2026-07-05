import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Attachment, Note } from "@note-stream/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { NoteMarkdown } from "@/lib/markdown";
import { formatRelative, formatTimestamp } from "@/lib/format";
import { AttachmentPreview } from "./AttachmentPreview";
import { AttachmentModal } from "./AttachmentModal";
import { useFilters } from "@/state/filters";

export function NoteCard({
  note,
  onEdit,
  onDelete,
  isDeleting,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const { filters, toggleTag } = useFilters();
  const [openAttachment, setOpenAttachment] =
    React.useState<Attachment | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  return (
    <Card className="group p-4">
      <div className="flex items-start justify-between gap-2">
        <time
          dateTime={note.createdAt}
          title={formatTimestamp(note.createdAt)}
          className="text-xs text-muted-foreground"
        >
          {formatRelative(note.createdAt)}
          {note.updatedAt !== note.createdAt ? " (edited)" : ""}
        </time>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Edit note"
            onClick={() => onEdit(note)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            aria-label="Delete note"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="mt-1">
        <NoteMarkdown content={note.content} />
      </div>

      {note.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.attachments.map((att) => (
            <AttachmentPreview
              key={att.id}
              attachment={att}
              onClick={() => setOpenAttachment(att)}
            />
          ))}
        </div>
      )}

      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {note.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className="focus-visible:outline-none"
              aria-label={`Filter by tag ${tag}`}
            >
              <Badge
                active={filters.tags.includes(tag)}
                className="cursor-pointer hover:opacity-80"
              >
                #{tag}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <AttachmentModal
        attachment={openAttachment}
        onClose={() => setOpenAttachment(null)}
      />

      {confirmDelete && (
        <Dialog open onOpenChange={(open) => !open && setConfirmDelete(false)}>
          <DialogContent>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              This will remove the note and its attachments from the stream.
            </DialogDescription>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={isDeleting}
                onClick={() => {
                  onDelete(note.id);
                  setConfirmDelete(false);
                }}
              >
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
