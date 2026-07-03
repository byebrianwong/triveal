/**
 * Stage 2: normalize answers, group rows, rank by frequency, keep the top
 * working set. Frequency is a free gettability prior (spec §3.2).
 *
 *   pnpm pipeline pipeline/2-dedupe-rank.ts [--top 2000]
 */

import { normalizeAnswer, readJson, writeJson, type JeopardyRow, type RankedAnswer } from "./lib";

const TOP = Number(process.argv[process.argv.indexOf("--top") + 1]) || 2000;

const rows = readJson<JeopardyRow[]>("rows.json");
const groups = new Map<string, { raws: Map<string, number>; clues: string[]; categories: string[]; values: number[] }>();

for (const row of rows) {
  const canonical = normalizeAnswer(row.answer);
  if (!canonical || canonical.length < 2) continue;
  let g = groups.get(canonical);
  if (!g) {
    g = { raws: new Map(), clues: [], categories: [], values: [] };
    groups.set(canonical, g);
  }
  const raw = row.answer.replace(/<[^>]+>/g, "").trim();
  g.raws.set(raw, (g.raws.get(raw) ?? 0) + 1);
  g.clues.push(row.clue);
  g.categories.push(row.category);
  const v = Number(row.value.replace(/[^0-9]/g, ""));
  if (v) g.values.push(v);
}

const ranked: RankedAnswer[] = [...groups.entries()]
  .map(([canonical, g]) => ({
    canonical,
    answer: [...g.raws.entries()].sort((a, b) => b[1] - a[1])[0][0],
    frequency: g.clues.length,
    clues: g.clues,
    categories: [...new Set(g.categories)].slice(0, 10),
    typicalValue: g.values.length
      ? g.values.sort((a, b) => a - b)[Math.floor(g.values.length / 2)]
      : 0,
  }))
  .sort((a, b) => b.frequency - a.frequency)
  .slice(0, TOP);

console.error(`${groups.size} unique answers -> keeping top ${ranked.length}`);
writeJson("ranked.json", ranked);
