/**
 * Pure logic for the clue-quality eval: the judge's output shape, the flags
 * derived from it, the checks against Brian's grades, and the markdown
 * reports. No API calls and no file access, so all of it is unit tested.
 */

import { matchGuess } from "@/lib/game/answerMatch";
import type { Difficulty, Question } from "@/lib/game/types";

/** Could a typical player name the answer from this clue alone? Only "instant" is too easy. */
export type Alone = "no" | "think" | "instant";

/** The judge's verdict on one clue. Field meanings are defined in rubric.ts. */
export interface ClueJudgement {
  interest: 1 | 2 | 3 | 4 | 5;
  alone: Alone;
  /** Uses a distinctive word from the answer's own name ("Pisa"). */
  names_answer: boolean;
  wording: 1 | 2 | 3;
  /** Position of another clue this one repeats, or 0. */
  repeats: 0 | 1 | 2 | 3 | 4;
  fact: "ok" | "doubtful" | "wrong";
  note: string;
}

/** The judge's structured output for one question (matches JUDGE_SCHEMA). */
export interface Judgement {
  clue1: ClueJudgement;
  clue2: ClueJudgement;
  clue3: ClueJudgement;
  clue4: ClueJudgement;
  distinct_facts: 1 | 2 | 3 | 4;
  order_ok: boolean;
  expected_solve: "1" | "2" | "3" | "4" | "never";
  clue4_unique: boolean;
  difficulty: Difficulty;
  verdict: "good" | "needs_work" | "bad";
  summary: string;
}

/** The simulated player's run: the clue it first guessed right on, if any. */
export interface PlayerRun {
  solvedOn: number | null;
  /** One guess per clue revealed, in order. */
  guesses: string[];
}

/**
 * Problems with a judgement that didn't come through the API's schema check,
 * such as one a Claude Code subagent wrote. Empty means it is usable.
 */
export function validateJudgement(x: unknown): string[] {
  const problems: string[] = [];
  if (typeof x !== "object" || x === null) return ["not an object"];
  const j = x as Record<string, unknown>;
  const oneOf = (field: string, value: unknown, allowed: readonly unknown[]) => {
    if (!allowed.includes(value)) problems.push(`${field} is ${JSON.stringify(value)}, expected one of ${allowed.join("/")}`);
  };
  for (const p of [1, 2, 3, 4]) {
    const c = j[`clue${p}`] as Record<string, unknown> | undefined;
    if (typeof c !== "object" || c === null) {
      problems.push(`clue${p} is missing`);
      continue;
    }
    oneOf(`clue${p}.interest`, c.interest, [1, 2, 3, 4, 5]);
    oneOf(`clue${p}.alone`, c.alone, ["no", "think", "instant"]);
    oneOf(`clue${p}.names_answer`, c.names_answer, [true, false]);
    oneOf(`clue${p}.wording`, c.wording, [1, 2, 3]);
    oneOf(`clue${p}.repeats`, c.repeats, [0, 1, 2, 3, 4]);
    oneOf(`clue${p}.fact`, c.fact, ["ok", "doubtful", "wrong"]);
    if (typeof c.note !== "string") problems.push(`clue${p}.note is not text`);
  }
  oneOf("distinct_facts", j.distinct_facts, [1, 2, 3, 4]);
  oneOf("order_ok", j.order_ok, [true, false]);
  oneOf("expected_solve", j.expected_solve, ["1", "2", "3", "4", "never"]);
  oneOf("clue4_unique", j.clue4_unique, [true, false]);
  oneOf("difficulty", j.difficulty, ["easy", "medium", "hard"]);
  oneOf("verdict", j.verdict, ["good", "needs_work", "bad"]);
  if (typeof j.summary !== "string") problems.push("summary is not text");
  return problems;
}

/**
 * Score a player's guesses, one per clue revealed, with the game's own
 * matcher. Guesses after the first right one are dropped.
 */
