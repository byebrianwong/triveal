/**
 * Fact-check the bank's clues against sources. It runs inside a Claude Code
 * session, like `eval-clues --export / --ingest`:
 *
 *   pnpm pipeline pipeline/fact-check.ts --export pipeline/data/fact-tasks [--ids a,b] [--batch 12]
 *     ... one fresh subagent per checker-NNN.txt; it opens sources with web
 *         search and writes checker-NNN.answer.json next to it ...
 *   pnpm pipeline pipeline/fact-check.ts --ingest pipeline/data/fact-tasks
 *   pnpm pipeline pipeline/fact-check.ts --report
 *
 * --export picks every public question with a clue that has no ok check in
 * lib/questions/clueEval/results/factcheck.json (or just --ids), and asks
 * only about those clues. A clue counts as checked only for its exact text,
 * so any rewrite gets checked again.
 *
 * --ingest validates the answers, refuses a question edited since export,
 * appends the checks to factcheck.json and rewrites factcheck.md, which lists
 * every clue still in the bank whose check found a problem. It never edits
 * the bank: read each problem and its fix, then edit the clue by hand. A clue
 * whose new text is the checker's own fix counts as checked.
 */

import fs from "node:fs";
import path from "node:path";
import type { Question } from "../lib/game/types";
import { EXTRA_QUESTIONS } from "../lib/questions/extraBank";
import { SEED_QUESTIONS } from "../lib/questions/seed";
import { dedupeByCanonical } from "../lib/questions/select";
import {
  factCheckAnswerProblems,
  factCheckReport,
  factCheckTaskPrompt,
  uncheckedPositions,
  type CheckItem,
  type ClueCheck,
  type FactCheckFile,
} from "../lib/questions/clueEval/factCheck";

const argv = process.argv.slice(2);
function option(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

const RESULTS_DIR = path.join(process.cwd(), "lib", "questions", "clueEval", "results");
const CHECK_FILE = path.join(RESULTS_DIR, "factcheck.json");
const REPORT_FILE = path.join(RESULTS_DIR, "factcheck.md");
const CHECKER = "claude-code-subagent";

const bank = dedupeByCanonical([...SEED_QUESTIONS, ...EXTRA_QUESTIONS], (q) => q.answerCanonical);
const byId = new Map(bank.map((q) => [q.id, q]));
const clueTexts = (q: Question) => [...q.clues].sort((a, b) => a.position - b.position).map((c) => c.text);
const today = () => new Date().toISOString().slice(0, 10);

function readChecks(): FactCheckFile {
  if (!fs.existsSync(CHECK_FILE)) {
    return {
      meta: { about: "Fact checks of the bank's clues against sources, by pipeline/fact-check.ts. See lib/questions/clueEval/factCheck.ts." },
      questions: {},
    };
  }
  return JSON.parse(fs.readFileSync(CHECK_FILE, "utf8")) as FactCheckFile;
}

function writeChecks(file: FactCheckFile): void {
  const sorted = Object.fromEntries(Object.entries(file.questions).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CHECK_FILE, JSON.stringify({ ...file, questions: sorted }, null, 1) + "\n");
  fs.writeFileSync(REPORT_FILE, factCheckReport(bank, file, today()));
}

/**
 * URLs the writers cited, keyed by clue text, from the rewrite and
 * new-question files in results/. Checkers open these first.
 */
function citedSources(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (text: unknown, urls: unknown) => {
    if (typeof text !== "string") return;
    const list = (Array.isArray(urls) ? urls : [urls]).filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u));
    if (list.length) out[text] = [...new Set([...(out[text] ?? []), ...list])];
  };
  for (const name of fs.readdirSync(RESULTS_DIR)) {
    if (!/^(rewrites|new-questions)-.*\.json$/.test(name)) continue;
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, name), "utf8")) as unknown;
    if (Array.isArray(data)) {
      for (const change of data as { after?: string[]; sources?: Record<string, unknown> }[]) {
        for (const [pos, urls] of Object.entries(change.sources ?? {})) add(change.after?.[Number(pos) - 1], urls);
      }
    } else if (data && typeof data === "object") {
      for (const q of Object.values(data as Record<string, { clues?: { text?: string; sources?: unknown }[] }>)) {
        for (const c of q.clues ?? []) add(c.text, c.sources);
      }
    }
  }
  return out;
}

