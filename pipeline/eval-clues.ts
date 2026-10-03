/**
 * Clue-quality eval. Scores every clue in the public bank against the rules
 * in lib/questions/README.md ("What makes a good question"), and checks the
 * judge against Brian's own grades. How it works and how to read the results:
 * lib/questions/clueEval/README.md.
 *
 *   pnpm eval-clues --graded          # judge vs Brian's grades -> results/calibration.md
 *   pnpm eval-clues                   # whole bank -> results/latest.json + results/report.md
 *   pnpm eval-clues --ids tea,boxing  # just these questions (merged into latest.json)
 *   pnpm eval-clues --dry-run         # print the prompts; no API calls, no key needed
 *
 * Flags:
 *   --limit N            only the first N bank questions
 *   --concurrency N      questions in flight at once (default 6)
 *   --no-player          skip the simulated player
 *   --force              re-score even when a stored result matches
 *   --judge-model ID     default claude-opus-5-5
 *   --player-model ID    default claude-haiku-4-5 (see below)
 *   --effort LEVEL       judge effort, default high
 *
 * A stored result is reused when the prompts, model and question text it came
 * from are unchanged, so a re-run only pays for questions that were edited,
 * and results/latest.json works as a shared cache across machines.
 *
 * The player is a smaller model on purpose. It is meant to stand in for a
 * typical player, and a model that knows less trivia is closer to one. Even so
 * it knows more than most people, so read its solve points as "at the latest".
 *
 * There is no fallback model on refusal: a different judge would make scores
 * incomparable, so a refused or cut-off answer fails that question instead.
 *
 * Only the public bank is scored (seed + extraBank). The results are
 * committed, and the private bank must not leak into the repo.
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { matchGuess } from "../lib/game/answerMatch";
import type { Question } from "../lib/game/types";
import { EXTRA_QUESTIONS } from "../lib/questions/extraBank";
import { SEED_QUESTIONS } from "../lib/questions/seed";
import { dedupeByCanonical } from "../lib/questions/select";
import { GRADED_CASES } from "../lib/questions/clueEval/graded";
import {
  JUDGE_SCHEMA,
  PLAYER_SCHEMA,
  PLAYER_SYSTEM,
  RUBRIC_VERSION,
  judgeSystemPrompt,
  judgeUserMessage,
  playerUserMessage,
  readHouseRules,
} from "../lib/questions/clueEval/rubric";
import {
  applyCase,
  caseKey,
  flagsFor,
  renderBankReport,
  renderCalibrationReport,
  runCheck,
  type EvalEntry,
  type Judgement,
  type PlayerRun,
} from "../lib/questions/clueEval/score";

// ---------------------------------------------------------------------------
// Arguments

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
function option(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

const GRADED = flag("graded");
const DRY_RUN = flag("dry-run");
const FORCE = flag("force");
const WITH_PLAYER = !flag("no-player");
const IDS = option("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = option("limit") ? Number(option("limit")) : undefined;
const CONCURRENCY = Number(option("concurrency") ?? 6);
const JUDGE_MODEL = option("judge-model") ?? "claude-opus-5-5";
const PLAYER_MODEL = option("player-model") ?? "claude-haiku-4-5";
const EFFORT = (option("effort") ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";

/** A hard ceiling per question, independent of the SDK's per-request timeout. */
const QUESTION_TIMEOUT_MS = 10 * 60_000;

const RESULTS_DIR = path.join(process.cwd(), "lib", "questions", "clueEval", "results");
const ERRORS_FILE = path.join(process.cwd(), "pipeline", "data", "clue-eval-errors.jsonl");

// ---------------------------------------------------------------------------
// What to score

const bank = dedupeByCanonical([...SEED_QUESTIONS, ...EXTRA_QUESTIONS], (q) => q.answerCanonical);
const byId = new Map(bank.map((q) => [q.id, q]));

