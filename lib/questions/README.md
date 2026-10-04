# Adding questions to the bank

Read this before writing questions. Most of it is not guessable from the
code, and several of the rules bite silently — a question that breaks them
either fails an opaque assertion or, worse, ships broken.

## Where questions live

| Source | File | Notes |
| --- | --- | --- |
| Public samples | `seed.ts` | The 4 worked examples from the spec. Don't grow this. |
| Committed bank | `extraBank.ts` | **Add new questions here.** |
| Private bank | `private-bank.json` | Gitignored; also reaches Vercel as base64 `TRIVEAL_PRIVATE_BANK`. Overlaps the committed bank. |
| Live database | Supabase `triveal_questions` | What production actually serves. Synced from the three above on every production deploy. |

`source.ts` assembles the first three into one pool, deduped by
`answerCanonical` (first occurrence wins), **but only when Supabase env vars
are absent**. With them set — i.e. production — both daily and practice read
from Supabase instead. A question that exists only in `extraBank.ts` is
invisible in production until it is synced. See "After the merge" below.

## Shape

```ts
{
  id: "voyager-1",                       // kebab slug, unique across the bank
  answer: "Voyager 1",                   // as displayed
  answerCanonical: "voyager 1",          // must normalize to the same string as `answer`
  answerAliases: ["Voyager"],            // other accepted spellings — see the trap below
  category: "Space",
  difficulty: "hard",                    // easy | medium | hard
  clues: [                               // exactly 4, positions 1..4, one line each
    { position: 1, text: "…" },
  ],
  decoys: [                              // at least 2
    { text: "Pioneer 10", eliminatedByClue: 1 },
  ],
}
```

Clue text uses real typography — em dashes and proper diacritics
(`Röntgen`, `Orléans`, `Malecón`), matching the surrounding entries.

## What makes a good question

These rules come from Brian grading sample questions on 2026-10-03. They
replace the older "clue ladder" rules from spec §2.2, which put misdirection
first. Those older rules are still visible in `seed.ts` and in
`pipeline/prompts/generate.ts`. Follow this section where they disagree.

The clue-quality eval (`clueEval/README.md`) feeds the list between the
`judge-rules` markers to its judge word for word. Editing the list changes
what the judge checks. The examples table below the list is kept out on
purpose, because those examples are the eval's test cases. For the same
reason, examples inside the list must not come from a question in
`clueEval/graded.ts`. A test checks this.

<!-- judge-rules:start -->
- **Most questions should be medium or hard.** The fun is in needing more
  than one clue. A typical player should solve on clue 2 or 3. If people get
  it on clue 1 without thinking, the question is too easy. Working the answer
  out from clue 1 is fine; that's part of the fun. A typical player is a
  casual one: a smart adult with general knowledge, not a trivia buff.
- **Every clue is an interesting fact, not only clue 1.** A plot summary, or
  a description of how the thing works, is not an interesting fact. "A
  tree-dwelling Australian marsupial that carries its young in a pouch"
  describes a koala. "Its fingerprints are so like a human's that they are
  hard to tell apart" tells you something new about it.
- **Each clue covers a different angle.** Four clues should be four separate
  facts, for example a person, a number, a piece of history and an odd
  detail. Don't spread one idea, such as "it became a hit", over two clues.
- **Be specific to the answer.** If a fact could fit many answers, add the
  detail that ties it back. "This album sold millions of copies" could
  describe hundreds of albums. A detail only one album has, such as where or
  how it was recorded, ties it to that one.
- **No giveaway words before clue 4.** Words like "Hogwarts",
  "web-slinger" or "the Big Apple" settle the question on their own.
- **None of the first three clues should be instant.** Clues 2 and 3 can be
  easier than clue 1, but a player should still have to think. They don't
  have to be hard.
- **Don't use a word from the answer's own name**, in any clue, clue 4
  included. A clue about the Leaning Tower of Pisa shouldn't say "Pisa".
  A word that only says what kind of thing the answer is, such as "this
  river", is fine.
