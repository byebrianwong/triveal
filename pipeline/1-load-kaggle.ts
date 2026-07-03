/**
 * Stage 1: load the Kaggle Jeopardy CSV into pipeline/data/rows.json.
 *
 *   kaggle datasets download -d tunguz/200000-jeopardy-questions
 *   unzip 200000-jeopardy-questions.zip
 *   pnpm pipeline pipeline/1-load-kaggle.ts <path/to/JEOPARDY_CSV.csv>
 */

import fs from "node:fs";
import { parseCsv, writeJson, type JeopardyRow } from "./lib";

const csvPath = process.argv[2];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error("Usage: pnpm pipeline pipeline/1-load-kaggle.ts <JEOPARDY_CSV.csv>");
  console.error("Get it with: kaggle datasets download -d tunguz/200000-jeopardy-questions");
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (name: string) => header.indexOf(name);
const [iCat, iVal, iClue, iAns, iRound, iDate] = [
  col("category"),
  col("value"),
  col("question"),
  col("answer"),
  col("round"),
  col("air date"),
];

const out: JeopardyRow[] = rows.slice(1).map((r) => ({
  category: r[iCat] ?? "",
  value: r[iVal] ?? "",
  clue: r[iClue] ?? "",
  answer: r[iAns] ?? "",
  round: r[iRound] ?? "",
  airDate: r[iDate] ?? "",
}));

console.error(`parsed ${out.length} rows`);
writeJson("rows.json", out);
