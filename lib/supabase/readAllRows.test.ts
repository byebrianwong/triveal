import { describe, expect, it } from "vitest";
import { PAGE_SIZE, readAllRows, type RowPage } from "./readAllRows";

/**
 * A stand-in for a Supabase query over `total` rows. `serverCap` is the most
 * rows the fake server returns per request, like the project's "Max rows"
 * setting. Records each requested range.
 */
function fakeTable(
  total: number,
  { serverCap = PAGE_SIZE, withCount = true, failAt }: { serverCap?: number; withCount?: boolean; failAt?: number } = {},
) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number): Promise<RowPage<{ id: number }>> => {
    calls.push([from, to]);
    if (calls.length === failAt) return { data: null, error: { message: "boom" }, count: null };
    const end = Math.min(to + 1, from + serverCap);
    return { data: rows.slice(from, end), error: null, count: withCount ? total : null };
  };
  return { rows, calls, fetchPage };
}

describe("readAllRows", () => {
  it("reads a table smaller than one page in a single request", async () => {
    const t = fakeTable(556);
    expect(await readAllRows(t.fetchPage)).toEqual(t.rows);
    expect(t.calls).toEqual([[0, 999]]);
  });

  it("reads past 1,000 rows, page by page", async () => {
    const t = fakeTable(2350);
    expect(await readAllRows(t.fetchPage)).toEqual(t.rows);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops at the count when rows fill the last page exactly", async () => {
    const t = fakeTable(2000);
    expect(await readAllRows(t.fetchPage)).toHaveLength(2000);
    expect(t.calls).toHaveLength(2);
  });

  it("still reads everything when the server caps pages below the page size", async () => {
    const t = fakeTable(1200, { serverCap: 500 });
    expect(await readAllRows(t.fetchPage)).toEqual(t.rows);
    expect(t.calls).toEqual([
      [0, 999],
      [500, 1499],
      [1000, 1999],
    ]);
  });

  it("without a count, stops at the first short page", async () => {
    const t = fakeTable(1500, { withCount: false });
    expect(await readAllRows(t.fetchPage)).toEqual(t.rows);
    expect(t.calls).toHaveLength(2);
  });

  it("returns an empty list for an empty table", async () => {
    const t = fakeTable(0);
    expect(await readAllRows(t.fetchPage)).toEqual([]);
    expect(t.calls).toHaveLength(1);
  });

  it("returns null if any page fails", async () => {
    const t = fakeTable(2500, { failAt: 2 });
    expect(await readAllRows(t.fetchPage)).toBeNull();
  });
});
