import { describe, it, expect } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  initialPartyRound,
  canPlayerGuess,
  applyPartyGuess,
  revealNextPartyClue,
  partyRoundPoints,
  rankStandings,
  nextRoundNumber,
  isGameOver,
  type PartyPlayer,
} from "./party";

describe("room codes", () => {
  it("generates codes of the right length from the unambiguous alphabet", () => {
    // Deterministic RNG cycling through a few values.
    const seq = [0, 0.5, 0.99, 0.25];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const code = generateRoomCode(rng);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
  });

  it("never emits the ambiguous characters I, O, 1, or 0", () => {
    for (const bad of ["I", "O", "1", "0"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(bad);
    }
    // rng at the extremes must still produce valid in-alphabet codes.
    expect(isValidRoomCode(generateRoomCode(() => 0))).toBe(true);
    expect(isValidRoomCode(generateRoomCode(() => 0.999999))).toBe(true);
  });

  it("normalizes and validates player-typed codes", () => {
    const valid = generateRoomCode(() => 0); // "AAAA"
    expect(normalizeRoomCode(`  ${valid.toLowerCase()} `)).toBe(valid);
    expect(isValidRoomCode(valid.toLowerCase())).toBe(true);
    expect(isValidRoomCode("AAA")).toBe(false); // too short
    expect(isValidRoomCode("AAAAA")).toBe(false); // too long
    expect(isValidRoomCode("AAI0")).toBe(false); // contains I and 0
  });
});

describe("party round — guessing and locking", () => {
  it("first correct guess wins and resolves the round", () => {
    const start = initialPartyRound(4);
    const { state, accepted, wonRound } = applyPartyGuess(start, "p1", true);
    expect(accepted).toBe(true);
    expect(wonRound).toBe(true);
    expect(state.status).toBe("resolved");
    expect(state.winnerPlayerId).toBe("p1");
  });

  it("rejects further guesses once resolved (no second winner)", () => {
    const won = applyPartyGuess(initialPartyRound(4), "p1", true).state;
    const second = applyPartyGuess(won, "p2", true);
    expect(second.accepted).toBe(false);
    expect(second.wonRound).toBe(false);
    expect(second.state.winnerPlayerId).toBe("p1");
  });

  it("a wrong guess locks the player out for the current clue only", () => {
    const start = initialPartyRound(4);
    const missed = applyPartyGuess(start, "p1", false);
    expect(missed.accepted).toBe(true);
    expect(missed.wonRound).toBe(false);
    expect(canPlayerGuess(missed.state, "p1")).toBe(false);
    // Other players are unaffected.
    expect(canPlayerGuess(missed.state, "p2")).toBe(true);
  });

  it("a locked-out player's repeat guess is ignored, even if correct", () => {
    const missed = applyPartyGuess(initialPartyRound(4), "p1", false).state;
    const retry = applyPartyGuess(missed, "p1", true);
    expect(retry.accepted).toBe(false);
    expect(retry.wonRound).toBe(false);
    expect(retry.state.status).toBe("revealing");
  });

  it("revealing the next clue unlocks everyone and advances the pointer", () => {
    const missed = applyPartyGuess(initialPartyRound(4), "p1", false).state;
    const next = revealNextPartyClue(missed);
    expect(next.clueIndex).toBe(1);
    expect(canPlayerGuess(next, "p1")).toBe(true);
  });

  it("resolves with no winner when the last clue passes unsolved", () => {
    let state = initialPartyRound(4);
    state = revealNextPartyClue(state); // -> clue 1
    state = revealNextPartyClue(state); // -> clue 2
    state = revealNextPartyClue(state); // -> clue 3 (last)
    expect(state.clueIndex).toBe(3);
    expect(state.status).toBe("revealing");
    const past = revealNextPartyClue(state); // nothing left to reveal
    expect(past.status).toBe("resolved");
    expect(past.winnerPlayerId).toBeNull();
    expect(partyRoundPoints(past)).toBe(0);
  });
});

describe("party round — scoring by clue", () => {
  it("awards the current clue's value to the winner (10/8/6/4)", () => {
    expect(partyRoundPoints(applyPartyGuess(initialPartyRound(4), "p1", true).state)).toBe(10);

    let s = revealNextPartyClue(initialPartyRound(4)); // clue 1
    expect(partyRoundPoints(applyPartyGuess(s, "p1", true).state)).toBe(8);

    s = revealNextPartyClue(s); // clue 2
    expect(partyRoundPoints(applyPartyGuess(s, "p1", true).state)).toBe(6);

    s = revealNextPartyClue(s); // clue 3
    expect(partyRoundPoints(applyPartyGuess(s, "p1", true).state)).toBe(4);
  });

  it("is zero while the round is still unresolved", () => {
    expect(partyRoundPoints(initialPartyRound(4))).toBe(0);
  });
});

describe("standings", () => {
  const players: PartyPlayer[] = [
    { id: "a", name: "Ada", score: 12, joinedAt: 100 },
    { id: "b", name: "Ben", score: 20, joinedAt: 200 },
    { id: "c", name: "Cid", score: 12, joinedAt: 50 }, // ties Ada, joined earlier
  ];

  it("ranks by score desc, breaking ties by earliest join", () => {
    const board = rankStandings(players);
    expect(board.map((s) => s.playerId)).toEqual(["b", "c", "a"]);
    expect(board.map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const copy = [...players];
    rankStandings(players);
    expect(players).toEqual(copy);
  });

  it("accepts ISO-string join times", () => {
    const board = rankStandings([
      { id: "x", name: "X", score: 5, joinedAt: "2026-01-01T00:00:10Z" },
      { id: "y", name: "Y", score: 5, joinedAt: "2026-01-01T00:00:05Z" },
    ]);
    expect(board.map((s) => s.playerId)).toEqual(["y", "x"]);
  });
});

describe("game lifecycle", () => {
  it("computes the next round number and detects game over", () => {
    expect(nextRoundNumber(0)).toBe(1);
    expect(nextRoundNumber(4)).toBe(5);
    expect(isGameOver(4, 5)).toBe(false);
    expect(isGameOver(5, 5)).toBe(true);
    expect(isGameOver(6, 5)).toBe(true);
  });
});
