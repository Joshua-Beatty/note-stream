import { describe, it, expect } from "vitest";
import { createTestCaller } from "../test/helpers.js";
import { nowLocalIso } from "../lib/time.js";

describe("notes.create", () => {
  it("creates a note and returns it", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "hello world",
      attachmentIds: [],
    });
    expect(note.content).toBe("hello world");
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(note.tags).toEqual([]);
    expect(note.attachments).toEqual([]);
    expect(note.createdAt).toBe(note.updatedAt);
  });

  it("extracts tags from content", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "Working on #ProjectX today, also #groceries #projectx",
      attachmentIds: [],
    });
    expect(note.tags).toEqual(["groceries", "projectx"]);
  });

  it("rejects empty content", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.notes.create({ content: "", attachmentIds: [] }),
    ).rejects.toThrow();
  });

  it("claims pending attachments", async () => {
    const { caller, db } = await createTestCaller();
    const attId = "01920000-0000-7000-8000-000000000001";
    await db
      .insertInto("attachments")
      .values({
        id: attId,
        note_id: null,
        filename: "photo.jpg",
        mime_type: "image/jpeg",
        size_bytes: 123,
        created_at: nowLocalIso(),
        deleted_at: null,
      })
      .execute();

    const note = await caller.notes.create({
      content: "with attachment",
      attachmentIds: [attId],
    });
    expect(note.attachments).toHaveLength(1);
    expect(note.attachments[0]?.filename).toBe("photo.jpg");
    expect(note.attachments[0]?.url).toBe(
      `/user_content/${attId}/photo.jpg`,
    );
  });

  it("does not steal attachments already claimed by another note", async () => {
    const { caller, db } = await createTestCaller();
    const attId = "01920000-0000-7000-8000-000000000002";
    const first = await caller.notes.create({
      content: "first",
      attachmentIds: [],
    });
    await db
      .insertInto("attachments")
      .values({
        id: attId,
        note_id: first.id,
        filename: "owned.txt",
        mime_type: "text/plain",
        size_bytes: 5,
        created_at: nowLocalIso(),
        deleted_at: null,
      })
      .execute();

    const second = await caller.notes.create({
      content: "second",
      attachmentIds: [attId],
    });
    expect(second.attachments).toHaveLength(0);
  });
});
