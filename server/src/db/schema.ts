/**
 * Hand-written Kysely database interface.
 * Kept in lockstep with the migrations in ./migrations/.
 */

export interface NotesTable {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AttachmentsTable {
  id: string;
  /** NULL while the upload is pending (not yet claimed by a note). */
  note_id: string | null;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  deleted_at: string | null;
}

export interface NoteTagsTable {
  note_id: string;
  tag: string;
}

export interface Database {
  notes: NotesTable;
  attachments: AttachmentsTable;
  note_tags: NoteTagsTable;
}
