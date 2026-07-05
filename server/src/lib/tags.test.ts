import { describe, it, expect } from "vitest";
import { extractTags } from "./tags.js";

describe("extractTags", () => {
  it("extracts simple tags", () => {
    expect(extractTags("hello #world")).toEqual(["world"]);
  });

  it("extracts multiple tags sorted and deduped", () => {
    expect(extractTags("#b #a #b")).toEqual(["a", "b"]);
  });

  it("lowercases tags", () => {
    expect(extractTags("#TypeScript #TYPESCRIPT")).toEqual(["typescript"]);
  });

  it("only matches alphanumeric characters", () => {
    expect(extractTags("#foo-bar")).toEqual(["foo"]);
    expect(extractTags("#tag! done")).toEqual(["tag"]);
  });

  it("includes digits", () => {
    expect(extractTags("#2026goals")).toEqual(["2026goals"]);
  });

  it("returns empty for no tags", () => {
    expect(extractTags("no tags here")).toEqual([]);
    expect(extractTags("# not a tag")).toEqual([]);
  });
});
