import { describe, it, expect } from "vitest";
import { openDatabase } from "./database.js";
import { migrateToLatest } from "./migrator.js";

describe("migrator", () => {
  it("migrates an empty database to latest", async () => {
    const db = openDatabase(":memory:")._unsafeUnwrap();
    const result = await migrateToLatest(db);
    expect(result.isOk()).toBe(true);
  });

  it("is idempotent when run twice", async () => {
    const db = openDatabase(":memory:")._unsafeUnwrap();
    const first = await migrateToLatest(db);
    expect(first.isOk()).toBe(true);
    const second = await migrateToLatest(db);
    expect(second.isOk()).toBe(true);
  });

  it("creates the expected tables", async () => {
    const db = openDatabase(":memory:")._unsafeUnwrap();
    (await migrateToLatest(db))._unsafeUnwrap();

    // Inserting into each table should succeed.
    await db
      .insertInto("notes")
      .values({
        id: "test-id",
        content: "hello",
        created_at: "2026-01-01T00:00:00.000-07:00",
        updated_at: "2026-01-01T00:00:00.000-07:00",
        deleted_at: null,
      })
      .execute();
    await db
      .insertInto("note_tags")
      .values({ note_id: "test-id", tag: "hello" })
      .execute();
    await db
      .insertInto("attachments")
      .values({
        id: "att-id",
        note_id: "test-id",
        filename: "a.txt",
        mime_type: "text/plain",
        size_bytes: 1,
        created_at: "2026-01-01T00:00:00.000-07:00",
        deleted_at: null,
      })
      .execute();

    const notes = await db.selectFrom("notes").selectAll().execute();
    expect(notes).toHaveLength(1);
  });
});
