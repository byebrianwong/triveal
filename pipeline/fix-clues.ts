/**
 * Rewrite weak clues using the clue eval's judgements. It runs inside a
 * Claude Code session, like `eval-clues --export / --ingest`:
 *
 *   pnpm pipeline pipeline/fix-clues.ts --export pipeline/data/fix-tasks --ids tea,boxing [--notes notes.json] [--batch 10]
 *     ... one fresh subagent per fixer-NNN.txt; it researches with web search
 *         and writes fixer-NNN.answer.json next to it ...
 *   pnpm pipeline pipeline/fix-clues.ts --apply pipeline/data/fix-tasks
 *
 * --export needs a current judgement for each question in
 * lib/questions/clueEval/results/latest.json, so run the judge first.
 * --notes is an optional JSON object of notes from Brian, keyed by question
 * id; the rewriter treats them as outranking the judge.
 *
 * --apply checks every rewrite (four clues, the leak rule, a source for every
 * changed clue, nothing edited since export), writes the good ones into
 * lib/questions/extraBank.ts, and lists what changed in changes.json and what
 * it refused in rejected.json. Re-judge the edited questions afterwards
 * (`pnpm eval-clues --ids ...`) to confirm they improved, then run the tests.
 */

import fs from "node:fs";
import path from "node:path";
import type { Question } from "../lib/game/types";
import { EXTRA_QUESTIONS } from "../lib/questions/extraBank";
import { changedPositions, replaceCluesInSource, rewriteProblems, type Rewrite } from "../lib/questions/clueEval/fixes";
import { fixerTaskPrompt, readHouseRules, type FixItem } from "../lib/questions/clueEval/rubric";
import type { EvalEntry } from "../lib/questions/clueEval/score";

const argv = process.argv.slice(2);
function option(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
}

const BANK_FILE = path.join(process.cwd(), "lib", "questions", "extraBank.ts");
const RESULTS_FILE = path.join(process.cwd(), "lib", "questions", "clueEval", "results", "latest.json");
const byId = new Map(EXTRA_QUESTIONS.map((q) => [q.id, q]));

interface FixTasks {
  howTo: string;
  batches: { ids: string[]; prompt: string; answer: string }[];
  /** Each question's clue texts at export, to refuse rewrites of a question edited since. */
  original: Record<string, string[]>;
}

interface Change {
  id: string;
  answer: string;
  category: string;
  before: string[];
  after: string[];
  changed: number[];
  sources: Record<string, string>;
  summary: string;
}

const clueTexts = (q: Question) => [...q.clues].sort((a, b) => a.position - b.position).map((c) => c.text);

function exportTasks(dir: string): void {
  const ids = option("ids")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids?.length) throw new Error("--export needs --ids");
  const notes = option("notes") ? (JSON.parse(fs.readFileSync(option("notes")!, "utf8")) as Record<string, string>) : {};
  const batchSize = Number(option("batch") ?? 10);
  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8")) as { questions: Record<string, EvalEntry> };

  const items: FixItem[] = ids.map((id) => {
    const q = byId.get(id);
    if (!q) throw new Error(`no question "${id}" in extraBank.ts`);
    const e = results.questions[id];
    if (!e) throw new Error(`no judgement for "${id}"; run pnpm eval-clues --ids ${id} first`);
    const j = e.judge;
    return {
      q,
      judge: {
        summary: j.summary,
        verdict: j.verdict,
        clues: [j.clue1, j.clue2, j.clue3, j.clue4].map((c) => ({ note: c.note, fix: c.fix ?? "" })),
      },
      ownerNotes: notes[id],
    };
  });

  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const houseRules = readHouseRules();
  const batches: FixTasks["batches"] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const n = String(batches.length + 1).padStart(3, "0");
    fs.writeFileSync(path.join(dir, `fixer-${n}.txt`), fixerTaskPrompt(chunk, houseRules));
    batches.push({ ids: chunk.map((it) => it.q.id), prompt: `fixer-${n}.txt`, answer: `fixer-${n}.answer.json` });
  }
  const tasks: FixTasks = {
    howTo:
      "Give each fixer-NNN.txt to a fresh subagent that can search the web. It writes fixer-NNN.answer.json. Then run --apply on this folder.",
    batches,
    original: Object.fromEntries(items.map(({ q }) => [q.id, clueTexts(q)])),
  };
  fs.writeFileSync(path.join(dir, "tasks.json"), JSON.stringify(tasks, null, 1));
  console.error(`Wrote ${dir}: ${batches.length} rewrite prompts for ${items.length} questions.`);
}

function readAnswer(file: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, "utf8");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error(`${path.basename(file)} holds no JSON object`);
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function applyRewrites(dir: string): void {
  const tasks = JSON.parse(fs.readFileSync(path.join(dir, "tasks.json"), "utf8")) as FixTasks;
  let source = fs.readFileSync(BANK_FILE, "utf8");
  const changes: Change[] = [];
  const rejected: { id: string; problems: string[] }[] = [];
  let unchanged = 0;

  for (const batch of tasks.batches) {
    const answer = readAnswer(path.join(dir, batch.answer));
    for (const id of batch.ids) {
      const q = byId.get(id)!;
      const reject = (problems: string[]) => {
        rejected.push({ id, problems });
        console.error(`[refused] ${id}: ${problems.join("; ")}`);
      };
      if (!answer) {
        reject([`no answer file ${batch.answer}`]);
        continue;
      }
      if (JSON.stringify(clueTexts(q)) !== JSON.stringify(tasks.original[id])) {
        reject(["the question was edited after export; export again"]);
        continue;
      }
      const rewrite = answer[id] as Rewrite | undefined;
      const problems = rewrite === undefined ? ["no rewrite in the answer file"] : rewriteProblems(q, rewrite);
      if (problems.length) {
        reject(problems);
        continue;
      }
      const after = rewrite!.clues.map((c) => c.trim());
      if (JSON.stringify(after) === JSON.stringify(clueTexts(q))) {
        unchanged++;
        continue;
      }
      source = replaceCluesInSource(source, id, after);
      changes.push({
        id,
        answer: q.answer,
        category: q.category,
        before: clueTexts(q),
        after,
        changed: changedPositions(q, after),
        sources: rewrite!.sources,
        summary: rewrite!.summary,
      });
    }
  }

  fs.writeFileSync(BANK_FILE, source);
  fs.writeFileSync(path.join(dir, "changes.json"), JSON.stringify(changes, null, 1));
  fs.writeFileSync(path.join(dir, "rejected.json"), JSON.stringify(rejected, null, 1));
  console.error(
    `Applied ${changes.length} rewrites to lib/questions/extraBank.ts; ${unchanged} came back unchanged; refused ${rejected.length}.`,
  );
  if (changes.length) console.error(`Re-judge them: pnpm eval-clues --ids ${changes.map((c) => c.id).join(",")}`);
  if (rejected.length) process.exitCode = 1;
}

const exportDir = option("export");
const applyDir = option("apply");
if (exportDir) exportTasks(exportDir);
else if (applyDir) applyRewrites(applyDir);
else {
  console.error("Use --export <folder> --ids a,b or --apply <folder>.");
  process.exitCode = 1;
}
