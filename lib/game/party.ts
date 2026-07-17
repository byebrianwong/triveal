/**
 * Party-mode game logic — pure, server-authoritative, no React/Supabase.
 *
 * Party mode is a Jackbox-style race: a room of players sees the same
 * question, clues reveal one at a time on a shared timer, and the FIRST
 * correct answer wins the round. A wrong guess locks you out until the next
 * clue reveals (one shot per clue), so guessing early is a gamble. The round
 * is worth the current clue's value (10/8/6/4), so winning earlier scores
 * more — mirroring the single-player decay.
 *
 * These functions are the source of truth the server actions call; the DB
 * rows (cluedown_games / _players / _rounds / _guesses) persist the results
 * and a unique index enforces first-correct-wins at the storage layer too.
 */

import { clueValue } from "./scoring";

// Unambiguous room-code alphabet: no I/O/1/0 (spec §4 — "4 chars, no I/O/1/0").
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

/**
 * Generate a room code from the unambiguous alphabet. `rng` is injectable so
 * tests are deterministic; defaults to Math.random in real use.
 */
export function generateRoomCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.min(
      ROOM_CODE_ALPHABET.length - 1,
      Math.max(0, Math.floor(rng() * ROOM_CODE_ALPHABET.length)),
    );
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

/** Normalize player-typed codes: uppercase and map look-alikes (O→0? no — */
/*  our alphabet has no 0/O ambiguity by design, but players still lowercase). */
export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** A code is valid iff it is the right length and uses only alphabet chars. */
export function isValidRoomCode(raw: string): boolean {
  const code = normalizeRoomCode(raw);
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

// --- Round state (one question in flight for the whole room) ------------------

export type PartyRoundStatus = "revealing" | "resolved";

export interface PartyRoundState {
  /** 0-based index of the clue currently showing to the room. */
  clueIndex: number;
  /** Total clues for this question. */
  clueCount: number;
  status: PartyRoundStatus;
  /** Winner once resolved; null if resolved with no correct guess. */
  winnerPlayerId: string | null;
  /**
   * playerId -> the clueIndex they last guessed wrong on. A player is locked
   * out for the clue they missed and gets a fresh shot when the next reveals.
   */
  lockedOut: Record<string, number>;
}

export function initialPartyRound(clueCount: number): PartyRoundState {
  return {
    clueIndex: 0,
    clueCount,
    status: "revealing",
    winnerPlayerId: null,
    lockedOut: {},
  };
}

/** Can this player submit a guess right now? */
export function canPlayerGuess(state: PartyRoundState, playerId: string): boolean {
  if (state.status !== "revealing") return false;
  return state.lockedOut[playerId] !== state.clueIndex;
}

export interface PartyGuessOutcome {
  state: PartyRoundState;
  /** False when the guess was ignored (round resolved, or player locked out). */
  accepted: boolean;
  /** True only when this guess just won the round. */
  wonRound: boolean;
}

/**
 * Apply a guess whose correctness was already computed server-side (the
 * client never holds the answer). Correct + still open -> the player wins and
 * the round resolves. Wrong -> the player is locked out for the current clue.
 * Guesses from resolved rounds or locked-out players are rejected, not scored.
 */
export function applyPartyGuess(
  state: PartyRoundState,
  playerId: string,
  correct: boolean,
): PartyGuessOutcome {
  if (!canPlayerGuess(state, playerId)) {
    return { state, accepted: false, wonRound: false };
  }

  if (correct) {
    return {
      accepted: true,
      wonRound: true,
      state: { ...state, status: "resolved", winnerPlayerId: playerId },
    };
  }

  return {
    accepted: true,
    wonRound: false,
    state: {
      ...state,
      lockedOut: { ...state.lockedOut, [playerId]: state.clueIndex },
    },
  };
}

/**
 * Reveal the next clue: advances the shared pointer and clears every lockout
 * so all players get a fresh guess. If the last clue is already showing, the
 * round resolves with no winner (nobody got it).
 */
export function revealNextPartyClue(state: PartyRoundState): PartyRoundState {
  if (state.status !== "revealing") return state;
  if (state.clueIndex >= state.clueCount - 1) {
    return { ...state, status: "resolved" };
  }
  return { ...state, clueIndex: state.clueIndex + 1, lockedOut: {} };
}

/** Points the winner earns for resolving on the current clue (10/8/6/4). */
export function partyRoundPoints(state: PartyRoundState): number {
  return state.winnerPlayerId ? clueValue(state.clueIndex) : 0;
}

// --- Standings ---------------------------------------------------------------

export interface PartyPlayer {
  id: string;
  name: string;
  score: number;
  /** ISO timestamp or epoch ms; used only as a stable tiebreaker. */
  joinedAt: number | string;
}

export interface PartyStanding {
  playerId: string;
  name: string;
  score: number;
  /** 1-based rank; players tied on score share... no — ranks are dense and
   *  unique, broken by earlier join time so the leaderboard is deterministic. */
  rank: number;
}

/**
 * Rank players by score (desc), breaking ties by who joined first so the
 * board never flickers between equal scores.
 */
export function rankStandings(players: PartyPlayer[]): PartyStanding[] {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = typeof a.joinedAt === "string" ? Date.parse(a.joinedAt) : a.joinedAt;
    const bt = typeof b.joinedAt === "string" ? Date.parse(b.joinedAt) : b.joinedAt;
    if (at !== bt) return at - bt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted.map((p, i) => ({
    playerId: p.id,
    name: p.name,
    score: p.score,
    rank: i + 1,
  }));
}

// --- Game lifecycle ----------------------------------------------------------

/** Default rounds per party game; overridable via game settings. */
export const DEFAULT_PARTY_ROUNDS = 5;

/** The round number (1-based) that should play after `completedRounds`. */
export function nextRoundNumber(completedRounds: number): number {
  return completedRounds + 1;
}

/** Is the game over — have we finished the configured number of rounds? */
export function isGameOver(completedRounds: number, totalRounds: number): boolean {
  return completedRounds >= totalRounds;
}