interface CheckTasks {
  howTo: string;
  batches: { ids: string[]; prompt: string; answer: string }[];
  /** Each question's clue texts and the positions asked about, at export. */
  original: Record<string, { clues: string[]; positions: number[] }>;
}

function exportTasks(dir: string): void {
  const file = readChecks();
  const ids = option("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
  const batchSize = Number(option("batch") ?? 12);
  const pool = ids ? ids.map((id) => byId.get(id) ?? fail(`no question "${id}" in the public bank`)) : bank;
  const sources = citedSources();
  const items: CheckItem[] = pool
    .map((q) => ({ q, positions: uncheckedPositions(q, file.questions[q.id]), sources }))
    .filter((it) => it.positions.length);

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const batches: CheckTasks["batches"] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const n = String(batches.length + 1).padStart(3, "0");
    fs.writeFileSync(path.join(dir, `checker-${n}.txt`), factCheckTaskPrompt(chunk));
    batches.push({ ids: chunk.map((it) => it.q.id), prompt: `checker-${n}.txt`, answer: `checker-${n}.answer.json` });
  }
  const tasks: CheckTasks = {
    howTo: "Give each checker-NNN.txt to a fresh subagent that can search the web. It writes checker-NNN.answer.json. Then run --ingest on this folder.",
    batches,
    original: Object.fromEntries(items.map(({ q, positions }) => [q.id, { clues: clueTexts(q), positions }])),
  };
  fs.writeFileSync(path.join(dir, "tasks.json"), JSON.stringify(tasks, null, 1));
  const clues = items.reduce((n, it) => n + it.positions.length, 0);
  console.error(`Wrote ${dir}: ${batches.length} checker prompts for ${clues} clues in ${items.length} questions.`);
}

function readAnswer(file: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error(`${path.basename(file)} holds no JSON object`);
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function ingest(dir: string): void {
  const tasks = JSON.parse(fs.readFileSync(path.join(dir, "tasks.json"), "utf8")) as CheckTasks;
  const file = readChecks();
  const refused: { id: string; problems: string[] }[] = [];
  const counts: Record<string, number> = {};
  for (const batch of tasks.batches) {
    const answer = readAnswer(path.join(dir, batch.answer));
    for (const id of batch.ids) {
      const q = byId.get(id);
      const { clues, positions } = tasks.original[id];
      const refuse = (problems: string[]) => {
        refused.push({ id, problems });
        console.error(`[refused] ${id}: ${problems.join("; ")}`);
      };
      if (!answer) {
        refuse([`no answer file ${batch.answer}`]);
        continue;
      }
      if (!q || JSON.stringify(clueTexts(q)) !== JSON.stringify(clues)) {
        refuse(["the question was edited after export; export again"]);
        continue;
      }
      const problems = factCheckAnswerProblems(q, positions, answer[id]);
      if (problems.length) {
        refuse(problems);
        continue;
      }
      const entry = (file.questions[id] ??= { id, answer: q.answer, checks: [] });
      for (const c of (answer[id] as { clues: ClueCheck[] }).clues) {
        const text = clues[c.position - 1];
        // Ingesting the same folder twice must not record a check twice.
        if (entry.checks.some((k) => k.text === text && k.verdict === c.verdict && k.evidence === c.evidence.trim())) continue;
        counts[c.verdict] = (counts[c.verdict] ?? 0) + 1;
        entry.checks.push({
          position: c.position,
          text,
          verdict: c.verdict,
          evidence: c.evidence.trim(),
          ...(c.problem ? { problem: c.problem.trim() } : {}),
          ...(c.fix ? { fix: c.fix.trim() } : {}),
          checkedOn: today(),
          checker: CHECKER,
        });
      }
    }
  }
  writeChecks(file);
  console.error(`Recorded ${Object.entries(counts).map(([v, n]) => `${n} ${v}`).join(", ") || "nothing"}; refused ${refused.length} questions.`);
  console.error(`Open problems are in ${path.relative(process.cwd(), REPORT_FILE)}.`);
  if (refused.length) process.exitCode = 1;
}

function fail(message: string): never {
  throw new Error(message);
}

const exportDir = option("export");
const ingestDir = option("ingest");
if (exportDir) exportTasks(exportDir);
else if (ingestDir) ingest(ingestDir);
else if (argv.includes("--report")) writeChecks(readChecks());
else {
  console.error("Use --export <folder> [--ids a,b], --ingest <folder> or --report.");
  process.exitCode = 1;
}
