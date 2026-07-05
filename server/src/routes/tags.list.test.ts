import { describe, it, expect } from "vitest";
import { createTestCaller } from "../test/helpers.js";

describe("tags.list", () => {
  it("returns empty for no notes", async () => {
    const { caller } = await createTestCaller();
    expect(await caller.tags.list()).toEqual([]);
  });

  it("counts tags across all live notes", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({ content: "#work item one", attachmentIds: [] });
    await caller.notes.create({ content: "#work item two", attachmentIds: [] });
    await caller.notes.create({ content: "#home chores", attachmentIds: [] });

    const tags = await caller.tags.list();
    expect(tags).toEqual([
      { tag: "work", count: 2 },
      { tag: "home", count: 1 },
    ]);
  });

  it("lowercases and dedupes tags per note", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({
      content: "#Work and #WORK and #work",
      attachmentIds: [],
    });
    const tags = await caller.tags.list();
    expect(tags).toEqual([{ tag: "work", count: 1 }]);
  });

  it("excludes soft-deleted notes from counts", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({ content: "#stay", attachmentIds: [] });
    const gone = await caller.notes.create({
      content: "#stay #gone",
      attachmentIds: [],
    });
    await caller.notes.delete({ id: gone.id });

    const tags = await caller.tags.list();
    expect(tags).toEqual([{ tag: "stay", count: 1 }]);
  });
});
