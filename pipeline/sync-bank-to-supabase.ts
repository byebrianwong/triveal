/**
 * Sync the committed local question bank into Supabase so the DB-backed
 * daily/practice modes serve exactly the same questions as the zero-config
 * local build. The source is the same bank the app uses when Supabase is
 * absent — SEED_QUESTIONS + EXTRA_QUESTIONS + the (optional) private bank —
 * so there is no separate export step to keep in sync.
 *
 * Idempotent: it dedupes by answer_canonical and, by default, inserts only
 * the questions the database doesn't already have. Safe to re-run.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm sync-bank
 *   # or: pnpm pipeline pipeline/sync-bank-to-supabase.ts
 *
 * Flags:
 *   --update    Also reconcile questions already in the DB whose committed
 *               content changed — the answer/aliases/category/difficulty, the
 *               clues, or the decoys — rewriting only the parts that differ.
 *               Matches on answer_canonical, so editing the answer text itself
 *               reads as a new question, not an edit. Never deletes questions.
 *   --dry-run   Print what would change and write nothing. Without --update it
 *               needs no credentials (it just reports the local bank); with
 *               --update it reads the DB to compute the diff, so credentials
 *               are required.
 *
 * Apply supabase/migrations/0001_init.sql first. This uses the service-role
 * key (writes bypass RLS), so run it from a trusted machine — never ship the
 * key to the browser.
 */

import { createClient } from "@supabase/supabase-js";
import type { Question } from "../lib/game/types";
import { SEED_QUESTIONS } from "../lib/questions/seed";
import { EXTRA_QUESTIONS } from "../lib/questions/extraBank";
import { loadPrivateBank } from "../lib/questions/privateBank";
import { dedupeByCanonical } from "../lib/questions/select";

// Points decay by clue position, matching the app's 10/8/6/4(/2) scoring.
const CLUE_POINTS = [10, 8, 6, 4, 2];
const CHUNK = 500; // rows per PostgREST bulk insert
const dryRun = process.argv.includes("--dry-run");
const doUpdate = process.argv.includes("--update");

// The exact bank the app serves in zero-config mode (source.ts `localBank`).
const bank: Question[] = [...SEED_QUESTIONS, ...EXTRA_QUESTIONS, ...loadPrivateBank()];

// De-dupe within the bank by canonical answer, first occurrence wins. Not
// merely defensive: the private bank genuinely overlaps the committed one.
// Shared with the app's own pool (`lib/questions/source.ts` `localBank`) so
// both paths serve exactly the same set.
const unique = dedupeByCanonical(bank, (q) => q.answerCanonical);

/** Row shape read back from Supabase for the --update diff. */
interface ExistingRow {
  id: string;
  answer: string;
  answer_canonical: string;
  answer_aliases: string[] | null;
  category: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  wikipedia_title: string | null;
  status: string;
  clues: { position: number; text: string; points_value: number }[];
  decoys: { text: string; eliminated_by_clue: number | null }[];
}

const EXISTING_SELECT =
  "id, answer, answer_canonical, answer_aliases, category, difficulty, " +
  "wikipedia_title, status, " +
  "clues:triveal_clues(position, text, points_value), " +
  "decoys:triveal_decoys(text, eliminated_by_clue)";

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

// --- Normalized fingerprints, so a diff ignores incidental ordering. ---

function bankCluesFingerprint(q: Question): string {
  const rows = [...q.clues]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      position: c.position,
      text: c.text,
      points_value: CLUE_POINTS[Math.min(c.position - 1, CLUE_POINTS.length - 1)],
    }));
  return JSON.stringify(rows);
}

function dbCluesFingerprint(row: ExistingRow): string {
  const rows = [...row.clues]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ position: c.position, text: c.text, points_value: c.points_value }));
  return JSON.stringify(rows);
}

const decoyKey = (d: { text: string; eliminated_by_clue: number | null }) =>
  `${d.text}\u0000${d.eliminated_by_clue ?? ""}`;

function bankDecoysFingerprint(q: Question): string {
  const rows = q.decoys
    .map((d) => ({ text: d.text, eliminated_by_clue: d.eliminatedByClue }))
    .sort((a, b) => decoyKey(a).localeCompare(decoyKey(b)));
  return JSON.stringify(rows);
}

function dbDecoysFingerprint(row: ExistingRow): string {
  const rows = row.decoys
    .map((d) => ({ text: d.text, eliminated_by_clue: d.eliminated_by_clue }))
    .sort((a, b) => decoyKey(a).localeCompare(decoyKey(b)));
  return JSON.stringify(rows);
}

function scalarsDiffer(q: Question, row: ExistingRow): boolean {
  return (
    q.answer !== row.answer ||
    JSON.stringify(q.answerAliases) !== JSON.stringify(row.answer_aliases ?? []) ||
    q.category !== (row.category ?? null) ||
    q.difficulty !== (row.difficulty ?? null) ||
    // Only a bank-side title counts as a difference: the pipeline resolves
    // titles the committed bank doesn't carry, and --update must not blank them.
    (Boolean(q.wikipediaTitle) && q.wikipediaTitle !== (row.wikipedia_title ?? undefined)) ||
    row.status !== "verified"
  );
}

