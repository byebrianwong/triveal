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
    <div className="clue-past flex-none rounded-xl px-3.5 py-2.5 lg:px-5 lg:py-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#8479b8] lg:mb-1.5 lg:gap-2 lg:text-[11.5px]">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#3a3168] text-[10px] font-semibold text-[#cdb9ff] lg:h-5 lg:w-5 lg:text-[11.5px]">
          {index + 1}
        </span>
        Clue {index + 1}
      </div>
      <p className="text-[13px] leading-snug text-lav-lt lg:text-[16px] lg:leading-normal">{text}</p>
      {miss && (
        <span className="toast-miss mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] lg:px-3 lg:py-1 lg:text-[13px]">
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

  // When the list changes size (the window is resized, or a miss message
  // appears above it), jump back to the bottom so the live clue stays in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => el.scrollTo({ top: el.scrollHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const guessOn = (i: number) => wrongGuesses.find((g) => g.clueIndex === i);
  const isGiveaway = (i: number) => i === clues.length - 1;

  return (
    // Sized by flex rather than h-full so it works both ways: on phones it
    // fills the space between header and input, and on desktop it is only as
    // tall as its clues, shrinking and scrolling once the window runs short.
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-initial">
      <div
        ref={scrollRef}
        className="scroll-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-0.5 py-2 lg:flex-initial lg:gap-3 lg:py-3.5"
      >
        {clues.slice(0, clueIndex + 1).map((text, i) =>
          i === clueIndex ? (
            <div key={i} className="clue-live clue-enter relative flex-none rounded-2xl p-4 pt-5 text-center lg:rounded-3xl lg:px-8 lg:pb-7 lg:pt-8">
              <div className="pill-gold absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-px text-[10px] font-semibold uppercase tracking-wide lg:-top-3 lg:px-4 lg:py-0.5 lg:text-[11.5px]">
                Clue {i + 1}{isGiveaway(i) ? " · giveaway" : ""}
              </div>
              <p className="mt-1 text-[15.5px] leading-relaxed lg:mt-0 lg:text-[21px] lg:leading-[1.55]">{text}</p>
            </div>
          ) : (
            <PastClue key={i} index={i} text={text} miss={guessOn(i)} />
          ),
        )}
      </div>
    </div>
  );
}
