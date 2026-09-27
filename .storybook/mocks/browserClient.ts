// Stand-in for lib/supabase/browserClient.ts in Storybook (see MOCKED_MODULES
// in main.ts). Party mode reports itself as set up, so the party screens
// render, but there is no realtime connection: the party state hook falls back
// to polling the stand-in `getPartyState`.

import { fn } from "storybook/test";

export const partyRealtimeConfigured = fn(() => true).mockName("partyRealtimeConfigured");
export const getBrowserSupabase = fn(() => null).mockName("getBrowserSupabase");

/** Put every stand-in back to its default. Runs before each story. */
export function resetBrowserClientMocks() {
  partyRealtimeConfigured.mockReset();
  partyRealtimeConfigured.mockImplementation(() => true);
  getBrowserSupabase.mockReset();
  getBrowserSupabase.mockImplementation(() => null);
}
