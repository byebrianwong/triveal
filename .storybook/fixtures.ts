// Fixed data for stories. The questions are copied from the real bank so the
// screens show realistic clue lengths, but they are frozen here: editing the
// bank never changes a snapshot.

import type { DailyPuzzleDto, PuzzleDto } from "@/app/actions";
import type { PartyPlayerDto, PartyRoundDto, PartyStateDto } from "@/app/party-actions";
import type { PartyStanding } from "@/lib/game/party";
import type { RoundState } from "@/lib/game/roundState";
import type { PlayerStats } from "@/lib/game/stats";
import type { AnswerImage } from "@/lib/questions/answerImage";

// --- Questions ---------------------------------------------------------------

export const DAILY_PUZZLE: DailyPuzzleDto = {
  questionId: "asteroid",
  category: "Space",
  difficulty: "medium",
  clueCount: 4,
  clues: [
    "One of these about 10 km wide is blamed for wiping out the dinosaurs 66 million years ago.",
    "Most of them orbit the Sun in a vast belt between Mars and Jupiter, leftover rubble from the Solar System's birth.",
    "Ranging from pebbles to hundreds of miles across, these rocky bodies are sometimes called 'minor planets.'",
    "This chunk of space rock circling the Sun becomes a 'meteor' if it streaks into Earth's atmosphere.",
  ],
  dateStr: "2026-09-27",
  dailyNumber: 119,
};

export const PRACTICE_PUZZLE: PuzzleDto = {
  questionId: "octopus",
  category: "Animals",
  difficulty: "medium",
  clueCount: 4,
  clues: [
    "Three hearts, blue copper-based blood, and most of its mind spread out through its arms.",
    "It can change color and texture in an instant and squeeze its entire body through any gap larger than its only hard part, its beak.",
    "Some species can detach an arm to escape a predator and grow it back, and most of their neurons live in the arms rather than a central brain.",
    "This eight-armed cephalopod is a famously clever ocean animal, a close relative of the squid and cuttlefish.",
  ],
};

/** Answers by question id, for the stand-in `checkGuess` and `revealAnswer`. */
export const ANSWERS: Record<string, string> = {
  asteroid: "Asteroid",
  octopus: "Octopus",
};

/** Guesses the real bank lists as decoys, so the "fair trap" message shows. */
export const DECOYS: Record<string, string[]> = {
  asteroid: ["comet", "meteorite"],
  octopus: ["squid", "cuttlefish"],
};

// Local drawings stand in for the Wikipedia pictures, so snapshots never
// depend on a remote image.
export const ANSWER_IMAGES: Record<string, AnswerImage> = {
  asteroid: {
    src: "/storybook-assets/asteroid.svg",
    width: 640,
    height: 420,
    alt: "A grey, cratered asteroid against black space",
    pageUrl: "https://en.wikipedia.org/wiki/Asteroid",
    credit: "Sample drawing for Storybook · CC0",
    creditUrl: "https://en.wikipedia.org/wiki/Asteroid",
  },
  octopus: {
    src: "/storybook-assets/octopus.svg",
    width: 640,
    height: 420,
    alt: "A purple octopus with curled arms",
    pageUrl: "https://en.wikipedia.org/wiki/Octopus",
    credit: "Sample drawing for Storybook · CC0",
    creditUrl: "https://en.wikipedia.org/wiki/Octopus",
  },
};

// --- Daily rounds and stats --------------------------------------------------

/** On the giveaway clue after two wrong guesses. */
export const ROUND_LAST_CLUE: RoundState = {
  clueIndex: 3,
  wrongGuesses: [
    { clueIndex: 0, guess: "Comet" },
    { clueIndex: 2, guess: "Meteor" },
  ],
  status: "playing",
  solvedClueIndex: null,
  score: 0,
};

/** Solved on clue 2 after one wrong guess: 8 points − 1. */
export const ROUND_WON: RoundState = {
  clueIndex: 1,
  wrongGuesses: [{ clueIndex: 0, guess: "Comet" }],
  status: "won",
  solvedClueIndex: 1,
  score: 7,
};

/** Every clue used, three wrong guesses. */
export const ROUND_LOST: RoundState = {
  clueIndex: 3,
  wrongGuesses: [
    { clueIndex: 0, guess: "Comet" },
    { clueIndex: 2, guess: "Meteor" },
    { clueIndex: 3, guess: "Meteorite" },
  ],
  status: "lost",
  solvedClueIndex: null,
  score: 0,
};

