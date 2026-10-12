/**
 * The fact-check pass: a second check on the bank, separate from the clue
 * judge. The judge marks a fact "doubtful" from memory and never looks
 * anything up. A fact checker opens sources and gives each clue a verdict.
 * Used by pipeline/fact-check.ts; the results live in results/factcheck.json.
 */

import { containsAnswerName, normalizeAnswer } from "@/lib/game/answerMatch";
import type { Question } from "@/lib/game/types";

export const FACT_VERDICTS = ["ok", "loose", "wrong", "unverified"] as const;
export type FactVerdict = (typeof FACT_VERDICTS)[number];

/** One clue's check. `text` is the clue as it was checked. */
export interface ClueCheck {
  position: number;
  text: string;
  verdict: FactVerdict;
  /** A short note and the URL that settled it. */
  evidence: string;
  /** For loose and wrong: what is off. */
  problem?: string;
  /** For loose and wrong: a corrected clue, backed by the same evidence. */
  fix?: string;
}

/** Every check recorded for one question, newest last. */
export interface FactCheckEntry {
  id: string;
  answer: string;
  checks: (ClueCheck & { checkedOn: string; checker: string })[];
}

export interface FactCheckFile {
  meta: { about: string };
  questions: Record<string, FactCheckEntry>;
}

const clueTexts = (q: Question) => [...q.clues].sort((a, b) => a.position - b.position).map((c) => c.text);

/**
 * A clue counts as checked when a check on that exact text came back ok, or
 * when the text is a checker's own fix. Any edit to a clue makes it unchecked
 * again, so a rewrite always gets checked afresh.
 */
export function isClueChecked(entry: FactCheckEntry | undefined, text: string): boolean {
  return Boolean(entry?.checks.some((c) => (c.text === text && c.verdict === "ok") || c.fix === text));
}

/** Positions (1-based) of the clues that still need a check. */
export function uncheckedPositions(q: Question, entry: FactCheckEntry | undefined): number[] {
  return clueTexts(q).flatMap((text, i) => (isClueChecked(entry, text) ? [] : [i + 1]));
}

/** The latest check of each current clue that did not come back ok, and isn't settled by a fix. */
export function openProblems(q: Question, entry: FactCheckEntry | undefined): ClueCheck[] {
  if (!entry) return [];
  return clueTexts(q).flatMap((text, i) => {
    if (isClueChecked(entry, text)) return [];
    const latest = entry.checks.filter((c) => c.text === text).at(-1);
    return latest ? [{ ...latest, position: i + 1 }] : [];
  });
}

/** What a checker gets for one question. */
export interface CheckItem {
  q: Question;
  positions: number[];
  /** URLs a writer cited for a clue, keyed by clue text. */
  sources: Record<string, string[]>;
}

export function factCheckTaskPrompt(items: CheckItem[]): string {
  const blocks = items
    .map(({ q, positions, sources }) => {
      const names = [q.answer, ...q.answerAliases].map((n) => `"${n}"`).join(", ");
      const clues = clueTexts(q)
        .map((text, i) => {
          const p = i + 1;
          const tag = positions.includes(p) ? "CHECK" : "already checked, context only";
          const cited = sources[text]?.length ? `\n  Cited by its writer: ${sources[text].join(" ")}` : "";
          return `Clue ${p} (${tag}): ${text}${cited}`;
        })
        .join("\n");
      return `<question id="${q.id}">
Answer: ${q.answer}
Category: ${q.category}
Names that must not appear in any clue, even inside a longer word: ${names}

${clues}
</question>`;
    })
    .join("\n\n");

  return `You fact-check clues for Triveal, a daily trivia game played by real people. Each question has one answer and four clues. Your only job is to find clues that are false, overstated or misleading. You are not judging style or difficulty.

Check every clue marked CHECK:

1. Split it into its separate factual claims: names, numbers, dates, firsts, superlatives, causes, "the only", "the oldest", quotes.
2. Check each claim against a source you open in this session with WebFetch or WebSearch. Open a cited source first; if it doesn't support the claim, search for a reliable one that does or that contradicts it. Budget about 2-4 tool calls per question; searches are capped for the whole session. Spend them on the claims most likely to be wrong: exact numbers, dates, firsts and onlys, quotes, and stories that sound too good.
3. Give a verdict:
   - "ok": every claim is supported.
   - "loose": true in substance, but a detail is overstated, too precise, out of date, or states a legend or disputed claim as fact.
   - "wrong": a claim is false.
   - "unverified": you could not confirm or refute it.
   For loose and wrong, say what is off in "problem", and give "fix": a corrected clue that keeps the clue's interest and length and is supported by your evidence. Leave "fix" out if no true version exists; then say in "problem" that the clue needs replacing.

Events after your training data may be real. If a claim is about something recent, search for it before calling it wrong.

A fix must keep the game's rules: no listed name may appear, even inside a longer word; one sentence about the answer, in the same voice as the other clues ("This painting...", "this city's..."); straight quotes and apostrophes only; em dashes and proper diacritics as in the other clues.

${blocks}

When you're done, write only a JSON object, with no other text and no code fence. Its keys are the question ids. Each value lists the clues you checked:
{"clues": [{"position": 1, "verdict": "ok", "evidence": "what the source says, then its URL"}, {"position": 3, "verdict": "loose", "problem": "...", "fix": "corrected clue", "evidence": "... https://..."}]}
Include every clue marked CHECK and no others. Every evidence note ends with the URL of a page you opened. If web search stops working, write what you checked and mark the rest "unverified".`;
}

