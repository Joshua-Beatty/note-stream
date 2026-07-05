import { describe, it, expect } from "vitest";
import { createTestCaller } from "../test/helpers.js";

describe("calendar.days", () => {
  it("returns days in a month that have notes", async () => {
    const { caller, db } = await createTestCaller();
    await db
      .insertInto("notes")
      .values([
        {
          id: "c1",
          content: "one",
          created_at: "2026-07-04T09:00:00.000-06:00",
          updated_at: "2026-07-04T09:00:00.000-06:00",
          deleted_at: null,
        },
        {
          id: "c2",
          content: "two",
          created_at: "2026-07-04T15:00:00.000-06:00",
          updated_at: "2026-07-04T15:00:00.000-06:00",
          deleted_at: null,
        },
        {
          id: "c3",
          content: "three",
          created_at: "2026-07-10T09:00:00.000-06:00",
          updated_at: "2026-07-10T09:00:00.000-06:00",
          deleted_at: null,
        },
        {
          id: "c4",
          content: "other month",
          created_at: "2026-08-01T09:00:00.000-06:00",
          updated_at: "2026-08-01T09:00:00.000-06:00",
          deleted_at: null,
        },
      ])
      .execute();

    const days = await caller.calendar.days({ month: "2026-07" });
    expect(days).toEqual(["2026-07-04", "2026-07-10"]);
  });

  it("excludes soft-deleted notes", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "today",
      attachmentIds: [],
    });
    await caller.notes.delete({ id: note.id });

    const month = note.createdAt.slice(0, 7);
    const days = await caller.calendar.days({ month });
    expect(days).toEqual([]);
  });

  it("rejects a malformed month", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.calendar.days({ month: "July 2026" }),
    ).rejects.toThrow();
  });
});
