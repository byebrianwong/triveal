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
 *
 * Grading session 3 (2026-10-15, on a grading page): ten questions the judge
 * called good, five it scored highest and five lowest, with the scores
 * hidden. He marked seven "ship as is" and tagged no single clues. For
 * comet he asked whether "long-period" is a real thing and said that if it
 * is, the question is fine; it is (an orbit longer than 200 years), so it
 * counts as ship. He left kyoto and the-dress without a verdict: his notes
 * there are about whether hanafuda cards are too obscure and whether "The
 * Dress" is a specific enough answer, so they carry no check.
 *
 * Grading session 4 (2026-10-16, on a grading page): the 14 questions the
 * judge rated "needs work", with each answer hidden until he chose to show it.
 * He marked six "ship as is" and eight "needs work", and wrote notes instead
 * of tagging clues. Five of the six he'd ship were held back only because the
 * judge rated clue 3 instant. Where he said a clue still makes you think,
 * there's a clue-not-too-easy check. His koala grade (ship as is) isn't
 * recorded: the house rules use the koala and its clue 1 as their example,
 * and a graded question must not appear in the rules the judge reads.
 *
 * Grading session 5 (2026-10-16, playing the live site): he rated five rounds
 * with the post-round faces and wrote "too easy" on three of them. These are
 * grades from playing, not from reading, so there are no per-clue tags and no
 * note on which clue gave it away. All three were questions the judge had
 * rated good with no clue called instant, so they are the first cases where he
 * is harsher than the judge. The meerkat round he rated good; the olympic-games
 * round he rated okay, which is neither verdict, so it carries no check.
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
  "wright-brothers": [
    "These inventors' key insight was 'wing warping', twisting the wingtips in opposite directions to keep balance and turn in the air.",
    "Neither of them ever married, and they tossed a coin to decide which would make the first attempt at powered flight.",
    "They ran a bicycle shop in Dayton, Ohio, and paid for their flying experiments with its profits.",
    "These two American brothers, Wilbur and Orville, built and flew the world's first successful airplane.",
  ],
  skeleton: [
    "More than half of this body system's parts are found in the hands and feet.",
    "This body system's hyoid, a horseshoe-shaped piece in the neck, is the only one of its parts not joined to any other.",
    "In adults this body system is constantly rebuilt, with roughly a tenth of it replaced every year.",
    "A rattling one is a Halloween staple, and it is what an X-ray reveals beneath the skin.",
  ],
  meerkat: [
    "In a group of these animals, one dominant female has most of the pups, and while pregnant she may drive pregnant rivals out of the group for weeks.",
    "This animal has dark patches around its eyes that cut the glare of the southern African desert sun.",
    "Adults of this animal teach their pups to eat scorpions, first handing them dead ones, then live ones with the stinger removed.",
    "Timon, the wisecracking sidekick in Disney's 'The Lion King', is one of these animals.",
  ],
  pixar: [
    "This studio began in 1979 as the Graphics Group of Lucasfilm's computer division and was spun off in 1986 with $10 million from Steve Jobs.",
    "This studio hides the code A113, a classroom number at the CalArts art school, in nearly every one of its feature films.",
    "This studio's 1988 short 'Tin Toy,' about a wind-up one-man band, became the first computer-animated film to win an Academy Award.",
    "This Emeryville, California, animation studio, behind 'Toy Story,' 'Up' and 'WALL-E,' was bought by Disney in 2006.",
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
  // Session 3: the grading page, judge-"good" questions only. The clues are
  // the texts he saw; zebra and super-mario-bros changed in the bank after
  // the fact check.
  {
    id: "zebra",
    clues: [
      "A group of these African grazers is called a 'dazzle', and one species is named after Jules Grévy, a French president who received one as a gift from Abyssinia in the 1880s.",
      "In a 2019 study, biting horseflies struggled to land on this animal, failing to slow down as they neared its patterned coat.",
      "This wild cousin of the horse has never been truly domesticated, though the zoologist Walter Rothschild drove a carriage pulled by them to Buckingham Palace.",
      "This striped, horse-like grazer roams the African plains in herds, often mixed in with wildebeest.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "giant-sequoia",
    clues: [
      "This tree's spongy bark can be two feet thick, armor against the wildfires that help its seeds sprout.",
      "It grows naturally only in scattered groves on the western slopes of California's Sierra Nevada.",
      "It is not the tallest tree — its coastal cousin is — but the most massive single tree on Earth, General Sherman, is one.",
      "This colossal red-barked conifer gives a California national park its name.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "black-mirror",
    clues: [
      "Jodie Foster directed an episode of this anthology series in which a worried mother has a monitoring chip implanted in her young daughter's brain.",
      "This show's 2013 episode about a woman who talks to an AI copy of her dead boyfriend was a partial influence on the chatbot app Replika.",
      "This show's very first episode, aired in 2011, has a kidnapper demand that the British prime minister have sex with a pig on live TV.",
      "Named for the blank screen of a switched-off device, this anthology includes 'San Junipero' and 'Nosedive'.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "rocky",
    clues: [
      "This film beat 'Taxi Driver' and 'Network' for the Best Picture Oscar.",
      "Its star wrote the first draft in three and a half days and refused to sell the script unless he could play the lead.",
      "Its theme, Bill Conti's 'Gonna Fly Now,' topped the Billboard Hot 100 in July 1977.",
      "This 1976 Sylvester Stallone film is famous for its training run up the steps of the Philadelphia Museum of Art.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "earwax",
    clues: [
      "This substance was recommended as a balm for cracked lips by Lydia Maria Child's popular 19th-century household guide, The American Frugal Housewife.",
      "In baleen whales this builds up for a lifetime in layers like tree rings, so scientists slice the plugs open to read a whale's age and stress hormones.",
      "A single letter of DNA in one gene decides whether yours is sticky and brown or dry and crumbly, and the same gene affects how much your armpits smell.",
      "Doctors warn that cotton swabs just push this sticky yellowish gunk deeper, and it usually works its way out on its own as you chew and talk.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "super-mario-bros",
    clues: [
      "This game's 'Minus World', an endless underwater level reached by slipping through a wall, was a playground rumor that turned out to be real.",
      "Its main theme, by Koji Kondo, was the first video game music added to the U.S. National Recording Registry.",
      "Released in 1985 and later bundled with the NES, it was the best-selling video game of all time for over 20 years.",
      "In this Nintendo classic, a plumber and his sibling Luigi set out to rescue Princess Peach from the spiky-shelled Bowser.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "saxophone",
    clues: [
      "This instrument was patented in 1846 for orchestras and military bands, and French army bands took it up decades before jazz made it famous.",
      "Though this instrument is made of brass, it is played with a single reed like a clarinet, so it counts as a woodwind.",
      "Jazz giants Charlie Parker, nicknamed 'Bird', and John Coltrane both made their names on this instrument.",
      "President Bill Clinton famously played this reed instrument, which comes in alto and tenor sizes.",
    ],
    said: "Ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "comet",
    clues: [
      "The name for these objects comes from a Greek word meaning 'long-haired.'",
      "Most long-period ones of these are thought to come from the Oort Cloud, a vast icy shell at the far edge of the solar system.",
      "In 2014 the European probe Rosetta set down a small lander named Philae on one of these, the first such landing ever.",
      "Halley's is the most famous of these icy visitors, returning to our skies about every 76 years.",
    ],
    said: "'What is \"long-period\"? If that's a real thing, then this is fine.' It is real, so ship as is.",
    expect: [{ kind: "verdict-good" }],
  },
  // Session 4: the grading page, the 14 questions the judge rated "needs work",
  // shown in mixed order with each answer hidden until he chose to show it. The
  // clues are the texts he saw; eight were rewritten after his grades.
  {
    id: "honey",
    clues: [
      "A rock painting in Spain's Araña Caves, thought to be about 8,000 years old, shows a figure high on a cliff gathering this food from the wild.",
      "Ancient Egyptian doctors spread this food on wounds, and it turns up in many of the remedies in their surviving medical papyri.",
      "Doctors warn against giving this food to babies under one year old because it can carry botulism spores.",
      "Golden and sticky, this natural sweetener is what Winnie-the-Pooh craves from the hive.",
    ],
    said: "Ship as is. 'The honey babies is not super well known, it's fine to keep in.'",
    expect: [{ kind: "verdict-good" }, { kind: "clue-not-too-easy", clue: 3 }],
  },
  {
    id: "great-white-shark",
    clues: [
      "A tagged female of this fish, nicknamed Nicole, swam from South Africa to Australia and back in under nine months.",
      "Warmer-bodied than most fish, it can rocket its whole body clear out of the water to ambush a seal from below.",
      "It grows and sheds thousands of serrated teeth over its life, set in replaceable rows, and no aquarium has kept one longer than 198 days.",
      "The huge predatory fish behind the movie 'Jaws,' it is named for its pale underside.",
    ],
    said: "Needs work. 'I think many people would put shark.' An early clue should hint that the full, specific name of the shark is needed.",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "chess",
    clues: [
      "This board game has more possible games than there are atoms in the observable universe; Claude Shannon put the figure at about 10 to the 120th power.",
      "This game grew out of India's chaturanga, known by the 600s, in which the piece that became its most powerful could move just one square diagonally.",
      "In 1997 an IBM computer became the first to beat this game's reigning world champion in a match at standard tournament time controls.",
      "In this two-player strategy game, each side marshals pawns, knights, bishops, rooks, a queen, and a king.",
    ],
    said: "Ship as is. 'Clue three is not instant, there's also Go, and other possible options.'",
    expect: [{ kind: "verdict-good" }, { kind: "clue-not-too-easy", clue: 3 }],
  },
  {
    id: "wheres-waldo",
    clues: [
      "This character is known as Charlie in France, Holger in Denmark and Efi in Israel.",
      "Across his first seven books, this figure's average size on the page shrank from about 0.99 to roughly 0.2 square centimeters, while the crowds hiding him grew.",
      "One crowded beach scene in this character's first book got it pulled from some US school libraries in the 1990s because of a tiny topless sunbather.",
      "This bespectacled traveler in a red-and-white striped shirt and bobble hat hides in busy double-page scenes drawn by British illustrator Martin Handford.",
    ],
    said: "Ship as is. The shrinking-size idea seems true. A clue should hint that the answer is the full title, not only the character.",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "blood",
    clues: [
      "Karl Landsteiner won the 1930 Nobel Prize in Medicine for discovering that this fluid comes in different groups.",
      "Horseshoe crabs have a blue version of this fluid, harvested to test medicines and vaccines for contamination.",
      "An adult's body holds about five liters of this fluid, and at rest the heart pumps all of it around in about a minute.",
      "Iron-rich hemoglobin gives this fluid its color as it courses through the body's arteries and veins.",
    ],
    said: "Needs work. 'It's fine to have some clues that play easy. But agree this is a little too easy.'",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "venus",
    clues: [
      "This planet spins so slowly that one turn on its axis takes longer than its year, and the Sun rises in the west.",
      "Even though it is not the closest planet to the Sun, its dense carbon-dioxide atmosphere traps so much heat that its surface can melt lead.",
      "Roughly Earth's twin in size, it is the brightest natural object in our night sky after the Moon.",
      "Named for the Roman goddess of love, it is the second planet from the Sun.",
    ],
    said: "Ship as is. 'This is fine.'",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "frozen",
    clues: [
      "This was the first film from Walt Disney Animation Studios to win the Oscar for Best Animated Feature.",
      "This film's queen began as a villain, until a power ballad written for her led the director to rewrite the whole movie.",
      "This film's art director wanted its kingdom on a fjord, so he chose Norway as the model, borrowing its rosemaling folk art too.",
      "Loosely based on 'The Snow Queen,' this animated blockbuster turns everything Elsa touches to ice.",
    ],
    said: "Needs work. The other clues are fine enough; clue 4 is worded weird.",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "rhinoceros",
    clues: [
      "A group of these animals is called a 'crash,' and they use shared dung heaps called middens to leave scent messages for each other.",
      "With weak eyesight, this huge, thick-skinned plant-eater leans on sharp hearing and smell to sense trouble.",
      "Its horn, the reason poachers hunt it, has no bone in it at all; it is keratin, the same stuff as your fingernails.",
      "This massive horned herbivore, whose biggest species is second only to the elephant among land animals, wallows in mud to keep cool.",
    ],
    said: "Needs work. 'Clue 2 is fine, clue 3 is too easy.'",
    expect: [{ kind: "verdict-not-good" }, { kind: "clue-too-easy", clue: 3 }],
  },
  {
    id: "hot-wheels",
    clues: [
      "In 2008 this toy line marked its four billionth car with a white-gold model studded with about 2,700 diamond chips, valued at $140,000.",
      "This toy line's holy grail is a pink 1969 Volkswagen bus prototype that loaded its surfboards through the rear window; one is now valued at around $150,000.",
      "This toy line's creator, Elliot Handler, reportedly got the idea watching his son play with Matchbox cars, and wanted flashy custom cars instead of realistic models.",
      "This die-cast car brand, launched by Mattel in 1968, is famous for the bright orange plastic track its little cars race down.",
    ],
    said: "Needs work. Saying 'car' in clue 1 is too easy, though the rest of that clue is interesting. 'Clue 3 should probably be replaced.'",
    expect: [{ kind: "verdict-not-good" }, { kind: "clue-too-easy", clue: 1 }],
  },
  {
    id: "water",
    clues: [
      "Each molecule of this compound is bent, with its two outer atoms set about 104.5 degrees apart.",
      "Henry Cavendish found in 1781 that burning hydrogen in air produces this substance, a result Lavoisier soon used to show it is a compound.",
      "A heavy form of this substance, made with deuterium, was the target of Allied sabotage raids on a Norwegian plant during World War II.",
      "This clear, tasteless liquid, vital to all known life, falls as rain and fills the oceans.",
    ],
    said: "Ship as is. 'It's fine.'",
    expect: [{ kind: "verdict-good" }],
  },
  {
    id: "wizard-of-oz",
    variant: "session-4",
    clues: [
      "This film changed the color of its magic shoes, which were silver in the book, to show off the Technicolor process.",
      "This film's best-known song was nearly cut because the studio felt a slow ballad so early stalled the story; it then won the Oscar for Best Original Song.",
      "Buddy Ebsen was hospitalized and had to quit this film when the aluminum dust in his metallic makeup coated his lungs.",
      "In this 1939 musical, a Kansas farm girl and her dog Toto are swept away by a tornado to a land of Munchkins and witches.",
    ],
    said: "Needs work. Swap clues 1 and 3. Don't use the word 'metallic' (it makes the Buddy Ebsen clue too easy). Clue 2 is not specific enough: other Oscar-winning songs may also have nearly been cut.",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "basketball",
    clues: [
      "At the 1936 Berlin Olympics this sport's first gold-medal game was played outdoors on a dirt tennis court in driving rain.",
      "This sport's first goals were two peach containers hung from a gym balcony rail with their bottoms still in, so the ball had to be retrieved after every score.",
      "Muggsy Bogues, at 5 feet 3 inches the shortest player ever in this sport's top U.S. league, played 14 seasons in it.",
      "In this sport, players dribble, shoot free throws and dunk, and Michael Jordan and LeBron James are among its greatest stars.",
    ],
    said: "Needs work. 'Clue 2 is too easy. Clue 3 might be too easy as a 2nd clue.'",
    expect: [{ kind: "verdict-not-good" }, { kind: "clue-too-easy", clue: 2 }],
  },
  {
    id: "great-pyramid-of-giza",
    clues: [
      "This landmark stood as the tallest structure people had ever built for about 3,800 years, until a medieval English cathedral spire finally passed it.",
      "This monument was once faced in white limestone polished until it shone, but by the 1800s most of those casing stones had been taken for other building work.",
      "The only one of the seven wonders of the ancient world still standing, it was built from over two million blocks of stone.",
      "This tomb of the pharaoh Khufu is the largest of the three famous royal tombs at a desert site in Greater Cairo.",
    ],
    said: "Needs work. 'Plays a little too easy.'",
    expect: [{ kind: "verdict-not-good" }],
  },
  // Session 5: played on the live site. A "too easy" note with a bad face is a
  // verdict on the whole question; he tagged no clues, so nothing says which
  // clue gave it away.
  {
    id: "wright-brothers",
    said: "Rated bad while playing, with the note 'too easy'.",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "skeleton",
    said: "Rated bad while playing, with the note 'too easy'.",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "pixar",
    said: "Rated bad while playing, with the note 'too easy'.",
    expect: [{ kind: "verdict-not-good" }],
  },
  {
    id: "meerkat",
    said: "Rated good while playing, with no note.",
    expect: [{ kind: "verdict-good" }],
  },
];

export const GRADED_CASES: GradedCase[] = CASES.map((c) => ({ clues: GRADED_CLUES[c.id], ...c }));
