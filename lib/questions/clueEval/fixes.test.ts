import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EXTRA_QUESTIONS } from "../extraBank";
import { changedPositions, replaceCluesInSource, rewriteProblems } from "./fixes";

const boxing = EXTRA_QUESTIONS.find((q) => q.id === "boxing")!;
const oldClues = boxing.clues.map((c) => c.text);
const source = fs.readFileSync(path.join(process.cwd(), "lib", "questions", "extraBank.ts"), "utf8");

describe("rewriteProblems", () => {
  const good = {
    clues: [oldClues[0], "This sport's rules carry the name of a Scottish marquess.", oldClues[2], oldClues[3]],
    sources: { "2": "https://en.wikipedia.org/wiki/Marquess_of_Queensberry_Rules" },
    summary: "Replaced clue 2.",
  };

  it("accepts a rewrite with a source for each changed clue", () => {
    expect(rewriteProblems(boxing, good)).toEqual([]);
  });

  it("doesn't ask for a source for a clue that only moved", () => {
    const moved = { ...good, clues: [oldClues[1], oldClues[0], oldClues[2], oldClues[3]], sources: {} };
    expect(changedPositions(boxing, moved.clues)).toEqual([]);
    expect(rewriteProblems(boxing, moved)).toEqual([]);
  });

  it("catches a leak, a missing source, a wrong count and a long clue", () => {
    expect(rewriteProblems(boxing, { ...good, clues: [...good.clues.slice(0, 3), "This is kickboxing's parent."] }))
      .toEqual([expect.stringContaining('contains "boxing"'), "clue 4 changed but has no source"]);
    expect(rewriteProblems(boxing, { ...good, sources: {} })).toEqual(["clue 2 changed but has no source"]);
    expect(rewriteProblems(boxing, { ...good, clues: good.clues.slice(0, 3) })).toEqual(["expected 4 clues"]);
    const long = "x".repeat(201);
    expect(rewriteProblems(boxing, { ...good, clues: [long, ...good.clues.slice(1)], sources: { ...good.sources, "1": "https://a.b" } }))
      .toEqual(["clue 1 is 201 characters"]);
  });
});

describe("replaceCluesInSource", () => {
  it("rewrites only that question's clues, in the file's format", () => {
    const next = ["One \"quoted\" — clue.", "Two.", "Three.", "Four."];
    const out = replaceCluesInSource(source, "boxing", next);
    expect(out).toContain('      { position: 1, text: "One \\"quoted\\" — clue." },');
    expect(out).toContain('      { position: 4, text: "Four." },');
    for (const old of oldClues) expect(out).not.toContain(JSON.stringify(old));
    // Everything else is untouched.
    expect(out.length - source.length).toBe(
      next.map((t) => JSON.stringify(t).length).reduce((a, b) => a + b) -
        oldClues.map((t) => JSON.stringify(t).length).reduce((a, b) => a + b),
    );
  });

  it("refuses an unknown id", () => {
    expect(() => replaceCluesInSource(source, "no-such-question", ["a", "b", "c", "d"])).toThrow(/no question/);
  });
});
