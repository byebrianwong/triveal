/**
 * What the /ratings review page needs: every rating rolled up per question and
 * paired with the question itself, so a row reads as "Salt — 3 good, 1 bad"
 * rather than as a bare uuid.
 *
 * Server-only: it resolves full questions (answers included) and returns every
 * note anyone left.
 */

import "server-only";
import type { Decoy } from "@/lib/game/types";
import { getQuestionById } from "@/lib/questions/source";
import { listRatings } from "./store";
import {
  overallTotals,
  sortSummaries,
  summarize,
  type QuestionRatingSummary,
  type SummarySort,
} from "./summary";

export interface ReviewRow {
  summary: QuestionRatingSummary;
  /** Null when the question has since left the bank — the ratings outlive it. */
  answer: string | null;
  category: string | null;
  difficulty: string | null;
  /**
   * Clue texts in play order, hardest first. A score alone doesn't say what
   * was wrong with a question — the clues are what you actually judge.
   */
  clues: string[];
  /**
   * The wrong answers the clues are meant to rule out, ordered by the clue
   * that kills them. They shape difficulty as much as the clues do: a decoy
   * no clue ever eliminates is a question that stays unfairly ambiguous to
   * the end, which is exactly the kind of thing a bad rating is complaining
   * about.
   */
  decoys: ReviewDecoy[];
}

export interface ReviewDecoy {
  text: string;
  /** 1-based clue position that rules it out; null when nothing does. */
  eliminatedByClue: number | null;
}

export interface Review {
  rows: ReviewRow[];
  totals: ReturnType<typeof overallTotals>;
}

/**
 * Order decoys by the clue that eliminates them, with the never-eliminated
 * ones last — those are the ones worth looking at, so they end up next to the
 * notes rather than buried mid-list.
 *
 * A position of 0 (the Supabase default when the column is null) or one past
 * the last clue means nothing rules it out, and is reported as such rather
 * than shown as a clue number that doesn't exist.
 */
function reviewDecoys(decoys: Decoy[], clueCount: number): ReviewDecoy[] {
  return decoys
    .map(({ text, eliminatedByClue }) => ({
      text,
      eliminatedByClue:
        eliminatedByClue >= 1 && eliminatedByClue <= clueCount ? eliminatedByClue : null,
    }))
    .sort((a, b) => (a.eliminatedByClue ?? Infinity) - (b.eliminatedByClue ?? Infinity));
}

export async function buildReview(sort: SummarySort): Promise<Review> {
  const summaries = sortSummaries(summarize(await listRatings()), sort);
  const questions = await Promise.all(summaries.map((s) => getQuestionById(s.questionId)));

  return {
    totals: overallTotals(summaries),
    rows: summaries.map((summary, i) => {
      const q = questions[i];
      const clues = [...(q?.clues ?? [])].sort((a, b) => a.position - b.position);
      return {
        summary,
        answer: q?.answer ?? null,
        category: q?.category ?? null,
        difficulty: q?.difficulty ?? null,
        clues: clues.map((c) => c.text),
        decoys: reviewDecoys(q?.decoys ?? [], clues.length),
      };
    }),
  };
}
