import { describe, expect, it } from "vitest";
import { CLUE_POINTS, clueValue, scoreForSolve } from "./scoring";
import { fuzzyTolerance, levenshtein, matchGuess, normalizeAnswer } from "./answerMatch";
import { giveUp, initialRoundState, revealNextClue, submitGuess } from "./roundState";
import { dailyQuestionIndex, hashString, localDateString } from "./daily";
import { applyResult, initialStats } from "./stats";
import { buildShareGlyphs, buildShareText } from "./shareCard";
import { SEED_QUESTIONS } from "@/lib/questions/seed";
import { loadPrivateBank } from "@/lib/questions/privateBank";

/** Public samples + gitignored private bank (integrity-checked together). */
const FULL_BANK = [...SEED_QUESTIONS, ...loadPrivateBank()];

const venus = SEED_QUESTIONS.find((q) => q.id === "venus")!;
const nyc = SEED_QUESTIONS.find((q) => q.id === "new-york-city")!;
const cleopatra = SEED_QUESTIONS.find((q) => q.id === "cleopatra")!;

describe("scoring", () => {
  it("decays 10/8/6/4 down the clue ladder", () => {
    expect(CLUE_POINTS.slice(0, 4)).toEqual([10, 8, 6, 4]);
    expect(clueValue(0)).toBe(10);
    expect(clueValue(3)).toBe(4);
  });

  it("subtracts 1 per wrong guess, floored at 0", () => {
    expect(scoreForSolve(0, 0)).toBe(10);
    expect(scoreForSolve(1, 1)).toBe(7);
    expect(scoreForSolve(3, 3)).toBe(1);
    expect(scoreForSolve(3, 99)).toBe(0);
  });
});

describe("normalizeAnswer", () => {
  it("strips articles, case, punctuation, diacritics", () => {
    expect(normalizeAnswer("The Eiffel Tower")).toBe("eiffel tower");
    expect(normalizeAnswer("  NEW   YORK CITY! ")).toBe("new york city");
    expect(normalizeAnswer("Beyoncé")).toBe("beyonce");
    expect(normalizeAnswer("Spider-Man")).toBe("spider man");
  });
});

describe("levenshtein + tolerance", () => {
  it("computes edit distance", () => {
    expect(levenshtein("venus", "venus")).toBe(0);
    expect(levenshtein("venus", "venos")).toBe(1);
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });

  it("gives short answers zero typo budget", () => {
    expect(fuzzyTolerance("mars")).toBe(0);
    expect(fuzzyTolerance("jupiter")).toBe(1);
    expect(fuzzyTolerance("cleopatra")).toBe(2);
  });
});

describe("matchGuess", () => {
  it("accepts exact and case-insensitive", () => {
    expect(matchGuess(venus, "Venus").correct).toBe(true);
    expect(matchGuess(venus, "VENUS").kind).toBe("exact");
  });

  it("accepts aliases", () => {
    expect(matchGuess(nyc, "NYC").correct).toBe(true);
    expect(matchGuess(nyc, "new york").kind).toBe("alias");
  });

  it("forgives typos scaled to length", () => {
    expect(matchGuess(cleopatra, "Cleopatrra").correct).toBe(true);
    expect(matchGuess(cleopatra, "Cleopatrra").kind).toBe("fuzzy");
  });

  it("rejects decoys, even with typos", () => {
    expect(matchGuess(venus, "Mercury")).toMatchObject({ correct: false, kind: "decoy" });
    expect(matchGuess(venus, "mercurry").kind).toBe("decoy");
    expect(matchGuess(nyc, "Boston").kind).toBe("decoy");
  });

  it("rejects unrelated wrong answers", () => {
    expect(matchGuess(venus, "Saturn").correct).toBe(false);
    expect(matchGuess(venus, "").correct).toBe(false);
  });
});

describe("roundState", () => {
  it("wrong guess costs 1 and reveals the next clue", () => {
    const { state, match } = submitGuess(initialRoundState(), venus, "Mercury");
    expect(match.correct).toBe(false);
    expect(state.clueIndex).toBe(1);
    expect(state.wrongGuesses).toEqual([{ clueIndex: 0, guess: "Mercury" }]);
    expect(state.status).toBe("playing");
  });

  it("solve on clue 2 after one miss scores 8 - 1 = 7", () => {
    const miss = submitGuess(initialRoundState(), venus, "Mercury").state;
    const { state } = submitGuess(miss, venus, "Venus");
    expect(state.status).toBe("won");
    expect(state.solvedClueIndex).toBe(1);
    expect(state.score).toBe(7);
  });

  it("clean first-clue solve scores 10", () => {
    const { state } = submitGuess(initialRoundState(), venus, "venus");
    expect(state.score).toBe(10);
  });

  it("wrong guess on the last clue loses the round", () => {
    let s = initialRoundState();
    for (let i = 0; i < venus.clues.length - 1; i++) s = revealNextClue(s, venus.clues.length);
    expect(s.clueIndex).toBe(3);
    const { state } = submitGuess(s, venus, "Mars");
    expect(state.status).toBe("lost");
    expect(state.score).toBe(0);
  });

  it("revealNextClue advances without penalty and clamps at the end", () => {
    let s = revealNextClue(initialRoundState(), venus.clues.length);
    expect(s.clueIndex).toBe(1);
    expect(s.wrongGuesses).toHaveLength(0);
    for (let i = 0; i < 10; i++) s = revealNextClue(s, venus.clues.length);
    expect(s.clueIndex).toBe(venus.clues.length - 1);
  });

  it("giveUp ends the round unsolved", () => {
    expect(giveUp(initialRoundState()).status).toBe("lost");
  });
});