/** A regular player's history, so the stats row and solve chart have shape. */
export const STATS: PlayerStats = {
  gamesPlayed: 23,
  wins: 19,
  currentStreak: 6,
  maxStreak: 11,
  totalScore: 142,
  solveDistribution: [3, 8, 5, 3, 0],
  lastCompletedDate: "2026-09-27",
};

// --- Party ---------------------------------------------------------------------

export const PARTY_IDENTITY_HOST = { gameId: "game-1", playerId: "p1" };
export const PARTY_IDENTITY_GUEST = { gameId: "game-1", playerId: "p2" };

const PLAYERS: PartyPlayerDto[] = [
  { id: "p1", name: "Ada", score: 0, isHost: true },
  { id: "p2", name: "Grace", score: 0, isHost: false },
  { id: "p3", name: "Linus", score: 0, isHost: false },
  { id: "p4", name: "Margaret", score: 0, isHost: false },
];

// A full room: 12 is the most players a room takes (MAX_PLAYERS in
// app/party-actions.ts). The lists are then taller than a phone screen.
const FULL_ROOM: PartyPlayerDto[] = [
  ...PLAYERS,
  ...["Alan", "Barbara", "Dennis", "Edsger", "Frances", "Hedy", "Ken", "Radia"].map((name, i) => ({
    id: `p${i + 5}`,
    name,
    score: 0,
    isHost: false,
  })),
];

function standings(scores: Record<string, number>, players = PLAYERS): PartyStanding[] {
  return players.map((p) => ({ playerId: p.id, name: p.name, score: scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

const MID_GAME_SCORES = { p1: 8, p2: 14, p3: 6, p4: 10 };

export const PARTY_LOBBY: PartyStateDto = {
  gameId: "game-1",
  roomCode: "QZRT",
  status: "lobby",
  currentRound: 0,
  totalRounds: 5,
  youAreHost: true,
  players: PLAYERS,
  round: null,
  standings: standings({}),
};

const ROUND_IN_PLAY: PartyRoundDto = {
  roundNumber: 3,
  clueIndex: 1,
  clueCount: 4,
  revealedClues: PRACTICE_PUZZLE.clues.slice(0, 2),
  category: "Animals",
  status: "revealing",
  winner: null,
  answer: null,
  questionId: null,
  youLockedOut: false,
  youWon: false,
};

export const PARTY_ROUND_IN_PLAY: PartyStateDto = {
  ...PARTY_LOBBY,
  status: "active",
  currentRound: 3,
  players: PLAYERS.map((p) => ({ ...p, score: MID_GAME_SCORES[p.id as keyof typeof MID_GAME_SCORES] })),
  round: ROUND_IN_PLAY,
  standings: standings(MID_GAME_SCORES),
};

export const PARTY_ROUND_RESOLVED: PartyStateDto = {
  ...PARTY_ROUND_IN_PLAY,
  round: {
    ...ROUND_IN_PLAY,
    clueIndex: 2,
    revealedClues: PRACTICE_PUZZLE.clues.slice(0, 3),
    status: "resolved",
    winner: { playerId: "p2", name: "Grace" },
    answer: "Octopus",
    questionId: "octopus",
  },
  standings: standings({ ...MID_GAME_SCORES, p2: 20 }),
};

const FINAL_SCORES = { p1: 24, p2: 31, p3: 12, p4: 27 };

export const PARTY_FINISHED: PartyStateDto = {
  ...PARTY_LOBBY,
  status: "finished",
  currentRound: 5,
  players: PLAYERS.map((p) => ({ ...p, score: FINAL_SCORES[p.id as keyof typeof FINAL_SCORES] })),
  round: null,
  standings: standings(FINAL_SCORES),
};

export const PARTY_LOBBY_FULL: PartyStateDto = {
  ...PARTY_LOBBY,
  players: FULL_ROOM,
  standings: standings({}, FULL_ROOM),
};

const FULL_ROOM_FINAL_SCORES = {
  ...FINAL_SCORES,
  p5: 18,
  p6: 9,
  p7: 22,
  p8: 15,
  p9: 4,
  p10: 11,
  p11: 7,
  p12: 0,
};

export const PARTY_FINISHED_FULL: PartyStateDto = {
  ...PARTY_FINISHED,
  players: FULL_ROOM.map((p) => ({
    ...p,
    score: FULL_ROOM_FINAL_SCORES[p.id as keyof typeof FULL_ROOM_FINAL_SCORES],
  })),
  standings: standings(FULL_ROOM_FINAL_SCORES, FULL_ROOM),
};
