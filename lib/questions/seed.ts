/**
 * Public sample questions — the four worked examples from the product spec,
 * already published there (no spoiler risk). The rest of the hand-verified
 * bank lives in the gitignored lib/questions/private-bank.json, which the
 * server merges in automatically when present. This bank backs the app until the offline
 * pipeline fills Supabase; it also serves as the fallback data source when
 * no Supabase env is configured.
 *
 * Rules honored (spec §2.2): every clue true of the answer; early clues
 * plausibly fit the decoys; each clue eliminates a decoy or adds
 * recognizability; the final clue is unambiguous; no clue contains the
 * answer or an obvious derivative.
 */

import type { Question } from "@/lib/game/types";

export const SEED_QUESTIONS: Question[] = [
  {
    id: "venus",
    answer: "Venus",
    answerCanonical: "venus",
    answerAliases: [],
    category: "Space",
    difficulty: "easy",
    clues: [
      { position: 1, text: "This planet spins so slowly that one turn on its axis takes longer than its year, and the Sun rises in the west." },
      { position: 2, text: "Even though it is not the closest planet to the Sun, its dense carbon-dioxide atmosphere traps so much heat that its surface can melt lead." },
      { position: 3, text: "Roughly Earth's twin in size, it is the brightest natural object in our night sky after the Moon." },
      { position: 4, text: "Named for the Roman goddess of love, it is the second planet from the Sun." },
    ],
    decoys: [
      { text: "Mercury", eliminatedByClue: 2 },
      { text: "Mars", eliminatedByClue: 3 },
    ],
  },
  {
    id: "cleopatra",
    answer: "Cleopatra",
    answerCanonical: "cleopatra",
    answerAliases: ["Cleopatra VII"],
    category: "History",
    difficulty: "medium",
    clues: [
      { position: 1, text: "This ruler of Macedonian Greek descent seldom needed an interpreter with foreign peoples, Plutarch wrote, and was the first of her dynasty known to learn Egyptian." },
      { position: 2, text: "She lived closer in time to the first Moon landing than to the building of the Great Pyramid of Giza." },
      { position: 3, text: "In keeping with family custom, she shared her throne with two of her younger brothers in turn, and was wed to at least one of them." },
      { position: 4, text: "The last active ruler of the Ptolemaic Kingdom, she is said by legend to have died from the bite of an asp." },
    ],
    decoys: [
      { text: "Nefertiti", eliminatedByClue: 1 },
      { text: "Hatshepsut", eliminatedByClue: 1 },
    ],
  },
  {
    id: "octopus",
    answer: "Octopus",
    answerCanonical: "octopus",
    answerAliases: ["octopuses", "octopi"],
    category: "Animals",
    difficulty: "medium",
    clues: [
      { position: 1, text: "A deep-sea female of this animal was watched guarding her eggs for 53 months off California, the longest brooding known for any animal." },
      { position: 2, text: "In Indonesia, one species of this animal gathers discarded coconut-shell halves, carries them across the seabed and shuts itself inside them when threatened." },
      { position: 3, text: "After a 2021 government-commissioned review, the UK extended its animal sentience law to cover this animal, along with crabs and lobsters." },
      { position: 4, text: "This eight-armed cephalopod is a famously clever ocean animal, a close relative of the squid and cuttlefish." },
    ],
    decoys: [
      { text: "Squid", eliminatedByClue: 4 },
      { text: "Cuttlefish", eliminatedByClue: 4 },
      { text: "Nautilus", eliminatedByClue: 2 },
    ],
  },
  {
    id: "new-york-city",
    answer: "New York City",
    answerCanonical: "new york city",
    answerAliases: ["NYC", "New York"],
    category: "Cities",
    difficulty: "easy",
    clues: [
      { position: 1, text: "This city was the nation's capital when George Washington was sworn in here as the first U.S. president in 1789." },
      { position: 2, text: "It is the most populous city in its country, yet it is not even the capital of its own state." },
      { position: 3, text: "A 1626 Dutch letter reports that settlers bought the island at its heart from Native people for goods worth 60 guilders." },
      { position: 4, text: "Home to the Statue of Liberty, Times Square, and Central Park, it is nicknamed \"the Big Apple.\"" },
    ],
    decoys: [
      { text: "Philadelphia", eliminatedByClue: 2 },
      { text: "Washington D.C.", eliminatedByClue: 2 },
      { text: "Boston", eliminatedByClue: 2 },
    ],
  },
];
