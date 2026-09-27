"use client";

import { useEffect, useRef, useState } from "react";
import { checkGuess, revealAnswer, type PuzzleDto } from "@/app/actions";
import {
  applyMatch,
  giveUp as giveUpRound,
  initialRoundState,
  revealNextClue,
  type RoundState,
} from "@/lib/game/roundState";
import { clueValue, currentNetValue } from "@/lib/game/scoring";
import { ClueRecap } from "./ClueRecap";
import { ClueStack } from "./ClueStack";
import { EnterHint, focusForTyping } from "./keyboard";
import { Medallion } from "./Medallion";
import { StarHost, type StarExpression } from "./StarHost";

/**
 * A single playable round in the Starlit stage. Mode-specific chrome (the
 * badge, subline, result panel, persistence) comes in through `config`, so
 * daily and practice share all the guess/reveal/scoring mechanics.
 *
 * Remount with a fresh `key` (e.g. the question id) to start a new round.
 */
export interface GameConfig {
  /** Top-right chip (streak for daily, session score for practice). */
  badge: React.ReactNode;
  /** Leads the subline, e.g. "Daily No. 32" or "Practice". */
  sublinePrefix: string;
  /** Restored in-progress or finished round (daily resume). */
  restoredRound?: RoundState | null;
  onRoundChange?: (round: RoundState) => void;
  onResolved?: (round: RoundState) => void;
  /**
   * The finished-round panel. On desktop it renders into a two-column grid:
   * give the answer block `lg:col-start-1 lg:row-start-1` and the follow-up
   * block (rating, stats, buttons) `lg:col-start-2 lg:row-span-2`.
   */
  renderResult: (round: RoundState, answer: string) => React.ReactNode;
  /** Small always-available link(s) in the footer (mode switches). */
  footerLink?: { label: string; onClick: () => void };
  footerLinkAlt?: { label: string; onClick: () => void };
}

