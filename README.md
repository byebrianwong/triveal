# Cluedown

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
**59 questions, zero config**:

- 4 public sample questions (the spec's worked examples) in `lib/questions/seed.ts`
- 55 committed questions in `lib/questions/extraBank.ts`
- *(optional)* whatever is in `lib/questions/private-bank.json` — a gitignored
  file for extra hand-verified questions kept out of the public repo so
  upcoming dailies can't be spoiled. The app runs fine without it.

Add Supabase env vars (see `.env.example`) to serve from Postgres instead;
apply `supabase/migrations/0001_init.sql` first.

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
| `CLUEDOWN_PRIVATE_BANK` | base64 of `private-bank.json`, to add private questions on top of the committed bank. Generate with `base64 -i lib/questions/private-bank.json`. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | serve questions from Supabase Postgres instead of the local bank. |

`lib/questions/privateBank.ts` reads `CLUEDOWN_PRIVATE_BANK` first, then the
local file — so dev uses the file and prod uses the env var when set.

### Or deploy from the CLI

```bash
pnpm dlx vercel        # first run links/creates the project
pnpm dlx vercel --prod # ship to production
```

## Party mode (multiplayer)

Party mode needs a Supabase project (Postgres + Realtime). Daily and practice
modes do **not** — skip this section entirely if you only want single-player.

All Cluedown tables are prefixed `cluedown_` so the schema is safe to apply to
a **shared** Supabase project used by other apps — the prefix namespaces them
inside `public` without needing custom "exposed schemas" config.

**One-time setup:**

1. In the Supabase dashboard, open **SQL Editor** and run
   `supabase/migrations/0001_init.sql`. It is idempotent (`create ... if not
   exists`), so re-running is safe.
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

## Layout

```
app/                 Next.js App Router; server actions keep answers server-side
components/          DailyGame, ClueStack, Medallion, StarHost, ResultPanel
lib/game/            pure game logic (no React/Supabase) — scoring, matching,
                     round state, streaks, share card. Portable to RN later.
lib/questions/       public samples + gitignored private bank + data source
                     (env-gated Supabase fallback)
lib/supabase/        server-side Supabase access
supabase/migrations/ full schema incl. party mode tables + realtime
pipeline/            offline question bank builder (Kaggle -> Wikipedia ->
                     generate -> verify -> Supabase). See pipeline/README.md.
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
- ✅ Supabase schema + env-gated data layer (seed fallback with zero config)
- ✅ Pipeline scaffolded end to end (needs ANTHROPIC_API_KEY + kaggle CSV)
- 🚧 Party mode: pure engine done + unit-tested (`lib/game/party.ts`);
  namespaced schema ready; server actions + realtime UI in progress
  (needs a Supabase project — see "Party mode" above)
- ⬜ Real mascot art (current star is a placeholder)