export function playerRunFromGuesses(q: Question, guesses: string[]): PlayerRun {
  for (let i = 0; i < guesses.length; i++) {
    if (matchGuess(q, guesses[i]).correct) return { solvedOn: i + 1, guesses: guesses.slice(0, i + 1) };
  }
  return { solvedOn: null, guesses };
}

/**
 * Split questions into subagent batches of at most `size`, keeping a graded
 * rewrite ("wizard-of-oz~silver-shoes") out of the batch that holds its
 * original. In one batch, a player could use one version to answer the
 * other, and a judge could grade one against the other.
 */
export function batchApart<T extends { id: string }>(items: T[], size: number): T[][] {
  const base = (id: string) => id.split("~")[0];
  const batches: T[][] = [];
  for (const item of items) {
    const fit = batches.find((b) => b.length < size && !b.some((o) => base(o.id) === base(item.id)));
    if (fit) fit.push(item);
    else batches.push([item]);
  }
  return batches;
}

export function clueOf(j: Judgement, position: number): ClueJudgement {
  const c = ({ 1: j.clue1, 2: j.clue2, 3: j.clue3, 4: j.clue4 } as const)[position as 1 | 2 | 3 | 4];
  if (!c) throw new Error(`no clue ${position} in judgement`);
  return c;
}

const POSITIONS = [1, 2, 3, 4] as const;

/**
 * Concrete problems, each tied to one rule in the README. A question with no
 * flags can still be "needs_work" in the judge's verdict; flags are what the
 * judge's numbers say, the verdict is its overall call.
 */
export const FLAG_LABELS = {
  "clue1-too-easy": "Clue 1 gives it away without thinking",
  "clue2-too-easy": "Clue 2 gives it away without thinking",
  "plays-easy": "Plays easy",
  "names-answer": "A clue uses a word from the answer's name",
  "dull-clue": "A clue before clue 4 is a summary or the most famous fact",
  repeats: "Two clues repeat each other",
  "few-distinct-facts": "Four clues cover two ideas or fewer",
  order: "A clue is easier than one after it",
  "clunky-wording": "A clue is awkward or vague",
  "fact-doubtful": "A fact may be wrong",
  "fact-wrong": "A fact is wrong",
  "not-unique": "Clue 4 doesn't point to one answer",
  "player-never-solved": "The simulated player never got it",
} as const;

export type Flag = keyof typeof FLAG_LABELS;

export function flagsFor(j: Judgement, player?: PlayerRun): Flag[] {
  const flags: Flag[] = [];
  const clues = POSITIONS.map((p) => clueOf(j, p));

  // Working the answer out from clue 1 is fine; getting it without thinking is not.
  if (j.clue1.alone === "instant") flags.push("clue1-too-easy");
  if (j.clue2.alone === "instant") flags.push("clue2-too-easy");
  if (j.difficulty === "easy") flags.push("plays-easy");
  if (clues.some((c) => c.names_answer)) flags.push("names-answer");
  // Clue 4 is allowed to be the plain giveaway, so it can't be "dull".
  if (clues.slice(0, 3).some((c) => c.interest <= 2)) flags.push("dull-clue");
  if (clues.some((c) => c.repeats !== 0)) flags.push("repeats");
  if (j.distinct_facts <= 2) flags.push("few-distinct-facts");
  if (!j.order_ok) flags.push("order");
  if (clues.some((c) => c.wording === 1)) flags.push("clunky-wording");
  if (clues.some((c) => c.fact === "wrong")) flags.push("fact-wrong");
  else if (clues.some((c) => c.fact === "doubtful")) flags.push("fact-doubtful");
  if (!j.clue4_unique) flags.push("not-unique");
  if (player && player.solvedOn === null) flags.push("player-never-solved");
  return flags;
}

/** Mean interest of clues 1-3, the ones the house rules ask to be interesting. */
export function meanInterest(j: Judgement): number {
  return (j.clue1.interest + j.clue2.interest + j.clue3.interest) / 3;
}

