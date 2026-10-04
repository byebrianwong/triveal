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

/**
 * The clues each question had when Brian graded it. All of these questions
 * were rewritten on 2026-10-04 (pipeline/fix-clues.ts), so the grades below
 * apply to these texts, not to the bank's current clues.
 */
const GRADED_CLUES: Record<string, string[]> = {
  "star-wars": [
    "Its opening words scroll up the screen and into the distance: 'A long time ago in a galaxy far, far away.'",
    "In it, a farm boy, a smuggler, and a princess battle an evil Empire wielding glowing laser swords.",
    "George Lucas created this space saga, whose villain breathes heavily behind a black mask: Darth Vader.",
    "In this franchise, Luke Skywalker learns to use 'the Force,' aided by Yoda and the droids R2-D2 and C-3PO.",
  ],
  "wizard-of-oz": [
    "In this movie, a twister carries a Kansas farm girl and her dog Toto over the rainbow to a Technicolor land.",
    "In it, Dorothy follows a yellow brick road, gaining a scarecrow, a tin man, and a cowardly lion along the way.",
    "She seeks a humbug 'great and powerful' ruler hiding behind a curtain in an Emerald City.",
    "In this 1939 musical, ruby slippers and the chant 'There's no place like home' send Dorothy back to Kansas.",
  ],
  "boxing": [
    "Sweden banned its professional form in 1970, and Norway kept a similar ban in place until 2014.",
    "In it, two fighters in padded gloves trade punches inside a roped-off square, confusingly called a ring.",
    "Its bouts are split into timed rounds, won on points or by a knockout that ends things early.",
    "Weight classes from flyweight to heavyweight define this combat sport of the jab and uppercut.",
  ],
  "benjamin-franklin": [
    "One of America's most important founders, he never became president — yet his face is on its largest common bill.",
    "He flew a kite in a thunderstorm to study electricity, then invented the lightning rod and bifocal glasses.",
    "A printer, writer, and diplomat, he helped draft the Declaration of Independence and won France's aid in the Revolution.",
    "This bespectacled polymath grins from the U.S. hundred-dollar bill, though he never held the presidency.",
  ],
  "burj-khalifa": [
    "Its spire is so tall that people on its lower floors break their Ramadan fast minutes before those on top.",
    "Opened in 2010, it has been the tallest building in the world ever since, topping 2,700 feet.",
    "It pierces the skyline of Dubai and featured in a Tom Cruise 'Mission: Impossible' stunt.",
    "This needle-like skyscraper in the United Arab Emirates has more than 160 floors.",
  ],
  "among-us": [
    "It languished for two years after release, then exploded in 2020 as a pandemic hit.",
    "In it, crewmates aboard a cartoon spaceship complete tasks while secret impostors pick them off.",
    "Its players call emergency meetings to argue over who is the 'sus' saboteur and vote them out.",
    "Its bean-shaped little astronauts made this social-deduction game a streaming phenomenon.",
  ],
  "hubble-space-telescope": [
    "Its main mirror was ground wrong by about one-fiftieth the width of a human hair, and the first pictures came back blurred.",
    "Spacewalking astronauts fitted it with corrective optics in 1993 — the equivalent of handing it glasses — and went back to service it four more times.",
    "Pointed at an apparently empty speck of sky for ten days, it found thousands of galaxies in the Deep Field image.",
    "Orbiting 540 km up since 1990, this observatory is named for the astronomer who showed the universe is expanding.",
  ],
  "hagia-sophia": [
    "For close to a thousand years no building on Earth enclosed more space under one roof.",
    "Finished in 537 after only five years' work, its dome appears to float on a ring of forty windows; a bored Viking guard scratched runes into a gallery railing.",
    "Christian mosaics share the walls with vast Arabic calligraphy roundels, because it has been a cathedral, then a mosque, then a museum, and since 2020 a mosque again.",
    "Justinian's great domed church in Istanbul, whose Greek name means 'Holy Wisdom'.",
  ],
  "stapes": [
    "It is roughly the size of a grain of rice, and no bone in your body is smaller.",
    "Its name is Latin for the footrest a horse rider slips a boot into, which its arched shape resembles.",
    "It passes vibrations from its neighbor, the incus, into the fluid-filled cochlea through the oval window.",
    "The last and tiniest of the three ossicles of the middle ear, after the hammer and the anvil.",
  ],
  "corpse-flower": [
    "When it opens, it heats itself up to help its smell of rotting meat travel farther.",
    "It can take seven years or more to bloom, and the bloom lasts only a day or two, so botanical gardens announce it and crowds line up.",
    "Native to the rainforests of Sumatra, it sends up the world's largest unbranched flower spike, which can stand taller than a person.",
    "The giant Sumatran bloom nicknamed for the dead-body stench it gives off to lure carrion beetles and flies.",
  ],
  "parasite-film": [
    "It was the first film not in English to win the Academy Award for Best Picture.",
    "In it, a poor family cons its way into working for a wealthy household, one job at a time.",
    "This South Korean thriller hides a shocking secret in the rich family's basement.",
    "Bong Joon-ho's 2019 class satire takes its name from an organism that feeds off a host.",
  ],
  "speed-of-light": [
    "Einstein built his theory of relativity on the rule that nothing can exceed it.",
    "It is the universe's ultimate limit, roughly 300,000 kilometers every second in a vacuum.",
    "Because it is finite, distant stars we see may have died long ago; their glow is only now arriving.",
    "Physicists label this cosmic top speed with the letter c.",
  ],
  "elden-ring": [
    "A famously punishing studio handed its world-building to the author of A Song of Ice and Fire.",
    "Its open world is called the Lands Between, and dying over and over is the intended way to learn it.",
    "FromSoftware released it in 2022 under director Hidetaka Miyazaki, and it took Game of the Year.",
    "Tarnished warriors seek to mend a shattered relic and become Elden Lord in FromSoftware's open-world epic.",
  ],
  "pickleball": [
    "Three bored fathers on a Washington island invented it in 1965 out of table-tennis paddles and a perforated plastic ball.",
    "It has been the fastest-growing sport in the United States for several years running, especially among older players.",
    "It is played on a badminton-sized court with a lowered net, and the no-volley zone at the net is called the kitchen.",
    "The paddle sport played with a wiffle ball, whose name is often credited to a family dog.",
  ],
  "the-great-wave-off-kanagawa": [
    "Its striking blue came from Prussian blue, a synthetic pigment newly imported to Japan from Europe.",
    "As a woodblock print it was pressed thousands of times, so dozens of museums around the world own an original.",
    "It opens Hokusai's series 'Thirty-six Views of Mount Fuji,' with the snowy peak tiny in the distance.",
    "The Japanese print of a towering, claw-tipped breaker about to crash down on three fishing boats.",
  ],
  "the-odyssey": [
    "Its hero blinds a one-eyed giant, then foolishly shouts his own name and earns a sea god's wrath.",
    "Its long voyage home features a witch named Circe, the deadly Sirens, and the whirlpool Charybdis.",
    "Attributed to the Greek poet Homer, this epic follows Odysseus's ten-year journey back from the Trojan War.",
    "Its title, drawn from the hero's name, has become a word for any long, wandering adventure.",
  ],
};

