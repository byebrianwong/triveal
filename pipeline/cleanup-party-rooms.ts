/**
 * Delete finished and abandoned party rooms. Party rooms are disposable —
 * a game runs for minutes and is never revisited — but nothing removed them,
 * so triveal_games and everything under it grew without bound.
 *
 * This is a thin wrapper over the triveal_cleanup_stale_games() SQL function
 * added in supabase/migrations/0002_player_delete_cascade.sql. Deleting the
 * game row is enough: players, rounds, round_questions and guesses all cascade
 * from it (which is exactly what 0002 fixed).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm cleanup-rooms
 *
 * Flags:
 *   --finished-grace=<hours>   Age after which a *finished* room is removed.
 *                              Default 2 — long enough that a results screen
 *                              someone left open still resolves.
 *   --abandoned-after=<hours>  Age after which a room still in lobby/active is
 *                              treated as abandoned mid-play. Default 24.
 *   --dry-run                  Report what would be removed and delete nothing.
 *
 * Uses the service-role key (the cleanup function is service-role only, since
 * RLS grants anon no delete), so run it from a trusted machine — a cron job, a
 * scheduled CI task, or by hand. Never ship the key to the browser.
 */

import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");

/** Read a `--flag=<hours>` argument, falling back to `fallback`. */
function hoursArg(flag: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1];
  if (raw === undefined) return fallback;
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours < 0) {
    console.error(`--${flag} must be a non-negative number of hours (got "${raw}").`);
    process.exit(1);
  }
  return hours;
}

const finishedGrace = hoursArg("finished-grace", 2);
const abandonedAfter = hoursArg("abandoned-after", 24);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

const windows = {
  finished_grace: `${finishedGrace} hours`,
  abandoned_after: `${abandonedAfter} hours`,
};

function missingFunctionHint(message: string): void {
  console.error(`cleanup failed: ${message}`);
  console.error(
    "If this is 'function ... does not exist', apply " +
      "supabase/migrations/0002_player_delete_cascade.sql first.",
  );
  process.exit(1);
}

interface StaleRoom {
  room_code: string;
  status: string;
  created_at: string;
}

async function main(): Promise<void> {
  const described =
    `finished older than ${finishedGrace}h, lobby/active older than ${abandonedAfter}h`;

  if (dryRun) {
    // triveal_stale_games() is the same predicate the delete uses, so the
    // preview can't disagree with what a real run would remove.
    const { data, error } = await sb.rpc("triveal_stale_games", windows);
    if (error) missingFunctionHint(error.message);
    const stale = (data ?? []) as StaleRoom[];
    console.error(`dry run — ${described}`);
    for (const g of stale) {
      console.error(`  would remove ${g.room_code} (${g.status}, created ${g.created_at})`);
    }
    console.error(`${stale.length} room(s) would be removed; nothing was written.`);
    return;
  }

  const { data, error } = await sb.rpc("triveal_cleanup_stale_games", windows);
  if (error) missingFunctionHint(error.message);
  console.error(`done — removed ${data ?? 0} room(s) (${described}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
