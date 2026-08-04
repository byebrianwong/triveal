/**
 * Rolling up raw ratings into a per-question verdict for the review page.
 *
 * Deliberately done in memory rather than as a SQL aggregate: the two stores
 * (Supabase and the local file) then share one implementation, and the volume
 * is tiny — this is one person reviewing a few hundred questions, not a
 * dashboard over millions of rows.
 */

import { ratingScore, type RatingRecord, type RatingValue } from "./types";

export interface RatingComment {
  text: string;
  rating: RatingValue;
  mode: string;
  createdAt: string;
}

export interface QuestionRatingSummary {
  questionId: string;
  counts: Record<RatingValue, number>;
  total: number;
  /** Mean of −1/0/+1 across every rating: −1 is unanimously bad, +1 unanimously good. */
  score: number;
  /** How many raters solved the round — a "bad" from someone who lost reads differently. */
  solved: number;
  comments: RatingComment[];
  /** ISO timestamp of the most recent rating. */
  lastRatedAt: string;
}

export type SummarySort = "worst" | "best" | "recent" | "most";

export function summarize(records: RatingRecord[]): QuestionRatingSummary[] {
  const byQuestion = new Map<string, QuestionRatingSummary>();

  for (const r of records) {
    let s = byQuestion.get(r.questionId);
    if (!s) {
      s = {
        questionId: r.questionId,
        counts: { bad: 0, okay: 0, good: 0 },
        total: 0,
        score: 0,
        solved: 0,
        comments: [],
        lastRatedAt: r.createdAt,
      };
      byQuestion.set(r.questionId, s);
    }
    s.counts[r.rating] += 1;
    s.total += 1;
    s.score += ratingScore(r.rating);
    if (r.solved) s.solved += 1;
    if (r.comment) {
      s.comments.push({
        text: r.comment,
        rating: r.rating,
        mode: r.mode,
        createdAt: r.createdAt,
      });
    }
    if (r.createdAt > s.lastRatedAt) s.lastRatedAt = r.createdAt;
  }

  for (const s of byQuestion.values()) {
    s.score = s.total ? s.score / s.total : 0;
    s.comments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  return [...byQuestion.values()];
}

/**
 * Order summaries for the review page. `worst`/`best` sort by score with the
 * rating count as the tiebreak, so a question three people called bad outranks
 * one lone thumbs-down rather than being buried under it.
 */
export function sortSummaries(
  summaries: QuestionRatingSummary[],
  sort: SummarySort,
): QuestionRatingSummary[] {
  const sorted = [...summaries];
  switch (sort) {
    case "best":
      sorted.sort((a, b) => b.score - a.score || b.total - a.total);
      break;
    case "recent":
      sorted.sort((a, b) => (a.lastRatedAt < b.lastRatedAt ? 1 : -1));
      break;
    case "most":
      sorted.sort((a, b) => b.total - a.total || a.score - b.score);
      break;
    case "worst":
    default:
      sorted.sort((a, b) => a.score - b.score || b.total - a.total);
      break;
  }
  return sorted;
}

/** Totals for the review page header. */
export function overallTotals(summaries: QuestionRatingSummary[]) {
  const counts: Record<RatingValue, number> = { bad: 0, okay: 0, good: 0 };
  let comments = 0;
  for (const s of summaries) {
    counts.bad += s.counts.bad;
    counts.okay += s.counts.okay;
    counts.good += s.counts.good;
    comments += s.comments.length;
  }
  return {
    counts,
    comments,
    questions: summaries.length,
    ratings: counts.bad + counts.okay + counts.good,
  };
}
