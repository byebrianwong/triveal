/**
 * Stage 4: pull enough Wikipedia text per entity to support an obscure
 * lead-in, and bundle it with the grouped J-Archive clues (spec §3.4).
 *
 *   pnpm pipeline pipeline/4-assemble-context.ts
 */

import { fetchJson, readJson, sleep, writeJson, type ContextBundle, type ResolvedAnswer } from "./lib";

interface ExtractResult {
  query?: { pages?: Record<string, { extract?: string }> };
}

const resolved = readJson<ResolvedAnswer[]>("resolved.json");
const bundles: ContextBundle[] = [];

for (const [i, item] of resolved.entries()) {
  try {
    const data = await fetchJson<ExtractResult>(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(item.wikipediaTitle)}&format=json&exsectionformat=plain`,
    );
    const extract = Object.values(data.query?.pages ?? {})[0]?.extract ?? "";
    if (extract.length < 400) {
      console.error(`skip "${item.answer}": extract too short`);
      continue;
    }
    // Cap context: intro + early body is plenty and keeps token cost sane.
    bundles.push({ ...item, extract: extract.slice(0, 12_000) });
    if (i % 20 === 0) console.error(`assembled ${i + 1}/${resolved.length}`);
    await sleep(120);
  } catch (err) {
    console.error(`skip "${item.answer}": ${(err as Error).message}`);
  }
}

console.error(`${bundles.length} context bundles`);
writeJson("context.json", bundles);