describe("daily selection", () => {
  it("is deterministic per date and within bounds", () => {
    const a = dailyQuestionIndex("2026-07-02", SEED_QUESTIONS.length);
    const b = dailyQuestionIndex("2026-07-02", SEED_QUESTIONS.length);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(SEED_QUESTIONS.length);
    expect(hashString("x")).not.toBe(hashString("y"));
  });

  it("localDateString formats YYYY-MM-DD", () => {
    expect(localDateString(new Date(2026, 6, 2))).toBe("2026-07-02");
  });
});

describe("stats", () => {
  it("streak grows on consecutive-day wins and resets on a loss", () => {
    const win = { ...initialRoundState(), status: "won" as const, solvedClueIndex: 1, score: 7 };
    const loss = { ...initialRoundState(), status: "lost" as const };
    let s = applyResult(initialStats(), "2026-07-01", win);
    expect(s.currentStreak).toBe(1);
    s = applyResult(s, "2026-07-02", win);
    expect(s.currentStreak).toBe(2);
    expect(s.solveDistribution[1]).toBe(2);
    s = applyResult(s, "2026-07-03", loss);
    expect(s.currentStreak).toBe(0);
    expect(s.maxStreak).toBe(2);
  });

  it("a gap day resets the streak to 1 on the next win", () => {
    const win = { ...initialRoundState(), status: "won" as const, solvedClueIndex: 0, score: 10 };
    let s = applyResult(initialStats(), "2026-07-01", win);
    s = applyResult(s, "2026-07-04", win);
    expect(s.currentStreak).toBe(1);
  });

  it("never records the same date twice", () => {
    const win = { ...initialRoundState(), status: "won" as const, solvedClueIndex: 0, score: 10 };
    let s = applyResult(initialStats(), "2026-07-01", win);
    s = applyResult(s, "2026-07-01", win);
    expect(s.gamesPlayed).toBe(1);
  });
});

describe("share card", () => {
  it("encodes miss/solve/unused without leaking the answer", () => {
    const miss = submitGuess(initialRoundState(), venus, "Mercury").state;
    const won = submitGuess(miss, venus, "Venus").state;
    expect(buildShareGlyphs(won, 4)).toBe("✕★··");
    const text = buildShareText({ dailyNumber: 142, round: won, clueCount: 4, streak: 8 });
    expect(text).toContain("Cluedown No. 142");
    expect(text).toContain("7 pts");
    expect(text.toLowerCase()).not.toContain("venus");
  });
});

describe("question bank integrity (spec §2.2 machine checks)", () => {
  it.each(FULL_BANK.map((q) => [q.id, q] as const))("%s is well-formed", (_id, q) => {
    expect(q.clues.length).toBeGreaterThanOrEqual(4);
    expect(q.clues.map((c) => c.position)).toEqual(
      Array.from({ length: q.clues.length }, (_, i) => i + 1),
    );
    expect(q.decoys.length).toBeGreaterThanOrEqual(2);
    const canonical = normalizeAnswer(q.answerCanonical);
    expect(normalizeAnswer(q.answer)).toBe(canonical);
    for (const d of q.decoys) {
      expect(normalizeAnswer(d.text)).not.toBe(canonical);
      expect(d.eliminatedByClue).toBeGreaterThanOrEqual(1);
      expect(d.eliminatedByClue).toBeLessThanOrEqual(q.clues.length);
    }
    // No clue may contain the answer or an alias (spec: no leaks).
    const leakTerms = [canonical, ...q.answerAliases.map(normalizeAnswer)];
    for (const clue of q.clues) {
      const clueNorm = normalizeAnswer(clue.text);
      for (const term of leakTerms) {
        expect(clueNorm.includes(term), `${q.id} clue ${clue.position} leaks "${term}"`).toBe(false);
      }
    }
    // Decoys must be rejected by the matcher.
    for (const d of q.decoys) {
      expect(matchGuess(q, d.text).correct).toBe(false);
    }
    // The real answer and every alias must be accepted.
    expect(matchGuess(q, q.answer).correct).toBe(true);
    for (const alias of q.answerAliases) {
      expect(matchGuess(q, alias).correct).toBe(true);
    }
  });
});
