# Triveal

[![CI](https://github.com/byebrianwong/triveal/actions/workflows/ci.yml/badge.svg)](https://github.com/byebrianwong/triveal/actions/workflows/ci.yml)

A trivia game of counting-down clues. One hidden answer, four clues revealed
one at a time — hardest first, giveaway last. Guess early for more points,
but wrong guesses cost you. Two modes share one verified question bank:
a Wordle-style **daily** and a Jackbox-style **party** mode (rooms + realtime).

## Scoring

| Clue | Base value |
|---|---|
| 1 | 10 |
| 2 | 8 |
| 3 | 6 |
| 4 | 4 |

**−1 point per wrong guess**, floored at 0. Solve on clue 2 after one miss →
8 − 1 = 7.

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000 — daily mode, zero config
pnpm test       # vitest unit suite (engine + bank integrity checks)
pnpm build      # production build
```

With no environment variables the app serves the local question bank —
**154 questions, zero config**:

- 4 public sample questions (the spec's worked examples) in `lib/questions/seed.ts`
- 150 committed questions in `lib/questions/extraBank.ts`
- *(optional)* whatever is in `lib/questions/private-bank.json` — a gitignored
  file for extra hand-verified questions kept out of the public repo so
  upcoming dailies can't be spoiled. The app runs fine without it.

Add Supabase env vars (see `.env.example`) to serve from Postgres instead;
apply the migrations in `supabase/migrations/` in order first, then load the
committed bank into the database:

```bash
# apply migrations first, then:
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm sync-bank
```

`pnpm sync-bank` copies the committed bank (`SEED_QUESTIONS` + `EXTRA_QUESTIONS`
+ any private bank) into the `triveal_*` tables as `verified` questions. It is
idempotent — it dedupes by `answer_canonical` and inserts only what's missing —
so re-run it whenever you add questions. Without this step a Supabase-backed
deploy would serve only whatever is already in the database, not the committed
bank.

Flags:

- `--dry-run` previews what would change and writes nothing. On its own it just
  reports the local bank (no credentials needed); combined with `--update` it
  reads the DB to compute the diff, so credentials are required.
- `--update` also reconciles questions **already** in the DB whose committed
  content changed — the answer/aliases/category/difficulty, the clues, or the
  decoys — rewriting only the parts that differ. Use it after editing existing
  questions (a plain sync inserts new questions but never touches existing
  rows). It matches on `answer_canonical`, so changing the answer text itself
  reads as a new question rather than an edit, and it never deletes questions.

## Answer pictures

When a round ends, the revealed answer gets a picture beside it — a salt
shaker for "Salt", an octopus for "Octopus". It is Wikipedia's lead image for
the answer's article, fetched after the reveal (so nothing in the round waits
on it) and cached for a month. No API key, no configuration.

Two rules keep it honest:

- **Free pictures only.** Only files hosted on Wikimedia Commons are used;
  English Wikipedia's own uploads (`upload.wikimedia.org/wikipedia/en/…`) are
  mostly non-free fair-use posters and logos that a game has no right to reuse.
  So most people, places, animals and objects get a picture, while film,
  TV and game answers usually don't.
- **The right picture or none.** A bare answer that lands on a disambiguation
  page falls back to a category-scoped search, and search results are only
  accepted when the article title *is* the answer — a confidently wrong picture
  is worse than no picture. Answers whose plain name means something else
  ("Apple", "Queen", "Mercury") are pinned to the right article in
  `ANSWER_PAGE_TITLES` (`lib/questions/answerImage.ts`); add to that short list
  when a new question needs it. Questions coming from Supabase use their
  `wikipedia_title` column when it is set.

Every picture carries its author and license and links to the Commons file
page. Anything that fails — no article, no free image, Wikipedia unreachable,
slow response — just renders no picture at all.

## Rating questions

Every finished round — daily and practice — ends with one line under the
answer: **How was this question?** and three faces, ☹ / 😐 / ☺. One tap
records it. A small "Add a note" link appears afterwards for the rare player
who wants to say *why*; nobody has to open it.

Tapping a different face revises the rating already sent rather than adding a
second one, and your verdict is remembered locally, so re-opening a finished
daily shows what you chose instead of asking again.

### Reviewing them

`/ratings` lists every rated question, **worst first**, with the answer, its
category, the three counts, a score from −1 (unanimously bad) to +1
(unanimously good), how many raters actually solved it, and any notes. Sort
by best, most-rated or most-recent from the links at the top.

Each card also carries the question itself, because a score doesn't say what
went wrong:

- **The clue ladder** in play order, hardest first, labelled with what each
  clue is worth — so a note like "clue 2 gives it away" can be checked against
  clue 2 without leaving the page.
- **The decoys**, ordered by the clue that eliminates them. Any decoy that no
  clue rules out is flagged in pink as *never ruled out* and sorted last: it
  means the question stays ambiguous to the end, which is often what a bad
  rating is really complaining about.

The page shows answers, so it is private:

- With `TRIVEAL_ADMIN_TOKEN` set, it needs `?key=<that value>` — anything else
  404s.
- With the variable unset it works in `pnpm dev` and **404s in production**,
  so an unconfigured deploy can't leak upcoming dailies.

Ratings are stored per question id, which is enough context to read them
fairly: a "bad" from someone who never solved the round is not the same
complaint as a "bad" from someone who breezed through it, and the page shows
the solve count next to the score.

### Where they are stored

| Environment | Store |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Postgres (`triveal_question_ratings`) |
| anything else | `.triveal/ratings.json` in the project root (gitignored) |

The file store exists so the whole loop works in `pnpm dev` with zero config.
It is **not** durable on Vercel — serverless filesystems are per-request — so
a deploy that should keep its ratings needs the Supabase pair above, plus
`supabase/migrations/0004_question_ratings.sql` applied. The review page says
which store it read from, and warns when it's the file.

The ratings table carries RLS with no policies at all: only the service role
touches it, so the anon key can neither read other people's notes nor rewrite
a rating. That is also why the anon key alone isn't enough to turn the
Supabase store on.

## Deploy

This is a stock Next.js app, so [Vercel](https://vercel.com) hosts it with
**no configuration** — it auto-detects Next.js and pnpm, and the committed
question bank means the deployed site is playable immediately (daily +
practice) without any environment variables.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/byebrianwong/triveal)

### Recommended: connect the repo (push-to-deploy)

1. In the [Vercel dashboard](https://vercel.com/new), **Add New → Project**
   and import `byebrianwong/triveal`.
2. Accept the auto-detected settings (Framework: Next.js, Build: `next build`,
   Install: `pnpm install`) and **Deploy**.
3. Every push to `main` now ships automatically, and PRs get preview URLs.

That's the whole setup — no env vars required.

### Optional environment variables

Set these in **Project → Settings → Environment Variables** only if you want
the extras; all are optional:

| Variable | Purpose |
|---|---|
| `TRIVEAL_PRIVATE_BANK` | base64 of `private-bank.json`, to add private questions on top of the committed bank. Generate with `base64 -i lib/questions/private-bank.json`. |
| `TRIVEAL_ADMIN_TOKEN` | password for the `/ratings` review page. Without it that page 404s in production. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | serve questions from Supabase Postgres instead of the local bank. |

`lib/questions/privateBank.ts` reads `TRIVEAL_PRIVATE_BANK` first, then the
local file — so dev uses the file and prod uses the env var when set.

### Or deploy from the CLI

```bash
pnpm dlx vercel        # first run links/creates the project
pnpm dlx vercel --prod # ship to production
```

## Party mode (multiplayer)

Party mode needs a Supabase project (Postgres + Realtime). Daily and practice
modes do **not** — skip this section entirely if you only want single-player.

All Triveal tables are prefixed `triveal_` so the schema is safe to apply to
a **shared** Supabase project used by other apps — the prefix namespaces them
inside `public` without needing custom "exposed schemas" config.

**One-time setup:**

1. In the Supabase dashboard, open **SQL Editor** and run every file in
   `supabase/migrations/` in numeric order, starting with `0001_init.sql`.
   All of them are idempotent, so re-running is safe.

   `0002` is required for any project provisioned before it existed: `0001`
   creates its tables with `if not exists`, so re-running it will *not* repair
   an existing schema. See "Cleaning up old rooms" below for what it fixes.
2. Add these env vars in **Vercel → Project → Settings → Environment
   Variables** (and to a local `.env.local` if you want party mode in `pnpm
   dev`):

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role key (server-only) |

3. Redeploy. `supabaseConfigured()` flips on automatically when the URL + a key
   are present.

The pure party engine (room codes, first-correct-wins resolution, per-clue
scoring, standings) lives in `lib/game/party.ts` and is unit-tested
independently of Supabase.

### Cleaning up old rooms

Party rooms are disposable — a game runs for minutes and is never revisited —
so they need sweeping up, or `triveal_games` grows without bound.

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm cleanup-rooms
```

By default this removes finished rooms older than 2 hours (long enough that a
results screen someone left open still resolves) and lobby/active rooms older
than 24 hours (abandoned mid-play). Tune with `--finished-grace=<hours>` and
`--abandoned-after=<hours>`; preview with `--dry-run`. It is a thin wrapper
over the `triveal_cleanup_stale_games()` SQL function, so you can equally call
it from the SQL editor or from pg_cron — see the note at the end of
`0002_player_delete_cascade.sql`.

`0002` is what makes this possible at all. `0001` created
`triveal_guesses.player_id` with no `on delete` action, so deleting a game
aborted with a foreign-key violation the moment the room contained a single
guess — rooms could be created but never removed. `0002` gives that column
`on delete cascade`, and gives `triveal_rounds.winner_player_id` `on delete
set null` (it blocked deleting an individual player who had won a round).

## Layout

```
app/                 Next.js App Router; server actions keep answers server-side.
                     app/ratings is the private question-review page.
components/          DailyGame, ClueStack, Medallion, StarHost, ResultPanel,
                     AnswerImage, RateQuestion
lib/game/            pure game logic (no React/Supabase) — scoring, matching,
                     round state, streaks, share card. Portable to RN later.
lib/questions/       public samples + gitignored private bank + data source
                     (env-gated Supabase fallback) + answer-picture lookup
lib/ratings/         question feedback: types, pure roll-up, and the store
                     (Supabase, or a local JSON file with zero config)
lib/supabase/        server-side (service role) + browser (anon realtime) clients
supabase/migrations/ full schema incl. party mode tables + realtime
pipeline/            offline question bank builder (Kaggle -> Wikipedia ->
                     generate -> verify -> Supabase). See pipeline/README.md.
                     Also the party-room cleanup script (pnpm cleanup-rooms).
mocks/               design exploration HTML (Starlit stage etc.)
```

## Design

"Starlit stage" — cosmic game-show: dusk gradient, gold prize medallion
(shows the current clue's value; a pink badge tracks the wrong-guess
penalty), lit-bulb clue ladder, star host placeholder mascot with
per-beat expressions. Clues stack into a scrollable history carrying your
wrong guesses; the answer box never leaves the screen.

## Status

- ✅ Daily mode: playable end to end, streaks + solve distribution in
  localStorage, spoiler-free share card, keyboard + screen-reader +
  reduced-motion support
- ✅ Question engine: matching (aliases, typo tolerance, decoy rejection),
  scoring, round state — 35 unit tests
- ✅ Answer pictures: freely-licensed Wikimedia Commons art on every reveal
  (daily, practice and party), credited and degrading to nothing
- ✅ Question ratings: three faces + an optional note after each round,
  reviewed worst-first at `/ratings` (see "Rating questions")
- ✅ Supabase schema + env-gated data layer (seed fallback with zero config)
- ✅ Pipeline scaffolded end to end (needs ANTHROPIC_API_KEY + kaggle CSV)
- 🚧 Party mode: fully built — pure engine (`lib/game/party.ts`, unit-tested),
  namespaced schema, server actions, realtime hook, and lobby/round/results
  UI. Needs a Supabase project to run (see "Party mode" above); realtime not
  yet exercised end-to-end against a live database.
- ⬜ Real mascot art (current star is a placeholder)
