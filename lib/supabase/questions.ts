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

const QUESTION_SELECT =
  "id, answer, answer_canonical, answer_aliases, category, difficulty, clues(position, text), decoys(text, eliminated_by_clue)";

export async function fetchDailyQuestionFromSupabase(
  dateStr: string,
): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("daily_questions")
    .select(`play_date, questions(${QUESTION_SELECT})`)
    .eq("play_date", dateStr)
    .maybeSingle();
  if (error || !data?.questions) return null;
  return rowToQuestion(data.questions as unknown as QuestionRow);
}

export async function fetchQuestionByIdFromSupabase(id: string): Promise<Question | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from("questions")
    .select(QUESTION_SELECT)
    .eq("id", id)
    .eq("status", "verified")
    .maybeSingle();
  if (error || !data) return null;
  return rowToQuestion(data as unknown as QuestionRow);
}