export function Game({ puzzle, config }: { puzzle: PuzzleDto; config: GameConfig }) {
  const [round, setRound] = useState<RoundState>(config.restoredRound ?? initialRoundState());
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const resolvedRef = useRef(false);
  const initRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restored finished round (daily resume): reveal the answer, but don't
  // re-record stats — they were folded in when it first finished.
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (round.status !== "playing") {
      resolvedRef.current = true;
      revealAnswer(puzzle.questionId).then((r) => setAnswer(r.answer));
    }
  }, [puzzle.questionId, round.status]);

  // Every new clue (the first, a wrong guess, a skip) puts the caret back in
  // the answer box, so a keyboard player never has to click into it. The
  // submit button or "Next clue" would otherwise keep focus after a click.
  const playing = round.status === "playing";
  useEffect(() => {
    if (playing) focusForTyping(inputRef.current);
  }, [playing, round.clueIndex]);

  function commit(next: RoundState) {
    setRound(next);
    config.onRoundChange?.(next);
  }

  async function finish(next: RoundState) {
    const res = await revealAnswer(puzzle.questionId);
    setAnswer(res.answer);
    if (!resolvedRef.current) {
      resolvedRef.current = true;
      config.onResolved?.(next);
    }
    setAnnounce(
      next.status === "won"
        ? `Correct! The answer was ${res.answer}. You scored ${next.score} points.`
        : `Round over. The answer was ${res.answer}.`,
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || round.status !== "playing" || !guess.trim()) return;
    setBusy(true);
    setToast(null);
    try {
      const verdict = await checkGuess(puzzle.questionId, guess);
      const { state: next } = applyMatch(round, puzzle.clueCount, verdict, guess);
      commit(next);
      setGuess("");
      if (next.status === "playing") {
        setToast(
          verdict.kind === "decoy"
            ? `${guess.trim()} — a fair trap, but no. −1 point, clue ${next.clueIndex + 1} unlocked.`
            : `${guess.trim()} — not quite. −1 point, clue ${next.clueIndex + 1} unlocked.`,
        );
        setAnnounce(`Wrong guess. Clue ${next.clueIndex + 1}: ${puzzle.clues[next.clueIndex]}`);
      } else {
        await finish(next);
      }
    } finally {
      setBusy(false);
    }
  }

  function onRevealNext() {
    if (round.status !== "playing") return;
    const next = revealNextClue(round, puzzle.clueCount);
    commit(next);
    setToast(null);
    setAnnounce(`Clue ${next.clueIndex + 1}: ${puzzle.clues[next.clueIndex]}`);
  }

  async function onGiveUp() {
    if (round.status !== "playing") return;
    const next = giveUpRound(round);
    commit(next);
    await finish(next);
  }

  const misses = round.wrongGuesses.length;
  const onLastClue = round.clueIndex >= puzzle.clueCount - 1;
  const expression: StarExpression = !playing
    ? round.status === "won"
      ? "cheer"
      : "sad"
    : toast
      ? "wince"
      : onLastClue
        ? "encourage"
        : "curious";
  const clueLine = playing ? ` · clue ${round.clueIndex + 1} of ${puzzle.clueCount}` : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p aria-live="polite" className="sr-only-live">
        {announce}
      </p>

      {/*
        Top bar: title, what you're playing, and the badge. On phones the
        subline drops to its own centred line under the title row. On desktop
        all three share one row across the top of the window.
      */}
      <header className="relative grid flex-none grid-cols-[1fr_auto] items-center px-5 pt-4 lg:grid-cols-[auto_1fr_auto] lg:gap-x-6 lg:px-10 lg:pt-7">
        <div className="spotlight pointer-events-none absolute -top-11 left-1/2 h-40 w-64 -translate-x-1/2 lg:hidden" />
        <span className="twinkle absolute left-6 top-14 text-[9px] text-[#cdb9ff] lg:hidden" aria-hidden>✦</span>
        <span className="twinkle absolute right-6 top-24 text-[8px] text-pink-lt [animation-delay:1.2s] lg:hidden" aria-hidden>✦</span>
        <h1 className="relative text-[21px] font-semibold tracking-[.3px] text-gold-lt lg:text-[28px]">Triveal</h1>
        <p className="col-span-2 row-start-2 mt-1.5 mb-3 text-center text-[10.5px] uppercase tracking-[2.5px] text-lav lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:m-0 lg:border-l lg:border-purple-line lg:pl-6 lg:text-left lg:text-[12.5px]">
          {config.sublinePrefix} · {puzzle.category}
          {clueLine}
        </p>
        <div className="relative col-start-2 row-start-1 lg:col-start-3">{config.badge}</div>
      </header>

      {/*
        Below the bar: the prize (host and medallion) and the play area. On
        phones they stack, with the clues scrolling between the prize and the
        pinned answer box. On desktop they sit side by side in the middle of
        the window, each only as tall as its content, so the clue, the answer
        box and the medallion stay together instead of at opposite edges.
      */}
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          playing ? "lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:px-10 lg:pb-12 lg:pt-6" : ""
        }`}
      >
        {playing && (
          <div className="relative flex-none px-5 lg:w-56 lg:px-0">
            <div className="spotlight pointer-events-none absolute left-1/2 top-1/2 hidden h-80 w-80 -translate-x-1/2 -translate-y-1/2 lg:block" />
            <div className="relative flex items-center justify-center gap-2 lg:flex-col lg:gap-5">
              <StarHost expression={expression} size={52} className="lg:h-[76px] lg:w-[76px]" />
              <Medallion value={clueValue(round.clueIndex)} penalty={misses} />
            </div>
            {misses > 0 && (
              <p className="relative mt-2 text-center text-[12.5px] font-medium text-[#ffd9a8] lg:mt-5 lg:text-[15px]">
                Solve now for{" "}
                <b className="font-semibold text-gold-lt">
                  {currentNetValue(round.clueIndex, misses)}
                </b>{" "}
                <span className="text-lav">
                  ({clueValue(round.clueIndex)} − {misses} wrong{" "}
                  {misses === 1 ? "guess" : "guesses"})
                </span>
              </p>
            )}
          </div>
        )}

        {/* Play area: clue history + answer input */}
        <div
          className={`flex min-h-0 flex-1 flex-col ${
            playing ? "lg:max-h-full lg:w-[36rem] lg:flex-none" : ""
          }`}
        >
          <main className={`flex min-h-0 flex-1 flex-col px-5 lg:px-0 ${playing ? "lg:flex-initial" : ""}`}>
            {toast && playing && (
              <div className="toast-miss clue-enter mt-1 flex flex-none items-center gap-2 rounded-xl px-3 py-2 text-[13px] lg:mt-0 lg:mb-1 lg:px-4 lg:py-2.5 lg:text-[15px]">
                <span aria-hidden>✕</span> {toast}
              </div>
            )}
            {playing ? (
              <ClueStack
                clues={puzzle.clues}
                clueIndex={round.clueIndex}
                wrongGuesses={round.wrongGuesses}
              />
            ) : answer ? (
              // One scroll area as wide as the window, so on desktop the
              // scrollbar sits at the window edge like a normal page.
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2 pb-6 lg:px-10 lg:pb-12 lg:pt-8">
                {/*
                  On phones everything stacks. On desktop it is two columns:
                  the result panels place their answer block top-left and
                  their rating/share block in the right column, and the clue
                  recap goes under the answer.
                */}
                <div className="mx-auto w-full max-w-md lg:grid lg:max-w-4xl lg:grid-cols-2 lg:items-start lg:gap-x-14">
                  {config.renderResult(round, answer)}
                  <div className="lg:col-start-1 lg:row-start-2">
                    <ClueRecap
                      clues={puzzle.clues}
                      lastClueIndex={round.clueIndex}
                      wrongGuesses={round.wrongGuesses}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-lav lg:text-base">
                Revealing…
              </div>
            )}
          </main>

          {/* Pinned input */}
          {playing && (
            <footer className="flex-none px-5 pb-5 pt-1.5 lg:px-0 lg:pb-0 lg:pt-4">
              <div className="mb-3.5 flex justify-center gap-2.5 lg:mb-5 lg:gap-3" aria-hidden>
                {Array.from({ length: puzzle.clueCount }, (_, i) => (
                  <span
                    key={i}
                    className={`h-[11px] w-[11px] rounded-full border-2 lg:h-[13px] lg:w-[13px] ${
                      i === round.clueIndex ? "bulb-on border-gold-lt" : "border-[#463c78] bg-[#241f4d]"
                    }`}
                  />
                ))}
              </div>
              <form onSubmit={onSubmit}>
                <label htmlFor="guess" className="sr-only-live">
                  Your answer
                </label>
                <input
                  ref={inputRef}
                  id="guess"
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Type your answer…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  maxLength={80}
                  className="field-dark mb-2.5 w-full rounded-xl px-3.5 py-3 text-[15px] lg:mb-3 lg:px-4 lg:py-3.5 lg:text-[17px]"
                />
                <button
                  type="submit"
                  disabled={busy || !guess.trim()}
                  className="btn-gold w-full rounded-2xl py-3 text-base font-semibold lg:py-3.5 lg:text-[17px]"
                >
                  {busy ? "Checking…" : (
                    <>
                      Lock in your guess
                      <EnterHint />
                    </>
                  )}
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-[13px] font-medium text-lav-lt lg:mt-3 lg:text-[15px]">
                {onLastClue ? (
                  <span className="text-lav">Last clue — make it count</span>
                ) : (
                  <button
                    type="button"
                    onClick={onRevealNext}
                    className="rounded px-1 py-0.5 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                  >
                    Next clue → drops to {clueValue(round.clueIndex + 1)} points
                  </button>
                )}
                <button
                  type="button"
                  onClick={onGiveUp}
                  className="rounded px-1 py-0.5 text-lav hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
                >
                  Give up
                </button>
              </div>
              {(config.footerLink || config.footerLinkAlt) && (
                <div className="mt-2 flex items-center justify-center gap-4 text-center lg:mt-7 lg:gap-6">
                  {[config.footerLink, config.footerLinkAlt].map(
                    (link, i) =>
                      link && (
                        <button
                          key={i}
                          type="button"
                          onClick={link.onClick}
                          className="text-[12.5px] text-lav hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold rounded px-1 lg:text-[14px]"
                        >
                          {link.label}
                        </button>
                      ),
                  )}
                </div>
              )}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
