/**
 * Stage 5: generate questions from context bundles (spec §3.5).
 * One structured-output API call per answer; the model's job is selection,
 * ordering, phrasing, and decoy design — not recall.
 *
 *   ANTHROPIC_API_KEY=... pnpm pipeline pipeline/5-generate.ts [--limit 50]
 */

import Anthropic from "@anthropic-ai/sdk";
import { readJson, writeJson, normalizeAnswer, type ContextBundle, type GeneratedQuestion } from "./lib";
import { buildGenerateUser, FEW_SHOTS, GENERATE_SCHEMA, GENERATE_SYSTEM } from "./prompts/generate";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required (pipeline only — the live app never needs it).");
  process.exit(1);
}

// Sonnet-class for batch volume per the handoff spec §3.5.
const MODEL = process.env.CLUEDOWN_GENERATE_MODEL ?? "claude-sonnet-5";
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 50;

const client = new Anthropic();
const bundles = readJson<ContextBundle[]>("context.json")
  .filter((b) => b.confidence === "high")
  .slice(0, LIMIT);

const fewShotMessages: Anthropic.MessageParam[] = FEW_SHOTS.flatMap((shot) => [
  { role: "user" as const, content: shot.user },
  { role: "assistant" as const, content: shot.assistant },
]);

const generated: GeneratedQuestion[] = [];

for (const [i, bundle] of bundles.entries()) {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        { type: "text", text: GENERATE_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      output_config: { format: { type: "json_schema", schema: GENERATE_SCHEMA } },
      messages: [
        ...fewShotMessages,
        {
          role: "user",
          content: buildGenerateUser({
            answer: bundle.answer,
            extract: bundle.extract,
            groupedClues: bundle.clues,
            frequency: bundle.frequency,
            typicalValue: bundle.typicalValue,
          }),
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      console.error(`refused: ${bundle.answer}`);
      continue;
    }
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as Omit<GeneratedQuestion, "canonical" | "wikipediaTitle">;
    generated.push({
      ...parsed,
      canonical: normalizeAnswer(parsed.answer),
      wikipediaTitle: bundle.wikipediaTitle,
    });
    console.error(`generated ${i + 1}/${bundles.length}: ${bundle.answer}`);
  } catch (err) {
    console.error(`failed "${bundle.answer}": ${(err as Error).message}`);
  }
}

console.error(`${generated.length} generated`);
writeJson("generated.json", generated);
