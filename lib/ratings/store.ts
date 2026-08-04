/**
 * Where ratings live. Same shape as lib/questions/source.ts: Postgres when
 * the environment offers it, a local file otherwise so the feature works with
 * zero configuration.
 *
 * Supabase is used only when SUPABASE_SERVICE_ROLE_KEY is set (not merely the
 * anon key): the ratings table has no anon policies, so an anon-only client
 * would silently write nothing.
 *
 * Server-only — it holds every comment anyone has left.
 */

import "server-only";
import { listRatingsFromFile, saveRatingToFile, updateRatingInFile } from "./fileStore";
import type { NewRating, RatingRecord } from "./types";
import {
  listRatingsFromSupabase,
  ratingsUseSupabase,
  saveRatingToSupabase,
  updateRatingInSupabase,
} from "@/lib/supabase/ratings";

export type RatingsBackend = "supabase" | "file";

export function ratingsBackend(): RatingsBackend {
  return ratingsUseSupabase() ? "supabase" : "file";
}

/** Records a new rating. Returns null if the store rejected it. */
export async function saveRating(input: NewRating): Promise<RatingRecord | null> {
  if (ratingsUseSupabase()) return saveRatingToSupabase(input);
  return saveRatingToFile(input);
}

/**
 * Amends a rating already submitted this round — the player changed their
 * mind about the face, or added a note after the fact. Returns false when the
 * id doesn't exist.
 */
export async function updateRating(
  id: string,
  patch: Partial<Pick<RatingRecord, "rating" | "comment">>,
): Promise<boolean> {
  if (ratingsUseSupabase()) {
    return updateRatingInSupabase(id, {
      ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
      ...(patch.comment !== undefined ? { comment: patch.comment } : {}),
    });
  }
  return updateRatingInFile(id, patch);
}

/** Every rating, newest first. Feeds the review page. */
export async function listRatings(): Promise<RatingRecord[]> {
  const records = ratingsUseSupabase()
    ? await listRatingsFromSupabase()
    : await listRatingsFromFile();
  return [...records].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
