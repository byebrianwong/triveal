"use client";

import { useState } from "react";
import {
  revealNextPartyClue,
  startNextPartyRound,
  submitPartyGuess,
  type PartyStateDto,
} from "@/app/party-actions";
import { clueValue } from "@/lib/game/scoring";

/** Live scoreboard, sorted, with the current player highlighted. */
function Scoreboard({ state, playerId }: { state: PartyStateDto; playerId: string }) {
  return (
    <ol className="flex flex-col gap-1">
      {state.standings.map((s) => (
        <li
          key={s.playerId}
          className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${
            s.playerId === playerId ? "bg-[#3a2e6e]/70 text-cream" : "text-lav"
          }`}
        >
          <span>
            {s.rank}. {s.name}
          </span>
          <span className="font-semibold text-gold-lt">{s.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** One in-flight party round: clue ladder, guessing, host controls. */
export function PartyRound({
  state,
  playerId,
  onLeave,
}: {
  state: PartyStateDto;
  playerId: string;
  onLeave: () => void;
}) {
  const round = state.round!;
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const resolved = round.status === "resolved";
  const canGuess = !resolved && !round.youLockedOut;
  const clueWorth = clueValue(round.clueIndex);

  async function guessNow() {
    if (!guess.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const r = await submitPartyGuess(state.gameId, playerId, guess);
      setGuess("");
      if (r.wonRound) setFeedback("🎉 You got it!");
      else if (r.tooLate) setFeedback("So close — someone beat you to it.");
      else if (r.correct) setFeedback("Correct!");
      else if (r.accepted) setFeedback("Not it — locked out until the next clue.");
      else setFeedback("Guess not accepted.");
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function hostReveal() {
    setBusy(true);
    try {
      await revealNextPartyClue(state.gameId, playerId);
    } finally {
      setBusy(false);
    }
  }

  async function hostNext() {
    setBusy(true);
    try {
      await startNextPartyRound(state.gameId, playerId);
    } finally {
      setBusy(false);
    }
  }

  const isLastRound = state.currentRound >= state.totalRounds;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between text-sm text-lav">
        <span>
          Round {round.roundNumber} / {state.totalRounds}
        </span>
        <span className="pill-gold rounded-full px-3 py-1 font-semibold">
          {round.category} · worth {clueWorth}
        </span>
      </div>

      {/* Clue ladder — only revealed clues are ever sent to the client. */}
      <ol className="flex flex-col gap-2">
        {round.revealedClues.map((text, i) => (
          <li
            key={i}
            className={`rounded-lg px-4 py-3 text-cream ${
              i === round.clueIndex && !resolved ? "clue-live" : "clue-past"
            }`}
          >
            <span className="mr-2 text-xs font-bold text-gold-lt">{clueValue(i)}</span>
            {text}
          </li>
        ))}
      </ol>

      {resolved ? (
        <div className="rounded-lg bg-[#241f4d]/70 px-4 py-3 text-center">
          {round.winner ? (
            <p className="text-cream">
              <span className="font-bold text-gold">{round.winner.name}</span> won this round!
            </p>
          ) : (
            <p className="text-lav">Nobody got it.</p>
          )}
          {round.answer && (
            <p className="mt-1 text-sm text-lav">
              Answer: <span className="font-semibold text-cream">{round.answer}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="field-dark flex-1 rounded-lg px-3 py-2 text-base text-cream disabled:opacity-60"
              value={guess}
              maxLength={120}
              placeholder={canGuess ? "Your guess…" : "Locked out — wait for the next clue"}
              disabled={!canGuess || busy}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guessNow()}
            />
            <button
              type="button"
              className="btn-gold rounded-lg px-4 font-bold disabled:cursor-not-allowed"
              disabled={!canGuess || busy || !guess.trim()}
              onClick={guessNow}
            >
              Guess
            </button>
          </div>
          {feedback && <p className="text-center text-sm text-lav">{feedback}</p>}
        </div>
      )}

      {/* Host controls */}
      {state.youAreHost && (
        <div className="flex gap-2">
          {!resolved && round.clueIndex < round.clueCount - 1 && (
            <button
              type="button"
              className="flex-1 rounded-full border border-gold/60 py-2 text-sm font-semibold text-gold-lt disabled:opacity-50"
              disabled={busy}
              onClick={hostReveal}
            >
              Reveal next clue
            </button>
          )}
          {!resolved && round.clueIndex >= round.clueCount - 1 && (
            <button
              type="button"
              className="flex-1 rounded-full border border-gold/60 py-2 text-sm font-semibold text-gold-lt disabled:opacity-50"
              disabled={busy}
              onClick={hostReveal}
            >
              End round (no winner)
            </button>
          )}
          {resolved && (
            <button
              type="button"
              className="btn-gold flex-1 rounded-full py-2 text-sm font-bold disabled:opacity-50"
              disabled={busy}
              onClick={hostNext}
            >
              {isLastRound ? "See final results" : "Next round"}
            </button>
          )}
        </div>
      )}
      {!state.youAreHost && resolved && (
        <p className="text-center text-sm text-lav">Waiting for the host to continue…</p>
      )}

      <div className="mt-2 border-t border-[#362f63] pt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-lav-dim">Scores</p>
        <Scoreboard state={state} playerId={playerId} />
      </div>

      <button type="button" className="text-center text-xs text-lav underline" onClick={onLeave}>
        Leave game
      </button>
    </div>
  );
}
