import { describe, it, expect } from "vitest";
import { createTestCaller } from "../test/helpers.js";
import { nowLocalIso } from "../lib/time.js";

describe("notes.update", () => {
  it("updates content and re-extracts tags", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "original #old",
      attachmentIds: [],
    });

    const updated = await caller.notes.update({
      id: note.id,
      content: "changed #new",
      attachmentIds: [],
    });
    expect(updated.content).toBe("changed #new");
    expect(updated.tags).toEqual(["new"]);
  });

  it("throws NOT_FOUND for a missing note", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.notes.update({
        id: "01920000-0000-7000-8000-00000000dead",
        content: "nope",
        attachmentIds: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND for a soft-deleted note", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "bye",
      attachmentIds: [],
    });
    await caller.notes.delete({ id: note.id });
    await expect(
      caller.notes.update({
        id: note.id,
        content: "resurrect",
        attachmentIds: [],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("adds and removes attachments to match the provided list", async () => {
    const { caller, db } = await createTestCaller();
    const keepId = "01920000-0000-7000-8000-000000000010";
    const dropId = "01920000-0000-7000-8000-000000000011";
    const addId = "01920000-0000-7000-8000-000000000012";
    const now = nowLocalIso();

    const note = await caller.notes.create({
      content: "attachments test",
      attachmentIds: [],
    });
    await db
      .insertInto("attachments")
      .values([
        {
          id: keepId,
          note_id: note.id,
          filename: "keep.txt",
          mime_type: "text/plain",
          size_bytes: 1,
          created_at: now,
          deleted_at: null,
        },
        {
          id: dropId,
          note_id: note.id,
          filename: "drop.txt",
          mime_type: "text/plain",
          size_bytes: 1,
          created_at: now,
          deleted_at: null,
        },
        {
          id: addId,
          note_id: null,
          filename: "add.txt",
          mime_type: "text/plain",
          size_bytes: 1,
          created_at: now,
          deleted_at: null,
        },
      ])
      .execute();

    const updated = await caller.notes.update({
      id: note.id,
      content: "attachments test v2",
      attachmentIds: [keepId, addId],
    });
    const names = updated.attachments.map((a) => a.filename).sort();
    expect(names).toEqual(["add.txt", "keep.txt"]);
  });

  it("bumps updatedAt but not createdAt", async () => {
    const { caller, db } = await createTestCaller();
    const note = await caller.notes.create({
      content: "timing",
      attachmentIds: [],
    });
    // Force a distinct timestamp.
    await db
      .updateTable("notes")
      .set({ created_at: "2026-01-01T00:00:00.000-07:00" })
      .where("id", "=", note.id)
      .execute();

    const updated = await caller.notes.update({
      id: note.id,
      content: "timing v2",
      attachmentIds: [],
    });
    expect(updated.createdAt).toBe("2026-01-01T00:00:00.000-07:00");
    expect(updated.updatedAt).not.toBe(updated.createdAt);
  });
});
