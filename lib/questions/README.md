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
| Live database | Supabase `triveal_questions` | What production actually serves. Fed by `pnpm sync-bank`. |

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

- **Facts.** Nothing verifies them. Every clue must be true of the answer.
- **The clue ladder** (spec §2.2): clue 1 is crossword-terse — one oblique,
  surprising fact, not a description; clues 1–2 also plausibly fit a decoy;
  each later clue eliminates a decoy or adds recognizability; clue 4 is a
  fair giveaway that identifies the answer unambiguously.
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

## Answer pictures

Artwork is Wikipedia's lead image for the answer's article, resolved from
the answer text itself. When the bare answer is a disambiguation page or a
different subject ("Casablanca" the city, "Dune" the sand formation), add an
override to `ANSWER_PAGE_TITLES` in `answerImage.ts`, keyed by the
normalized answer. A test asserts every override key matches a real bank
question, so don't leave stale ones behind.

## Checklist

```bash
pnpm install          # a fresh worktree has no node_modules
pnpm test             # +1 test per question added
pnpm lint
npx tsc --noEmit      # one pre-existing error in components/PartyRound.test.tsx
```

Then update the header comment in `extraBank.ts` with the new total.

## After the merge

Neither of these is automatic, and skipping them means the questions exist
only in the repo:

```bash
# insert the new questions into the live DB (idempotent; inserts only what's missing)
set -a; . .env.local; set +a; pnpm sync-bank --dry-run --update   # show the diff
set -a; . .env.local; set +a; pnpm sync-bank                      # insert
```

`sync-bank` never touches rows that already exist — edits to clue text on an
existing question need `--update`. Note it syncs whatever bank is loadable
where you run it: without `private-bank.json` or `TRIVEAL_PRIVATE_BANK`
present, private questions are simply skipped (nothing is deleted).

**Daily mode is on an explicit schedule.** `triveal_daily_questions` is
populated with a fixed 365-day permutation, and an explicit row wins over
the app's `hash(date) % bankSize` fallback. New questions appear in practice
as soon as they are synced, but **not in daily** until that schedule is
regenerated or extended.
