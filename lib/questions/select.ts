/**
 * Pure question-selection helpers shared by the local-bank and Supabase
 * random pickers. Deliberately free of `server-only` and any I/O so the
 * category-spacing logic can be unit-tested in isolation.
 */

/**
 * Collapse a raw category into a coarser "spacing group". Some categories
 * read as the same kind of question while playing — Geography, Landmarks and
 * Cities all feel like "geography" — so we space them apart as one group
 * rather than only de-duplicating exact category names.
 */
export function categoryGroup(category: string): string {
  const c = category.trim().toLowerCase();
  if (c === "geography" || c === "landmarks" || c === "cities") return "geography";
  return c;
}

/**
 * Collapse items sharing a canonical answer, keeping the first occurrence.
 *
 * The gitignored private bank overlaps the committed one, so concatenating
 * the banks yields the same question more than once. Both the local pool
 * (`source.ts` `localBank`) and the Supabase mirror
 * (`pipeline/sync-bank-to-supabase.ts`) run everything through this, so the
 * two paths serve an identical set — without it the overlapping questions
 * come up roughly twice as often locally as they do from Postgres.
 */
export function dedupeByCanonical<T>(items: T[], canonicalOf: (item: T) => string): T[] {
  const byCanonical = new Map<string, T>();
  for (const it of items) {
    const key = canonicalOf(it);
    if (!byCanonical.has(key)) byCanonical.set(key, it);
  }
  return [...byCanonical.values()];
}

/**
 * Pick one item at random while steering away from recently-served
 * categories, so a uniform-random draw doesn't clump the same category
 * several times in a row.
 *
 * `recentCategories` is newest-last. We first try to avoid every recent
 * category's group; if that leaves nothing to pick, we relax by dropping the
 * oldest constraint one at a time — preserving avoidance of the *immediately
 * previous* category for as long as the pool allows — and only fall back to
 * the full pool when even that is impossible. Always returns an item when
 * `items` is non-empty.
 */
export function pickAvoidingCategories<T>(
  items: T[],
  recentCategories: string[],
  categoryOf: (item: T) => string,
  rand: () => number = Math.random,
): T | undefined {
  if (items.length === 0) return undefined;
  const recentGroups = recentCategories.map(categoryGroup);
  // Progressively drop the oldest avoided group until a non-empty pool remains.
  for (let start = 0; start < recentGroups.length; start++) {
    const avoid = new Set(recentGroups.slice(start));
    const pool = items.filter((it) => !avoid.has(categoryGroup(categoryOf(it))));
    if (pool.length > 0) return pool[Math.floor(rand() * pool.length)];
  }
  return items[Math.floor(rand() * items.length)];
}
