import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "@/lib/game/answerMatch";
import type { Question } from "@/lib/game/types";
import { EXTRA_QUESTIONS } from "../extraBank";
import { SEED_QUESTIONS } from "../seed";
import { GRADED_CASES } from "./graded";
import {
  JUDGE_SCHEMA,
  judgeTaskPrompt,
  judgeUserMessage,
  playerTaskPrompt,
  playerUserMessage,
  readHouseRules,
} from "./rubric";
import {
  applyCase,
  caseKey,
  batchApart,
  flagsFor,
  playerRunFromGuesses,
  renderBankReport,
  renderFixes,
  runCheck,
  validateJudgement,
  type Check,
  type ClueJudgement,
  type EvalEntry,
  type Judgement,
} from "./score";

const bank = [...SEED_QUESTIONS, ...EXTRA_QUESTIONS];
const byId = new Map(bank.map((q) => [q.id, q]));

const goodClue: ClueJudgement = {
  interest: 4,
  alone: "no",
  names_answer: false,
  wording: 2,
  repeats: 0,
  fact: "ok",
  note: "",
  fix: "",
};

/** A judgement with nothing wrong in it; tests change one thing at a time. */
function clean(overrides: Partial<Judgement> = {}): Judgement {
  return {
    clue1: { ...goodClue },
    clue2: { ...goodClue, alone: "think" },
    clue3: { ...goodClue, alone: "think" },
    clue4: { ...goodClue, interest: 2, alone: "instant" },
    distinct_facts: 4,
    order_ok: true,
    expected_solve: "3",
    clue4_unique: true,
    difficulty: "medium",
    verdict: "good",
    summary: "Fine.",
    ...overrides,
  };
}

describe("house rules for the judge", () => {
  it("reads the rules list from the README", () => {
    const rules = readHouseRules();
    expect(rules).toContain("Most questions should be medium or hard");
    expect(rules).toContain("Clue 4 can be the giveaway");
  });

  it("keeps the graded examples out of the judge's prompt", () => {
    const rules = readHouseRules();
    expect(rules).not.toContain("Examples from the grading");
    expect(rules).not.toContain("Ramadan");
  });

  // The graded cases are the judge's test. If the rules it reads name those
  // answers or quote their clues, the test is no longer held out.
  it("doesn't name a graded answer or quote a graded clue", () => {
    const rules = ` ${normalizeAnswer(readHouseRules())} `;
    for (const c of GRADED_CASES) {
      const q = applyCase(byId.get(c.id)!, c);
      expect(rules, `rules name "${q.answer}"`).not.toContain(` ${normalizeAnswer(q.answer)} `);
      for (const clue of q.clues) {
        const words = normalizeAnswer(clue.text).split(" ");
        for (let i = 0; i + 5 <= words.length; i++) {
          const run = words.slice(i, i + 5).join(" ");
          expect(rules, `rules quote ${q.id} clue ${clue.position}: "${run}"`).not.toContain(` ${run} `);
        }
      }
    }
  });

  it("fails loudly when the markers are missing", () => {
    expect(() => readHouseRules("# README with no markers")).toThrow(/judge-rules/);
  });
});

describe("prompts", () => {
  const q = byId.get("boxing")!;

  it("shows the judge the answer and clues but not the decoys", () => {
    const msg = judgeUserMessage(q);
    expect(msg).toContain("Answer: Boxing");
    expect(msg).toContain("Clue 4:");
    for (const d of q.decoys) expect(msg).not.toContain(d.text);
  });

  it("shows the player only the clues revealed so far, and never the answer", () => {
    const msg = playerUserMessage(q, 2);
    expect(msg).toContain(`Category: ${q.category}`);
    expect(msg).toContain("Clue 2:");
    expect(msg).not.toContain("Clue 3:");
    expect(msg.toLowerCase()).not.toContain("boxing");
  });

  it("asks the judge for exactly the fields the code reads", () => {
    expect([...JUDGE_SCHEMA.required].sort()).toEqual(Object.keys(clean()).sort());
  });
});

