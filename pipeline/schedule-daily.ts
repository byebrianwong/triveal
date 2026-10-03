/**
 * Keep the daily schedule (`triveal_daily_questions`) in step with the
 * question bank. Questions that have never had a day get one, and the
 * schedule is extended before it runs out. Today and the next two days are
 * never changed. The planning rules live in `lib/questions/dailySchedule.ts`.
 *
 * Does nothing when the schedule already covers every question, so it is
 * safe to run on every deploy (`pipeline/sync-on-deploy.ts` does).
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm pipeline pipeline/schedule-daily.ts
 *
 * Flags:
 *   --dry-run   Print the plan and write nothing. Still reads the DB, so it
 *               needs the same credentials.
 */

import { createClient } from "@supabase/supabase-js";
import { planDailySchedule, type ScheduleRow } from "../lib/questions/dailySchedule";

const dryRun = process.argv.includes("--dry-run");
const PAGE = 1000;
const CHUNK = 500;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function readAll<T>(table: string, columns: string, filter?: [string, string]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = sb.from(table).select(columns).order(columns.split(",")[0].trim()).range(from, from + PAGE - 1);
    if (filter) query = query.eq(filter[0], filter[1]);
    const { data, error } = await query;
    if (error) throw new Error(`reading ${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function main(): Promise<void> {
  const schedule = await readAll<{ play_date: string; question_id: string }>(
    "triveal_daily_questions",
    "play_date, question_id",
  );
  const questions = await readAll<{ id: string; answer: string; category: string | null }>(
    "triveal_questions",
    "id, answer, category",
    ["status", "verified"],
  );

  const rows: ScheduleRow[] = schedule.map((r) => ({ playDate: r.play_date, questionId: r.question_id }));
  const today = new Date().toISOString().slice(0, 10);
  const plan = planDailySchedule({
    rows,
    questions: questions.map((q) => ({ id: q.id, category: q.category ?? "General" })),
    today,
  });

  const last = rows.reduce((max, r) => (r.playDate > max ? r.playDate : max), "");
  if (!plan) {
    console.error(`daily schedule: up to date (${questions.length} questions, scheduled through ${last}).`);
    return;
  }

  const answerById = new Map(questions.map((q) => [q.id, q.answer]));
  console.error(`daily schedule: re-planning ${plan.from} to ${plan.to} (${plan.rows.length} days). Why:`);
  for (const reason of plan.reasons) console.error(`  - ${reason}`);
  console.error(`  dates before ${plan.from} are unchanged; first days of the new plan:`);
  for (const r of plan.rows.slice(0, 5)) console.error(`    ${r.playDate}  ${answerById.get(r.questionId)}`);

  if (dryRun) {
    console.error("[dry-run] no rows written.");
    return;
  }

  // Upsert first, then trim the tail, so every date keeps a question even if
  // a later step fails.
  for (let i = 0; i < plan.rows.length; i += CHUNK) {
    const group = plan.rows.slice(i, i + CHUNK).map((r) => ({ play_date: r.playDate, question_id: r.questionId }));
    const { error } = await sb.from("triveal_daily_questions").upsert(group, { onConflict: "play_date" });
    if (error) throw new Error(`writing schedule: ${error.message}`);
  }
  const { error } = await sb.from("triveal_daily_questions").delete().gt("play_date", plan.to);
  if (error) throw new Error(`trimming schedule after ${plan.to}: ${error.message}`);

  console.error(`daily schedule: wrote ${plan.rows.length} days, now scheduled through ${plan.to}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
