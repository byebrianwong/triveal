/**
 * Server-side question data source. When Supabase env vars are present,
 * verified questions come from Postgres; otherwise the bundled seed bank
 * serves as the source so the app runs with zero configuration.
 *
 * Only ever import this from server code — it holds full questions
 * including answers.
 */

import "server-only";
import { dailyQuestionIndex } from "@/lib/game/daily";
import type { Question } from "@/lib/game/types";
import { SEED_QUESTIONS } from "./seed";
import { loadPrivateBank } from "./privateBank";
import { fetchDailyQuestionFromSupabase, supabaseConfigured } from "@/lib/supabase/questions";

/** Public samples + gitignored private bank (when present). */
function localBank(): Question[] {
  return [...SEED_QUESTIONS, ...loadPrivateBank()];
}

export interface DailyPuzzle {
  /** Full question, answer included. Never send this to the client whole. */
  question: Question;
  dateStr: string;
}

export async function getDailyQuestion(dateStr: string): Promise<DailyPuzzle> {
  if (supabaseConfigured()) {
    const q = await fetchDailyQuestionFromSupabase(dateStr);
    if (q) return { question: q, dateStr };
  }
  const bank = localBank();
  const idx = dailyQuestionIndex(dateStr, bank.length);
  return { question: bank[idx], dateStr };
}

export async function getQuestionById(id: string): Promise<Question | null> {
  // Local lookup first (ids are stable slugs); Supabase rows use uuids.
  const local = localBank().find((q) => q.id === id);
  if (local) return local;
  if (supabaseConfigured()) {
    const { fetchQuestionByIdFromSupabase } = await import("@/lib/supabase/questions");
    return fetchQuestionByIdFromSupabase(id);
  }
  return null;
}

/** A random verified question for practice mode (excludes today's). */
export async function getPracticeQuestion(excludeId?: string): Promise<Question> {
  const pool = localBank().filter((q) => q.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
