/**
 * Sync the committed local question bank into Supabase so the DB-backed
 * daily/practice modes serve exactly the same questions as the zero-config
 * local build. The source is the same bank the app uses when Supabase is
 * absent — SEED_QUESTIONS + EXTRA_QUESTIONS + the (optional) private bank —
 * so there is no separate export step to keep in sync.
 *
 * Idempotent: it dedupes by answer_canonical and inserts only the questions
 * the database doesn't already have, so it is safe to re-run after adding
 * more questions to the bank. It never updates or deletes existing rows.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm sync-bank
 *   # or: pnpm pipeline pipeline/sync-bank-to-supabase.ts
 *
 * Apply supabase/migrations/0001_init.sql first. This uses the service-role
 * key (writes bypass RLS), so run it from a trusted machine — never ship the
 * key to the browser.
 *
 * Pass --dry-run to print what would be inserted without touching Supabase
 * (no credentials required).
 */

import { createClient } from "@supabase/supabase-js";
import type { Question } from "../lib/game/types";
import { SEED_QUESTIONS } from "../lib/questions/seed";
import { EXTRA_QUESTIONS } from "../lib/questions/extraBank";
import { loadPrivateBank } from "../lib/questions/privateBank";

// Points decay by clue position, matching the app's 10/8/6/4(/2) scoring.
const CLUE_POINTS = [10, 8, 6, 4, 2];
const CHUNK = 500; // rows per PostgREST bulk insert
const dryRun = process.argv.includes("--dry-run");

// The exact bank the app serves in zero-config mode (source.ts `localBank`).
const bank: Question[] = [...SEED_QUESTIONS, ...EXTRA_QUESTIONS, ...loadPrivateBank()];

// De-dupe within the bank by canonical (defensive; the integrity suite
// already forbids duplicate answers). First occurrence wins.
const byCanonical = new Map<string, Question>();
for (const q of bank) {
  if (!byCanonical.has(q.answerCanonical)) byCanonical.set(q.answerCanonical, q);
}
const unique = [...byCanonical.values()];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clueRowsFor(q: Question, questionId: string) {
  return q.clues.map((c) => ({
    question_id: questionId,
    position: c.position,
    text: c.text,
    points_value: CLUE_POINTS[Math.min(c.position - 1, CLUE_POINTS.length - 1)],
  }));
}

function decoyRowsFor(q: Question, questionId: string) {
  return q.decoys.map((d) => ({
    question_id: questionId,
    text: d.text,
    eliminated_by_clue: d.eliminatedByClue,
  }));
}

if (dryRun) {
  const clues = unique.reduce((n, q) => n + q.clues.length, 0);
  const decoys = unique.reduce((n, q) => n + q.decoys.length, 0);
  const byCategory = new Map<string, number>();
  for (const q of unique) byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
  console.error(`[dry-run] would sync ${unique.length} questions, ${clues} clues, ${decoys} decoys.`);
  console.error("[dry-run] by category:");
  for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(n).padStart(3)}  ${cat}`);
  }
  console.error("[dry-run] no rows written. Set the Supabase env vars and drop --dry-run to sync.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main(): Promise<void> {
  // 1) Read which canonicals already exist, paging so a large table is safe.
  const existing = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("cluedown_questions")
      .select("answer_canonical")
      .range(from, from + 999);
    if (error) {
      console.error(`failed reading existing questions: ${error.message}`);
      process.exit(1);
    }
    for (const r of data ?? []) existing.add(r.answer_canonical as string);
    if (!data || data.length < 1000) break;
  }

  const toInsert = unique.filter((q) => !existing.has(q.answerCanonical));
  console.error(
    `bank: ${unique.length} unique • already in DB: ${existing.size} • to insert: ${toInsert.length}`,
  );
  if (toInsert.length === 0) {
    console.error("nothing to do — Supabase already has the whole bank.");
    return;
  }

  // 2) Insert the new questions, collecting canonical -> generated uuid.
  const idByCanonical = new Map<string, string>();
  for (const group of chunk(toInsert, CHUNK)) {
    const { data, error } = await sb
      .from("cluedown_questions")
      .insert(
        group.map((q) => ({
          answer: q.answer,
          answer_canonical: q.answerCanonical,
          answer_aliases: q.answerAliases,
          category: q.category,
          difficulty: q.difficulty,
          wikipedia_title: q.wikipediaTitle ?? null,
          status: "verified",
        })),
      )
      .select("id, answer_canonical");
    if (error || !data) {
      console.error(`question insert failed: ${error?.message}`);
      process.exit(1);
    }
    for (const r of data) idByCanonical.set(r.answer_canonical as string, r.id as string);
  }

  // 3) Insert clues + decoys for exactly the questions we just added. If a
  //    child insert fails, delete the questions from this run (children
  //    cascade) so a re-run starts clean instead of leaving clue-less rows.
  const rollback = async (reason: string): Promise<never> => {
    console.error(reason);
    const ids = [...idByCanonical.values()];
    for (const group of chunk(ids, CHUNK)) {
      await sb.from("cluedown_questions").delete().in("id", group);
    }
    console.error(`rolled back ${ids.length} questions from this run.`);
    process.exit(1);
  };

  const clueRows = toInsert.flatMap((q) => clueRowsFor(q, idByCanonical.get(q.answerCanonical)!));
  const decoyRows = toInsert.flatMap((q) => decoyRowsFor(q, idByCanonical.get(q.answerCanonical)!));

  for (const group of chunk(clueRows, CHUNK)) {
    const { error } = await sb.from("cluedown_clues").insert(group);
    if (error) await rollback(`clue insert failed: ${error.message}`);
  }
  for (const group of chunk(decoyRows, CHUNK)) {
    const { error } = await sb.from("cluedown_decoys").insert(group);
    if (error) await rollback(`decoy insert failed: ${error.message}`);
  }

  console.error(
    `done — inserted ${toInsert.length} questions, ${clueRows.length} clues, ${decoyRows.length} decoys.`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
