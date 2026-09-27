// Stand-in for app/party-actions.ts in Storybook (see MOCKED_MODULES in
// main.ts). By default the room is the fixture lobby; a story swaps in another
// state with `mocked(getPartyState).mockResolvedValue(...)`.

import { fn, type Mock } from "storybook/test";
import type * as real from "@/app/party-actions";
import { PARTY_LOBBY } from "../fixtures";

type PartyActions = typeof real;

const defaults: PartyActions = {
  createPartyRoom: async () => ({ gameId: "game-1", playerId: "p1", roomCode: "QZRT" }),
  joinPartyRoom: async () => ({ gameId: "game-1", playerId: "p2", roomCode: "QZRT" }),
  startPartyGame: async () => {},
  submitPartyGuess: async () => ({ accepted: true, correct: false, wonRound: false, tooLate: false }),
  revealNextPartyClue: async () => {},
  startNextPartyRound: async () => {},
  getPartyState: async () => PARTY_LOBBY,
};

export const createPartyRoom = fn(defaults.createPartyRoom).mockName("createPartyRoom");
export const joinPartyRoom = fn(defaults.joinPartyRoom).mockName("joinPartyRoom");
export const startPartyGame = fn(defaults.startPartyGame).mockName("startPartyGame");
export const submitPartyGuess = fn(defaults.submitPartyGuess).mockName("submitPartyGuess");
export const revealNextPartyClue = fn(defaults.revealNextPartyClue).mockName("revealNextPartyClue");
export const startNextPartyRound = fn(defaults.startNextPartyRound).mockName("startNextPartyRound");
export const getPartyState = fn(defaults.getPartyState).mockName("getPartyState");

function restore<T extends (...args: never[]) => unknown>(mock: Mock<T>, impl: T) {
  mock.mockReset();
  mock.mockImplementation(impl as Parameters<Mock<T>["mockImplementation"]>[0]);
}

/** Put every stand-in back to its default. Runs before each story. */
export function resetPartyActionMocks() {
  restore(createPartyRoom, defaults.createPartyRoom);
  restore(joinPartyRoom, defaults.joinPartyRoom);
  restore(startPartyGame, defaults.startPartyGame);
  restore(submitPartyGuess, defaults.submitPartyGuess);
  restore(revealNextPartyClue, defaults.revealNextPartyClue);
  restore(startNextPartyRound, defaults.startNextPartyRound);
  restore(getPartyState, defaults.getPartyState);
}
