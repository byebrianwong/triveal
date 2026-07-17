"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browserClient";
import { getPartyState, type PartyStateDto } from "@/app/party-actions";

/**
 * Live party state for one player. Realtime (Postgres changes on this game's
 * coordination tables) triggers a re-fetch of sanitized state via the server
 * action; a slow interval poll runs alongside as a safety net so the game
 * still progresses if a realtime event is missed or realtime is unconfigured.
 */
export function usePartyState(gameId: string | null, playerId: string | null) {
  const [state, setState] = useState<PartyStateDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!gameId || !playerId || inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await getPartyState(gameId, playerId);
      setState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lost connection to the game.");
    } finally {
      inFlight.current = false;
    }
  }, [gameId, playerId]);

  useEffect(() => {
    if (!gameId || !playerId) return;
    let active = true;
    const kick = () => {
      if (active) void refresh();
    };
    kick();

    const sb = getBrowserSupabase();
    const channel = sb
      ?.channel(`party:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cluedown_games", filter: `id=eq.${gameId}` },
        kick,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cluedown_players", filter: `game_id=eq.${gameId}` },
        kick,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cluedown_rounds", filter: `game_id=eq.${gameId}` },
        kick,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cluedown_guesses" },
        kick,
      )
      .subscribe();

    // Safety-net poll (also covers environments without realtime).
    const interval = setInterval(kick, 3000);

    return () => {
      active = false;
      clearInterval(interval);
      if (sb && channel) sb.removeChannel(channel);
    };
  }, [gameId, playerId, refresh]);

  return { state, error, refresh };
}
