"use client";

import { useState } from "react";
import type { RoundState } from "@/lib/game/roundState";
import type { PlayerStats } from "@/lib/game/stats";
import { buildShareText } from "@/lib/game/shareCard";
import { clueValue } from "@/lib/game/scoring";
import { StarHost } from "./StarHost";

interface ResultPanelProps {
  round: RoundState;
  answer: string;
  dailyNumber: number;
  clueCount: number;
  stats: PlayerStats;
}

export function ResultPanel({ round, answer, dailyNumber, clueCount, stats }: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const won = round.status === "won";
  const misses = round.wrongGuesses.length;

  async function share() {
    const text = buildShareText({
      dailyNumber,
      round,
      clueCount,
      streak: stats.currentStreak,
      url: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  const maxDist = Math.max(1, ...stats.solveDistribution.slice(0, clueCount));

  return (
    <div className="clue-enter flex flex-col items-center px-1 text-center">
      <StarHost expression={won ? "cheer" : "sad"} size={76} />
      <h2 className={`mt-2 text-2xl font-semibold ${won ? "text-gold-lt" : "text-cream"}`}>
        {won ? "Correct!" : "Out of clues"}
      </h2>
      {won ? (
        <>
          <p className="text-sm text-cream">
            +{round.score} points · solved on clue {(round.solvedClueIndex ?? 0) + 1}
          </p>
          {misses > 0 && (
            <p className="mt-0.5 text-xs text-lav">
              clue {(round.solvedClueIndex ?? 0) + 1} worth {clueValue(round.solvedClueIndex ?? 0)},
              −{misses} for {misses === 1 ? "one wrong guess" : `${misses} wrong guesses`}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-lav">No points this round</p>
      )}

      <div className="mt-4 w-full rounded-2xl border border-purple-line bg-[#2c2456]/60 p-3.5">
        <div className="text-[11px] uppercase tracking-[2px] text-lav">The answer was</div>
        <div className="my-1 text-[22px] font-semibold text-gold-lt">{answer}</div>
        <p className="text-[12.5px] leading-normal text-lav-lt">
          {won
            ? "Every clue above is a real fact — take one to trivia night."
            : "The clues above are yours to keep — tomorrow's a fresh one."}
        </p>
      </div>

      <div className="mt-4 flex w-full items-center justify-center gap-5 text-[13px] text-cream">
        <span>
          streak <b className="text-gold-lt">{stats.currentStreak}</b>
        </span>
        <span className="text-purple-line">|</span>
        <span>
          best <b className="text-gold-lt">{stats.maxStreak}</b>
        </span>
        <span className="text-purple-line">|</span>
        <span>
          played <b className="text-gold-lt">{stats.gamesPlayed}</b>
        </span>
      </div>

      <div className="mt-3 flex w-full flex-col gap-1.5" aria-label="Solve distribution">
        {Array.from({ length: clueCount }, (_, i) => {
          const n = stats.solveDistribution[i] ?? 0;
          const mine = won && round.solvedClueIndex === i;
          return (
            <div key={i} className="flex items-center gap-2 text-[11px] text-lav">
              <span className="w-10 text-right">clue {i + 1}</span>
              <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#241f4d]">
                <div
                  className={`h-full rounded-full ${mine ? "bg-gold" : "bg-purple-line"}`}
                  style={{ width: `${Math.max(n > 0 ? 12 : 0, (n / maxDist) * 100)}%` }}
                />
              </div>
              <span className="w-4 text-left">{n}</span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={share}
        className="btn-gold mt-5 w-full rounded-2xl py-3 text-base font-semibold"
      >
        {copied ? "Copied!" : "Share result"}
      </button>
      <p className="mt-2 text-xs text-lav">Spoiler-free — never shows the answer.</p>
    </div>
  );
}
