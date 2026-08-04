/**
 * What the /ratings review page needs: every rating rolled up per question and
 * paired with the question itself, so a row reads as "Salt — 3 good, 1 bad"
 * rather than as a bare uuid.
 *
 * Server-only: it resolves full questions (answers included) and returns every
 * note anyone left.
 */

import "server-only";
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
}

export interface Review {
  rows: ReviewRow[];
  totals: ReturnType<typeof overallTotals>;
}

export async function buildReview(sort: SummarySort): Promise<Review> {
  const summaries = sortSummaries(summarize(await listRatings()), sort);
  const questions = await Promise.all(summaries.map((s) => getQuestionById(s.questionId)));

  return {
    totals: overallTotals(summaries),
    rows: summaries.map((summary, i) => {
      const q = questions[i];
      return {
        summary,
        answer: q?.answer ?? null,
        category: q?.category ?? null,
        difficulty: q?.difficulty ?? null,
        clues: [...(q?.clues ?? [])].sort((a, b) => a.position - b.position).map((c) => c.text),
      };
    }),
  };
}
