/**
 * Single-player round state machine. Pure reducer: UI dispatches actions,
 * never computes correctness or points itself. The same shape backs party
 * mode server-side later.
 */

import { matchGuess, type MatchResult } from "./answerMatch";
import { scoreForSolve } from "./scoring";
import type { Question } from "./types";

export type RoundStatus = "playing" | "won" | "lost";

export interface WrongGuess {
  /** 0-based clue index the guess was made on. */
  clueIndex: number;
  guess: string;
}

export interface RoundState {
  /** 0-based index of the clue currently showing. */
  clueIndex: number;
  wrongGuesses: WrongGuess[];
  status: RoundStatus;
  /** Set when won: which clue (0-based) the solve landed on. */
  solvedClueIndex: number | null;
  /** Final score; 0 unless won. */
  score: number;
}

export function initialRoundState(): RoundState {
  return {
    clueIndex: 0,
    wrongGuesses: [],
    status: "playing",
    solvedClueIndex: null,
    score: 0,
  };
}

export interface GuessOutcome {
  state: RoundState;
  match: MatchResult;
}

/**
 * Apply an already-computed match result (e.g. from a server action that
 * holds the answer). Correct -> won with score. Wrong -> −1 recorded and
 * the next clue reveals automatically; a miss on the final clue ends the
 * round.
 */
export function applyMatch(
  state: RoundState,
  clueCount: number,
  match: MatchResult,
  rawGuess: string,
): GuessOutcome {
  if (state.status !== "playing") return { state, match: { correct: false, kind: "none", close: false } };

  if (match.correct) {
    return {
      match,
      state: {
        ...state,
        status: "won",
        solvedClueIndex: state.clueIndex,
        score: scoreForSolve(state.clueIndex, state.wrongGuesses.length),
      },
    };
  }

  const wrongGuesses = [
    ...state.wrongGuesses,
    { clueIndex: state.clueIndex, guess: rawGuess.trim() },
  ];
  const onLastClue = state.clueIndex >= clueCount - 1;

  return {
    match,
    state: onLastClue
      ? { ...state, wrongGuesses, status: "lost" }
      : { ...state, wrongGuesses, clueIndex: state.clueIndex + 1 },
  };
}

/** Convenience for offline/practice: match locally, then apply. */
export function submitGuess(
  state: RoundState,
  question: Question,
  rawGuess: string,
): GuessOutcome {
  const match = matchGuess(question, rawGuess);
  return applyMatch(state, question.clues.length, match, rawGuess);
}

/** Voluntarily reveal the next clue (no penalty beyond the value decay). */
export function revealNextClue(state: RoundState, clueCount: number): RoundState {
  if (state.status !== "playing") return state;
  if (state.clueIndex >= clueCount - 1) return state;
  return { ...state, clueIndex: state.clueIndex + 1 };
}

/** Give up: round ends unsolved. */
export function giveUp(state: RoundState): RoundState {
  if (state.status !== "playing") return state;
  return { ...state, status: "lost" };
}
