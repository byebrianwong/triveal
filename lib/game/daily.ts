/**
 * Deterministic daily question selection. Day boundary is the player's
 * local midnight (Wordle convention). Selection hashes the date string so
 * every player maps the same date to the same question, with no DB needed;
 * when Supabase is wired, an explicit daily_questions row wins instead.
 */

export const EPOCH = "2026-06-01"; // daily numbering starts here (No. 1)

/** Local date as YYYY-MM-DD. */
export function localDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Days since EPOCH (No. 1 on the epoch date), for "Daily No. N". */
export function dailyNumber(dateStr: string): number {
  const ms = new Date(`${dateStr}T12:00:00`).getTime() - new Date(`${EPOCH}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** FNV-1a 32-bit — stable across platforms, good enough to shuffle days. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pick the index for a date. Walks the bank in a hash-offset stride so
 * consecutive days don't play neighboring bank entries.
 */
export function dailyQuestionIndex(dateStr: string, bankSize: number): number {
  if (bankSize <= 0) return 0;
  return hashString(`cluedown:${dateStr}`) % bankSize;
}
