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
      {
        position: 1,
        text: "A single day on this world lasts longer than its entire year, and it spins backward compared to most of its neighbors.",
      },
      {
        position: 2,
        text: "Even though it is not the closest planet to the Sun, its dense carbon-dioxide atmosphere traps so much heat that its surface can melt lead.",
      },
      {
        position: 3,
        text: "Roughly Earth's twin in size, it is the brightest natural object in our night sky after the Moon.",
      },
      {
        position: 4,
        text: "Named for the Roman goddess of love, it is the second planet from the Sun.",
      },
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
      {
        position: 1,
        text: "Though she ruled Egypt, she came from a Greek-speaking Macedonian dynasty and was reportedly the first of her line to learn the Egyptian language.",
      },
      {
        position: 2,
        text: "She lived closer in time to the first Moon landing than to the building of the Great Pyramid of Giza.",
      },
      {
        position: 3,
        text: "Her relationships with two powerful Romans, Julius Caesar and Mark Antony, helped decide the fate of the Roman Republic.",
      },
      {
        position: 4,
        text: "The last active ruler of the Ptolemaic Kingdom, she is said by legend to have died from the bite of an asp.",
      },
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
      {
        position: 1,
        text: "It has three hearts and blue, copper-based blood, and at least one of those hearts stops beating when it swims, which tires it out and is partly why it prefers to crawl.",
      },
      {
        position: 2,
        text: "It can change color and texture in an instant and squeeze its entire body through any gap larger than its only hard part, its beak.",
      },
      {
        position: 3,
        text: "Some species can detach an arm to escape a predator and grow it back, and most of their neurons live in the arms rather than a central brain.",
      },
      {
        position: 4,
        text: "This eight-armed cephalopod is a famously clever ocean animal, a close relative of the squid and cuttlefish.",
      },
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
      {
        position: 1,
        text: "George Washington was sworn in as the first U.S. president here in 1789, when it briefly served as the nation's capital.",
      },
      {
        position: 2,
        text: "It is the most populous city in its country, yet it is not even the capital of its own state. That title belongs to Albany.",
      },
      {
        position: 3,
        text: "Its five boroughs include Brooklyn, Queens, and the Bronx, and its harbor processed millions of arriving immigrants at Ellis Island.",
      },
      {
        position: 4,
        text: "Home to the Statue of Liberty, Times Square, and Central Park, it is nicknamed \"the Big Apple.\"",
      },
    ],
    decoys: [
      { text: "Philadelphia", eliminatedByClue: 2 },
      { text: "Washington D.C.", eliminatedByClue: 2 },
      { text: "Boston", eliminatedByClue: 2 },
    ],
  },
];
