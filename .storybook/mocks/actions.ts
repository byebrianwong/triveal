// Stand-in for app/actions.ts in Storybook (see MOCKED_MODULES in main.ts).
//
// Each export is a spy with a sensible default, so a story that says nothing
// gets a working game: the daily and practice puzzles load, the right answer
// is accepted, and a picture and summary come back. A story changes one
// behaviour with `mocked(checkGuess).mockResolvedValue(...)` in its
// `beforeEach`.

import { fn, type Mock } from "storybook/test";
import type * as real from "@/app/actions";
import type { AnswerInfo } from "@/lib/questions/answerInfo";
import { ANSWERS, ANSWER_INFO, DAILY_PUZZLE, DECOYS, PRACTICE_PUZZLE } from "../fixtures";

type Actions = typeof real;

const defaults: Actions = {
  fetchDailyPuzzle: async () => DAILY_PUZZLE,
  fetchPracticePuzzle: async () => PRACTICE_PUZZLE,
  checkGuess: async (questionId, guess) => {
    const typed = guess.trim().toLowerCase();
    if (typed === ANSWERS[questionId]?.toLowerCase()) {
      return { correct: true, kind: "exact", close: false };
    }
    const decoy = DECOYS[questionId]?.includes(typed) ?? false;
    return { correct: false, kind: decoy ? "decoy" : "none", close: false };
  },
  revealAnswer: async (questionId) => ({ answer: ANSWERS[questionId] ?? "Unknown" }),
  fetchAnswerInfo: async (questionId) =>
    (ANSWER_INFO as Record<string, AnswerInfo>)[questionId] ?? null,
  rateQuestion: async () => ({ ratingId: "rating-1" }),
  commentOnRating: async () => true,
};

export const fetchDailyPuzzle = fn(defaults.fetchDailyPuzzle).mockName("fetchDailyPuzzle");
export const fetchPracticePuzzle = fn(defaults.fetchPracticePuzzle).mockName("fetchPracticePuzzle");
export const checkGuess = fn(defaults.checkGuess).mockName("checkGuess");
export const revealAnswer = fn(defaults.revealAnswer).mockName("revealAnswer");
export const fetchAnswerInfo = fn(defaults.fetchAnswerInfo).mockName("fetchAnswerInfo");
export const rateQuestion = fn(defaults.rateQuestion).mockName("rateQuestion");
export const commentOnRating = fn(defaults.commentOnRating).mockName("commentOnRating");

function restore<T extends (...args: never[]) => unknown>(mock: Mock<T>, impl: T) {
  mock.mockReset();
  mock.mockImplementation(impl as Parameters<Mock<T>["mockImplementation"]>[0]);
}

/** Put every stand-in back to its default. Runs before each story. */
export function resetActionMocks() {
  restore(fetchDailyPuzzle, defaults.fetchDailyPuzzle);
  restore(fetchPracticePuzzle, defaults.fetchPracticePuzzle);
  restore(checkGuess, defaults.checkGuess);
  restore(revealAnswer, defaults.revealAnswer);
  restore(fetchAnswerInfo, defaults.fetchAnswerInfo);
  restore(rateQuestion, defaults.rateQuestion);
  restore(commentOnRating, defaults.commentOnRating);
}