/** One question's result as stored in results/latest.json. */
export interface EvalEntry {
  id: string;
  answer: string;
  category: string;
  /** The difficulty written in the bank, for comparison with the judge's. */
  labelled: Difficulty;
  /** Hash of the judge prompt, model and question text this result came from. */
  judgeKey: string;
  /**
   * Who judged it: an API model id such as "claude-opus-5-5", or
   * "claude-code-subagent:opus" for a run inside a Claude Code session.
   */
  judgeModel: string;
  /** Hash of the player prompt, model and question this run came from. */
  playerKey?: string;
  playerModel?: string;
  judge: Judgement;
  player?: PlayerRun;
  flags: Flag[];
}

// ---------------------------------------------------------------------------
// Checks against Brian's grades (graded.ts)

export type Check =
  /** The judge must call the question ready to ship. */
  | { kind: "verdict-good" }
  /** The judge must not call the question ready to ship. */
  | { kind: "verdict-not-good" }
  /** An interesting clue that doesn't give the answer away without thinking. */
  | { kind: "clue-good"; clue: number }
  /** Not interesting: a summary, the famous fact, or something generic. */
  | { kind: "clue-weak"; clue: number }
  /** A summary or the most famous fact (the grading page's "Dull"). */
  | { kind: "clue-dull"; clue: number }
  /** Most typical players would name the answer from this clue at once, without thinking. */
  | { kind: "clue-too-easy"; clue: number }
  /** The clue uses a distinctive word from the answer's own name. */
  | { kind: "clue-names-answer"; clue: number }
  /** The judge must not flag a fact we have checked. */
  | { kind: "clue-fact-ok"; clue: number }
  /** The judge must see these two clues as repeating each other. */
  | { kind: "repeat-pair"; clues: [number, number] }
  /** The judge must not see these two clues as repeating each other. */
  | { kind: "no-repeat-pair"; clues: [number, number] }
  /** The clues cover two ideas or fewer, or some clue repeats another. */
  | { kind: "repetitive" };

export interface GradedCase {
  /** Bank question id. */
  id: string;
  /** Set when the case is a rewrite of the bank question rather than the question itself. */
  variant?: string;
  /** Clue texts that replace the bank's for this case, by position. */
  replaceClues?: Record<number, string>;
  /** What Brian said, close to his words. */
  said: string;
  expect: Check[];
}

export function caseKey(c: GradedCase): string {
  return c.variant ? `${c.id}~${c.variant}` : c.id;
}

/** The question a graded case runs on: the bank question with any clue replacements. */
export function applyCase(q: Question, c: GradedCase): Question {
  if (!c.replaceClues) return q;
  return {
    ...q,
    id: caseKey(c),
    clues: q.clues.map((clue) =>
      c.replaceClues?.[clue.position] !== undefined
        ? { ...clue, text: c.replaceClues[clue.position] }
        : clue,
    ),
  };
}

export function describeCheck(c: Check): string {
  switch (c.kind) {
    case "verdict-good":
      return "ready to ship";
    case "verdict-not-good":
      return "not ready to ship";
    case "clue-good":
      return `clue ${c.clue} is good`;
    case "clue-weak":
      return `clue ${c.clue} is not interesting`;
    case "clue-dull":
      return `clue ${c.clue} is dull`;
    case "clue-too-easy":
      return `clue ${c.clue} gives it away`;
    case "clue-names-answer":
      return `clue ${c.clue} uses the answer's name`;
    case "clue-fact-ok":
      return `clue ${c.clue}'s fact is right`;
    case "repeat-pair":
      return `clues ${c.clues[0]} and ${c.clues[1]} repeat`;
    case "no-repeat-pair":
      return `clues ${c.clues[0]} and ${c.clues[1]} don't repeat`;
    case "repetitive":
      return "clues repeat themselves";
  }
}

export interface CheckResult {
  check: Check;
  pass: boolean;
  /** What the judge actually said, for the calibration report. */
  got: string;
}

