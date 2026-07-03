# Cluedown

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

With no environment variables the app serves the local question bank:
4 public sample questions (the spec's worked examples) plus
`lib/questions/private-bank.json` — a gitignored file holding the rest of
the hand-verified bank, kept out of the public repo so upcoming dailies
can't be spoiled. Copy that file to any deploy target (or use Supabase).
Add Supabase env vars (see `.env.example`) to serve from Postgres instead;
apply `supabase/migrations/0001_init.sql` first.

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
- ⬜ Party mode (schema ready; needs a Supabase project for realtime)
- ⬜ Real mascot art (current star is a placeholder)
