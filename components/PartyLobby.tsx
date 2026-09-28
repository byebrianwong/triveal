"use client";

import { useState } from "react";
import { startPartyGame, type PartyStateDto } from "@/app/party-actions";
import { ScrollScreen } from "./chrome";
import { EnterHint, useEnterKey } from "./keyboard";

/** Waiting room: room code to share, player list, host start button. */
export function PartyLobby({
  state,
  playerId,
  onLeave,
}: {
  state: PartyStateDto;
  playerId: string;
  onLeave: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await startPartyGame(state.gameId, playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start.");
      setBusy(false);
    }
  }

  const canStart = state.youAreHost && !busy && state.players.length >= 1;
  useEnterKey(start, canStart);

  return (
    // A room holds up to 12 players, and that list doesn't fit a phone screen.
    <ScrollScreen className="flex max-w-sm flex-col gap-6 px-6 py-8">
      <div className="text-center">
        <p className="text-sm text-lav">Room code</p>
        <p className="text-4xl font-bold tracking-[0.4em] text-gold">{state.roomCode}</p>
        <p className="mt-1 text-xs text-lav-dim">Share it so friends can join.</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-lav">
          Players ({state.players.length})
        </p>
        <ul className="flex flex-col gap-2">
          {state.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-[#241f4d]/60 px-3 py-2 text-cream"
            >
              <span>
                {p.name}
                {p.id === playerId && <span className="text-lav-dim"> (you)</span>}
              </span>
              {p.isHost && <span className="pill-gold rounded-full px-2 py-0.5 text-xs">Host</span>}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="toast-miss rounded-lg px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      )}

      {state.youAreHost ? (
        <button
          type="button"
          className="btn-gold rounded-full py-3 text-base font-bold disabled:cursor-not-allowed"
          disabled={!canStart}
          onClick={start}
          aria-keyshortcuts="Enter"
        >
          {busy ? "Starting…" : (
            <>
              Start game ({state.totalRounds} rounds)
              <EnterHint />
            </>
          )}
        </button>
      ) : (
        <p className="text-center text-sm text-lav">Waiting for the host to start…</p>
      )}

      <button type="button" className="text-center text-sm text-lav underline" onClick={onLeave}>
        Leave room
      </button>
    </ScrollScreen>
  );
}
