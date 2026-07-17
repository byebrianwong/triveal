/**
 * Browser-side Supabase client for party-mode realtime. Uses the ANON key
 * only (never the service role) and reads only the anon-safe coordination
 * tables via realtime. Returns null when Supabase isn't configured, so the
 * UI can show a "party mode unavailable" state instead of crashing.
 *
 * Realtime is used purely as a "something changed" signal: on any change to
 * this game's rows the client re-fetches sanitized state through a server
 * action (which alone can see clue texts and answers).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function partyRealtimeConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (!partyRealtimeConfigured()) return null;
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 5 } } },
    );
  }
  return browserClient;
}
