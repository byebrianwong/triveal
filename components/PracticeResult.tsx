"use client";

import type { RoundState } from "@/lib/game/roundState";
import { clueValue } from "@/lib/game/scoring";
import { StarHost } from "./StarHost";

interface PracticeResultProps {
  round: RoundState;
  answer: string;
  /** Running totals for this practice session (already include this round). */
  sessionScore: number;
  played: number;
  solved: number;
  onNext: () => void;
  onExit: () => void;
}

export function PracticeResult({
  round,
  answer,
  sessionScore,
  played,
  solved,
  onNext,
  onExit,
}: PracticeResultProps) {
  const won = round.status === "won";
  const misses = round.wrongGuesses.length;

  return (
    <div className="clue-enter flex flex-col items-center px-1 text-center">
      <StarHost expression={won ? "cheer" : "sad"} size={76} />
      <h2 className={`mt-2 text-2xl font-semibold ${won ? "text-gold-lt" : "text-cream"}`}>
        {won ? "Correct!" : "Out of clues"}
      </h2>
      {won ? (
        <p className="text-sm text-cream">
          +{round.score} points · solved on clue {(round.solvedClueIndex ?? 0) + 1}
          {misses > 0 && (
            <span className="text-lav">
              {" "}
              ({clueValue(round.solvedClueIndex ?? 0)} − {misses})
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-lav">No points this one</p>
      )}

      <div className="mt-4 w-full rounded-2xl border border-purple-line bg-[#2c2456]/60 p-3.5">
        <div className="text-[11px] uppercase tracking-[2px] text-lav">The answer was</div>
        <div className="my-1 text-[22px] font-semibold text-gold-lt">{answer}</div>
        <p className="text-[12.5px] leading-normal text-lav-lt">
          Every clue above is a real fact — keep one for trivia night.
        </p>
      </div>

      <div className="mt-4 flex w-full items-center justify-center gap-5 text-[13px] text-cream">
        <span>
          this session <b className="text-gold-lt">{sessionScore} pts</b>
        </span>
        <span className="text-purple-line">|</span>
        <span>
          <b className="text-gold-lt">{solved}</b>/{played} solved
        </span>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="btn-gold mt-5 w-full rounded-2xl py-3 text-base font-semibold"
        autoFocus
      >
        Next question <i className="ti ti-arrow-right" style={{ verticalAlign: -2 }} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onExit}
        className="mt-3 w-full rounded-2xl border border-purple-line py-3 text-sm font-medium text-lav-lt hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        Back to today&rsquo;s daily
      </button>
    </div>
  );
}