// --- Dry-run without --update needs no DB and no credentials. ---
if (dryRun && !doUpdate) {
  const clues = unique.reduce((n, q) => n + q.clues.length, 0);
  const decoys = unique.reduce((n, q) => n + q.decoys.length, 0);
  const byCategory = new Map<string, number>();
  for (const q of unique) byCategory.set(q.category, (byCategory.get(q.category) ?? 0) + 1);
  console.error(`[dry-run] would sync ${unique.length} questions, ${clues} clues, ${decoys} decoys.`);
  console.error("[dry-run] by category:");
  for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    console.error(`  ${String(n).padStart(3)}  ${cat}`);
  }
  console.error("[dry-run] no rows written. Add --update to also reconcile edited questions.");
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
  // 1) Read what's already in the DB. For --update we need the full rows to
  //    diff against; otherwise just the canonicals are enough.
  const existingByCanonical = new Map<string, ExistingRow>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("triveal_questions")
      .select(doUpdate ? EXISTING_SELECT : "answer_canonical")
      .range(from, from + 999);
    if (error) {
      console.error(`failed reading existing questions: ${error.message}`);
      process.exit(1);
    }
    const rows = (data ?? []) as unknown as ExistingRow[];
    for (const r of rows) existingByCanonical.set(r.answer_canonical, r);
    if (rows.length < 1000) break;
  }

  const toInsert = unique.filter((q) => !existingByCanonical.has(q.answerCanonical));

  // 2) Compute the update set (only when --update).
  const toUpdate = doUpdate
    ? unique
        .map((q) => {
          const row = existingByCanonical.get(q.answerCanonical);
          if (!row) return null;
          const scalar = scalarsDiffer(q, row);
          const clues = bankCluesFingerprint(q) !== dbCluesFingerprint(row);
          const decoys = bankDecoysFingerprint(q) !== dbDecoysFingerprint(row);
          if (!scalar && !clues && !decoys) return null;
          return { q, row, scalar, clues, decoys };
        })
        .filter((u): u is NonNullable<typeof u> => u !== null)
    : [];

  console.error(
    `bank: ${unique.length} unique • in DB: ${existingByCanonical.size} • ` +
      `to insert: ${toInsert.length}` +
      (doUpdate ? ` • to update: ${toUpdate.length}` : ""),
  );

  if (dryRun) {
    for (const u of toUpdate) {
      const parts = [u.scalar && "fields", u.clues && "clues", u.decoys && "decoys"].filter(Boolean);
      console.error(`  [would update] ${u.q.answer} (${parts.join(", ")})`);
    }
    console.error("[dry-run] no rows written.");
    return;
  }

  // 3) Insert missing questions, collecting canonical -> generated uuid.
  const idByCanonical = new Map<string, string>();
  for (const group of chunk(toInsert, CHUNK)) {
    const { data, error } = await sb
      .from("triveal_questions")
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

  // If a child insert fails, delete the questions from this run (children
  // cascade) so a re-run starts clean instead of leaving clue-less rows.
  const rollback = async (reason: string): Promise<never> => {
    console.error(reason);
    const ids = [...idByCanonical.values()];
    for (const group of chunk(ids, CHUNK)) {
      await sb.from("triveal_questions").delete().in("id", group);
    }
    console.error(`rolled back ${ids.length} inserted questions from this run.`);
    process.exit(1);
  };

  const clueRows = toInsert.flatMap((q) => clueRowsFor(q, idByCanonical.get(q.answerCanonical)!));
  const decoyRows = toInsert.flatMap((q) => decoyRowsFor(q, idByCanonical.get(q.answerCanonical)!));
  for (const group of chunk(clueRows, CHUNK)) {
    const { error } = await sb.from("triveal_clues").insert(group);
    if (error) await rollback(`clue insert failed: ${error.message}`);
  }
  for (const group of chunk(decoyRows, CHUNK)) {
    const { error } = await sb.from("triveal_decoys").insert(group);
    if (error) await rollback(`decoy insert failed: ${error.message}`);
  }

  // 4) Apply updates to already-present questions (only with --update). Each
  //    changed part is rewritten independently; children are replaced wholesale
  //    so the DB ends up matching the committed bank exactly.
  let updated = 0;
  let failures = 0;
  for (const u of toUpdate) {
    const id = u.row.id;
    try {
      if (u.scalar) {
        const { error } = await sb
          .from("triveal_questions")
          .update({
            answer: u.q.answer,
            answer_aliases: u.q.answerAliases,
            category: u.q.category,
            difficulty: u.q.difficulty,
            ...(u.q.wikipediaTitle ? { wikipedia_title: u.q.wikipediaTitle } : {}),
            status: "verified",
          })
          .eq("id", id);
        if (error) throw new Error(`fields: ${error.message}`);
      }
      if (u.clues) {
        const del = await sb.from("triveal_clues").delete().eq("question_id", id);
        if (del.error) throw new Error(`clues delete: ${del.error.message}`);
        const ins = await sb.from("triveal_clues").insert(clueRowsFor(u.q, id));
        if (ins.error) throw new Error(`clues insert: ${ins.error.message}`);
      }
      if (u.decoys) {
        const del = await sb.from("triveal_decoys").delete().eq("question_id", id);
        if (del.error) throw new Error(`decoys delete: ${del.error.message}`);
        const ins = await sb.from("triveal_decoys").insert(decoyRowsFor(u.q, id));
        if (ins.error) throw new Error(`decoys insert: ${ins.error.message}`);
      }
      updated++;
    } catch (err) {
      failures++;
      console.error(`update failed "${u.q.answer}": ${err instanceof Error ? err.message : err}`);
    }
  }

  console.error(
    `done — inserted ${toInsert.length} questions, ${clueRows.length} clues, ${decoyRows.length} decoys` +
      (doUpdate ? `; updated ${updated} existing question(s)` : "") +
      (failures ? `; ${failures} update(s) failed` : "") +
      ".",
  );
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
