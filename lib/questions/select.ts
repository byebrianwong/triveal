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