function pairRepeats(j: Judgement, [a, b]: [number, number]): boolean {
  return clueOf(j, a).repeats === b || clueOf(j, b).repeats === a;
}

export function runCheck(j: Judgement, check: Check): CheckResult {
  switch (check.kind) {
    case "verdict-good":
      return { check, pass: j.verdict === "good", got: `verdict ${j.verdict}` };
    case "verdict-not-good":
      return { check, pass: j.verdict !== "good", got: `verdict ${j.verdict}` };
    case "clue-good": {
      const c = clueOf(j, check.clue);
      return {
        check,
        pass: c.interest >= 4 && c.alone !== "instant",
        got: `interest ${c.interest}, alone ${c.alone}`,
      };
    }
    case "clue-weak": {
      const c = clueOf(j, check.clue);
      return { check, pass: c.interest <= 3, got: `interest ${c.interest}` };
    }
    case "clue-dull": {
      const c = clueOf(j, check.clue);
      return { check, pass: c.interest <= 2, got: `interest ${c.interest}` };
    }
    case "clue-too-easy": {
      const c = clueOf(j, check.clue);
      return { check, pass: c.alone === "instant", got: `alone ${c.alone}` };
    }
    case "clue-names-answer": {
      const c = clueOf(j, check.clue);
      return { check, pass: c.names_answer, got: c.names_answer ? "names it" : "doesn't name it" };
    }
    case "clue-fact-ok": {
      const c = clueOf(j, check.clue);
      return { check, pass: c.fact === "ok", got: `fact ${c.fact}` };
    }
    case "repeat-pair": {
      const pass = pairRepeats(j, check.clues);
      return { check, pass, got: pass ? "repeat" : "no repeat" };
    }
    case "no-repeat-pair": {
      const pass = !pairRepeats(j, check.clues);
      return { check, pass, got: pass ? "no repeat" : "repeat" };
    }
    case "repetitive": {
      const anyRepeat = POSITIONS.some((p) => clueOf(j, p).repeats !== 0);
      return {
        check,
        pass: j.distinct_facts <= 2 || anyRepeat,
        got: `${j.distinct_facts} distinct facts${anyRepeat ? ", repeats" : ""}`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Reports

function count<T extends string>(values: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}%` : "–";
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function renderCalibrationReport(
  rows: { c: GradedCase; results: CheckResult[]; judge: Judgement }[],
  meta: { judgeModel: string; date: string },
): string {
  const all = rows.flatMap((r) => r.results);
  const passed = all.filter((r) => r.pass).length;
  const lines = [
    "# Clue eval: agreement with Brian's grades",
    "",
    `Generated by \`pnpm eval-clues --graded\` on ${meta.date} with \`${meta.judgeModel}\`.`,
    "Each check is something Brian said about a question (see `graded.ts`).",
    "",
    `**${passed} of ${all.length} checks agree (${pct(passed, all.length)}).**`,
    "",
    "Read that number with care. Most of the grades so far say a question or clue",
    "falls short, so a judge that found fault with everything would agree with most",
    "of them. The checks that a clue is *good* are the ones that tell a fair judge",
    "from a harsh one.",
    "",
    "| Case | What was said | Check | Judge said | Agrees |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const { c, results } of rows) {
    results.forEach((r, i) => {
      const said = i === 0 ? cell(c.said) : "";
      lines.push(
        `| ${i === 0 ? caseKey(c) : ""} | ${said} | ${describeCheck(r.check)} | ${r.got} | ${r.pass ? "yes" : "**no**"} |`,
      );
    });
  }
  lines.push("", "## Judge summaries", "");
  for (const { c, judge } of rows) {
    lines.push(`- **${caseKey(c)}** (${judge.verdict}): ${judge.summary}`);
  }
  return lines.join("\n") + "\n";
}

export function renderBankReport(
  entries: EvalEntry[],
  meta: { judgeModel: string; playerModel: string; date: string },
): string {
  const n = entries.length;
  const verdicts = count(entries.map((e) => e.judge.verdict));
  const judged = count(entries.map((e) => e.judge.difficulty));
  const labelled = count(entries.map((e) => e.labelled));
  const expected = count(entries.map((e) => e.judge.expected_solve));
  const played = entries.filter((e) => e.player);
  const solved = count(played.map((e) => (e.player!.solvedOn === null ? "never" : String(e.player!.solvedOn))));
  const flags = count(entries.flatMap((e) => e.flags));
  const avg = (p: number) =>
    n ? (entries.reduce((s, e) => s + clueOf(e.judge, p).interest, 0) / n).toFixed(1) : "–";

  const lines = [
    "# Clue eval: bank report",
    "",
    `Generated by \`pnpm eval-clues\` on ${meta.date}. Judge \`${meta.judgeModel}\`, player \`${meta.playerModel}\`.`,
    "The rules it checks are in `lib/questions/README.md`, under \"What makes a good question\".",
    "",
    `**${n} questions. Verdicts: ${verdicts.get("good") ?? 0} good (${pct(verdicts.get("good") ?? 0, n)}), ${verdicts.get("needs_work") ?? 0} needs work, ${verdicts.get("bad") ?? 0} bad.**`,
    "",
    "## How the bank plays",
    "",
    "| | 1 | 2 | 3 | 4 | never |",
    "| --- | --- | --- | --- | --- | --- |",
    `| Judge: typical player solves on clue | ${["1", "2", "3", "4", "never"].map((k) => expected.get(k as Judgement["expected_solve"]) ?? 0).join(" | ")} |`,
    `| Simulated player solved on clue | ${["1", "2", "3", "4", "never"].map((k) => solved.get(k) ?? 0).join(" | ")} |`,
    "",
    "| Difficulty | easy | medium | hard |",
    "| --- | --- | --- | --- |",
    `| Labelled in the bank | ${(["easy", "medium", "hard"] as const).map((d) => labelled.get(d) ?? 0).join(" | ")} |`,
    `| As the judge thinks it plays | ${(["easy", "medium", "hard"] as const).map((d) => judged.get(d) ?? 0).join(" | ")} |`,
    "",
    `Mean interest (1-5) by clue: 1 = ${avg(1)}, 2 = ${avg(2)}, 3 = ${avg(3)}, 4 = ${avg(4)}.`,
    "",
    "## Problems found",
    "",
    "| Flag | Questions |",
    "| --- | --- |",
    ...(Object.keys(FLAG_LABELS) as Flag[])
      .filter((f) => flags.get(f))
      .sort((a, b) => (flags.get(b) ?? 0) - (flags.get(a) ?? 0))
      .map((f) => `| ${FLAG_LABELS[f]} | ${flags.get(f)} |`),
    "",
    "## Questions to fix, worst first",
    "",
    "Sorted by verdict, then by mean interest of clues 1-3. Per-clue notes are in `latest.json`.",
    "",
    "| Question | Category | Verdict | Interest 1-3 | Flags | What to fix |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  const rank = { bad: 0, needs_work: 1, good: 2 } as const;
  const toFix = entries
    .filter((e) => e.judge.verdict !== "good")
    .sort(
      (a, b) =>
        rank[a.judge.verdict] - rank[b.judge.verdict] ||
        meanInterest(a.judge) - meanInterest(b.judge) ||
        a.id.localeCompare(b.id),
    );
  for (const e of toFix) {
    const interest = [e.judge.clue1, e.judge.clue2, e.judge.clue3].map((c) => c.interest).join("/");
    lines.push(
      `| ${cell(e.answer)} (\`${e.id}\`) | ${cell(e.category)} | ${e.judge.verdict} | ${interest} | ${e.flags.join(", ")} | ${cell(e.judge.summary)} |`,
    );
  }
  return lines.join("\n") + "\n";
}
