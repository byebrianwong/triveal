<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

# Writing questions

Adding or editing questions in the bank? Read
[`lib/questions/README.md`](lib/questions/README.md) first — all of it. The
rules that matter are not guessable from the types: the no-leak rule matches
substrings and strips leading articles, decoys are matched before the answer
so a near-miss decoy makes the *right* answer fail, and new questions reach
players only through the production deploy of the merge, which syncs them
into Supabase and schedules them for daily mode. If that deploy fails, they
are not live. The README's "After the merge" section covers both.
