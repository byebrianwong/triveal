"use client";

import { useState } from "react";
import type { RoundState } from "@/lib/game/roundState";
import type { PlayerStats } from "@/lib/game/stats";
import { buildShareText } from "@/lib/game/shareCard";
import { clueValue } from "@/lib/game/scoring";
import { AnswerInfo } from "./AnswerInfo";
import { EnterHint, useEnterKey } from "./keyboard";
import { RateQuestion } from "./RateQuestion";
import { StarHost } from "./StarHost";

interface ResultPanelProps {
  round: RoundState;
  answer: string;
  /** Identifies the question to the answer-picture lookup. */
  questionId: string;
  dailyNumber: number;
  clueCount: number;
  stats: PlayerStats;
  onSecondary?: () => void;
  secondaryLabel?: string;
}

export function ResultPanel({
  round,
  answer,
  questionId,
  dailyNumber,
  clueCount,
  stats,
  onSecondary,
  secondaryLabel,
}: ResultPanelProps) {
  const [copied, setCopied] = useState(false);
  const won = round.status === "won";
  const misses = round.wrongGuesses.length;
  // Enter keeps you playing rather than sharing: a share sheet is a detour
  // nobody wants to open by accident.
  useEnterKey(() => onSecondary?.(), Boolean(onSecondary));

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
    <>
      {/* The answer. On desktop the round's grid puts this top-left, with
          the clue recap under it. */}
      <div className="clue-enter flex flex-col items-center px-1 text-center lg:col-start-1 lg:row-start-1">
        <StarHost expression={won ? "cheer" : "sad"} size={76} />
        <h2 className={`mt-2 text-2xl font-semibold lg:text-[30px] ${won ? "text-gold-lt" : "text-cream"}`}>
          {won ? "Correct!" : "Out of clues"}
        </h2>
        {won ? (
          <>
            <p className="text-sm text-cream lg:mt-1 lg:text-base">
              +{round.score} points · solved on clue {(round.solvedClueIndex ?? 0) + 1}
            </p>
            {misses > 0 && (
              <p className="mt-0.5 text-xs text-lav lg:text-sm">
                clue {(round.solvedClueIndex ?? 0) + 1} worth {clueValue(round.solvedClueIndex ?? 0)},
                −{misses} for {misses === 1 ? "one wrong guess" : `${misses} wrong guesses`}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-lav lg:mt-1 lg:text-base">No points this round</p>
        )}

        <div className="mt-4 w-full rounded-2xl border border-purple-line bg-[#2c2456]/60 p-3.5 lg:mt-6 lg:p-5">
          <div className="text-[11px] uppercase tracking-[2px] text-lav lg:text-[12.5px]">The answer was</div>
          <div className="my-1 text-[22px] font-semibold text-gold-lt lg:text-[28px]">{answer}</div>
          <AnswerInfo questionId={questionId} />
          {!won && (
            <p className="mt-2.5 text-[12.5px] leading-normal text-lav-lt lg:text-[14.5px]">
              Your clues are below, yours to keep — tomorrow&rsquo;s a fresh one.
            </p>
          )}
        </div>
      </div>

      {/* What to do next. On desktop this is the right-hand column, held in
          view while a long clue recap scrolls. */}
      <div className="clue-enter flex flex-col items-center px-1 text-center lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <RateQuestion questionId={questionId} mode="daily" solved={won} />

        <div className="mt-4 flex w-full items-center justify-center gap-5 text-[13px] text-cream lg:mt-5 lg:text-[15px]">
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
              <div key={i} className="flex items-center gap-2 text-[11px] text-lav lg:text-[13px]">
                <span className="w-10 text-right lg:w-12">clue {i + 1}</span>
                <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#241f4d] lg:h-4">
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
          className="btn-gold mt-5 w-full rounded-2xl py-3 text-base font-semibold lg:py-3.5 lg:text-[17px]"
        >
          {copied ? "Copied!" : "Share result"}
        </button>
        <p className="mt-2 text-xs text-lav lg:text-sm">Spoiler-free — never shows the answer.</p>

        {onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            aria-keyshortcuts="Enter"
            className="mt-4 w-full rounded-2xl border border-purple-line py-3 text-sm font-medium text-lav-lt hover:text-cream lg:py-3.5 lg:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            {secondaryLabel ?? "Keep playing"}{" "}
            <span aria-hidden>→</span>
            <EnterHint />
          </button>
        )}
      </div>
    </>
  );
}
