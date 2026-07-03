/**
 * Scoring: each clue has a descending base value; every wrong guess
 * anywhere in the round costs a flat penalty off the final score.
 *
 *   score = max(0, clueValue(solvedClue) - wrongGuesses * WRONG_GUESS_PENALTY)
 */

/** Base value by 0-based clue index. 4-clue default: 10 / 8 / 6 / 4. */
export const CLUE_POINTS: readonly number[] = [10, 8, 6, 4, 2];

export const WRONG_GUESS_PENALTY = 1;

/** Base value of the clue at `clueIndex` (0-based). */
export function clueValue(clueIndex: number): number {
  return CLUE_POINTS[Math.min(clueIndex, CLUE_POINTS.length - 1)] ?? 0;
}

/** Net score for solving on `clueIndex` with `wrongGuessCount` misses. */
export function scoreForSolve(clueIndex: number, wrongGuessCount: number): number {
  return Math.max(0, clueValue(clueIndex) - wrongGuessCount * WRONG_GUESS_PENALTY);
}

/** What a solve is worth right now — shown under the medallion. */
export function currentNetValue(clueIndex: number, wrongGuessCount: number): number {
  return scoreForSolve(clueIndex, wrongGuessCount);
}

/** Maximum possible score for a clean first-clue solve. */
export const MAX_SCORE = CLUE_POINTS[0];
