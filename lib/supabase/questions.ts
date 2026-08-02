/**
 * Supabase question access. Env-gated: everything returns null/false when
 * NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent, and the
 * caller falls back to the bundled seed bank.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Question } from "@/lib/game/types";
import { pickAvoidingCategories } from "@/lib/questions/select";

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
  wikipedia_title: string | null;
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
    wikipediaTitle: row.wikipedia_title ?? undefined,
    clues: [...row.clues].sort((a, b) => a.position - b.position),
    decoys: row.decoys.map((d) => ({
      text: d.text,
      eliminatedByClue: d.eliminated_by_clue ?? 0,
    })),
  };
}

// Embedded resources are aliased (`clues:triveal_clues`) so the response
// keys stay `clues`/`decoys`/`questions` regardless of the prefixed tables.
const QUESTION_SELECT =
  "id, answer, answer_canonical, answer_aliases, category, difficulty, wikipedia_title, clues:triveal_clues(position, text), decoys:triveal_decoys(text, eliminated_by_clue)";

export async function fetchDailyQuestionFromSupabase(
  dateStr: string,
): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("triveal_daily_questions")
    .select(`play_date, questions:triveal_questions(${QUESTION_SELECT})`)
    .eq("play_date", dateStr)
    .maybeSingle();
  if (error || !data?.questions) return null;
  return rowToQuestion(data.questions as unknown as QuestionRow);
}

export async function fetchRandomVerifiedQuestionFromSupabase(
  exclude: string[],
  avoidCategories: string[] = [],
): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("triveal_questions")
    .select("id, category")
    .eq("status", "verified")
    .limit(1000);
  if (error || !data?.length) return null;
  const rows = data as { id: string; category: string | null }[];
  const pool = rows.filter((r) => !exclude.includes(r.id));
  const from = pool.length ? pool : rows;
  const pick = pickAvoidingCategories(from, avoidCategories, (r) => r.category ?? "General");
  if (!pick) return null;
  return fetchQuestionByIdFromSupabase(pick.id);
}

export async function fetchQuestionByIdFromSupabase(id: string): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("triveal_questions")
    .select(QUESTION_SELECT)
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();
  if (error || !data) return null;
  return rowToQuestion(data as unknown as QuestionRow);
}
