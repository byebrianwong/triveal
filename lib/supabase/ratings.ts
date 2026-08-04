/**
 * Supabase-backed question ratings (see migration 0004).
 *
 * Writes go through the service role — the table carries no anon policies at
 * all, so a stray anon key can neither read other people's notes nor rewrite
 * a rating. `ratingsUseSupabase()` is what decides whether this module or the
 * local file store is in play.
 */

import "server-only";
import { getServerSupabase } from "./questions";
import type { NewRating, RatingRecord } from "@/lib/ratings/types";
import { isRatingMode, isRatingValue } from "@/lib/ratings/types";

const TABLE = "triveal_question_ratings";

/** Most rows the review page pulls back. Far above any realistic volume. */
const LIST_LIMIT = 5000;

export function ratingsUseSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

interface RatingRow {
  id: string;
  question_ref: string;
  rating: string;
  comment: string | null;
  mode: string;
  solved: boolean;
  created_at: string;
}

function rowToRecord(row: RatingRow): RatingRecord | null {
  // A row whose enum text somehow drifted (hand-edited in the SQL editor) is
  // dropped rather than allowed to break the summary's typed counts.
  if (!isRatingValue(row.rating) || !isRatingMode(row.mode)) return null;
  return {
    id: row.id,
    questionId: row.question_ref,
    rating: row.rating,
    comment: row.comment,
    mode: row.mode,
    solved: row.solved,
    createdAt: row.created_at,
  };
}

export async function saveRatingToSupabase(input: NewRating): Promise<RatingRecord | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      question_ref: input.questionId,
      rating: input.rating,
      mode: input.mode,
      solved: input.solved,
    })
    .select("id, question_ref, rating, comment, mode, solved, created_at")
    .single();
  if (error || !data) return null;
  return rowToRecord(data as RatingRow);
}

export async function updateRatingInSupabase(
  id: string,
  patch: { rating?: string; comment?: string | null },
): Promise<boolean> {
  const sb = getServerSupabase();
  const { data, error } = await sb.from(TABLE).update(patch).eq("id", id).select("id");
  return !error && (data?.length ?? 0) > 0;
}

export async function listRatingsFromSupabase(): Promise<RatingRecord[]> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from(TABLE)
    .select("id, question_ref, rating, comment, mode, solved, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error || !data) return [];
  return (data as RatingRow[]).map(rowToRecord).filter((r): r is RatingRecord => r !== null);
}
