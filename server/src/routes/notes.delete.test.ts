import { describe, it, expect } from "vitest";
import { createTestCaller } from "../test/helpers.js";
import { nowLocalIso } from "../lib/time.js";

describe("notes.delete", () => {
  it("soft-deletes a note", async () => {
    const { caller, db } = await createTestCaller();
    const note = await caller.notes.create({
      content: "goodbye",
      attachmentIds: [],
    });

    const result = await caller.notes.delete({ id: note.id });
    expect(result.id).toBe(note.id);

    const row = await db
      .selectFrom("notes")
      .selectAll()
      .where("id", "=", note.id)
      .executeTakeFirst();
    expect(row?.deleted_at).not.toBeNull();
  });

  it("soft-deletes the note's attachments", async () => {
    const { caller, db } = await createTestCaller();
    const attId = "01920000-0000-7000-8000-000000000020";
    await db
      .insertInto("attachments")
      .values({
        id: attId,
        note_id: null,
        filename: "f.txt",
        mime_type: "text/plain",
        size_bytes: 1,
        created_at: nowLocalIso(),
        deleted_at: null,
      })
      .execute();
    const note = await caller.notes.create({
      content: "with file",
      attachmentIds: [attId],
    });

    await caller.notes.delete({ id: note.id });

    const att = await db
      .selectFrom("attachments")
      .selectAll()
      .where("id", "=", attId)
      .executeTakeFirst();
    expect(att?.deleted_at).not.toBeNull();
  });

  it("removes tags from counts after delete", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "tagged #gone",
      attachmentIds: [],
    });
    await caller.notes.delete({ id: note.id });

    const tags = await caller.tags.list();
    expect(tags.find((t) => t.tag === "gone")).toBeUndefined();
  });

  it("throws NOT_FOUND for a missing note", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.notes.delete({ id: "01920000-0000-7000-8000-00000000dead" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when deleting twice", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "once",
      attachmentIds: [],
    });
    await caller.notes.delete({ id: note.id });
    await expect(caller.notes.delete({ id: note.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
