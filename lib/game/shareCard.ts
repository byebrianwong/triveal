/**
 * Spoiler-free share text. Encodes the round's shape — never the answer,
 * never clue text.
 *
 *   Cluedown No. 142 — solved on clue 2
 *   ✕★··  7 pts · streak 8
 */

import type { RoundState } from "./roundState";

export interface ShareInput {
  dailyNumber: number;
  round: RoundState;
  clueCount: number;
  streak: number;
  url?: string;
}

export function buildShareGlyphs(round: RoundState, clueCount: number): string {
  const glyphs: string[] = [];
  const missed = new Set(round.wrongGuesses.map((g) => g.clueIndex));
  for (let i = 0; i < clueCount; i++) {
    if (round.status === "won" && round.solvedClueIndex === i) glyphs.push("★");
    else if (missed.has(i)) glyphs.push("✕");
    else glyphs.push("·");
  }
  return glyphs.join("");
}

export function buildShareText(input: ShareInput): string {
  const { dailyNumber, round, clueCount, streak, url } = input;
  const headline =
    round.status === "won"
      ? `solved on clue ${(round.solvedClueIndex ?? 0) + 1}`
      : "not today";
  const glyphs = buildShareGlyphs(round, clueCount);
  const scoreBit = round.status === "won" ? `${round.score} pts` : "0 pts";
  const streakBit = streak > 0 ? ` · streak ${streak}` : "";
  const lines = [
    `Cluedown No. ${dailyNumber} — ${headline}`,
    `${glyphs}  ${scoreBit}${streakBit}`,
  ];
  if (url) lines.push(url);
  return lines.join("\n");
}
