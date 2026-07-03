# Cluedown question pipeline (offline)

Builds the verified question bank. Runs on your machine, never in the live
app — the app only serves rows that already passed verification.

```
kaggle CSV ──1──> rows.json ──2──> ranked.json ──3──> resolved.json
   ──4──> context.json ──5──> generated.json ──6──> verified.json ──7──> Supabase
```

## Run

```bash
# 0. one-time: grab the dataset (needs kaggle CLI + credentials)
kaggle datasets download -d tunguz/200000-jeopardy-questions && unzip 200000-jeopardy-questions.zip

# stages (each writes pipeline/data/*.json; stderr shows progress)
pnpm pipeline pipeline/1-load-kaggle.ts JEOPARDY_CSV.csv
pnpm pipeline pipeline/2-dedupe-rank.ts --top 2000
pnpm pipeline pipeline/3-resolve-wikipedia.ts --limit 200
pnpm pipeline pipeline/4-assemble-context.ts
ANTHROPIC_API_KEY=sk-... pnpm pipeline pipeline/5-generate.ts --limit 50
ANTHROPIC_API_KEY=sk-... pnpm pipeline pipeline/6-verify.ts
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm pipeline pipeline/7-load-supabase.ts
```

Models: generation defaults to `claude-sonnet-5` (batch volume), verification
to `claude-opus-4-8` (stronger checking pass). Override with
`CLUEDOWN_GENERATE_MODEL` / `CLUEDOWN_VERIFY_MODEL`.

## Rules enforced

- Every clue's facts must trace to the retrieved Wikipedia extract; the
  verify stage rejects anything unsupported or answer-leaking, and routes
  ambiguous clues to `needs_review` instead of auto-publishing.
- J-Archive supplies answer strings and difficulty signals only. Clue text
  is written fresh from Wikipedia — never copy J-Archive wording (IP note,
  spec §3.8).
- Hand-review the first batch against the four worked examples before
  trusting the pipeline at volume (spec §9 phase 1).

`pipeline/data/` is gitignored — it's a build artifact.
