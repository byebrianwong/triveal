"use client";

import type { PartyStateDto } from "@/app/party-actions";
import { ScrollScreen } from "./chrome";

/** Final standings after the last round. */
export function PartyResults({
  state,
  onLeave,
}: {
  state: PartyStateDto;
  onLeave: () => void;
}) {
  const [winner] = state.standings;
  const medals = ["🥇", "🥈", "🥉"];

  return (
    // With a full room of 12 the standings don't fit a phone screen, so they
    // scroll. With a few players they stay centred.
    <ScrollScreen center className="flex max-w-sm flex-col gap-6 px-6 py-8">
      <div className="text-center">
        <p className="text-sm text-lav">Game over</p>
        {winner && (
          <p className="text-2xl font-bold text-gold">
            {medals[0]} {winner.name} wins!
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {state.standings.map((s, i) => (
          <li
            key={s.playerId}
            className="flex items-center justify-between rounded-lg bg-[#241f4d]/60 px-4 py-2.5 text-cream"
          >
            <span>
              <span className="mr-2">{medals[i] ?? `${s.rank}.`}</span>
              {s.name}
            </span>
            <span className="font-semibold text-gold-lt">{s.score}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn-gold rounded-full py-3 text-base font-bold"
        onClick={onLeave}
      >
        Back to daily
      </button>
    </ScrollScreen>
  );
}