const CASES: GradedCase[] = [
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

  // Session 2: the grading page. He first marked these four "ship as is",
  // then decided style problems (a bare "It" opener, a fragment clue 4) mean
  // needs work, and agreed with the judge's catches noted below.
  {
    id: "hubble-space-telescope",
    said: "Tagged every clue good. Later: style problems mean needs work, and agreed clues 1 and 2 both tell the mirror story.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
      { kind: "repeat-pair", clues: [1, 2] },
    ],
  },
  {
    id: "hagia-sophia",
    // He also agreed clue 1's "no building enclosed more space" claim needs
    // fixing (usually stated as "largest cathedral"). Unverified, so no check.
    said: "Tagged every clue good. Later: style problems mean needs work, and agreed clue 1's claim needs fixing.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
    ],
  },
  {
    id: "stapes",
    said: "Tagged every clue good. Later: style problems mean needs work, and agreed clue 4 repeats clue 1's 'smallest bone'.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
      { kind: "repeat-pair", clues: [1, 4] },
    ],
  },
  {
    id: "corpse-flower",
    said: "Tagged every clue good; 'the 3rd clue should maybe be the first'. Later: style problems mean needs work, and agreed clue 4 repeats the smell from clue 1.",
    expect: [
      { kind: "verdict-not-good" },
      { kind: "clue-good", clue: 1 },
      { kind: "clue-good", clue: 2 },
      { kind: "clue-good", clue: 3 },
      { kind: "repeat-pair", clues: [1, 4] },
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

export const GRADED_CASES: GradedCase[] = CASES.map((c) => ({ clues: GRADED_CLUES[c.id], ...c }));
