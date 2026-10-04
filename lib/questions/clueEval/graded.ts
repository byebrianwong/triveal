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
 * Grading session 1 (2026-10-03, in chat): six bank questions plus two
 * rewritten first clues he approved. All six fell short of the standard.
 *
 * Grading session 2 (2026-10-03, on a grading page): ten more questions. He
 * gave each clue a tag (good, too easy, dull, fact?) and most questions a
 * verdict. Four are "ship as is", the first whole questions graded good.
 * Clue 4 tags of "good" aren't checked: clue 4 is allowed to give the
 * answer away, so "good" there doesn't map onto the judge's scores. Where
 * he left the verdict blank, there's no verdict check.
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

  // Session 2: the grading page.
  ...[
    "hubble-space-telescope",
    "hagia-sophia",
    "stapes",
  ].map(
    (id): GradedCase => ({
      id,
      said: "Ship as is. Tagged every clue good.",
      expect: [
        { kind: "verdict-good" },
        { kind: "clue-good", clue: 1 },
        { kind: "clue-good", clue: 2 },
        { kind: "clue-good", clue: 3 },
      ],
    }),
  ),
  {
    id: "corpse-flower",
    said: "Ship as is. Tagged every clue good. 'The 3rd clue should maybe be the first clue? It's less direct than the first clue.'",
    expect: [
      { kind: "verdict-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
    ],
  },
  {
    id: "parasite-film",
    said: "Needs work. Clue 1 good, clues 2 and 3 dull.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-dull", clue: 2 },
      { kind: "clue-dull", clue: 3 },
    ],
  },
  {
    id: "speed-of-light",
    said: "Needs work. Clues 1 and 2 too easy, clue 3 good. 'Third clue is a little weirdly worded.'",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-too-easy", clue: 1 },
      { kind: "clue-too-easy", clue: 2 },
      { kind: "clue-good", clue: 3 },
    ],
  },
  {
    id: "elden-ring",
    said: "Clues 1-3 good, clue 4 dull. Clue 1 should say 'this game', not 'it'. 'The last clue says Elden in the clue.'",
    expect: [
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
      { kind: "clue-names-answer", clue: 4 },
    ],
  },
  {
    id: "pickleball",
    said: "Every clue good. The family-dog fact in clue 4 is less known than clue 1's plastic ball; swap them.",
    expect: [
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
    ],
  },
  {
    id: "the-great-wave-off-kanagawa",
    said: "Every clue good. Clue 1's 'Its' isn't descriptive enough ('This print's striking blue…'). Clue 4 is worded differently from the rest.",
    expect: [
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
    ],
  },
  {
    id: "the-odyssey",
    // He tagged clues 1 and 2 good but also called them "more just facts /
    // summary", so only clue 3 is checked.
    said: "Every clue tagged good, but 'the 4th might actually be less direct than the first? (first and second clues are more just facts / summary?)'",
    expect: [{ kind: "clue-good", clue: 3 }],
  },
];
