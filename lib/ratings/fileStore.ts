/**
 * Zero-config rating store: `.triveal/ratings.json` in the project root
 * (gitignored).
 *
 * This is what `pnpm dev` uses when Supabase isn't configured, so the whole
 * rate → review loop works locally with no setup. It is NOT durable on
 * serverless hosts (each deploy — often each request — gets a fresh
 * filesystem), which is why `store.ts` prefers Supabase whenever the service
 * role key is present.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NewRating, RatingRecord } from "./types";

// Statically scoped under a fixed subfolder — a path assembled from a variable
// makes the build tracer give up and bundle the whole project (the same reason
// lib/questions/privateBank.ts spells its path out in full).
const DIR = ".triveal";
const FILE = "ratings.json";

function ratingsDir(): string {
  return join(process.cwd(), DIR);
}

function ratingsFile(): string {
  return join(process.cwd(), DIR, FILE);
}

/**
 * Reads and writes are read-modify-write on one file, so they are chained
 * rather than run concurrently — two ratings landing together would otherwise
 * race and one would be lost.
 */
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

async function readAll(): Promise<RatingRecord[]> {
  try {
    const raw = await readFile(ratingsFile(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RatingRecord[]) : [];
  } catch {
    // Missing or unreadable file — no ratings yet.
    return [];
  }
}

async function writeAll(records: RatingRecord[]): Promise<void> {
  await mkdir(ratingsDir(), { recursive: true });
  await writeFile(ratingsFile(), `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

export function saveRatingToFile(input: NewRating): Promise<RatingRecord> {
  return serialize(async () => {
    const record: RatingRecord = {
      id: randomUUID(),
      questionId: input.questionId,
      rating: input.rating,
      comment: null,
      mode: input.mode,
      solved: input.solved,
      createdAt: new Date().toISOString(),
    };
    await writeAll([...(await readAll()), record]);
    return record;
  });
}

export function updateRatingInFile(
  id: string,
  patch: Partial<Pick<RatingRecord, "rating" | "comment">>,
): Promise<boolean> {
  return serialize(async () => {
    const records = await readAll();
    const target = records.find((r) => r.id === id);
    if (!target) return false;
    await writeAll(records.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    return true;
  });
}

export function listRatingsFromFile(): Promise<RatingRecord[]> {
  return serialize(readAll);
}
