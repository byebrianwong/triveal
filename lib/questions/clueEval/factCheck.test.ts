import { describe, expect, it } from "vitest";
import { EXTRA_QUESTIONS } from "../extraBank";
import {
  factCheckAnswerProblems,
  factCheckReport,
  factCheckTaskPrompt,
  openProblems,
  uncheckedPositions,
  type FactCheckEntry,
} from "./factCheck";

const boxing = EXTRA_QUESTIONS.find((q) => q.id === "boxing")!;
const texts = [...boxing.clues].sort((a, b) => a.position - b.position).map((c) => c.text);
const meta = { checkedOn: "2026-10-12", checker: "test" };

function entry(checks: Partial<FactCheckEntry["checks"][number]>[]): FactCheckEntry {
  return {
    id: "boxing",
    answer: "Boxing",
    checks: checks.map((c) => ({ position: 1, text: texts[0], verdict: "ok", evidence: "x https://e.org", ...meta, ...c })),
  };
}

describe("uncheckedPositions", () => {
  it("lists every clue when nothing was checked", () => {
    expect(uncheckedPositions(boxing, undefined)).toEqual([1, 2, 3, 4]);
  });

  it("counts a clue as checked only for the exact text that came back ok", () => {
    const e = entry([
      { position: 1, text: texts[0] },
      { position: 2, text: texts[1] + " (old wording)" },
      { position: 3, text: texts[2], verdict: "loose", problem: "p" },
    ]);
    expect(uncheckedPositions(boxing, e)).toEqual([2, 3, 4]);
  });

  it("counts a clue as checked when its text is a checker's fix", () => {
    const e = entry([{ position: 4, text: "an older clue 4", verdict: "wrong", problem: "p", fix: texts[3] }]);
    expect(uncheckedPositions(boxing, e)).toEqual([1, 2, 3]);
  });
});

describe("openProblems", () => {
  it("returns the latest failing check of each current clue", () => {
    const e = entry([
      { position: 2, text: texts[1], verdict: "unverified" },
      { position: 2, text: texts[1], verdict: "loose", problem: "too precise", fix: "a fix" },
      { position: 3, text: "a clue no longer in the bank", verdict: "wrong" },
    ]);
    expect(openProblems(boxing, e)).toEqual([expect.objectContaining({ position: 2, verdict: "loose", fix: "a fix" })]);
  });
});

describe("factCheckAnswerProblems", () => {
  it("accepts an answer that covers every clue asked about", () => {
    const answer = { clues: [{ position: 2, verdict: "ok", evidence: "Wikipedia https://en.wikipedia.org/wiki/Boxing" }] };
    expect(factCheckAnswerProblems(boxing, [2], answer)).toEqual([]);
  });

  it("catches a missing clue, an extra clue, a bad verdict, no evidence and a leaking fix", () => {
    const answer = {
      clues: [
        { position: 1, verdict: "maybe", evidence: "" },
        { position: 4, verdict: "wrong", evidence: "x", fix: "This is kickboxing's parent." },
      ],
    };
    expect(factCheckAnswerProblems(boxing, [1, 2], answer)).toEqual([
      'clue 1 has verdict "maybe"',
      "clue 1 has no evidence",
      "clue 4 wasn't asked about",
      "clue 2 is missing",
    ]);
    expect(factCheckAnswerProblems(boxing, [4], answer)).toEqual([
      "clue 1 wasn't asked about",
      'clue 4\'s fix contains "boxing"',
    ]);
  });
});

describe("factCheckTaskPrompt", () => {
  it("marks which clues to check and lists cited sources and banned names", () => {
    const prompt = factCheckTaskPrompt([{ q: boxing, positions: [2], sources: { [texts[1]]: ["https://example.org/a"] } }]);
    expect(prompt).toContain(`Clue 2 (CHECK): ${texts[1]}`);
    expect(prompt).toContain(`Clue 1 (already checked, context only): ${texts[0]}`);
    expect(prompt).toContain("Cited by its writer: https://example.org/a");
    expect(prompt).toContain('"Boxing"');
  });
});

describe("factCheckReport", () => {
  it("counts fully checked questions and lists open problems", () => {
    const e = entry([
      ...texts.map((text, i) => ({ position: i + 1, text })),
      { position: 2, text: texts[1], verdict: "ok" },
    ]);
    const done = factCheckReport([boxing], { meta: { about: "" }, questions: { boxing: e } }, "2026-10-12");
    expect(done).toContain("1 have every clue checked ok");

    const bad = entry([{ position: 3, text: texts[2], verdict: "wrong", problem: "wrong year | really" }]);
    const report = factCheckReport([boxing], { meta: { about: "" }, questions: { boxing: bad } }, "2026-10-12");
    expect(report).toContain("1 clues have an open problem");
    expect(report).toContain("wrong year \\| really");
  });
});
