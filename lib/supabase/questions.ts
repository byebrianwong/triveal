/**
 * Supabase question access. Env-gated: everything returns null/false when
 * NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent, and the
 * caller falls back to the bundled seed bank.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Question } from "@/lib/game/types";

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

let client: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return client;
}

interface QuestionRow {
  id: string;
  answer: string;
  answer_canonical: string;
  answer_aliases: string[];
  category: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  clues: { position: number; text: string }[];
  decoys: { text: string; eliminated_by_clue: number | null }[];
}

function rowToQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    answer: row.answer,
    answerCanonical: row.answer_canonical,
    answerAliases: row.answer_aliases ?? [],
    category: row.category ?? "General",
    difficulty: row.difficulty ?? "medium",
    clues: [...row.clues].sort((a, b) => a.position - b.position),
    decoys: row.decoys.map((d) => ({
      text: d.text,
      eliminatedByClue: d.eliminated_by_clue ?? 0,
    })),
  };
}

// Embedded resources are aliased (`clues:cluedown_clues`) so the response
// keys stay `clues`/`decoys`/`questions` regardless of the prefixed tables.
const QUESTION_SELECT =
  "id, answer, answer_canonical, answer_aliases, category, difficulty, clues:cluedown_clues(position, text), decoys:cluedown_decoys(text, eliminated_by_clue)";

export async function fetchDailyQuestionFromSupabase(
  dateStr: string,
): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_daily_questions")
    .select(`play_date, questions:cluedown_questions(${QUESTION_SELECT})`)
    .eq("play_date", dateStr)
    .maybeSingle();
  if (error || !data?.questions) return null;
  return rowToQuestion(data.questions as unknown as QuestionRow);
}

export async function fetchRandomVerifiedQuestionFromSupabase(
  exclude: string[],
): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_questions")
    .select("id")
    .eq("status", "verified")
    .limit(1000);
  if (error || !data?.length) return null;
  const ids = data.map((r) => r.id as string);
  const pool = ids.filter((id) => !exclude.includes(id));
  const from = pool.length ? pool : ids;
  const pick = from[Math.floor(Math.random() * from.length)];
  return fetchQuestionByIdFromSupabase(pick);
}

export async function fetchQuestionByIdFromSupabase(id: string): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("cluedown_questions")
    .select(QUESTION_SELECT)
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();
  if (error || !data) return null;
  return rowToQuestion(data as unknown as QuestionRow);
}
