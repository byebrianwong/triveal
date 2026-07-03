/**
 * Optional private question bank. lib/questions/private-bank.json is
 * gitignored — it holds the hand-verified questions that shouldn't be
 * readable in the public repo. When the file exists (local dev, or copied
 * to the server at deploy time), the data source merges it after the
 * public samples; when absent, the app runs on the samples alone.
 *
 * Server-side only by construction (uses fs); only imported from the
 * server-only data source.
 */

import fs from "node:fs";
import path from "node:path";
import type { Question } from "@/lib/game/types";

let cached: Question[] | null = null;

export function loadPrivateBank(): Question[] {
  if (cached) return cached;
  try {
    const file = path.join(process.cwd(), "lib", "questions", "private-bank.json");
    cached = JSON.parse(fs.readFileSync(file, "utf8")) as Question[];
  } catch {
    cached = [];
  }
  return cached;
}
