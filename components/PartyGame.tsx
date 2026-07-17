"use client";

import { useCallback, useEffect, useState } from "react";
import { partyRealtimeConfigured } from "@/lib/supabase/browserClient";
import { PartyEntry, type PartyIdentity } from "./PartyEntry";
import { PartyLobby } from "./PartyLobby";
import { PartyResults } from "./PartyResults";
import { PartyRound } from "./PartyRound";
import { usePartyState } from "./usePartyState";
import { StageLoading } from "./chrome";

const IDENTITY_KEY = "cluedown:party";

/** Party mode: entry → lobby → rounds → results, driven by live game state. */
export function PartyGame({ onExit }: { onExit: () => void }) {
  const [identity, setIdentity] = useState<PartyIdentity | null>(null);
  const [ready, setReady] = useState(false);

  // Restore any in-progress identity (survives refresh). Deferred so no
  // setState runs synchronously in the effect body.
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(IDENTITY_KEY);
        if (raw) setIdentity(JSON.parse(raw) as PartyIdentity);
      } catch {
        // ignore malformed storage
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const enter = useCallback((id: PartyIdentity) => {
    try {
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(id));
    } catch {
      // storage blocked — the session still works in-memory
    }
    setIdentity(id);
  }, []);

  const leave = useCallback(() => {
    try {
      localStorage.removeItem(IDENTITY_KEY);
    } catch {
      // ignore
    }
    setIdentity(null);
    onExit();
  }, [onExit]);

  const { state, error } = usePartyState(identity?.gameId ?? null, identity?.playerId ?? null);

  if (!ready) return <StageLoading />;

  if (!partyRealtimeConfigured()) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-gold">Party mode isn&apos;t set up yet</p>
        <p className="text-sm text-lav">
          This deployment has no Supabase project configured, so multiplayer rooms are unavailable.
          Daily and practice modes work without it.
        </p>
        <button type="button" className="btn-gold rounded-full px-6 py-2.5 font-bold" onClick={onExit}>
          Back to daily
        </button>
      </div>
    );
  }

  if (!identity) return <PartyEntry onEntered={enter} onCancel={onExit} />;

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="toast-miss rounded-lg px-3 py-2 text-sm">{error}</p>
        <button type="button" className="btn-gold rounded-full px-6 py-2.5 font-bold" onClick={leave}>
          Leave game
        </button>
      </div>
    );
  }

  if (!state) return <StageLoading />;

  if (state.status === "lobby") {
    return <PartyLobby state={state} playerId={identity.playerId} onLeave={leave} />;
  }
  if (state.status === "finished") {
    return <PartyResults state={state} onLeave={leave} />;
  }
  if (state.round) {
    return <PartyRound state={state} playerId={identity.playerId} onLeave={leave} />;
  }
  return <StageLoading />;
}
