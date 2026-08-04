"use client";

import type { WrongGuess } from "@/lib/game/roundState";
import { PastClue } from "./ClueStack";

interface ClueRecapProps {
  clues: string[];
  /** 0-based index of the last clue the player actually reached. */
  lastClueIndex: number;
  wrongGuesses: WrongGuess[];
}

/**
 * The clue history, kept on screen once the round is over — the reveal used to
 * replace the ladder outright, so the clues you were shown vanished the moment
 * you needed them to make sense of the answer.
 *
 * Only the clues the player reached: ones they never unlocked stay unspoiled,
 * so a question met again in practice still has something left to give.
 */
export function ClueRecap({ clues, lastClueIndex, wrongGuesses }: ClueRecapProps) {
  const shown = clues.slice(0, lastClueIndex + 1);
  if (shown.length === 0) return null;

  return (
    <section className="mt-7 w-full text-left">
      <h3 className="mb-2 text-[10.5px] uppercase tracking-[2px] text-lav">
        Clues you saw
        {shown.length < clues.length && (
          <span className="normal-case tracking-normal text-lav-lt">
            {" "}
            · {shown.length} of {clues.length}
          </span>
        )}
      </h3>
      <div className="flex flex-col gap-2.5">
        {shown.map((text, i) => (
          <PastClue
            key={i}
            index={i}
            text={text}
            miss={wrongGuesses.find((g) => g.clueIndex === i)}
          />
        ))}
      </div>
    </section>
  );
}
