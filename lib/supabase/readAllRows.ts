/**
 * Read every row a Supabase query matches, one page at a time.
 *
 * A single Supabase request returns at most 1,000 rows by default (the
 * project's "Max rows" API setting). Past that, a plain select drops the rest
 * without any error. This helper keeps asking for the next page until it has
 * as many rows as the server says match.
 */

/** Rows to ask for per request. Matches Supabase's default per-request cap. */
export const PAGE_SIZE = 1000;

/** The parts of a Supabase response this helper reads. */
export interface RowPage<T> {
  data: T[] | null;
  error: { message: string } | null;
  /** Total matching rows. Present when the select passes `{ count: "exact" }`. */
  count: number | null;
}

/**
 * `fetchPage(from, to)` must run the same query each time with
 * `.range(from, to)` added. The query must sort on a unique column, such as
 * `.order("id")`. Without a sort order, Postgres may return rows in a
 * different order on each request, so pages can skip or repeat rows.
 *
 * Returns null if any request fails, so callers can fall back the same way
 * they would for a single failed query.
 */
export async function readAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<RowPage<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + pageSize - 1);
    if (error) return null;
    const page = data ?? [];
    rows.push(...page);
    if (page.length === 0) return rows;
    // With a count, stop once every matching row is in. The next page starts
    // after the rows that actually came back, so a server cap lower than
    // `pageSize` still reads everything. Without a count, a short page is the
    // only sign that the end has been reached.
    const done = count !== null ? rows.length >= count : page.length < pageSize;
    if (done) return rows;
  }
}
