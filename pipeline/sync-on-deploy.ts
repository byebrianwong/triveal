/**
 * Puts the committed question bank in front of players. Runs at the end of
 * every build (package.json "build"), and does its work only on a Vercel
 * production build:
 *
 *   1. sync-bank-to-supabase.ts --update copies new and edited questions
 *      into Supabase, which is what production serves.
 *   2. schedule-daily.ts gives any question without a daily date a day.
 *
 * So merging a pull request that adds questions is the whole job: the
 * production deploy of that merge does the rest.
 *
 * Every other build (local, CI, preview deployments) skips it. Previews
 * would otherwise publish questions from branches that never merged.
 *
 * If either step fails, the build fails and Vercel keeps serving the previous
 * deployment. That is on purpose: a skipped sync is invisible, and invisible
 * is how questions went unpublished before this existed. Redeploying retries.
 *
 * To see what a production deploy would do, without writing anything:
 *   set -a; . .env.local; set +a; VERCEL_ENV=production pnpm pipeline pipeline/sync-on-deploy.ts --dry-run
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

if (process.env.VERCEL_ENV !== "production") {
  console.log(`sync-on-deploy: skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}, not production).`);
  process.exit(0);
}

const dryRun = process.argv.includes("--dry-run");
const tsx = path.join(process.cwd(), "node_modules", ".bin", "tsx");

const steps: [string, string[]][] = [
  ["pipeline/sync-bank-to-supabase.ts", ["--update"]],
  ["pipeline/schedule-daily.ts", []],
];

for (const [script, args] of steps) {
  console.log(`sync-on-deploy: ${script} ${[...args, ...(dryRun ? ["--dry-run"] : [])].join(" ")}`);
  const run = spawnSync(tsx, [script, ...args, ...(dryRun ? ["--dry-run"] : [])], { stdio: "inherit" });
  if (run.status !== 0) {
    console.error(`sync-on-deploy: ${script} failed (exit ${run.status ?? run.signal}). Failing the build.`);
    process.exit(1);
  }
}
console.log("sync-on-deploy: done.");