- **Say what kind of thing the answer is.** Open clue 1 with "This game…"
  or "This print's…", not a bare "It" or "Its", because the player doesn't
  yet know what "it" is. That's how trivia clues usually read. Write all
  four clues as sentences about the answer, in the same voice. Don't switch
  clue 4 to a dictionary-style fragment such as "The microscopic
  eight-legged survivor nicknamed…". A style problem like these is enough to
  hold a question back until it's fixed.
- **Order the clues from hardest to easiest.** A clue that is better known
  than the one after it is in the wrong place. If a later clue holds a
  lesser-known or less direct fact than an earlier one, swap them.
- **Clue 4 can be the giveaway.** It names what a casual player knows. Word
  it well, but it doesn't need to be surprising.
- **Clue 1 may be pure recall.** A fact you either know or don't is fine, as
  long as it is interesting.
- **Misdirection is not a goal.** Players get misdirected by what they
  already know. Decoys are still required, because `matchGuess` uses them to
  reject near-miss guesses and the tests check them. Pick them as plausible
  wrong answers. The clues don't have to fit them.
- **Check every fact.** Nothing verifies them. Every clue must be true of the
  answer. Check numbers and rankings ("the third highest-grossing …") against
  a source before using them.
<!-- judge-rules:end -->

Examples from the grading:

| Verdict | Question | Clue |
| --- | --- | --- |
| Good clue 1 | Burj Khalifa | "Its spire is so tall that people on its lower floors break their Ramadan fast minutes before those on top." |
| Good clue 1 | Boxing | "Sweden banned its professional form in 1970, and Norway kept a similar ban in place until 2014." |
| Good clue 1 | Wizard of Oz (rewrite) | "The book's magic shoes were silver; the film changed their color to show off a new color process." |
| Bad clue 1 | Star Wars | "Its opening words scroll up the screen …: 'A long time ago in a galaxy far, far away.'" It's the most famous line in the film. |
| Bad clue 2 | Wizard of Oz | "Dorothy follows a yellow brick road, gaining a scarecrow, a tin man, and a cowardly lion." It's a plot summary. |
| Bad set | Among Us | Four clues that say only two things: it became a hit, and how the game is played. |
| Ship as is | Hubble Space Telescope, Hagia Sophia, Stapes, Corpse Flower | Every clue before clue 4 is a specific, lesser-known fact. |
| Bad clue 4 | Elden Ring | "…become Elden Lord…" uses a word from the answer. |
| Wording | The Great Wave off Kanagawa | "Its striking blue came from…" should be "This print's striking blue came from…". Its clue 4 is a fragment, unlike the others. |
| Order | Pickleball | Clue 4's "name credited to a family dog" is less known than clue 1's plastic ball, so it belongs in clue 1. |

## Rules the test suite enforces

`lib/game/game.test.ts` generates one case per question, so a bad question
fails a test named after its id. The checks:

- 4+ clues, positions exactly `1..n`; 2+ decoys.
- `normalizeAnswer(answer) === normalizeAnswer(answerCanonical)`.
- **The leak rule:** no clue may contain the canonical answer or any alias.
- Every decoy is rejected by `matchGuess`; the answer and every alias are
  accepted by it.

Three ways the leak rule surprises people:

1. **It matches substrings, not words.** `liver` is leaked by "delivered"
   and "sliver"; `skin` by "skinny"; `dune` by "dunes"; `scream` by
   "screaming". Search your clue text for the bare canonical string.
2. **`normalizeAnswer` strips leading articles.** "The Bear" canonicalizes
   to `bear`, "The Scream" to `scream`, "The Great Gatsby" to
   `great gatsby` — so the banned word is often shorter and far more common
   than the displayed answer. It also strips punctuation and diacritics,
   maps `&` to "and", and lowercases: "X-ray" → `x ray`.
3. **Aliases are double-edged.** Adding `"Hubble"` lets a player type the
   short name, but also bans the word "Hubble" from that question's clues —
   including the sentence naming the astronomer it is named after.

## The decoy trap

