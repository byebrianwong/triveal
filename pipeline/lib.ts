/**
 * Shared helpers for the offline pipeline. Deliberately self-contained:
 * per the handoff spec, the pipeline does not import from lib/game.
 */

import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(import.meta.dirname ?? __dirname, "data");

export function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")) as T;
}

export function writeJson(name: string, value: unknown): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(value, null, 1));
  console.error(`wrote ${path.join("pipeline/data", name)}`);
}

export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ") // strip HTML
    .replace(/\([^)]*\)/g, " ") // strip parentheticals
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(a|an|the)\s+/, "");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wikimedia asks for a descriptive UA; generic agents get rate-limited. */
export const WIKI_HEADERS = {
  "User-Agent": "Cluedown-pipeline/0.1 (side project; contact: beamer408@gmail.com)",
  Accept: "application/json",
};

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: WIKI_HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

/** Minimal CSV parser handling quoted fields and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// --- Pipeline record shapes ---

export interface JeopardyRow {
  category: string;
  value: string;
  clue: string;
  answer: string;
  round: string;
  airDate: string;
}

export interface RankedAnswer {
  answer: string; // display form (most common raw variant)
  canonical: string;
  frequency: number;
  clues: string[]; // grouped J-Archive clue texts (vetted angles; never republished)
  categories: string[];
  typicalValue: number;
}

export interface ResolvedAnswer extends RankedAnswer {
  wikipediaTitle: string;
  confidence: "high" | "low";
}

export interface ContextBundle extends ResolvedAnswer {
  extract: string;
}

export interface GeneratedQuestion {
  answer: string;
  canonical: string;
  wikipediaTitle: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  clues: { position: number; text: string }[];
  decoys: { text: string; eliminated_by_clue: number }[];
  aliases: string[];
}

export interface VerifiedQuestion extends GeneratedQuestion {
  status: "verified" | "rejected" | "needs_review";
  verification: {
    position: number;
    supported: boolean;
    leaksAnswer: boolean;
    ambiguous: boolean;
    notes: string;
  }[];
}
