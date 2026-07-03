/**
 * Core domain types. This module (and everything in lib/game) is pure
 * TypeScript: no React, no Supabase, no browser APIs — portable to a
 * React Native client later.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface Clue {
  /** 1-based position; 1 = hardest, last = giveaway. */
  position: number;
  text: string;
}

export interface Decoy {
  text: string;
  /** 1-based clue position that rules this decoy out. */
  eliminatedByClue: number;
}

export interface Question {
  id: string;
  /** Display form, e.g. "New York City". */
  answer: string;
  /** Normalized form used for matching. */
  answerCanonical: string;
  /** Accepted alternates: abbreviations, spellings, short forms. */
  answerAliases: string[];
  category: string;
  difficulty: Difficulty;
  clues: Clue[];
  decoys: Decoy[];
}