/**
 * Problems that make one question's answer unusable. Checks the shape, that
 * every clue asked about came back, and that a fix keeps the leak rule.
 */
export function factCheckAnswerProblems(q: Question, positions: number[], answer: unknown): string[] {
  if (typeof answer !== "object" || answer === null) return ["no answer"];
  const clues = (answer as { clues?: unknown }).clues;
  if (!Array.isArray(clues)) return ["no clues list"];
  const problems: string[] = [];
  const banned = [...new Set([q.answerCanonical, q.answer, ...q.answerAliases].map(normalizeAnswer))].filter(Boolean);
  const seen = new Set<number>();
  for (const c of clues as Partial<ClueCheck>[]) {
    const p = Number(c?.position);
    if (!positions.includes(p)) {
      problems.push(`clue ${c?.position} wasn't asked about`);
      continue;
    }
    seen.add(p);
    if (!FACT_VERDICTS.includes(c.verdict as FactVerdict)) problems.push(`clue ${p} has verdict "${c.verdict}"`);
    if (typeof c.evidence !== "string" || !c.evidence.trim()) problems.push(`clue ${p} has no evidence`);
    if (c.fix !== undefined) {
      if (typeof c.fix !== "string" || !c.fix.trim()) problems.push(`clue ${p}'s fix is empty`);
      else for (const name of banned) if (containsAnswerName(normalizeAnswer(c.fix), name)) problems.push(`clue ${p}'s fix contains "${name}"`);
    }
  }
  for (const p of positions) if (!seen.has(p)) problems.push(`clue ${p} is missing`);
  return problems;
}

/** The markdown report: what the checks found that is still in the bank. */
export function factCheckReport(bank: Question[], file: FactCheckFile, today: string): string {
  let ok = 0;
  let unchecked = 0;
  const rows: string[] = [];
  for (const q of bank) {
    const entry = file.questions[q.id];
    const open = uncheckedPositions(q, entry);
    if (!open.length) {
      ok++;
      continue;
    }
    const problems = openProblems(q, entry);
    if (problems.length < open.length) unchecked++;
    for (const c of problems) {
      const cell = (s: string | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      rows.push(`| ${q.answer} (\`${q.id}\`) | ${c.position} | ${c.verdict} | ${cell(c.text)} | ${cell(c.problem)} | ${cell(c.fix)} |`);
    }
  }
  const lines = [
    "# Fact check: bank report",
    "",
    `Generated by \`pipeline/fact-check.ts\` on ${today}. Each clue was checked against sources a checker opened; see \`factcheck.json\` for the evidence.`,
    "",
    `**${bank.length} questions. ${ok} have every clue checked ok. ${unchecked} have clues not checked yet. ${rows.length} clues have an open problem.**`,
    "",
  ];
  if (rows.length) {
    lines.push("## Open problems", "", "| Question | Clue | Verdict | Clue text | Problem | Suggested fix |", "| --- | --- | --- | --- | --- | --- |", ...rows, "");
  }
  return lines.join("\n");
}
