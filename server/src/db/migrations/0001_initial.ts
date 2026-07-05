import { sql, type Kysely, type Migration } from "kysely";

export const migration0001Initial: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("notes")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("content", "text", (col) => col.notNull())
      .addColumn("created_at", "text", (col) => col.notNull())
      .addColumn("updated_at", "text", (col) => col.notNull())
      .addColumn("deleted_at", "text")
      .execute();

    await db.schema
      .createIndex("idx_notes_created_at")
      .on("notes")
      .columns(["created_at", "id"])
      .execute();

    await db.schema
      .createTable("attachments")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("note_id", "text", (col) => col.references("notes.id"))
      .addColumn("filename", "text", (col) => col.notNull())
      .addColumn("mime_type", "text", (col) => col.notNull())
      .addColumn("size_bytes", "integer", (col) => col.notNull())
      .addColumn("created_at", "text", (col) => col.notNull())
      .addColumn("deleted_at", "text")
      .execute();

    await db.schema
      .createIndex("idx_attachments_note_id")
      .on("attachments")
      .column("note_id")
      .execute();

    await db.schema
      .createTable("note_tags")
      .addColumn("note_id", "text", (col) =>
        col.notNull().references("notes.id"),
      )
      .addColumn("tag", "text", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_note_tags", ["note_id", "tag"])
      .execute();

    await db.schema
      .createIndex("idx_note_tags_tag")
      .on("note_tags")
      .column("tag")
      .execute();

    // FTS5 external-content index over live note content.
    await sql`
      CREATE VIRTUAL TABLE notes_fts USING fts5(
        content,
        content='notes',
        content_rowid='rowid'
      )
    `.execute(db);

    // Keep notes_fts in sync. Soft-deleted notes are removed from the index.
    await sql`
      CREATE TRIGGER notes_fts_after_insert AFTER INSERT ON notes
      WHEN new.deleted_at IS NULL
      BEGIN
        INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
      END
    `.execute(db);

    await sql`
      CREATE TRIGGER notes_fts_after_delete AFTER DELETE ON notes
      WHEN old.deleted_at IS NULL
      BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, content)
          VALUES ('delete', old.rowid, old.content);
      END
    `.execute(db);

    // Handles content edits, soft deletes, and un-deletes: remove the old row
    // from the index only if it was live, re-add the new row only if live.
    await sql`
      CREATE TRIGGER notes_fts_after_update AFTER UPDATE ON notes BEGIN
        INSERT INTO notes_fts(notes_fts, rowid, content)
          SELECT 'delete', old.rowid, old.content WHERE old.deleted_at IS NULL;
        INSERT INTO notes_fts(rowid, content)
          SELECT new.rowid, new.content WHERE new.deleted_at IS NULL;
      END
    `.execute(db);
  },
};
