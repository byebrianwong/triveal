"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkGuess,
  fetchDailyPuzzle,
  revealAnswer,
  type DailyPuzzleDto,
} from "@/app/actions";
import { localDateString } from "@/lib/game/daily";
import {
  applyMatch,
  giveUp,
  initialRoundState,
  revealNextClue,
  type RoundState,
} from "@/lib/game/roundState";
import { clueValue, currentNetValue } from "@/lib/game/scoring";
import { applyResult, initialStats, type PlayerStats } from "@/lib/game/stats";
import { ClueStack } from "./ClueStack";
import { Medallion } from "./Medallion";
import { ResultPanel } from "./ResultPanel";
import { StarHost, type StarExpression } from "./StarHost";

const ROUND_KEY = (date: string) => `cluedown:round:${date}`;
const STATS_KEY = "cluedown:stats";

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/blocked — play proceeds without persistence
  }
}

export function DailyGame() {
  const [puzzle, setPuzzle] = useState<DailyPuzzleDto | null>(null);
  const [round, setRound] = useState<RoundState>(initialRoundState());
  const [stats, setStats] = useState<PlayerStats>(initialStats());
  const [answer, setAnswer] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const dateRef = useRef(localDateString());
  const recordedRef = useRef(false);

  // Mount: load puzzle for the local date + any persisted state.
  useEffect(() => {
    const dateStr = dateRef.current;
    setStats(loadJson<PlayerStats>(STATS_KEY) ?? initialStats());
    const savedRound = loadJson<RoundState>(ROUND_KEY(dateStr));
    if (savedRound) setRound(savedRound);
    fetchDailyPuzzle(dateStr).then((p) => {
      setPuzzle(p);
      if (savedRound && savedRound.status !== "playing") {
        recordedRef.current = true; // stats were folded in when it finished
        revealAnswer(p.questionId).then((r) => setAnswer(r.answer));
      }
    });
  }, []);

  const finishRound = useCallback(
    async (finished: RoundState, questionId: string) => {
      const dateStr = dateRef.current;
      saveJson(ROUND_KEY(dateStr), finished);
      const { answer } = await revealAnswer(questionId);
      setAnswer(answer);
      if (!recordedRef.current) {
        recordedRef.current = true;
        setStats((prev) => {
          const next = applyResult(prev, dateStr, finished);
          saveJson(STATS_KEY, next);
          return next;
        });
      }
      setAnnounce(
        finished.status === "won"
          ? `Correct! The answer was ${answer}. You scored ${finished.score} points.`
          : `Round over. The answer was ${answer}.`,
      );
    },
    [],
  );

  async function onSubmitGuess(e: React.FormEvent) {
    e.preventDefault();
    if (!puzzle || busy || round.status !== "playing" || !guess.trim()) return;
    setBusy(true);
    setToast(null);
    try {
      const verdict = await checkGuess(puzzle.questionId, guess);
      const { state: next } = applyMatch(round, puzzle.clueCount, verdict, guess);
      setRound(next);
      saveJson(ROUND_KEY(dateRef.current), next);
      setGuess("");
      if (next.status === "playing") {
        setToast(
          verdict.kind === "decoy"
            ? `${guess.trim()} — a fair trap, but no. −1 point, clue ${next.clueIndex + 1} unlocked.`
            : `${guess.trim()} — not quite. −1 point, clue ${next.clueIndex + 1} unlocked.`,
        );
        setAnnounce(`Wrong guess. Clue ${next.clueIndex + 1}: ${puzzle.clues[next.clueIndex]}`);
      } else {
        await finishRound(next, puzzle.questionId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRevealNext() {
    if (!puzzle || round.status !== "playing") return;
    const next = revealNextClue(round, puzzle.clueCount);
    setRound(next);
    setToast(null);
    saveJson(ROUND_KEY(dateRef.current), next);
    setAnnounce(`Clue ${next.clueIndex + 1}: ${puzzle.clues[next.clueIndex]}`);
  }

  async function onGiveUp() {
    if (!puzzle || round.status !== "playing") return;
    const next = giveUp(round);
    setRound(next);
    await finishRound(next, puzzle.questionId);
  }

  if (!puzzle) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-lav">
        <StarHost expression="curious" size={64} />
        <p className="text-sm">Setting the stage…</p>
      </div>
    );
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
          <div className="pill-gold flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold">
            <span aria-hidden>🔥</span>
            <span aria-label={`${stats.currentStreak} day streak`}>{stats.currentStreak}</span>
          </div>
        </div>
        <p className="mt-1.5 mb-3 text-center text-[10.5px] uppercase tracking-[2.5px] text-lav">
          Daily No. {puzzle.dailyNumber} · {puzzle.category}
          {playing ? ` · clue ${round.clueIndex + 1} of ${puzzle.clueCount}` : ""}
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
            <ResultPanel
              round={round}
              answer={answer}
              dailyNumber={puzzle.dailyNumber}
              clueCount={puzzle.clueCount}
              stats={stats}
            />
          </div>
        ) : null}
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
          <form onSubmit={onSubmitGuess}>
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
        </footer>
      )}
    </>
  );
}