function selectQuestions(): Question[] {
  if (GRADED) {
    return GRADED_CASES.map((c) => {
      const q = byId.get(c.id);
      if (!q) throw new Error(`graded case ${caseKey(c)}: no bank question with id "${c.id}"`);
      return applyCase(q, c);
    });
  }
  if (IDS) {
    const missing = IDS.filter((id) => !byId.has(id));
    if (missing.length) throw new Error(`no bank question with id: ${missing.join(", ")}`);
    return IDS.map((id) => byId.get(id)!);
  }
  return LIMIT ? bank.slice(0, LIMIT) : bank;
}

// ---------------------------------------------------------------------------
// Result store: one JSON file, one question per line so diffs stay readable.

interface Store {
  meta: { rubricVersion: number; judgeModel: string; playerModel: string; updated: string };
  questions: Record<string, EvalEntry>;
}

const storeFile = path.join(RESULTS_DIR, GRADED ? "graded.json" : "latest.json");

function loadStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(storeFile, "utf8")) as Store;
  } catch {
    return {
      meta: { rubricVersion: RUBRIC_VERSION, judgeModel: JUDGE_MODEL, playerModel: PLAYER_MODEL, updated: "" },
      questions: {},
    };
  }
}

function saveStore(store: Store, order: string[]): void {
  const ids = [
    ...order.filter((id) => store.questions[id]),
    ...Object.keys(store.questions).filter((id) => !order.includes(id)).sort(),
  ];
  const body = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(store.questions[id])}`).join(",\n");
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(storeFile, `{\n"meta": ${JSON.stringify(store.meta)},\n"questions": {\n${body}\n}\n}\n`);
}

// ---------------------------------------------------------------------------
// Cache keys: a result is reused only if everything it was computed from is unchanged.

const houseRules = readHouseRules();
const judgeSystem = judgeSystemPrompt(houseRules);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

const judgeKey = (q: Question) =>
  hash({ v: RUBRIC_VERSION, model: JUDGE_MODEL, effort: EFFORT, judgeSystem, JUDGE_SCHEMA, user: judgeUserMessage(q) });

const playerKey = (q: Question) =>
  hash({
    v: RUBRIC_VERSION,
    model: PLAYER_MODEL,
    PLAYER_SYSTEM,
    PLAYER_SCHEMA,
    user: playerUserMessage(q, q.clues.length),
    // The guess is checked with the game's matcher, which reads these.
    answer: q.answerCanonical,
    aliases: q.answerAliases,
    decoys: q.decoys.map((d) => d.text),
  });

// ---------------------------------------------------------------------------
// API calls

const client = DRY_RUN ? null : new Anthropic({ maxRetries: 4, timeout: 180_000 });

type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number; calls: number };
const usage = new Map<string, Usage>();

function record(res: Anthropic.Message): void {
  const u = usage.get(res.model) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 };
  u.input += res.usage.input_tokens;
  u.output += res.usage.output_tokens;
  u.cacheRead += res.usage.cache_read_input_tokens ?? 0;
  u.cacheWrite += res.usage.cache_creation_input_tokens ?? 0;
  u.calls += 1;
  usage.set(res.model, u);
}

/** Pull the structured JSON out of a response, failing loudly on anything unusual. */
function parseJson<T>(res: Anthropic.Message, requested: string): T {
  record(res);
  if (!res.model.startsWith(requested)) {
    throw new Error(`asked for ${requested} but ${res.model} answered`);
  }
  if (res.stop_reason === "refusal") throw new Error(`refused (${res.stop_details?.category ?? "no category"})`);
  if (res.stop_reason === "max_tokens") throw new Error("hit max_tokens; output cut off");
  const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new Error(`no text block (stop_reason ${res.stop_reason})`);
  return JSON.parse(text) as T;
}

async function judge(q: Question): Promise<Judgement> {
  const res = await client!.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: judgeSystem, cache_control: { type: "ephemeral" } }],
    output_config: { effort: EFFORT, format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    messages: [{ role: "user", content: judgeUserMessage(q) }],
  });
  const j = parseJson<Judgement>(res, JUDGE_MODEL);
  for (const key of JUDGE_SCHEMA.required) {
    if (!(key in j)) throw new Error(`judge output is missing "${key}"`);
  }
  return j;
}

async function play(q: Question): Promise<PlayerRun> {
  const guesses: string[] = [];
  for (let revealed = 1; revealed <= q.clues.length; revealed++) {
    const res = await client!.messages.create({
      model: PLAYER_MODEL,
      max_tokens: 200,
      // Haiku takes a temperature; newer models reject one. Zero keeps re-runs comparable.
      ...(PLAYER_MODEL.startsWith("claude-haiku") ? { temperature: 0 } : {}),
      system: PLAYER_SYSTEM,
      output_config: { format: { type: "json_schema", schema: PLAYER_SCHEMA } },
      messages: [{ role: "user", content: playerUserMessage(q, revealed) }],
    });
    const { guess } = parseJson<{ guess: string }>(res, PLAYER_MODEL);
    guesses.push(guess);
    if (matchGuess(q, guess).correct) return { solvedOn: revealed, guesses };
  }
  return { solvedOn: null, guesses };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms).unref()),
  ]);
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "authentication failed: check ANTHROPIC_API_KEY";
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Cost, from the measured usage (first-party prices, $ per million tokens)

const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-4-5": { in: 1, out: 5 },
  "claude-fable-5-1": { in: 10, out: 50 },
};

function costLine(): string {
  let total = 0;
  const parts: string[] = [];
  for (const [model, u] of usage) {
    const price = Object.entries(PRICES).find(([id]) => model.startsWith(id))?.[1];
    const tokens = `${u.calls} calls, ${u.input + u.cacheRead + u.cacheWrite} in / ${u.output} out`;
    if (!price) {
      parts.push(`${model}: ${tokens} (no price on file)`);
      continue;
    }
    const cost =
      (u.input * price.in + u.cacheWrite * price.in * 1.25 + u.cacheRead * price.in * 0.1 + u.output * price.out) / 1e6;
    total += cost;
    parts.push(`${model}: ${tokens}, $${cost.toFixed(2)}`);
  }
  return parts.length ? `${parts.join("; ")}. Total $${total.toFixed(2)}.` : "no API calls made.";
}

// ---------------------------------------------------------------------------
// Main

async function main(): Promise<void> {
  const questions = selectQuestions();

  if (DRY_RUN) {
    const q = questions[0];
    console.log("=== judge system prompt ===\n" + judgeSystem);
    console.log(`\n=== judge user message (${q.id}) ===\n` + judgeUserMessage(q));
    console.log("\n=== player system prompt ===\n" + PLAYER_SYSTEM);
    console.log(`\n=== player user message after 2 clues (${q.id}) ===\n` + playerUserMessage(q, 2));
    console.error(`\n${questions.length} questions selected. Dry run: nothing sent.`);
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      "No ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN set. Using an `ant auth login` profile if there is one.",
    );
  }

  const store = loadStore();
  const order = (GRADED ? questions : bank).map((q) => q.id);
  const todo = questions.filter((q) => {
    const prev = store.questions[q.id];
    return FORCE || !prev || prev.judgeKey !== judgeKey(q) || (WITH_PLAYER && prev.playerKey !== playerKey(q));
  });
  console.error(
    `${questions.length} questions selected; ${questions.length - todo.length} already scored with these prompts; scoring ${todo.length}.`,
  );

  const errors: { id: string; error: string }[] = [];
  let done = 0;
  const started = Date.now();

  await pool(todo, CONCURRENCY, async (q) => {
    const prev = store.questions[q.id];
    try {
      const jKey = judgeKey(q);
      const pKey = playerKey(q);
      const reuseJudge = !FORCE && prev?.judgeKey === jKey;
      // A player run from an older wording of the question is dropped, not kept.
      const reusePlayer = !FORCE && prev?.playerKey === pKey;
      const [judgement, player] = await withTimeout(
        Promise.all([
          reuseJudge ? prev.judge : judge(q),
          reusePlayer ? prev.player : WITH_PLAYER ? play(q) : undefined,
        ]),
        QUESTION_TIMEOUT_MS,
      );
      store.questions[q.id] = {
        id: q.id,
        answer: q.answer,
        category: q.category,
        labelled: q.difficulty,
        judgeKey: jKey,
        ...(player ? { playerKey: pKey, player } : {}),
        judge: judgement,
        flags: flagsFor(judgement, player),
      };
      store.meta = {
        rubricVersion: RUBRIC_VERSION,
        judgeModel: JUDGE_MODEL,
        playerModel: PLAYER_MODEL,
        updated: new Date().toISOString().slice(0, 10),
      };
      saveStore(store, order);
      done++;
      const solved = player ? (player.solvedOn ? `player solved on ${player.solvedOn}` : "player never solved") : "";
      console.error(`[${done}/${todo.length}] ${q.id}: ${judgement.verdict} ${solved}`);
    } catch (err) {
      const error = describeError(err);
      errors.push({ id: q.id, error });
      fs.mkdirSync(path.dirname(ERRORS_FILE), { recursive: true });
      fs.appendFileSync(ERRORS_FILE, JSON.stringify({ at: new Date().toISOString(), id: q.id, error }) + "\n");
      console.error(`[error] ${q.id}: ${error}`);
    }
  });

  // A full bank run drops results for questions that left the bank.
  if (!GRADED && !IDS && !LIMIT) {
    for (const id of Object.keys(store.questions)) if (!byId.has(id)) delete store.questions[id];
  }
  // Flags are cheap to recompute, so a change to flagsFor applies without re-scoring.
  for (const e of Object.values(store.questions)) e.flags = flagsFor(e.judge, e.player);
  if (Object.keys(store.questions).length) saveStore(store, order);

  const date = new Date().toISOString().slice(0, 10);
  if (!Object.keys(store.questions).length) {
    console.error("Nothing scored, so no report written.");
  } else if (GRADED) {
    const rows = GRADED_CASES.filter((c) => store.questions[caseKey(c)]).map((c) => {
      const j = store.questions[caseKey(c)].judge;
      return { c, judge: j, results: c.expect.map((check) => runCheck(j, check)) };
    });
    fs.writeFileSync(
      path.join(RESULTS_DIR, "calibration.md"),
      renderCalibrationReport(rows, { judgeModel: JUDGE_MODEL, date }),
    );
    const all = rows.flatMap((r) => r.results);
    console.error(`\nAgreement with Brian's grades: ${all.filter((r) => r.pass).length}/${all.length} checks.`);
    for (const r of rows) {
      for (const res of r.results.filter((x) => !x.pass)) {
        console.error(`  disagrees: ${caseKey(r.c)}: expected ${JSON.stringify(res.check)}, judge said ${res.got}`);
      }
    }
    console.error("Wrote lib/questions/clueEval/results/calibration.md");
  } else {
    const entries = bank.map((q) => store.questions[q.id]).filter((e): e is EvalEntry => Boolean(e));
    fs.writeFileSync(
      path.join(RESULTS_DIR, "report.md"),
      renderBankReport(entries, { judgeModel: JUDGE_MODEL, playerModel: PLAYER_MODEL, date }) +
        (entries.length < bank.length ? `\n_${entries.length} of ${bank.length} bank questions scored so far._\n` : ""),
    );
    console.error(`\nWrote lib/questions/clueEval/results/report.md (${entries.length} of ${bank.length} questions).`);
  }

  console.error(`Took ${((Date.now() - started) / 1000).toFixed(0)}s. Cost: ${costLine()}`);
  if (errors.length) {
    console.error(`${errors.length} question(s) failed; see pipeline/data/clue-eval-errors.jsonl. Re-run to retry them.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(describeError(err));
  process.exit(1);
});
