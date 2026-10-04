/**
 * Pure helpers for applying rewritten clues: check a rewrite against the
 * rules a machine can check, and splice new clue text into extraBank.ts.
 * Used by pipeline/fix-clues.ts.
 */

import { normalizeAnswer } from "@/lib/game/answerMatch";
import type { Question } from "@/lib/game/types";

/** What a rewriter returns for one question. */
export interface Rewrite {
  clues: string[];
  /** Source URL for each changed clue, keyed by its new position ("1".."4"). */
  sources: Record<string, string>;
  summary: string;
}

export const MAX_CLUE_LENGTH = 200;

/** Positions (1-based) whose text is new, not just one of the old clues moved. */
export function changedPositions(q: Question, clues: string[]): number[] {
  const old = new Set(q.clues.map((c) => c.text));
  return clues.flatMap((text, i) => (old.has(text) ? [] : [i + 1]));
}

/**
 * Problems that make a rewrite unusable. The leak check is the same one the
 * test suite runs: no clue may contain the answer or an alias, even inside a
 * longer word, after normalizing.
 */
export function rewriteProblems(q: Question, r: unknown): string[] {
  if (typeof r !== "object" || r === null) return ["not an object"];
  const { clues, sources, summary } = r as Partial<Rewrite>;
  if (!Array.isArray(clues) || clues.length !== q.clues.length) {
    return [`expected ${q.clues.length} clues`];
  }
  const problems: string[] = [];
  const banned = [...new Set([q.answerCanonical, q.answer, ...q.answerAliases].map(normalizeAnswer))].filter(Boolean);
  clues.forEach((text, i) => {
    if (typeof text !== "string" || !text.trim()) {
      problems.push(`clue ${i + 1} is empty`);
      return;
    }
    if (text.length > MAX_CLUE_LENGTH) problems.push(`clue ${i + 1} is ${text.length} characters`);
    const norm = normalizeAnswer(text);
    for (const name of banned) if (norm.includes(name)) problems.push(`clue ${i + 1} contains "${name}"`);
  });
  if (new Set(clues).size !== clues.length) problems.push("two clues are identical");
  if (typeof summary !== "string") problems.push("no summary");
  const src = (sources ?? {}) as Record<string, unknown>;
  for (const p of changedPositions(q, clues as string[])) {
    const url = src[String(p)];
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) problems.push(`clue ${p} changed but has no source`);
  }
  return problems;
}

/**
 * Replace one question's clues in extraBank.ts source text. Finds the
 * question by its `id:` line and rewrites its whole `clues: [ … ]` array, one
 * clue per line, in the file's existing format.
 */
export function replaceCluesInSource(source: string, id: string, clues: string[]): string {
  const idAt = source.indexOf(`id: ${JSON.stringify(id)},`);
  if (idAt === -1) throw new Error(`no question with id "${id}" in the source`);
  const nextId = source.indexOf("\n    id: ", idAt + 1);
  const open = /\n( *)clues: \[\n/g;
  open.lastIndex = idAt;
  const m = open.exec(source);
  if (!m || (nextId !== -1 && m.index > nextId)) throw new Error(`no clues array for "${id}"`);
  const indent = m[1];
  const start = m.index + m[0].length;
  const close = source.indexOf(`\n${indent}],`, start);
  if (close === -1 || (nextId !== -1 && close > nextId)) throw new Error(`clues array for "${id}" isn't closed`);
  const body = clues.map((text, i) => `${indent}  { position: ${i + 1}, text: ${JSON.stringify(text)} },`).join("\n");
  return source.slice(0, start) + body + source.slice(close);
}
