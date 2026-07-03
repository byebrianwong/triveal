/**
 * Stage 3: resolve each ranked answer to a canonical Wikipedia title
 * (search -> follow redirects -> confidence flag). Low-confidence matches
 * are kept but flagged for review (spec §3.3).
 *
 *   pnpm pipeline pipeline/3-resolve-wikipedia.ts [--limit 200]
 */

import { fetchJson, readJson, sleep, writeJson, normalizeAnswer, type RankedAnswer, type ResolvedAnswer } from "./lib";

const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 200;

interface SearchResult {
  pages: { title: string; description?: string }[];
}
interface RedirectResult {
  query?: { redirects?: { to: string }[]; pages?: Record<string, { title: string }> };
}

const ranked = readJson<RankedAnswer[]>("ranked.json").slice(0, LIMIT);
const resolved: ResolvedAnswer[] = [];

for (const [i, item] of ranked.entries()) {
  try {
    const search = await fetchJson<SearchResult>(
      `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(item.answer)}&limit=5`,
    );
    if (!search.pages.length) continue;

    const top = search.pages[0];
    const redirect = await fetchJson<RedirectResult>(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(top.title)}&redirects=1&format=json`,
    );
    const pages = redirect.query?.pages ?? {};
    const canonicalTitle = Object.values(pages)[0]?.title ?? top.title;

    // High confidence when the resolved title normalizes to the answer;
    // otherwise flag for review (disambiguation risk: Mercury, etc.)
    const confidence =
      normalizeAnswer(canonicalTitle) === item.canonical ? "high" : "low";

    resolved.push({ ...item, wikipediaTitle: canonicalTitle, confidence });
    if (i % 20 === 0) console.error(`resolved ${i + 1}/${ranked.length}`);
    await sleep(120); // stay well under Wikimedia rate limits
  } catch (err) {
    console.error(`skip "${item.answer}": ${(err as Error).message}`);
  }
}

console.error(
  `${resolved.length} resolved (${resolved.filter((r) => r.confidence === "low").length} low-confidence)`,
);
writeJson("resolved.json", resolved);
