/**
 * Generation prompt (handoff spec §3.5) with the four worked examples as
 * few-shots. Structured output enforces the JSON shape at the API layer.
 */

export const GENERATE_SYSTEM = `You write trivia questions for a progressive-clue game. A question is one ANSWER revealed through 4 clues ordered from hardest and most obscure (clue 1) to an easy giveaway (clue 4), plus 2 to 3 decoys.

Hard rules:
- Use ONLY facts supported by the SOURCE text provided. Do not use outside knowledge for any factual claim. If you cannot support a clue from SOURCE, do not write it.
- Every clue must be true of the ANSWER.
- Clues 1 and 2 should each also be plausibly true of one or two well-known decoys, creating a fair misdirect. Never write a false or misleading clue.
- Each clue after the first must eliminate a decoy or add recognizability.
- Clue 4 must be gettable by a casual player. Clue 1 should be a surprising fact.
- No clue may contain the ANSWER or an obvious derivative of it.
- State required precision (1939 vs September 1, 1939).
- Decoys are well-known WRONG answers the early clues point toward. Tag each with the clue number that rules it out. These double as multiple-choice distractors.
- Also produce answer aliases: common abbreviations, alternate spellings, short forms a player might type ("New York City" -> "NYC", "New York").`;

export const GENERATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "category", "difficulty", "clues", "decoys", "aliases"],
  properties: {
    answer: { type: "string" },
    category: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    clues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["position", "text"],
        properties: {
          position: { type: "integer" },
          text: { type: "string" },
        },
      },
    },
    decoys: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "eliminated_by_clue"],
        properties: {
          text: { type: "string" },
          eliminated_by_clue: { type: "integer" },
        },
      },
    },
    aliases: { type: "array", items: { type: "string" } },
  },
} as const;

interface FewShot {
  user: string;
  assistant: string;
}

/** The four hand-checked worked examples from spec §2.3. */
export const FEW_SHOTS: FewShot[] = [
  {
    user: "ANSWER: Venus\nSOURCE (Wikipedia): Venus is the second planet from the Sun ... [abridged for few-shot]",
    assistant: JSON.stringify({
      answer: "Venus",
      category: "Space",
      difficulty: "easy",
      clues: [
        { position: 1, text: "A single day on this world lasts longer than its entire year, and it spins backward compared to most of its neighbors." },
        { position: 2, text: "Even though it is not the closest planet to the Sun, its dense carbon-dioxide atmosphere traps so much heat that its surface can melt lead." },
        { position: 3, text: "Roughly Earth's twin in size, it is the brightest natural object in our night sky after the Moon." },
        { position: 4, text: "Named for the Roman goddess of love, it is the second planet from the Sun." },
      ],
      decoys: [
        { text: "Mercury", eliminated_by_clue: 2 },
        { text: "Mars", eliminated_by_clue: 3 },
      ],
      aliases: [],
    }),
  },
  {
    user: "ANSWER: Cleopatra\nSOURCE (Wikipedia): Cleopatra VII Thea Philopator was Queen of the Ptolemaic Kingdom of Egypt ... [abridged for few-shot]",
    assistant: JSON.stringify({
      answer: "Cleopatra",
      category: "History",
      difficulty: "medium",
      clues: [
        { position: 1, text: "Though she ruled Egypt, she came from a Greek-speaking Macedonian dynasty and was reportedly the first of her line to learn the Egyptian language." },
        { position: 2, text: "She lived closer in time to the first Moon landing than to the building of the Great Pyramid of Giza." },
        { position: 3, text: "Her relationships with two powerful Romans, Julius Caesar and Mark Antony, helped decide the fate of the Roman Republic." },
        { position: 4, text: "The last active ruler of the Ptolemaic Kingdom, she is said by legend to have died from the bite of an asp." },
      ],
      decoys: [
        { text: "Nefertiti", eliminated_by_clue: 1 },
        { text: "Hatshepsut", eliminated_by_clue: 1 },
      ],
      aliases: ["Cleopatra VII"],
    }),
  },
  {
    user: "ANSWER: Octopus\nSOURCE (Wikipedia): An octopus is a soft-bodied, eight-limbed mollusc of the order Octopoda ... [abridged for few-shot]",
    assistant: JSON.stringify({
      answer: "Octopus",
      category: "Animals",
      difficulty: "medium",
      clues: [
        { position: 1, text: "It has three hearts and blue, copper-based blood, and at least one of those hearts stops beating when it swims, which tires it out and is partly why it prefers to crawl." },
        { position: 2, text: "It can change color and texture in an instant and squeeze its entire body through any gap larger than its only hard part, its beak." },
        { position: 3, text: "Some species can detach an arm to escape a predator and grow it back, and most of their neurons live in the arms rather than a central brain." },
        { position: 4, text: "This eight-armed cephalopod is a famously clever ocean animal, a close relative of the squid and cuttlefish." },
      ],
      decoys: [
        { text: "Squid", eliminated_by_clue: 4 },
        { text: "Cuttlefish", eliminated_by_clue: 4 },
        { text: "Nautilus", eliminated_by_clue: 2 },
      ],
      aliases: ["octopuses", "octopi"],
    }),
  },
  {
    user: "ANSWER: New York City\nSOURCE (Wikipedia): New York, often called New York City (NYC), is the most populous city in the United States ... [abridged for few-shot]",
    assistant: JSON.stringify({
      answer: "New York City",
      category: "Cities",
      difficulty: "easy",
      clues: [
        { position: 1, text: "George Washington was sworn in as the first U.S. president here in 1789, when it briefly served as the nation's capital." },
        { position: 2, text: "It is the most populous city in its country, yet it is not even the capital of its own state. That title belongs to Albany." },
        { position: 3, text: "Its five boroughs include Brooklyn, Queens, and the Bronx, and its harbor processed millions of arriving immigrants at Ellis Island." },
        { position: 4, text: 'Home to the Statue of Liberty, Times Square, and Central Park, it is nicknamed "the Big Apple."' },
      ],
      decoys: [
        { text: "Philadelphia", eliminated_by_clue: 2 },
        { text: "Washington D.C.", eliminated_by_clue: 2 },
        { text: "Boston", eliminated_by_clue: 2 },
      ],
      aliases: ["NYC", "New York"],
    }),
  },
];

export function buildGenerateUser(input: {
  answer: string;
  extract: string;
  groupedClues: string[];
  frequency: number;
  typicalValue: number;
}): string {
  return [
    `ANSWER: ${input.answer}`,
    `SOURCE (Wikipedia): ${input.extract}`,
    `ADDITIONAL VETTED FACTS (past trivia clues about this answer): ${input.groupedClues.slice(0, 30).join(" | ")}`,
    `DIFFICULTY SIGNAL: appeared ${input.frequency} times; typical value ${input.typicalValue}`,
  ].join("\n");
}
