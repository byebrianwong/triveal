# Clue-quality eval

This scores every clue in the public question bank against the rules in
[`../README.md`](../README.md), under "What makes a good question". It also
checks its own judgement against Brian's grades, so you can tell whether to
trust the scores.

Use it to find the questions that most need work, and to check a rewrite
before you ship it.

## Run it

There are two ways to run it. Both write the same result files.

- **Inside a Claude Code session**, with no API key. Subagents do the judging
  and playing, and the session's Claude plan pays. See the next section.
- **Through the API**, which needs a key: `export ANTHROPIC_API_KEY=…`, or
  log in once with the `ant` CLI (`ant auth login`). This is the more
  controlled route. Every call uses a fixed model and effort, and the API
  forces the answer to match the schema.

A script started from a Claude Code session can't use the session's own
login. That's why the API route needs a key even when you run it from
Claude Code.

### Running it inside a Claude Code session

1. Export the tasks. Use the same selection flags you'd use for an API run:

   ```bash
   pnpm eval-clues --graded --export pipeline/data/clue-tasks
   ```

   This writes one prompt file per subagent into that folder:
   `judge-NNN.txt` for the judge and `player-NN-round-N.txt` for the player.
   Each judge file holds up to 50 questions (`--judge-batch` changes that).
   Add `--skip-judged` to leave out every question that already has a
   result, so a run only covers what's new. Add `--no-player` to skip the
   simulated player.

2. Start one fresh subagent per prompt file. Use model `opus` for
   `judge-*.txt` and `haiku` for `player-*.txt`. They can all run at once.
   Give each one this instruction, with its own two paths:

   > Read the file `<folder>/<name>.txt` and follow its instructions
   > exactly. Then use the Write tool to save your answer (only the JSON
   > object it asks for, nothing else) to `<folder>/<name>.answer.json`.
   > Apart from reading that one file and writing that one file, use no
   > tools and open no other files.

   Never hand a subagent `tasks.json`. It maps the player's opaque ids
   (`q1`, `q2`, …) to the answers.

3. Ingest the answers, with the same selection flags:

   ```bash
   pnpm eval-clues --graded --ingest pipeline/data/clue-tasks
   ```

   It checks every judgement against the schema, scores the player's guesses
   with `matchGuess`, and writes the results and reports. Missing or
   malformed answers are listed. Re-run just those subagents, then ingest
   again.

How this differs from the API route:

- There's no effort setting, and nothing forces the output to match the
  schema. The ingest step rejects anything malformed.
- Results are labelled `claude-code-subagent:opus` and
  `claude-code-subagent:haiku`, so a later API run re-scores them instead of
  mixing the two.
- It uses plan usage, not API billing. Every subagent starts by loading
  Claude Code's own instructions, tools, CLAUDE.md files and memory, about
  55,000-75,000 tokens before it reads a question. Judging itself costs a
  few thousand tokens per question. So batch size decides the cost: one
  question per subagent cost about 100,000 tokens a question, six per
  subagent about 15,000, and 50 per subagent should be a few thousand.
- Don't have the session you're talking to do the judging itself. It knows
  the conversation, which may include Brian's grades, so the judge would be
  biased. A fresh subagent sees only its prompt file.

### API commands

```bash
pnpm eval-clues --graded            # judge vs Brian's grades -> results/calibration.md
pnpm eval-clues                     # whole bank -> results/latest.json + results/report.md
pnpm eval-clues --ids tea,boxing    # just these questions, merged into latest.json
pnpm eval-clues --dry-run           # print the exact prompts; no API calls, no key
```

Other flags (`--limit`, `--concurrency`, `--no-player`, `--force`, model and
effort overrides) are listed at the top of `pipeline/eval-clues.ts`. Every API
run ends by printing the tokens it used and what they cost.

## What it measures

Two models look at each question.

**The judge** (`claude-opus-5-5`) reads the whole question and the rules,
then scores each clue:

