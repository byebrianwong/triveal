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
import { ClueStack } from "./ClueStack";
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
  renderResult: (round: RoundState, answer: string) => React.ReactNode;
  /** Small always-available link in the footer (mode switch). */
  footerLink?: { label: string; onClick: () => void };
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

  const playing = round.status === "playing";
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
    <>
      <p aria-live="polite" className="sr-only-live">
        {announce}
      </p>

      {/* Pinned header */}
      <header className="relative flex-none px-5 pt-4">
        <div className="spotlight pointer-events-none absolute -top-11 left-1/2 h-40 w-64 -translate-x-1/2" />
        <span className="twinkle absolute left-6 top-14 text-[9px] text-[#cdb9ff]" aria-hidden>✦</span>
        <span className="twinkle absolute right-6 top-24 text-[8px] text-pink-lt [animation-delay:1.2s]" aria-hidden>✦</span>
        <div className="relative flex items-center justify-between">
          <h1 className="text-[21px] font-semibold tracking-[.3px] text-gold-lt">Cluedown</h1>
          {config.badge}
        </div>
        <p className="mt-1.5 mb-3 text-center text-[10.5px] uppercase tracking-[2.5px] text-lav">
          {config.sublinePrefix} · {puzzle.category}
          {clueLine}
        </p>
        {playing && (
          <>
            <div className="flex items-center justify-center gap-2">
              <StarHost expression={expression} size={52} />
              <Medallion value={clueValue(round.clueIndex)} penalty={misses} />
            </div>
            {misses > 0 && (
              <p className="mt-2 text-center text-[12.5px] font-medium text-[#ffd9a8]">
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
          </>
        )}
      </header>

      {/* Scrollable middle */}
      <main className="flex min-h-0 flex-1 flex-col px-5">
        {toast && playing && (
          <div className="toast-miss clue-enter mt-1 flex flex-none items-center gap-2 rounded-xl px-3 py-2 text-[13px]">
            <span aria-hidden>✕</span> {toast}
          </div>
        )}
        {playing ? (
          <ClueStack
            clues={puzzle.clues}
            clueIndex={round.clueIndex}
            wrongGuesses={round.wrongGuesses}
            roundOver={false}
          />
        ) : answer ? (
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto py-2">
            {config.renderResult(round, answer)}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-lav">
            Revealing…
          </div>
        )}
      </main>

      {/* Pinned input */}
      {playing && (
        <footer className="flex-none px-5 pb-5 pt-1.5">
          <div className="mb-3.5 flex justify-center gap-2.5" aria-hidden>
            {Array.from({ length: puzzle.clueCount }, (_, i) => (
              <span
                key={i}
                className={`h-[11px] w-[11px] rounded-full border-2 ${
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
              id="guess"
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder="Type your answer…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={80}
              className="field-dark mb-2.5 w-full rounded-xl px-3.5 py-3 text-[15px]"
            />
            <button
              type="submit"
              disabled={busy || !guess.trim()}
              className="btn-gold w-full rounded-2xl py-3 text-base font-semibold"
            >
              {busy ? "Checking…" : "Lock in your guess"}
            </button>
          </form>
          <div className="mt-2 flex items-center justify-between text-[13px] font-medium text-lav-lt">
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
          {config.footerLink && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={config.footerLink.onClick}
                className="text-[12.5px] text-lav hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold rounded px-1"
              >
                {config.footerLink.label}
              </button>
            </div>
          )}
        </footer>
      )}
    </>
  );
}
