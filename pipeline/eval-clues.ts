/**
 * Clue-quality eval. Scores every clue in the public bank against the rules
 * in lib/questions/README.md ("What makes a good question"), and checks the
 * judge against Brian's own grades. How it works and how to read the results:
 * lib/questions/clueEval/README.md.
 *
 * It runs one of two ways. Both write the same result files.
 *
 * Through the API (needs ANTHROPIC_API_KEY):
 *   pnpm eval-clues --graded          # judge vs Brian's grades -> results/calibration.md
 *   pnpm eval-clues                   # whole bank -> results/latest.json + results/report.md
 *   pnpm eval-clues --ids tea,boxing  # just these questions (merged into latest.json)
 *   pnpm eval-clues --dry-run         # print the prompts; no API calls, no key needed
 *
 * Inside a Claude Code session (no key; subagents do the judging and playing):
 *   pnpm eval-clues --graded --export pipeline/data/clue-tasks
 *     ... one fresh subagent per prompt file; each writes its answer file ...
 *   pnpm eval-clues --graded --ingest pipeline/data/clue-tasks
 *   The steps are spelled out in lib/questions/clueEval/README.md.
 *
 * Flags:
 *   --limit N            only the first N bank questions
 *   --concurrency N      API calls: questions in flight at once (default 6)
 *   --no-player          skip the simulated player
 *   --force              re-score even when a stored result matches
 *   --judge-model ID     API judge, default claude-opus-5-5
 *   --player-model ID    API player, default claude-haiku-4-5 (see below)
 *   --effort LEVEL       API judge effort, default high
 *   --judge-batch N      export: questions per judge subagent (default 1)
 *   --player-batch N     export: questions per player subagent (default 25)
 *
 * A stored result is reused when the prompts, model and question text it came
 * from are unchanged, so a re-run only pays for questions that were edited,
 * and results/latest.json works as a shared cache across machines. Session
 * results carry their own model label, so an API run re-scores them.
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
  judgeTaskPrompt,
  judgeUserMessage,
  playerTaskPrompt,
  playerUserMessage,
  readHouseRules,
} from "../lib/questions/clueEval/rubric";
import {
  applyCase,
  batchApart,
  caseKey,
  flagsFor,
  playerRunFromGuesses,
  renderBankReport,
  renderCalibrationReport,
  runCheck,
  validateJudgement,
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
const EXPORT = option("export");
const INGEST = option("ingest");
const JUDGE_BATCH = Number(option("judge-batch") ?? 1);
const PLAYER_BATCH = Number(option("player-batch") ?? 25);
const IN_SESSION = Boolean(EXPORT || INGEST);

// Session runs are labelled by the subagent model alias, since that is all
// the session can choose; API runs by the exact model id.
const JUDGE_MODEL = IN_SESSION ? "claude-code-subagent:opus" : (option("judge-model") ?? "claude-opus-5-5");
const PLAYER_MODEL = IN_SESSION ? "claude-code-subagent:haiku" : (option("player-model") ?? "claude-haiku-4-5");
const EFFORT = (option("effort") ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT_LABEL = IN_SESSION ? "session" : EFFORT;

/** A hard ceiling per question, independent of the SDK's per-request timeout. */
const QUESTION_TIMEOUT_MS = 10 * 60_000;

const RESULTS_DIR = path.join(process.cwd(), "lib", "questions", "clueEval", "results");
const ERRORS_FILE = path.join(process.cwd(), "pipeline", "data", "clue-eval-errors.jsonl");
const today = () => new Date().toISOString().slice(0, 10);

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
  meta: { rubricVersion: number; updated: string };
  questions: Record<string, EvalEntry>;
}

const storeFile = path.join(RESULTS_DIR, GRADED ? "graded.json" : "latest.json");

function loadStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(storeFile, "utf8")) as Store;
  } catch {
    return { meta: { rubricVersion: RUBRIC_VERSION, updated: "" }, questions: {} };
  }
}

