"use client";

import type { RoundState } from "@/lib/game/roundState";
import { clueValue } from "@/lib/game/scoring";
import { AnswerImage } from "./AnswerImage";
import { EnterHint, useEnterKey } from "./keyboard";
import { RateQuestion } from "./RateQuestion";
import { StarHost } from "./StarHost";

interface PracticeResultProps {
  round: RoundState;
  answer: string;
  /** Identifies the question to the answer-picture lookup. */
  questionId: string;
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
  questionId,
  sessionScore,
  played,
  solved,
  onNext,
  onExit,
}: PracticeResultProps) {
  const won = round.status === "won";
  const misses = round.wrongGuesses.length;
  useEnterKey(onNext);

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
          <p className="text-sm text-cream lg:mt-1 lg:text-base">
            +{round.score} points · solved on clue {(round.solvedClueIndex ?? 0) + 1}
            {misses > 0 && (
              <span className="text-lav">
                {" "}
                ({clueValue(round.solvedClueIndex ?? 0)} − {misses})
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm text-lav lg:mt-1 lg:text-base">No points this one</p>
        )}

        <div className="mt-4 w-full rounded-2xl border border-purple-line bg-[#2c2456]/60 p-3.5 lg:mt-6 lg:p-5">
          <div className="text-[11px] uppercase tracking-[2px] text-lav lg:text-[12.5px]">The answer was</div>
          <div className="my-1 text-[22px] font-semibold text-gold-lt lg:text-[28px]">{answer}</div>
          <AnswerImage questionId={questionId} />
        </div>
      </div>

      {/* What to do next. On desktop this is the right-hand column, held in
          view while a long clue recap scrolls. */}
      <div className="clue-enter flex flex-col items-center px-1 text-center lg:sticky lg:top-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <RateQuestion questionId={questionId} mode="practice" solved={won} />

        <div className="mt-4 flex w-full items-center justify-center gap-5 text-[13px] text-cream lg:mt-5 lg:text-[15px]">
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
          aria-keyshortcuts="Enter"
          className="btn-gold mt-5 w-full rounded-2xl py-3 text-base font-semibold lg:py-3.5 lg:text-[17px]"
        >
          Next question <span aria-hidden>→</span>
          <EnterHint />
        </button>
        <button
          type="button"
          onClick={onExit}
          className="mt-3 w-full rounded-2xl border border-purple-line py-3 text-sm font-medium text-lav-lt hover:text-cream lg:py-3.5 lg:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          Back to today&rsquo;s daily
        </button>
      </div>
    </>
  );
}
