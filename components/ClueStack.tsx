"use client";

import { useEffect, useRef } from "react";
import type { WrongGuess } from "@/lib/game/roundState";

interface PastClueProps {
  /** 0-based position in the ladder; rendered 1-based. */
  index: number;
  text: string;
  /** The wrong guess made while this clue was live, if there was one. */
  miss?: WrongGuess;
}

/**
 * A clue the round has moved past: dim card, numbered, carrying whatever wrong
 * guess it cost. Shared by the live ladder and the post-round recap so both
 * read as the same history.
 */
export function PastClue({ index, text, miss }: PastClueProps) {
  return (
    <div className="clue-past flex-none rounded-xl px-3.5 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#8479b8]">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3a3168] text-[10px] font-semibold text-[#cdb9ff]">
          {index + 1}
        </span>
        Clue {index + 1}
      </div>
      <p className="text-[13px] leading-snug text-lav-lt">{text}</p>
      {miss && (
        <span className="toast-miss mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]">
          ✕ You guessed: {miss.guess}
        </span>
      )}
    </div>
  );
}

interface ClueStackProps {
  clues: string[];
  /** 0-based index of the clue currently live. */
  clueIndex: number;
  wrongGuesses: WrongGuess[];
}

/**
 * Scrollable clue history for a round in play: earlier clues recede into dim
 * cards carrying the wrong guess made on them; the live clue glows gold at the
 * bottom. Once the round ends the stage swaps to the result panel, which shows
 * the same history through `ClueRecap`.
 */
export function ClueStack({ clues, clueIndex, wrongGuesses }: ClueStackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [clueIndex]);

  const guessOn = (i: number) => wrongGuesses.find((g) => g.clueIndex === i);
  const isGiveaway = (i: number) => i === clues.length - 1;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="scroll-thin flex h-full flex-col gap-2.5 overflow-y-auto px-0.5 py-2 lg:justify-end"
      >
        {clues.slice(0, clueIndex + 1).map((text, i) =>
          i === clueIndex ? (
            <div key={i} className="clue-live clue-enter relative flex-none rounded-2xl p-4 pt-5 text-center">
              <div className="pill-gold absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-px text-[10px] font-semibold uppercase tracking-wide">
                Clue {i + 1}{isGiveaway(i) ? " · giveaway" : ""}
              </div>
              <p className="mt-1 text-[15.5px] leading-relaxed">{text}</p>
            </div>
          ) : (
            <PastClue key={i} index={i} text={text} miss={guessOn(i)} />
          ),
        )}
      </div>
    </div>
  );
}
