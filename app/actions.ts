"use server";

/**
 * Server actions for daily + practice mode. The full question (with answer)
 * never leaves the server; the client receives clue text and match verdicts.
 */

import { matchGuess } from "@/lib/game/answerMatch";
import { dailyNumber } from "@/lib/game/daily";
import type { Difficulty, Question } from "@/lib/game/types";
import type { AnswerImage } from "@/lib/questions/answerImage";
import { getAnswerImage } from "@/lib/questions/answerImageSource";
import { getDailyQuestion, getQuestionById, getRandomQuestion } from "@/lib/questions/source";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PuzzleDto {
  questionId: string;
  category: string;
  difficulty: Difficulty;
  clueCount: number;
  /** All clue texts, in order. Revealed progressively by the client UI. */
  clues: string[];
}

export interface DailyPuzzleDto extends PuzzleDto {
  dateStr: string;
  dailyNumber: number;
}

function toPuzzleDto(question: Question): PuzzleDto {
  return {
    questionId: question.id,
    category: question.category,
    difficulty: question.difficulty,
    clueCount: question.clues.length,
    clues: [...question.clues].sort((a, b) => a.position - b.position).map((c) => c.text),
  };
}

export async function fetchDailyPuzzle(dateStr: string): Promise<DailyPuzzleDto> {
  if (!DATE_RE.test(dateStr)) throw new Error("Bad date");
  const { question } = await getDailyQuestion(dateStr);
  return { ...toPuzzleDto(question), dateStr, dailyNumber: dailyNumber(dateStr) };
}

/**
 * A random verified question for endless practice. `exclude` avoids recently-
 * seen questions; `avoidCategories` (newest-last) spaces categories apart so
 * the same one doesn't come up several rounds in a row.
 */
export async function fetchPracticePuzzle(
  exclude: string[] = [],
  avoidCategories: string[] = [],
): Promise<PuzzleDto> {
  const question = await getRandomQuestion(exclude.slice(0, 50), avoidCategories.slice(0, 8));
  return toPuzzleDto(question);
}

export interface GuessVerdict {
  correct: boolean;
  kind: "exact" | "alias" | "fuzzy" | "decoy" | "none";
  /** Near-miss flag, reserved for an "I meant this" confirm in single-player. */
  close: boolean;
}

export async function checkGuess(questionId: string, guess: string): Promise<GuessVerdict> {
  const question = await getQuestionById(questionId);
  if (!question) throw new Error("Unknown question");
  const match = matchGuess(question, String(guess).slice(0, 120));
  return { correct: match.correct, kind: match.kind, close: match.close };
}

export interface RevealDto {
  answer: string;
}

/** Reveal the answer once the round is over (client calls on win/loss). */
export async function revealAnswer(questionId: string): Promise<RevealDto> {
  const question = await getQuestionById(questionId);
  if (!question) throw new Error("Unknown question");
  return { answer: question.answer };
}

/**
 * The picture that goes with a revealed answer. Deliberately a second round
 * trip: it hits Wikipedia on a cold cache, and the result panel should never
 * wait on that. `null` whenever there is no freely-licensed picture.
 */
export async function fetchAnswerImage(questionId: string): Promise<AnswerImage | null> {
  const question = await getQuestionById(questionId);
  if (!question) return null;
  return getAnswerImage(question);
}
