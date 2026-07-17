"use client";

import { useState } from "react";
import { createPartyRoom, joinPartyRoom } from "@/app/party-actions";
import { ROOM_CODE_LENGTH } from "@/lib/game/party";

export interface PartyIdentity {
  gameId: string;
  playerId: string;
}

/** Create a new room or join one by code. */
export function PartyEntry({
  onEntered,
  onCancel,
}: {
  onEntered: (id: PartyIdentity) => void;
  onCancel: () => void;
}) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { gameId, playerId } = await createPartyRoom(name);
      onEntered({ gameId, playerId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the room.");
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { gameId, playerId } = await joinPartyRoom(code, name);
      onEntered({ gameId, playerId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join the room.");
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 0 && (tab === "create" || code.trim().length === ROOM_CODE_LENGTH);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-6 py-8">
      <h1 className="text-center text-2xl font-bold text-gold">Party mode</h1>

      <div className="flex rounded-full bg-[#181433] p-1 text-sm font-semibold">
        {(["create", "join"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`flex-1 rounded-full py-2 capitalize transition ${
              tab === t ? "pill-gold" : "text-lav"
            }`}
          >
            {t === "create" ? "Create room" : "Join room"}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm text-lav">
        Your name
        <input
          className="field-dark rounded-lg px-3 py-2 text-base text-cream"
          value={name}
          maxLength={24}
          placeholder="e.g. Ada"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {tab === "join" && (
        <label className="flex flex-col gap-1 text-sm text-lav">
          Room code
          <input
            className="field-dark rounded-lg px-3 py-2 text-lg uppercase tracking-[0.3em] text-cream"
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            placeholder="ABCD"
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
      )}

      {error && (
        <p className="toast-miss rounded-lg px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="btn-gold rounded-full py-3 text-base font-bold disabled:cursor-not-allowed"
        disabled={busy || !canSubmit}
        onClick={tab === "create" ? create : join}
      >
        {busy ? "…" : tab === "create" ? "Create room" : "Join room"}
      </button>

      <button type="button" className="text-center text-sm text-lav underline" onClick={onCancel}>
        ← Back to daily
      </button>
    </div>
  );
}
