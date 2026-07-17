/**
 * Stage 7: insert verified questions into Supabase (spec §3.8). Points
 * follow the app's 10/8/6/4(/2) decay by clue position. Re-runnable:
 * skips answers already present.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     pnpm pipeline pipeline/7-load-supabase.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readJson, type VerifiedQuestion } from "./lib";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const CLUE_POINTS = [10, 8, 6, 4, 2];
const sb = createClient(url, key, { auth: { persistSession: false } });
const questions = readJson<VerifiedQuestion[]>("verified.json").filter(
  (q) => q.status === "verified",
);

let inserted = 0;
for (const q of questions) {
  const { data: existing } = await sb
    .from("cluedown_questions")
    .select("id")
    .eq("answer_canonical", q.canonical)
    .maybeSingle();
  if (existing) {
    console.error(`skip (exists): ${q.answer}`);
    continue;
  }

  const { data: row, error } = await sb
    .from("cluedown_questions")
    .insert({
      answer: q.answer,
      answer_canonical: q.canonical,
      answer_aliases: q.aliases,
      category: q.category,
      difficulty: q.difficulty,
      wikipedia_title: q.wikipediaTitle,
      status: "verified",
    })
    .select("id")
    .single();
  if (error || !row) {
    console.error(`insert failed "${q.answer}": ${error?.message}`);
    continue;
  }

  const { error: clueErr } = await sb.from("cluedown_clues").insert(
    q.clues.map((c) => ({
      question_id: row.id,
      position: c.position,
      text: c.text,
      points_value: CLUE_POINTS[Math.min(c.position - 1, CLUE_POINTS.length - 1)],
    })),
  );
  const { error: decoyErr } = await sb.from("cluedown_decoys").insert(
    q.decoys.map((d) => ({
      question_id: row.id,
      text: d.text,
      eliminated_by_clue: d.eliminated_by_clue,
    })),
  );
  if (clueErr || decoyErr) {
    console.error(`children failed "${q.answer}": ${clueErr?.message ?? decoyErr?.message}`);
    await sb.from("cluedown_questions").delete().eq("id", row.id); // keep the bank consistent
    continue;
  }
  inserted++;
  console.error(`inserted: ${q.answer}`);
}

console.error(`${inserted}/${questions.length} inserted`);
