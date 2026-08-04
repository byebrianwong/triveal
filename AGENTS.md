<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Writing questions

Adding or editing questions in the bank? Read
[`lib/questions/README.md`](lib/questions/README.md) first — all of it. The
rules that matter are not guessable from the types: the no-leak rule matches
substrings and strips leading articles, decoys are matched before the answer
so a near-miss decoy makes the *right* answer fail, and neither the app nor
CI syncs new questions to the live database.
