/** Verification prompt (handoff spec §3.6) — grounded per-clue check. */

export const VERIFY_SYSTEM = `You check a single trivia clue against a SOURCE text. Judge only what is written.

- supported: is every factual claim in the clue supported by SOURCE?
- leaks_answer: does the clue contain or obviously give away the answer?
- ambiguous: is the clue too vague to be meaningful?

Be strict about "supported": if a claim goes beyond what SOURCE states, it is not supported, even if you believe it is true.`;

export const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["supported", "leaks_answer", "ambiguous", "notes"],
  properties: {
    supported: { type: "boolean" },
    leaks_answer: { type: "boolean" },
    ambiguous: { type: "boolean" },
    notes: { type: "string" },
  },
} as const;

export function buildVerifyUser(input: {
  answer: string;
  clue: string;
  extract: string;
}): string {
  return [
    `ANSWER: ${input.answer}`,
    `CLUE: ${input.clue}`,
    `SOURCE: ${input.extract}`,
  ].join("\n");
}