function saveStore(store: Store, order: string[]): void {
  store.meta = { rubricVersion: RUBRIC_VERSION, updated: today() };
  const ids = [
    ...order.filter((id) => store.questions[id]),
    ...Object.keys(store.questions).filter((id) => !order.includes(id)).sort(),
  ];
  const body = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(store.questions[id])}`).join(",\n");
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(storeFile, `{\n"meta": ${JSON.stringify(store.meta)},\n"questions": {\n${body}\n}\n}\n`);
}

function entryFor(q: Question, judgement: Judgement, player: PlayerRun | undefined): EvalEntry {
  return {
    id: q.id,
    answer: q.answer,
    category: q.category,
    labelled: q.difficulty,
    judgeKey: judgeKey(q),
    judgeModel: JUDGE_MODEL,
    ...(player ? { playerKey: playerKey(q), playerModel: PLAYER_MODEL, player } : {}),
    judge: judgement,
    flags: flagsFor(judgement, player),
  };
}

// ---------------------------------------------------------------------------
// Cache keys: a result is reused only if everything it was computed from is unchanged.

const houseRules = readHouseRules();
const judgeSystem = judgeSystemPrompt(houseRules);

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

const judgeKey = (q: Question) =>
  hash({
    v: RUBRIC_VERSION,
    model: JUDGE_MODEL,
    effort: EFFORT_LABEL,
    judgeSystem,
    JUDGE_SCHEMA,
    user: judgeUserMessage(q),
  });

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

/** Questions whose stored result is missing or out of date. */
function needsScoring(store: Store, questions: Question[]): Question[] {
  return questions.filter((q) => {
    const prev = store.questions[q.id];
    return FORCE || !prev || prev.judgeKey !== judgeKey(q) || (WITH_PLAYER && prev.playerKey !== playerKey(q));
  });
}

type Failure = { id: string; error: string };

function logFailure(failures: Failure[], id: string, error: string): void {
  failures.push({ id, error });
  fs.mkdirSync(path.dirname(ERRORS_FILE), { recursive: true });
  fs.appendFileSync(ERRORS_FILE, JSON.stringify({ at: new Date().toISOString(), id, error }) + "\n");
  console.error(`[error] ${id}: ${error}`);
}

// ---------------------------------------------------------------------------
// API route

let client: Anthropic | null = null;

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
  const problems = validateJudgement(j);
  if (problems.length) throw new Error(`judge output: ${problems.join("; ")}`);
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
    guesses.push(parseJson<{ guess: string }>(res, PLAYER_MODEL).guess);
    const run = playerRunFromGuesses(q, guesses);
    if (run.solvedOn) return run;
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

async function scoreWithApi(store: Store, todo: Question[], order: string[]): Promise<Failure[]> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      "No ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN set. Using an `ant auth login` profile if there is one.\n" +
        "Inside a Claude Code session, --export and --ingest run the eval without a key.",
    );
  }
  client = new Anthropic({ maxRetries: 4, timeout: 180_000 });
  const failures: Failure[] = [];
  let done = 0;
  await pool(todo, CONCURRENCY, async (q) => {
    const prev = store.questions[q.id];
    try {
      const reuseJudge = !FORCE && prev?.judgeKey === judgeKey(q);
      // A player run from an older wording of the question is dropped, not kept.
      const reusePlayer = !FORCE && prev?.playerKey === playerKey(q);
      const [judgement, player] = await withTimeout(
        Promise.all([
          reuseJudge ? prev.judge : judge(q),
          reusePlayer ? prev.player : WITH_PLAYER ? play(q) : undefined,
        ]),
        QUESTION_TIMEOUT_MS,
      );
      store.questions[q.id] = entryFor(q, judgement, player);
      saveStore(store, order);
      done++;
      const solved = player ? (player.solvedOn ? `player solved on ${player.solvedOn}` : "player never solved") : "";
      console.error(`[${done}/${todo.length}] ${q.id}: ${judgement.verdict} ${solved}`);
    } catch (err) {
      logFailure(failures, q.id, describeError(err));
    }
  });
  return failures;
}

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
// Session route: --export writes one prompt file per subagent into a folder;
// each subagent reads its file and writes its answer next to it; --ingest
// reads the answers back.

interface TaskFile {
  howTo: string;
  graded: boolean;
  judgeModel: string;
  playerModel: string;
  /** The keys each question had at export, so ingest can refuse answers to an older wording. */
  keys: Record<string, { judgeKey: string; playerKey: string }>;
  /** One fresh subagent (model opus) per prompt. It answers with JSON keyed by question id. */
  judgeTasks: { ids: string[]; prompt: string; answer: string }[];
  /**
   * One fresh subagent (model haiku) per round. It answers with JSON keyed by
   * the opaque ids (q1, q2, ...); `ids` maps them back to questions.
   */
  playerTasks: { ids: Record<string, string>; rounds: { prompt: string; answer: string }[] }[];
}

const pad = (n: number, width = 3) => String(n).padStart(width, "0");

function exportTasks(todo: Question[], dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const write = (name: string, text: string) => fs.writeFileSync(path.join(dir, name), text);
  const rounds = Math.max(...todo.map((q) => q.clues.length));

  const judgeTasks = batchApart(todo, JUDGE_BATCH).map((qs, i) => {
    const prompt = `judge-${pad(i + 1)}.txt`;
    write(prompt, judgeTaskPrompt(qs, houseRules));
    return { ids: qs.map((q) => q.id), prompt, answer: `judge-${pad(i + 1)}.answer.json` };
  });
  const playerTasks = !WITH_PLAYER
    ? []
    : batchApart(todo, PLAYER_BATCH).map((qs, t) => {
        const items = qs.map((q, i) => ({ opaqueId: `q${i + 1}`, q }));
        return {
          ids: Object.fromEntries(items.map(({ opaqueId, q }) => [opaqueId, q.id])),
          rounds: Array.from({ length: rounds }, (_, r) => {
            const prompt = `player-${pad(t + 1, 2)}-round-${r + 1}.txt`;
            write(prompt, playerTaskPrompt(items, r + 1));
            return { prompt, answer: `player-${pad(t + 1, 2)}-round-${r + 1}.answer.json` };
          }),
        };
      });

  const tasks: TaskFile = {
    howTo:
      "Follow lib/questions/clueEval/README.md, 'Running it inside a Claude Code session'. Never give this file to a subagent: it maps the player's opaque ids to answers.",
    graded: GRADED,
    judgeModel: JUDGE_MODEL,
    playerModel: PLAYER_MODEL,
    keys: Object.fromEntries(todo.map((q) => [q.id, { judgeKey: judgeKey(q), playerKey: playerKey(q) }])),
    judgeTasks,
    playerTasks,
  };
  write("tasks.json", JSON.stringify(tasks, null, 1));
  const playerPrompts = playerTasks.reduce((n, t) => n + t.rounds.length, 0);
  console.error(
    `Wrote ${dir}: ${judgeTasks.length} judge prompts and ${playerPrompts} player prompts for ${todo.length} questions.`,
  );
}

/** Read a subagent's JSON answer, tolerating a code fence or text around the object. */
function readAnswer(file: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error(`${path.basename(file)} holds no JSON object`);
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function ingestAnswers(store: Store, questions: Question[], dir: string, order: string[]): Failure[] {
  const tasks = JSON.parse(fs.readFileSync(path.join(dir, "tasks.json"), "utf8")) as TaskFile;
  if (tasks.graded !== GRADED) {
    throw new Error(`the tasks were exported ${tasks.graded ? "with" : "without"} --graded; ingest the same way`);
  }
  const selected = new Map(questions.map((q) => [q.id, q]));
  const failures: Failure[] = [];

  const judgements = new Map<string, unknown>();
  for (const task of tasks.judgeTasks) {
    const answer = readAnswer(path.join(dir, task.answer));
    if (!answer) {
      for (const id of task.ids) logFailure(failures, id, `no answer file ${task.answer}`);
      continue;
    }
    // A one-question task may come back as the bare judgement, not keyed by id.
    const keyed = task.ids.length === 1 && "clue1" in answer ? { [task.ids[0]]: answer } : answer;
    for (const id of task.ids) judgements.set(id, keyed[id]);
  }

  const guesses = new Map<string, string[]>();
  for (const task of tasks.playerTasks) {
    const rounds = task.rounds.map((r) => readAnswer(path.join(dir, r.answer)));
    for (const [opaque, id] of Object.entries(task.ids)) {
      const list = rounds.map((r) => r?.[opaque]);
      if (list.every((g): g is string => typeof g === "string")) guesses.set(id, list);
    }
  }

  let done = 0;
  for (const [id, keys] of Object.entries(tasks.keys)) {
    const q = selected.get(id);
    if (!q) {
      logFailure(failures, id, "not in the current selection; pass the same flags you exported with");
      continue;
    }
    if (keys.judgeKey !== judgeKey(q)) {
      logFailure(failures, id, "the question or the prompts changed after export; export again");
      continue;
    }
    if (!judgements.has(id)) continue; // already logged as a missing answer file
    const raw = judgements.get(id);
    const problems = raw === undefined ? ["no judgement for this id"] : validateJudgement(raw);
    if (problems.length) {
      logFailure(failures, id, `judge output: ${problems.join("; ")}`);
      continue;
    }
    const g = guesses.get(id);
    if (tasks.playerTasks.length && !g) logFailure(failures, id, "player guesses missing for some round; judged only");
    store.questions[id] = entryFor(q, raw as Judgement, g ? playerRunFromGuesses(q, g) : undefined);
    done++;
  }
  saveStore(store, order);
  console.error(`Ingested ${done} of ${Object.keys(tasks.keys).length} questions.`);
  return failures;
}

// ---------------------------------------------------------------------------
// Main

function writeReports(store: Store): void {
  const date = today();
  const models = (values: (string | undefined)[]) => [...new Set(values.filter(Boolean))].join(", ") || "none";
  if (GRADED) {
    const rows = GRADED_CASES.filter((c) => store.questions[caseKey(c)]).map((c) => {
      const j = store.questions[caseKey(c)].judge;
      return { c, judge: j, results: c.expect.map((check) => runCheck(j, check)) };
    });
    const judgeModel = models(GRADED_CASES.map((c) => store.questions[caseKey(c)]?.judgeModel));
    fs.writeFileSync(path.join(RESULTS_DIR, "calibration.md"), renderCalibrationReport(rows, { judgeModel, date }));
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
    const meta = {
      judgeModel: models(entries.map((e) => e.judgeModel)),
      playerModel: models(entries.map((e) => e.playerModel)),
      date,
    };
    fs.writeFileSync(
      path.join(RESULTS_DIR, "report.md"),
      renderBankReport(entries, meta) +
        (entries.length < bank.length ? `\n_${entries.length} of ${bank.length} bank questions scored so far._\n` : ""),
    );
    console.error(`\nWrote lib/questions/clueEval/results/report.md (${entries.length} of ${bank.length} questions).`);
  }
}

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

  const store = loadStore();
  const order = (GRADED ? questions : bank).map((q) => q.id);
  const todo = needsScoring(store, questions);
  console.error(
    `${questions.length} questions selected; ${questions.length - todo.length} already scored with these prompts; ${todo.length} to score.`,
  );

  if (EXPORT) {
    if (todo.length) exportTasks(todo, EXPORT);
    return;
  }

  const started = Date.now();
  const failures = INGEST ? ingestAnswers(store, questions, INGEST, order) : await scoreWithApi(store, todo, order);

  // A full bank run drops results for questions that left the bank.
  if (!GRADED && !IDS && !LIMIT) {
    for (const id of Object.keys(store.questions)) if (!byId.has(id)) delete store.questions[id];
  }
  // Flags are cheap to recompute, so a change to flagsFor applies without re-scoring.
  for (const e of Object.values(store.questions)) e.flags = flagsFor(e.judge, e.player);

  if (Object.keys(store.questions).length) {
    saveStore(store, order);
    writeReports(store);
  } else {
    console.error("Nothing scored, so no report written.");
  }

  if (!INGEST) console.error(`Took ${((Date.now() - started) / 1000).toFixed(0)}s. Cost: ${costLine()}`);
  if (failures.length) {
    console.error(`${failures.length} problem(s); see pipeline/data/clue-eval-errors.jsonl.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(describeError(err));
  process.exit(1);
});