| Field | Meaning |
| --- | --- |
| `interest` 1-5 | 1 = a summary or description, 2 = the most famous fact, 3 = dry or generic, 4 = specific and lesser-known, 5 = a fact you'd repeat to a friend |
| `alone` | Could a typical player name the answer from this clue alone: no, think (they can work it out) or instant (without thinking). Only instant is too easy. |
| `names_answer` | Uses a distinctive word from the answer's own name, like "Pisa" for the Leaning Tower of Pisa |
| `wording` 1-3 | Awkward, clear, or tight and vivid |
| `repeats` | Which other clue this one repeats, or 0 |
| `fact` | ok, doubtful or wrong, from the model's own knowledge |

For any clue with a problem it also writes `fix`, a suggested rewrite. It
gives the whole question a verdict (good, needs work, bad), a judged
difficulty, the clue a typical player would solve on, and a one-line summary.
The exact wording it gets is in `rubric.ts`, and `--dry-run` prints it.

**The simulated player** (`claude-haiku-4-5`) plays the question the way a
person does. It sees the category and one more clue at a time, and guesses
each time. Its guesses are checked with the game's own `matchGuess`. It records
the clue it first gets right on. It uses a smaller model on purpose, because a
model that knows less trivia is closer to a typical player. It still knows
more than most people, so read its solve point as "at the latest".

From those numbers the eval sets **flags**, each tied to one rule: clue 1 or
clue 2 gives the answer away without thinking, the question plays easy, a clue
uses the answer's name, a dull clue before clue 4, clues that repeat each
other, clues in the wrong order, a doubtful fact, and so on. The full list is
`FLAG_LABELS` in `score.ts`. Solving on clue 1 is not a flag by itself: Brian
decided that working the answer out from clue 1 is fine.

## Can the judge be trusted?

`graded.ts` holds Brian's grades. Each one is a check on the judge's output,
such as "Boxing's clue 2 gives the answer away". `pnpm eval-clues --graded`
runs the judge on those questions and writes `results/calibration.md`, which
shows each check and whether the judge agreed.

Look at that agreement before you act on the bank report. Run it again after
any change to `rubric.ts` or to the rules in `../README.md`.

Two things keep it honest:

- **The test cases are held out.** The rules the judge reads must not name a
  graded question or quote its clues. `clueEval.test.ts` fails if they do.
- **Grades are Brian's words, not guesses at his taste.** Add a case to
  `graded.ts` only for something he said or clearly agreed with. The set is
  26 cases from three sessions, twelve of them whole questions he'd ship as
  they are.

## Files

| File | What it is |
| --- | --- |
| `rubric.ts` | The judge and player prompts and their output schemas |
| `score.ts` | Flags, checks against the grades, and the markdown reports. Pure code, unit tested. |
| `graded.ts` | Brian's grades |
| `results/latest.json` | Every question's latest scores, one line per question. It also works as the cache. |
| `results/report.md` | The bank report: totals, then the questions to fix, worst first |
| `results/fixes.md` | The judge's suggested rewrites, worst questions first, next to the clues they'd replace. Facts unchecked. |
| `results/calibration.md` | Agreement with Brian's grades |
| `results/graded-fixes.md` | Suggested rewrites for the graded questions |
| `results/graded.json` | Scores for the graded cases, and their cache |
| `factCheck.ts` | The fact checker's prompt, answer checks and report. Pure code, unit tested. |
| `results/factcheck.json` | Every fact check: verdict, evidence and suggested fix for each clue text |
| `results/factcheck.md` | Clues still in the bank whose fact check found a problem |
| `../../../pipeline/fact-check.ts` | The fact-check runner |
| `../../../pipeline/eval-clues.ts` | The runner |

## Re-runs and second passes

A stored result is reused when the prompts, the model and the question's text
are all unchanged. `--skip-judged` goes further and skips any question that
has a result at all. Without it, editing one question re-scores only that
question, and editing the rules in `../README.md` or anything in `rubric.ts` re-scores everything.
Bump `RUBRIC_VERSION` to force that without a text change.

