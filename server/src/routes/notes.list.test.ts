import { describe, it, expect } from "vitest";
import { createTestCaller } from "../test/helpers.js";
import { buildFtsQuery } from "./notes.list.js";

describe("notes.list", () => {
  it("returns notes newest first", async () => {
    const { caller, db } = await createTestCaller();
    await db
      .insertInto("notes")
      .values([
        {
          id: "a",
          content: "older",
          created_at: "2026-01-01T10:00:00.000-07:00",
          updated_at: "2026-01-01T10:00:00.000-07:00",
          deleted_at: null,
        },
        {
          id: "b",
          content: "newer",
          created_at: "2026-01-02T10:00:00.000-07:00",
          updated_at: "2026-01-02T10:00:00.000-07:00",
          deleted_at: null,
        },
      ])
      .execute();

    const page = await caller.notes.list({});
    expect(page.notes.map((n) => n.content)).toEqual(["newer", "older"]);
    expect(page.nextCursor).toBeNull();
  });

  it("excludes soft-deleted notes", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "to delete",
      attachmentIds: [],
    });
    await caller.notes.create({ content: "keep", attachmentIds: [] });
    await caller.notes.delete({ id: note.id });

    const page = await caller.notes.list({});
    expect(page.notes.map((n) => n.content)).toEqual(["keep"]);
  });

  it("paginates with a cursor", async () => {
    const { caller, db } = await createTestCaller();
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `note-${i}`,
      content: `note ${i}`,
      created_at: `2026-01-0${i + 1}T10:00:00.000-07:00`,
      updated_at: `2026-01-0${i + 1}T10:00:00.000-07:00`,
      deleted_at: null,
    }));
    await db.insertInto("notes").values(rows).execute();

    const page1 = await caller.notes.list({ limit: 2 });
    expect(page1.notes.map((n) => n.content)).toEqual(["note 4", "note 3"]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.notes.list({
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.notes.map((n) => n.content)).toEqual(["note 2", "note 1"]);

    const page3 = await caller.notes.list({
      limit: 2,
      cursor: page2.nextCursor,
    });
    expect(page3.notes.map((n) => n.content)).toEqual(["note 0"]);
    expect(page3.nextCursor).toBeNull();
  });

  it("filters by full-text search", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({
      content: "the quick brown fox",
      attachmentIds: [],
    });
    await caller.notes.create({
      content: "lazy dogs sleep",
      attachmentIds: [],
    });

    const page = await caller.notes.list({ search: "quick" });
    expect(page.notes).toHaveLength(1);
    expect(page.notes[0]?.content).toContain("quick");
  });

  it("supports prefix search", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({
      content: "programming in typescript",
      attachmentIds: [],
    });
    const page = await caller.notes.list({ search: "program" });
    expect(page.notes).toHaveLength(1);
  });

  it("search does not match soft-deleted notes", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "unique searchterm here",
      attachmentIds: [],
    });
    await caller.notes.delete({ id: note.id });
    const page = await caller.notes.list({ search: "searchterm" });
    expect(page.notes).toHaveLength(0);
  });

  it("search reflects updated content", async () => {
    const { caller } = await createTestCaller();
    const note = await caller.notes.create({
      content: "original words",
      attachmentIds: [],
    });
    await caller.notes.update({
      id: note.id,
      content: "replaced vocabulary",
      attachmentIds: [],
    });

    expect((await caller.notes.list({ search: "original" })).notes).toHaveLength(
      0,
    );
    expect(
      (await caller.notes.list({ search: "replaced" })).notes,
    ).toHaveLength(1);
  });

  it("filters by a single tag", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({ content: "note #work", attachmentIds: [] });
    await caller.notes.create({ content: "note #home", attachmentIds: [] });

    const page = await caller.notes.list({ tags: ["work"] });
    expect(page.notes).toHaveLength(1);
    expect(page.notes[0]?.tags).toEqual(["work"]);
  });

  it("combines multiple tags with AND", async () => {
    const { caller } = await createTestCaller();
    await caller.notes.create({
      content: "both #work #urgent",
      attachmentIds: [],
    });
    await caller.notes.create({ content: "only #work", attachmentIds: [] });

    const page = await caller.notes.list({ tags: ["work", "urgent"] });
    expect(page.notes).toHaveLength(1);
    expect(page.notes[0]?.content).toBe("both #work #urgent");
  });

  it("filters by date", async () => {
    const { caller, db } = await createTestCaller();
    await db
      .insertInto("notes")
      .values([
        {
          id: "d1",
          content: "on the 4th",
          created_at: "2026-07-04T09:00:00.000-06:00",
          updated_at: "2026-07-04T09:00:00.000-06:00",
          deleted_at: null,
        },
        {
          id: "d2",
          content: "on the 5th",
          created_at: "2026-07-05T09:00:00.000-06:00",
          updated_at: "2026-07-05T09:00:00.000-06:00",
          deleted_at: null,
        },
      ])
      .execute();

    const page = await caller.notes.list({ date: "2026-07-04" });
    expect(page.notes.map((n) => n.content)).toEqual(["on the 4th"]);
  });

  it("combines search, tag, and date filters", async () => {
    const { caller, db } = await createTestCaller();
    await db
      .insertInto("notes")
      .values([
        {
          id: "m1",
          content: "meeting notes #work",
          created_at: "2026-07-04T09:00:00.000-06:00",
          updated_at: "2026-07-04T09:00:00.000-06:00",
          deleted_at: null,
        },
        {
          id: "m2",
          content: "meeting notes #home",
          created_at: "2026-07-04T10:00:00.000-06:00",
          updated_at: "2026-07-04T10:00:00.000-06:00",
          deleted_at: null,
        },
      ])
      .execute();
    await db
      .insertInto("note_tags")
      .values([
        { note_id: "m1", tag: "work" },
        { note_id: "m2", tag: "home" },
      ])
      .execute();

    const page = await caller.notes.list({
      search: "meeting",
      tags: ["work"],
      date: "2026-07-04",
    });
    expect(page.notes).toHaveLength(1);
    expect(page.notes[0]?.id).toBe("m1");
  });
});

describe("buildFtsQuery", () => {
  it("quotes terms and adds prefix operator", () => {
    expect(buildFtsQuery("hello world")).toBe('"hello"* "world"*');
  });

  it("escapes double quotes", () => {
    expect(buildFtsQuery('say "hi"')).toBe('"say"* """hi"""*');
  });

  it("prevents FTS syntax injection", () => {
    expect(buildFtsQuery("a OR b")).toBe('"a"* "OR"* "b"*');
  });
});