`matchGuess` checks decoys **before** the real answer, and its fuzzy match
is length-scaled (≤4 chars → 0 typos allowed, ≤7 → 1, longer → 2). So a
decoy within that distance of the answer makes the *correct* answer be
rejected as a decoy, and the question fails its test.

Concretely: "Voyager 2" cannot be a decoy for "Voyager 1" (edit distance 1),
and with the alias `"Voyager"` in play it is worse still. Keep decoys
lexically distant from the answer **and from every alias**.

## Rules nothing enforces — check these yourself

- **Clue quality.** See "What makes a good question" above.
- **`eliminatedByClue` should point at the clue that actually rules that
  decoy out.** The suite only checks it is in range.
- **Uniqueness of `answerCanonical`.** A duplicate is not an error — the
  pool dedupes silently, so the bank just quietly fails to grow. (`id`
  duplicates and canonical duplicates are covered by a test in
  `game.test.ts`; keep it that way.)
- **Category balance.** `pickAvoidingCategories` steers practice away from
  repeating a category, and `categoryGroup` treats Geography, Landmarks and
  Cities as one group. A lopsided bank makes that steering worse, so prefer
  feeding thin categories over the already-fat ones.

## Answer pictures and summaries

The picture and summary shown after a round are Wikipedia's lead image and
opening sentences for the answer's article, resolved from the answer text
itself. When the bare answer is a disambiguation page or a
different subject ("Casablanca" the city, "Dune" the sand formation), add an
override to `ANSWER_PAGE_TITLES` in `answerInfo.ts`, keyed by the
normalized answer. A test asserts every override key matches a real bank
question, so don't leave stale ones behind.

## Checklist

```bash
pnpm install          # a fresh worktree has no node_modules
pnpm test             # +1 test per question added
pnpm lint
npx tsc --noEmit
pnpm eval-clues --ids <new-or-edited-ids>   # clue quality; needs an API key
```

Then update the header comment in `extraBank.ts` with the new total.

The last step scores the clues against "What makes a good question" and
merges the results into `clueEval/results/`. Commit those results with the
questions. To find which existing questions most need work, read
`clueEval/results/report.md`. How the eval works, and how far to trust it,
is in [`clueEval/README.md`](clueEval/README.md).

## After the merge

Merging is all it takes. Production serves questions from Supabase, and the
production deploy of every merge to `main` updates it in two steps
(`pipeline/sync-on-deploy.ts`, run at the end of `pnpm build`):

1. `sync-bank --update` copies new and edited questions into the live DB.
   Practice serves them as soon as the deploy finishes.
2. `schedule-daily.ts` gives new questions days in daily mode.

Local builds, CI and preview deployments skip both steps, so only merged
questions reach players. If either step fails, the deploy fails and the
previous one keeps serving. Look at the Vercel build log, fix the cause, and
redeploy. A failed sync never gets skipped quietly.

To see what the next deploy would change, or to run a step by hand:

```bash
set -a; . .env.local; set +a
export TRIVEAL_PRIVATE_BANK="$(base64 -i lib/questions/private-bank.json)"  # so private questions sync too
VERCEL_ENV=production pnpm pipeline pipeline/sync-on-deploy.ts --dry-run   # both steps, nothing written

pnpm sync-bank --update                        # step 1 alone
pnpm pipeline pipeline/schedule-daily.ts       # step 2 alone
```

`sync-bank` without `--update` only inserts. It never touches rows that
already exist, so edits to an existing question need `--update`. It syncs
whatever bank it can load where you run it. Without `private-bank.json` or
`TRIVEAL_PRIVATE_BANK`, private questions are skipped (nothing is deleted).

**Daily mode runs on an explicit schedule.** Each row in
`triveal_daily_questions` assigns a question to a date, and a row wins over
the app's `hash(date) % bankSize` fallback. So a new question never plays in
daily until it has a row. `schedule-daily.ts` adds the rows. It deals every
question that has not played yet this round into the upcoming days, and
extends the schedule before it runs out. It never changes today or the next
two days. If the schedule already covers every question, it does nothing.
The rules are in `dailySchedule.ts`.
