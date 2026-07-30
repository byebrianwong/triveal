import { describe, expect, it } from "vitest";
import { SEED_QUESTIONS } from "./seed";
import { EXTRA_QUESTIONS } from "./extraBank";
import { loadPrivateBank } from "./privateBank";
import { categoryGroup, dedupeByCanonical, pickAvoidingCategories } from "./select";

/** Deterministic rand stub: always returns the first element of the pool. */
const first = () => 0;

describe("categoryGroup", () => {
  it("collapses geography-flavored categories into one group", () => {
    expect(categoryGroup("Geography")).toBe("geography");
    expect(categoryGroup("Landmarks")).toBe("geography");
    expect(categoryGroup("Cities")).toBe("geography");
  });

  it("normalizes case/whitespace and leaves unrelated categories distinct", () => {
    expect(categoryGroup("  Science ")).toBe("science");
    expect(categoryGroup("Animals")).toBe("animals");
    expect(categoryGroup("Space")).toBe("space");
  });
});

describe("dedupeByCanonical", () => {
  const canonOf = (i: { c: string }) => i.c;

  it("keeps the first occurrence and drops later ones", () => {
    const items = [
      { id: "public", c: "chess" },
      { id: "private", c: "chess" },
      { id: "other", c: "honey" },
    ];
    expect(dedupeByCanonical(items, canonOf).map((i) => i.id)).toEqual(["public", "other"]);
  });

  it("preserves order and passes through an already-unique list", () => {
    const items = [{ id: "a", c: "x" }, { id: "b", c: "y" }];
    expect(dedupeByCanonical(items, canonOf)).toEqual(items);
    expect(dedupeByCanonical([], canonOf)).toEqual([]);
  });

  it("leaves the assembled local bank free of duplicate answers", () => {
    // The private bank overlaps the committed one, so the raw concatenation
    // genuinely repeats questions. This is the guarantee `localBank` relies on
    // to serve the same set Supabase does.
    const raw = [...SEED_QUESTIONS, ...EXTRA_QUESTIONS, ...loadPrivateBank()];
    const unique = dedupeByCanonical(raw, (q) => q.answerCanonical);
    expect(new Set(unique.map((q) => q.answerCanonical)).size).toBe(unique.length);
  });
});

describe("pickAvoidingCategories", () => {
  const item = (id: string, c: string) => ({ id, c });
  const catOf = (i: { c: string }) => i.c;

  it("returns undefined for an empty pool", () => {
    expect(pickAvoidingCategories([], [], catOf)).toBeUndefined();
  });

  it("skips the immediately-previous category when the pool allows", () => {
    const items = [item("a", "Geography"), item("b", "Science"), item("c", "History")];
    const pick = pickAvoidingCategories(items, ["Geography"], catOf, first);
    expect(pick?.c).not.toBe("Geography");
    expect(pick?.id).toBe("b");
  });

  it("treats geography-flavored categories as one group", () => {
    // Previous was "Cities" — a "Landmarks" item shares the geography group
    // and must be avoided too, leaving only Science.
    const items = [item("a", "Landmarks"), item("b", "Science")];
    const pick = pickAvoidingCategories(items, ["Cities"], catOf, first);
    expect(pick?.id).toBe("b");
  });

  it("falls back to the full pool when avoidance would leave nothing", () => {
    const items = [item("a", "Geography"), item("b", "Geography")];
    const pick = pickAvoidingCategories(items, ["Geography"], catOf, first);
    expect(pick?.c).toBe("Geography"); // still returns something, never undefined
  });

  it("preserves avoidance of the most-recent category while relaxing older ones", () => {
    // Recent window is newest-last, so the previous category is "Science".
    // Avoiding both {History, Science} empties the pool, so it drops the
    // oldest (History) but still avoids Science, yielding the History item.
    const items = [item("a", "Science"), item("b", "History")];
    const pick = pickAvoidingCategories(items, ["History", "Science"], catOf, first);
    expect(pick?.c).toBe("History");
  });
});
