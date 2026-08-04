/**
 * Post-round question feedback: three faces — bad / okay / good — plus an
 * optional note. The point is to find out which questions are worth keeping,
 * so a rating always carries enough context to read it fairly (which mode it
 * came from, and whether the rater actually solved the round).
 *
 * Pure types and helpers only — no React, no Supabase, same rule as lib/game.
 */

export const RATING_VALUES = ["bad", "okay", "good"] as const;
export type RatingValue = (typeof RATING_VALUES)[number];

export const RATING_MODES = ["daily", "practice"] as const;
export type RatingMode = (typeof RATING_MODES)[number];

/** Comments are a footnote, not an essay; anything longer is cut server-side. */
export const MAX_COMMENT_LENGTH = 500;

export function isRatingValue(value: unknown): value is RatingValue {
  return typeof value === "string" && (RATING_VALUES as readonly string[]).includes(value);
}

export function isRatingMode(value: unknown): value is RatingMode {
  return typeof value === "string" && (RATING_MODES as readonly string[]).includes(value);
}

/** bad/okay/good as −1/0/+1, so a question's ratings average to a score. */
export function ratingScore(rating: RatingValue): number {
  return rating === "good" ? 1 : rating === "bad" ? -1 : 0;
}

/** One submitted rating. `questionId` is a local bank slug or a Supabase uuid. */
export interface RatingRecord {
  id: string;
  questionId: string;
  rating: RatingValue;
  comment: string | null;
  mode: RatingMode;
  /** Whether the rater solved the round they are rating. */
  solved: boolean;
  /** ISO timestamp. */
  createdAt: string;
}

/** A rating being written; the store fills in id and createdAt. */
export interface NewRating {
  questionId: string;
  rating: RatingValue;
  mode: RatingMode;
  solved: boolean;
}
