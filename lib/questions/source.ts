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
import { EXTRA_QUESTIONS } from "./extraBank";
import { loadPrivateBank } from "./privateBank";
import { dedupeByCanonical, pickAvoidingCategories } from "./select";
import {
  fetchDailyQuestionFromSupabase,
  fetchRandomVerifiedQuestionFromSupabase,
  supabaseConfigured,
} from "@/lib/supabase/questions";

/**
 * Public samples + committed extra bank + gitignored private bank (when
 * present), de-duped by canonical answer the same way the Supabase mirror is.
 * The private bank overlaps the committed one, so without the dedupe the
 * overlapping questions would sit in this pool twice and come up about twice
 * as often as they do when Supabase is configured.
 */
function localBank(): Question[] {
  return dedupeByCanonical(
    [...SEED_QUESTIONS, ...EXTRA_QUESTIONS, ...loadPrivateBank()],
    (q) => q.answerCanonical,
  );
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

/**
 * A random verified question for practice mode. `exclude` skips recently-seen
 * question ids; `avoidCategories` (newest-last) steers away from categories
 * just served so a uniform-random draw doesn't clump the same category
 * several rounds in a row.
 */
export async function getRandomQuestion(
  exclude: string[] = [],
  avoidCategories: string[] = [],
): Promise<Question> {
  if (supabaseConfigured()) {
    const q = await fetchRandomVerifiedQuestionFromSupabase(exclude, avoidCategories);
    if (q) return q;
  }
  const bank = localBank();
  const pool = bank.filter((q) => !exclude.includes(q.id));
  const from = pool.length ? pool : bank;
  return (
    pickAvoidingCategories(from, avoidCategories, (q) => q.category) ??
    from[Math.floor(Math.random() * from.length)]
  );
}
