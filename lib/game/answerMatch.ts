/**
 * Forgiving open-text answer matching that never accepts a decoy.
 *
 * Pipeline: normalize both sides -> reject decoys -> exact/alias match ->
 * length-scaled Levenshtein for typos.
 */

import type { Question } from "./types";

const LEADING_ARTICLES = /^(a|an|the)\s+/;

/** Lowercase, strip diacritics/punctuation/articles, collapse whitespace. */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ") // punctuation -> space so "spider-man" ~ "spider man"
    .replace(/\s+/g, " ")
    .trim()
    .replace(LEADING_ARTICLES, "");
}

/** Classic dynamic-programming Levenshtein distance. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Typo budget scaled to answer length: short answers get none. */
export function fuzzyTolerance(target: string): number {
  if (target.length <= 4) return 0;
  if (target.length <= 7) return 1;
  return 2;
}

export type MatchKind = "exact" | "alias" | "fuzzy" | "decoy" | "none";

export interface MatchResult {
  correct: boolean;
  kind: MatchKind;
  /** True for near-misses worth an "I meant this" confirm in single-player. */
  close: boolean;
}

function withinFuzz(guess: string, target: string): boolean {
  const tol = fuzzyTolerance(target);
  return tol > 0 && levenshtein(guess, target) <= tol;
}

/** Match an open-text guess against a question's answer, aliases, and decoys. */
export function matchGuess(question: Question, rawGuess: string): MatchResult {
  const guess = normalizeAnswer(rawGuess);
  if (!guess) return { correct: false, kind: "none", close: false };

  // Decoys are real wrong answers, never typos of the right one. Check first
  // so "Mercury" can't fuzzy-match anything.
  for (const decoy of question.decoys) {
    const d = normalizeAnswer(decoy.text);
    if (guess === d || withinFuzz(guess, d)) {
      return { correct: false, kind: "decoy", close: false };
    }
  }

  const canonical = normalizeAnswer(question.answerCanonical || question.answer);
  if (guess === canonical) return { correct: true, kind: "exact", close: false };

  for (const alias of question.answerAliases) {
    if (guess === normalizeAnswer(alias)) {
      return { correct: true, kind: "alias", close: false };
    }
  }

  if (withinFuzz(guess, canonical)) return { correct: true, kind: "fuzzy", close: true };
  for (const alias of question.answerAliases) {
    if (withinFuzz(guess, normalizeAnswer(alias))) {
      return { correct: true, kind: "fuzzy", close: true };
    }
  }

  return { correct: false, kind: "none", close: false };
}
