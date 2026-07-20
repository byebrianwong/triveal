"use client";

import { useEffect, useRef } from "react";
import type { WrongGuess } from "@/lib/game/roundState";

interface ClueStackProps {
  clues: string[];
  /** 0-based index of the clue currently live. */
  clueIndex: number;
  wrongGuesses: WrongGuess[];
  /** When the round is over every clue renders as history. */
  roundOver: boolean;
}

/**
 * Scrollable clue history: earlier clues recede into dim cards carrying the
 * wrong guess made on them; the live clue glows gold at the bottom.
 */
export function ClueStack({ clues, clueIndex, wrongGuesses, roundOver }: ClueStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [clueIndex, roundOver]);

  const guessOn = (i: number) => wrongGuesses.find((g) => g.clueIndex === i);
  const lastVisible = roundOver ? clues.length - 1 : clueIndex;
  const isGiveaway = (i: number) => i === clues.length - 1;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="scroll-thin flex h-full flex-col gap-2.5 overflow-y-auto px-0.5 py-2 lg:justify-end"
      >
        {clues.slice(0, lastVisible + 1).map((text, i) => {
          const live = !roundOver && i === clueIndex;
          const miss = guessOn(i);
          return live ? (
            <div key={i} className="clue-live clue-enter relative flex-none rounded-2xl p-4 pt-5 text-center">
              <div className="pill-gold absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-px text-[10px] font-semibold uppercase tracking-wide">
                Clue {i + 1}{isGiveaway(i) ? " · giveaway" : ""}
              </div>
              <p className="mt-1 text-[15.5px] leading-relaxed">{text}</p>
            </div>
          ) : (
            <div key={i} className="clue-past flex-none rounded-xl px-3.5 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#8479b8]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3a3168] text-[10px] font-semibold text-[#cdb9ff]">
                  {i + 1}
                </span>
                Clue {i + 1}
              </div>
              <p className="text-[13px] leading-snug text-lav-lt">{text}</p>
              {miss && (
                <span className="toast-miss mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]">
                  ✕ You guessed: {miss.guess}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
