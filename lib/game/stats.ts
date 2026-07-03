/**
 * Streaks and solve distribution. Pure update logic; persistence
 * (localStorage) lives in the client layer.
 */

import type { RoundState } from "./roundState";

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  totalScore: number;
  /** wins by 0-based solved clue index; length tracks max clue count. */
  solveDistribution: number[];
  /** Local date (YYYY-MM-DD) of the last completed daily. */
  lastCompletedDate: string | null;
}

export function initialStats(): PlayerStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    totalScore: 0,
    solveDistribution: [0, 0, 0, 0, 0],
    lastCompletedDate: null,
  };
}

function previousDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Fold a finished round into the stats. Call exactly once per daily. */
export function applyResult(
  stats: PlayerStats,
  dateStr: string,
  round: RoundState,
): PlayerStats {
  if (stats.lastCompletedDate === dateStr) return stats; // already recorded

  const won = round.status === "won";
  const continued = stats.lastCompletedDate === previousDateString(dateStr);
  const currentStreak = won ? (continued ? stats.currentStreak + 1 : 1) : 0;

  const solveDistribution = [...stats.solveDistribution];
  if (won && round.solvedClueIndex != null) {
    while (solveDistribution.length <= round.solvedClueIndex) solveDistribution.push(0);
    solveDistribution[round.solvedClueIndex] += 1;
  }

  return {
    gamesPlayed: stats.gamesPlayed + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    totalScore: stats.totalScore + round.score,
    solveDistribution,
    lastCompletedDate: dateStr,
  };
}
