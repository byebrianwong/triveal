/**
 * Optional private question bank. lib/questions/private-bank.json is
 * gitignored — it holds the hand-verified questions that shouldn't be
 * readable in the public repo. The data source merges it after the public
 * samples; when neither source is present, the app runs on the samples alone.
 *
 * Two ways it reaches the runtime:
 *   1. CLUEDOWN_PRIVATE_BANK — base64-encoded JSON. This is how the bank
 *      travels to Vercel, where the gitignored file doesn't exist. Set it
 *      with: base64 -i lib/questions/private-bank.json | vercel env add ...
 *   2. The local file — used in development.
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

  const encoded = process.env.CLUEDOWN_PRIVATE_BANK;
  if (encoded) {
    try {
      cached = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Question[];
      return cached;
    } catch {
      // malformed env var — fall back to the file
    }
  }

  try {
    const file = path.join(process.cwd(), "lib", "questions", "private-bank.json");
    cached = JSON.parse(fs.readFileSync(file, "utf8")) as Question[];
  } catch {
    cached = [];
  }
  return cached;
}
