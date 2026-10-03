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
   For a big run, add `--judge-batch 10` so each judge subagent takes 10
   questions. Every subagent starts with a lot of Claude Code's own context,
   so one question per subagent is expensive at scale.

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
- It uses plan usage, not API billing. The first graded run, 8 judge
  subagents and 4 player subagents, used about 850,000 tokens. Most of that
  was each subagent's starting context, not the questions.

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
| `alone` | How many typical players would name the answer from this clue alone: few, some or most |
| `wording` 1-3 | Awkward, clear, or tight and vivid |
| `repeats` | Which other clue this one repeats, or 0 |
| `fact` | ok, doubtful or wrong, from the model's own knowledge |

It also gives the whole question a verdict (good, needs work, bad), a judged
difficulty, the clue a typical player would solve on, and a one-line summary.
The exact wording it gets is in `rubric.ts`, and `--dry-run` prints it.

**The simulated player** (`claude-haiku-4-5`) plays the question the way a
person does. It sees the category and one more clue at a time, and guesses
each time. Its guesses are checked with the game's own `matchGuess`. It records
the clue it first gets right on. It uses a smaller model on purpose, because a
model that knows less trivia is closer to a typical player. It still knows
more than most people, so read its solve point as "at the latest".

From those numbers the eval sets **flags**, each tied to one rule: clue 1 or
clue 2 gives the answer away, a dull clue before clue 4, clues that repeat each
other, clues in the wrong order, a doubtful fact, and so on. The full list is
`FLAG_LABELS` in `score.ts`.

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
  small so far, and no whole question in it has been graded "good" yet. Grading
  a few questions he likes as they are would make the verdict checks much
  stronger.

## Files

| File | What it is |
| --- | --- |
| `rubric.ts` | The judge and player prompts and their output schemas |
| `score.ts` | Flags, checks against the grades, and the markdown reports. Pure code, unit tested. |
| `graded.ts` | Brian's grades |
| `results/latest.json` | Every question's latest scores, one line per question. It also works as the cache. |
| `results/report.md` | The bank report: totals, then the questions to fix, worst first |
| `results/calibration.md` | Agreement with Brian's grades |
| `results/graded.json` | Scores for the graded cases, and their cache |
| `../../../pipeline/eval-clues.ts` | The runner |

## Re-runs

A stored result is reused when the prompts, the model and the question's text
are all unchanged. Editing one question re-scores only that question. Editing
the rules in `../README.md` or anything in `rubric.ts` re-scores everything.
Bump `RUBRIC_VERSION` to force that without a text change.

The results are committed, so the next person or agent doesn't pay to
re-score questions that haven't changed.

## Improving a question with it

1. Pick a question from `results/report.md`. They're listed worst first, and
   `latest.json` has a note for each clue.
2. Rewrite it in `extraBank.ts`, following the rules in `../README.md`.
3. Check every new fact against a source. The judge's `fact` field comes from
   the model's memory: "doubtful" means look it up, and "ok" doesn't prove it.
4. Run `pnpm eval-clues --ids <id>`. Keep the rewrite if the verdict improved
   and no new flags appeared.
5. Run the usual checklist (`pnpm test`, `pnpm lint`, `npx tsc --noEmit`).

## Limits

- The fact check has no sources. It catches some errors, not all.
- Models know more trivia than people do, so "typical player" numbers are
  estimates. The simulated player gives a real measurement, but of a model.
- The calibration set is small (8 cases from one grading session).
- The private bank is not scored. The results are committed to a public repo,
  and private questions must not end up in it.