describe("subagent prompts", () => {
  const boxing = byId.get("boxing")!;
  const tea = byId.get("tea")!;

  it("give the judge the full instructions, the schema, and no tools", () => {
    const prompt = judgeTaskPrompt([boxing], readHouseRules());
    expect(prompt).toContain("Don't research this");
    expect(prompt).toContain("Most questions should be medium or hard");
    expect(prompt).toContain('<question id="boxing">');
    expect(prompt).toContain(JSON.stringify(JUDGE_SCHEMA));
  });

  it("hide the answer from the player behind opaque ids", () => {
    const prompt = playerTaskPrompt(
      [
        { opaqueId: "q1", q: boxing },
        { opaqueId: "q2", q: tea },
      ],
      1,
    );
    expect(prompt).toContain("[q1]");
    expect(prompt).toContain("[q2]");
    expect(prompt).toContain("Clue 1:");
    expect(prompt).not.toContain("Clue 2:");
    for (const word of ["boxing", "tea"]) expect(prompt.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`));
  });
});

describe("validateJudgement", () => {
  it("accepts a well-formed judgement", () => {
    expect(validateJudgement(clean())).toEqual([]);
  });

  it("names each bad or missing field", () => {
    const bad = { ...clean(), clue2: { ...goodClue, interest: 7 }, verdict: "great" } as unknown;
    const missing: Record<string, unknown> = { ...clean() };
    delete missing.clue3;
    expect(validateJudgement(bad)).toEqual([
      expect.stringContaining("clue2.interest"),
      expect.stringContaining("verdict"),
    ]);
    expect(validateJudgement(missing)).toEqual(["clue3 is missing"]);
    expect(validateJudgement("{}")).toEqual(["not an object"]);
  });
});

describe("playerRunFromGuesses", () => {
  const boxing = byId.get("boxing")!;

  it("solves on the first right guess, using the game's matcher", () => {
    // "Wrestling" is a decoy; "boxng" is a typo the matcher accepts.
    expect(playerRunFromGuesses(boxing, ["Wrestling", "boxng", "Boxing", "Boxing"])).toEqual({
      solvedOn: 2,
      guesses: ["Wrestling", "boxng"],
    });
  });

  it("reports never solved", () => {
    expect(playerRunFromGuesses(boxing, ["Fencing", "Judo", "Karate", "Wrestling"]).solvedOn).toBeNull();
  });
});

describe("batchApart", () => {
  it("keeps a rewrite out of its original's batch", () => {
    const ids = ["a", "b", "a~v1", "c", "b~v1", "a~v2"].map((id) => ({ id }));
    const batches = batchApart(ids, 10).map((b) => b.map((x) => x.id));
    expect(batches).toEqual([["a", "b", "c"], ["a~v1", "b~v1"], ["a~v2"]]);
  });

  it("respects the batch size", () => {
    const batches = batchApart(["a", "b", "c", "d", "e"].map((id) => ({ id })), 2);
    expect(batches.map((b) => b.length)).toEqual([2, 2, 1]);
  });
});

describe("graded cases", () => {
  it.each(GRADED_CASES.map((c) => [caseKey(c), c] as const))("%s points at a real question", (_key, c) => {
    expect(byId.has(c.id)).toBe(true);
  });

  it("have unique keys", () => {
    const keys = GRADED_CASES.map(caseKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only name clues 1-4", () => {
    for (const c of GRADED_CASES) {
      for (const pos of Object.keys(c.replaceClues ?? {})) expect([1, 2, 3, 4]).toContain(Number(pos));
      for (const check of c.expect) {
        const clues = "clue" in check ? [check.clue] : "clues" in check ? check.clues : [];
        for (const n of clues) expect([1, 2, 3, 4]).toContain(n);
      }
    }
  });

  it("replacement clues follow the leak rule", () => {
    for (const c of GRADED_CASES) {
      const q = byId.get(c.id)!;
      const banned = [q.answerCanonical, ...q.answerAliases].map(normalizeAnswer);
      for (const text of Object.values(c.replaceClues ?? {})) {
        for (const word of banned) expect(normalizeAnswer(text)).not.toContain(word);
      }
    }
  });

  it("judge the clues Brian graded, not the bank's rewritten ones", () => {
    const c = GRADED_CASES.find((g) => g.id === "star-wars" && !g.variant)!;
    const q = applyCase(byId.get(c.id)!, c);
    expect(q.clues[0].text).toMatch(/^Its opening words scroll up the screen/);
    expect(q.clues[0].text).not.toBe(byId.get(c.id)!.clues[0].text);
  });

  it("each record four graded clue texts", () => {
    for (const c of GRADED_CASES) expect(c.clues, caseKey(c)).toHaveLength(4);
  });

  it("swap in only the replaced clues", () => {
    const c = GRADED_CASES.find((g) => g.variant === "silver-shoes")!;
    const original = byId.get(c.id)!;
    const swapped: Question = applyCase(original, c);
    expect(swapped.id).toBe("wizard-of-oz~silver-shoes");
    expect(swapped.clues[0].text).toBe(c.replaceClues![1]);
    expect(swapped.clues.slice(1).map((x) => x.text)).toEqual(c.clues!.slice(1));
    expect(swapped.clues.map((x) => x.position)).toEqual(original.clues.map((x) => x.position));
  });
});

describe("flagsFor", () => {
  it("flags nothing on a clean judgement, even with an easy, plain clue 4", () => {
    expect(flagsFor(clean(), { solvedOn: 3, guesses: [] })).toEqual([]);
  });

  it("flags early giveaways", () => {
    const j = clean({
      clue1: { ...goodClue, alone: "instant" },
      clue2: { ...goodClue, alone: "instant" },
      clue3: { ...goodClue, alone: "instant" },
    });
    expect(flagsFor(j)).toEqual(expect.arrayContaining(["clue1-too-easy", "clue2-too-easy", "clue3-too-easy"]));
  });

  it("lets players work clue 1 out", () => {
    const j = clean({ clue1: { ...goodClue, alone: "think" }, expected_solve: "1" });
    expect(flagsFor(j)).toEqual([]);
  });

  it("flags an easy question and a clue that uses the answer's name", () => {
    const j = clean({ difficulty: "easy", clue4: { ...goodClue, names_answer: true } });
    expect(flagsFor(j)).toEqual(expect.arrayContaining(["plays-easy", "names-answer"]));
  });

  it("flags a dull clue before clue 4", () => {
    expect(flagsFor(clean({ clue2: { ...goodClue, interest: 1 } }))).toContain("dull-clue");
  });

  it("flags repeats, few facts, order, wording and facts", () => {
    const j = clean({
      clue1: { ...goodClue, repeats: 4, fact: "doubtful" },
      clue3: { ...goodClue, wording: 1 },
      distinct_facts: 2,
      order_ok: false,
      clue4_unique: false,
    });
    expect(flagsFor(j)).toEqual(
      expect.arrayContaining(["repeats", "fact-doubtful", "clunky-wording", "few-distinct-facts", "order", "not-unique"]),
    );
  });

  it("reports a wrong fact over a doubtful one", () => {
    const j = clean({ clue1: { ...goodClue, fact: "doubtful" }, clue2: { ...goodClue, fact: "wrong" } });
    const flags = flagsFor(j);
    expect(flags).toContain("fact-wrong");
    expect(flags).not.toContain("fact-doubtful");
  });

  it("flags a question the simulated player never solves, but not an early solve", () => {
    expect(flagsFor(clean(), { solvedOn: 1, guesses: ["x"] })).toEqual([]);
    expect(flagsFor(clean(), { solvedOn: null, guesses: [] })).toContain("player-never-solved");
  });
});

describe("runCheck", () => {
  const cases: [string, Check, Judgement, boolean][] = [
    ["verdict-not-good passes on needs_work", { kind: "verdict-not-good" }, clean({ verdict: "needs_work" }), true],
    ["verdict-not-good fails on good", { kind: "verdict-not-good" }, clean(), false],
    ["clue-good passes on an interesting, hard clue", { kind: "clue-good", clue: 1 }, clean(), true],
    ["clue-good fails on a giveaway", { kind: "clue-good", clue: 1 }, clean({ clue1: { ...goodClue, alone: "instant" } }), false],
    ["clue-good passes on a clue to work out", { kind: "clue-good", clue: 1 }, clean({ clue1: { ...goodClue, alone: "think" } }), true],
    ["verdict-good", { kind: "verdict-good" }, clean(), true],
    ["clue-dull passes at interest 2", { kind: "clue-dull", clue: 2 }, clean({ clue2: { ...goodClue, interest: 2 } }), true],
    ["clue-dull fails at interest 3", { kind: "clue-dull", clue: 2 }, clean({ clue2: { ...goodClue, interest: 3 } }), false],
    ["clue-names-answer", { kind: "clue-names-answer", clue: 4 }, clean({ clue4: { ...goodClue, names_answer: true } }), true],
    ["clue-weak passes at interest 3", { kind: "clue-weak", clue: 2 }, clean({ clue2: { ...goodClue, interest: 3 } }), true],
    ["clue-weak fails at interest 4", { kind: "clue-weak", clue: 2 }, clean(), false],
    ["clue-too-easy", { kind: "clue-too-easy", clue: 4 }, clean(), true],
    ["clue-fact-ok", { kind: "clue-fact-ok", clue: 1 }, clean({ clue1: { ...goodClue, fact: "doubtful" } }), false],
    ["repeat-pair either way round", { kind: "repeat-pair", clues: [1, 4] }, clean({ clue4: { ...goodClue, repeats: 1 } }), true],
    ["no-repeat-pair", { kind: "no-repeat-pair", clues: [1, 4] }, clean(), true],
    ["repetitive on few facts", { kind: "repetitive" }, clean({ distinct_facts: 2 }), true],
    ["repetitive fails on four facts and no repeats", { kind: "repetitive" }, clean(), false],
  ];
  it.each(cases)("%s", (_name, check, j, pass) => {
    expect(runCheck(j, check).pass).toBe(pass);
  });
});

describe("renderBankReport", () => {
  const entry = (id: string, judge: Judgement): EvalEntry => ({
    id,
    answer: id.toUpperCase(),
    category: "Test | Pipes",
    labelled: "easy",
    judgeKey: "k",
    judgeModel: "test",
    judge,
    flags: flagsFor(judge),
  });

  it("lists questions to fix worst first and leaves good ones out", () => {
    const report = renderBankReport(
      [
        entry("fine", clean()),
        entry("meh", clean({ verdict: "needs_work" })),
        entry("awful", clean({ verdict: "bad", clue1: { ...goodClue, interest: 1 } })),
      ],
      { judgeModel: "j", playerModel: "p", date: "2026-10-03" },
    );
    expect(report).toContain("1 good (33%), 1 needs work, 1 bad");
    expect(report.indexOf("`awful`")).toBeLessThan(report.indexOf("`meh`"));
    expect(report).not.toContain("`fine`");
    expect(report).toContain("Test \\| Pipes");
  });
});

describe("renderFixes", () => {
  it("shows each suggestion next to the clue it replaces, and skips questions with none", () => {
    const boxing = byId.get("boxing")!;
    const fixed: EvalEntry = {
      id: "boxing",
      answer: "Boxing",
      category: "Sports",
      labelled: "easy",
      judgeKey: "k",
      judgeModel: "test",
      judge: clean({ verdict: "needs_work", clue2: { ...goodClue, interest: 1, note: "A summary.", fix: "A new clue." } }),
      flags: [],
    };
    const untouched: EvalEntry = { ...fixed, id: "tea", answer: "Tea", judge: clean() };
    const md = renderFixes([fixed, untouched], new Map([["boxing", boxing]]), { date: "2026-10-04" });
    expect(md).toContain("1 questions have at least one suggestion");
    expect(md).toContain(`- Now: ${boxing.clues[1].text}`);
    expect(md).toContain("- Suggested: A new clue.");
    expect(md).not.toContain("`tea`");
  });
});
