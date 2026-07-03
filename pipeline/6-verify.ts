/**
 * Stage 6: grounded verification (spec §3.6). Each clue is checked against
 * the SOURCE extract — never against model memory. Decision rule:
 *   any clue unsupported or leaking  -> rejected
 *   any clue ambiguous               -> needs_review (human)
 *   all clues pass                   -> verified
 *
 *   ANTHROPIC_API_KEY=... pnpm pipeline pipeline/6-verify.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { readJson, writeJson, type ContextBundle, type GeneratedQuestion, type VerifiedQuestion } from "./lib";
import { buildVerifyUser, VERIFY_SCHEMA, VERIFY_SYSTEM } from "./prompts/verify";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required.");
  process.exit(1);
}

// A stronger model for the checking pass (spec: "use a stronger model or
// human spot-review").
const MODEL = process.env.CLUEDOWN_VERIFY_MODEL ?? "claude-opus-4-8";

const client = new Anthropic();
const generated = readJson<GeneratedQuestion[]>("generated.json");
const extracts = new Map(
  readJson<ContextBundle[]>("context.json").map((b) => [b.wikipediaTitle, b.extract]),
);

const verified: VerifiedQuestion[] = [];

for (const question of generated) {
  const extract = extracts.get(question.wikipediaTitle);
  if (!extract) continue;

  const verification: VerifiedQuestion["verification"] = [];
  for (const clue of question.clues) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: VERIFY_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: VERIFY_SCHEMA } },
      messages: [
        {
          role: "user",
          content: buildVerifyUser({ answer: question.answer, clue: clue.text, extract }),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    const result = JSON.parse(text) as {
      supported: boolean;
      leaks_answer: boolean;
      ambiguous: boolean;
      notes: string;
    };
    verification.push({
      position: clue.position,
      supported: result.supported,
      leaksAnswer: result.leaks_answer,
      ambiguous: result.ambiguous,
      notes: result.notes,
    });
  }

  const anyBad = verification.some((v) => !v.supported || v.leaksAnswer);
  const anyAmbiguous = verification.some((v) => v.ambiguous);
  const status = anyBad ? "rejected" : anyAmbiguous ? "needs_review" : "verified";
  verified.push({ ...question, status, verification });
  console.error(`${status}: ${question.answer}`);
}

const counts = verified.reduce<Record<string, number>>((acc, q) => {
  acc[q.status] = (acc[q.status] ?? 0) + 1;
  return acc;
}, {});
console.error(JSON.stringify(counts));
writeJson("verified.json", verified);