The results are committed, so the next person or agent doesn't pay to
re-score questions that haven't changed.

The fact check below is a separate pass with its own results file.

## Fact check

The judge's `fact` field comes from the model's memory. It flags some true
facts as doubtful and passes some false ones. `pipeline/fact-check.ts` is a
second pass that checks each clue against sources a subagent opens on the
web. It runs inside a Claude Code session, in the same export and ingest
pattern:

```bash
pnpm pipeline pipeline/fact-check.ts --export pipeline/data/fact-tasks   # every unchecked clue
pnpm pipeline pipeline/fact-check.ts --export pipeline/data/fact-tasks --ids tea,boxing
#   ... one fresh subagent per checker-NNN.txt, with web search; each writes checker-NNN.answer.json ...
pnpm pipeline pipeline/fact-check.ts --ingest pipeline/data/fact-tasks
```

Each checker gets 12 questions by default (`--batch` changes that) and
about 2-4 searches per question. Web search is capped per session, so keep
about 10 checkers running at once.

Each clue gets a verdict: `ok`, `loose` (true in substance but overstated or
too precise), `wrong`, or `unverified`, with the evidence and its URL. For
loose and wrong clues the checker suggests a fix. The results go into
`results/factcheck.json`, and `results/factcheck.md` lists every clue still
in the bank whose check found a problem. Ingest never edits the bank: read
each problem, check the fix, and edit the clue by hand.

A check applies to the clue's exact text. Any edit makes the clue unchecked
again, so the next export picks it up. A clue whose new text is the
checker's own fix counts as checked.

The two passes meet in one place. When a source has confirmed a clue, the
judge's doubt about that clue raises no flag, and a question held back only
for such doubts is left off the bank report's list of questions to fix.
`pnpm eval-clues` reads `factcheck.json` for this whenever it writes the
reports.

## Rewriting clues in bulk

`pipeline/fix-clues.ts` turns the judge's notes into rewritten clues, in the
same export and ingest pattern:

1. Judge the questions first (`pnpm eval-clues --ids …`, or a session run).
2. `pnpm pipeline pipeline/fix-clues.ts --export pipeline/data/fix-tasks --ids a,b --notes notes.json`
   writes one `fixer-NNN.txt` per 10 questions. `--notes` is optional: a JSON
   object of Brian's notes keyed by question id, which outrank the judge.
3. Give each file to a fresh subagent that can search the web. It must
   confirm every new fact with a search and cite a source for each changed
   clue. It writes `fixer-NNN.answer.json`.
4. `pnpm pipeline pipeline/fix-clues.ts --apply pipeline/data/fix-tasks`
   checks each rewrite and writes the good ones into `extraBank.ts`. It
   checks for four clues, the leak rule, a source for every changed clue,
   and that nothing was edited since export. What changed is listed in
   `changes.json`, and what it refused in `rejected.json`.
5. Re-judge the edited questions, run the tests, and show Brian the before
   and after. Nothing reaches players until the change merges.

## Improving a question with it

1. Pick a question from `results/report.md` or `results/fixes.md`. Both list
   the worst first, and `fixes.md` shows the judge's suggested rewrite next
   to each problem clue.
2. Rewrite it in `extraBank.ts`, following the rules in `../README.md`.
3. Check every new fact against a source. The judge's `fact` field comes from
   the model's memory: "doubtful" means look it up, and "ok" doesn't prove it.
4. Run `pnpm eval-clues --ids <id>`. Keep the rewrite if the verdict improved
   and no new flags appeared.
5. Run the usual checklist (`pnpm test`, `pnpm lint`, `npx tsc --noEmit`).

## Limits

- The judge's fact field has no sources. The fact check has sources, but a
  checker can still misread one, so read each fix before applying it.
- Models know more trivia than people do, so "typical player" numbers are
  estimates. The simulated player gives a real measurement, but of a model.
- The calibration set is small: 26 cases from three grading sessions.
- The private bank is not scored. The results are committed to a public repo,
  and private questions must not end up in it.
