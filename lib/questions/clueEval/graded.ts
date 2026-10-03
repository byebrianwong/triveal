/**
 * Brian's grades: the test set for the clue-quality judge.
 *
 * `pnpm eval-clues --graded` runs the judge on each case and reports how many
 * checks it agrees with. Agreement here is what tells you whether the bank
 * report can be trusted, so check it after any change to rubric.ts or to the
 * rules in lib/questions/README.md.
 *
 * Only record what Brian actually said or clearly agreed with. A check that
 * guesses at his taste tests the guess, not the judge.
 *
 * Grading session 1 (2026-10-03): six bank questions plus two rewritten
 * first clues he approved. All six questions fell short of the standard, so
 * there is no whole question here yet that he graded as good. Positive
 * examples are single clues. Grading a few questions he likes as they are
 * would make the "verdict" agreement mean much more.
 */

import type { GradedCase } from "./score";

export const GRADED_CASES: GradedCase[] = [
  {
    id: "star-wars",
    said: "'Glowing laser swords' is too much of a giveaway. A player rated the question 'too easy'.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-too-easy", clue: 1 },
      { kind: "clue-too-easy", clue: 2 },
    ],
  },
  {
    id: "wizard-of-oz",
    said: "Clue 2 is way too obvious, and basically just a summary. That's not interesting.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-too-easy", clue: 1 },
      { kind: "clue-too-easy", clue: 2 },
      { kind: "clue-weak", clue: 2 },
    ],
  },
  {
    id: "wizard-of-oz",
    variant: "silver-shoes",
    replaceClues: {
      1: "The book's magic shoes were silver; the film changed their color to show off a new color process.",
    },
    said: "A good rewrite of clue 1. That's an interesting fact.",
    expect: [{ kind: "clue-good", clue: 1 }],
  },
  {
    id: "boxing",
    said: "Clue 1 is a good first clue already. Clue 2 is way too obvious, and it's not an interesting fact.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      // Checked: Norway's parliament ended its 33-year ban in December 2014.
      { kind: "clue-fact-ok", clue: 1 },
      { kind: "clue-too-easy", clue: 2 },
      { kind: "clue-weak", clue: 2 },
    ],
  },
  {
    id: "benjamin-franklin",
    said: "Agreed that clue 4 repeats clue 1 (the $100 bill, never president), and approved replacing clue 1.",
    expect: [{ kind: "verdict-not-good" }, { kind: "repeat-pair", clues: [1, 4] }],
  },
  {
    id: "benjamin-franklin",
    variant: "four-documents",
    replaceClues: {
      1: "He was the only founder to sign all four of these: the Declaration of Independence, the alliance with France, the peace treaty with Britain and the Constitution.",
    },
    said: "That's a good rewrite clue.",
    expect: [
      { kind: "clue-good", clue: 1 },
      { kind: "no-repeat-pair", clues: [1, 4] },
    ],
  },
  {
    id: "burj-khalifa",
    said: "Good first clue already. Clue 2 needs a bit more, like who designed it. Something interesting.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-weak", clue: 2 },
    ],
  },
  {
    id: "among-us",
    said: "These clues say the same thing too much: that it became a phenomenon, and how the game works, spread over four clues. There should be some other interesting clue in there.",
    expect: [{ kind: "verdict-not-good" }, { kind: "repetitive" }],
  },
];
