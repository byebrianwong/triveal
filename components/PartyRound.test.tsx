// @vitest-environment jsdom

/**
 * Round-transition tests for <PartyRound />.
 *
 * The component never unmounts during a game — the host advancing the room
 * just hands it a new `round` — so the interesting cases are all about what
 * must (and must not) survive a prop change.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PartyGuessResult, PartyRoundDto, PartyStateDto } from "@/app/party-actions";
import { PartyRound } from "./PartyRound";

// The real module is a "use server" file that reaches for Supabase on import.
vi.mock("@/app/party-actions", () => ({
  submitPartyGuess: vi.fn(),
  revealNextPartyClue: vi.fn(),
  startNextPartyRound: vi.fn(),
}));

import { submitPartyGuess } from "@/app/party-actions";

const guessAction = vi.mocked(submitPartyGuess);

const WON: PartyGuessResult = { accepted: true, correct: true, wonRound: true, tooLate: false };
const MISSED: PartyGuessResult = { accepted: true, correct: false, wonRound: false, tooLate: false };

const WIN_BANNER = "🎉 You got it!";
const LOCKOUT = "Not it — locked out until the next clue.";

function partyState(round: Partial<PartyRoundDto> = {}): PartyStateDto {
  const roundNumber = round.roundNumber ?? 1;
  return {
    gameId: "game-1",
    roomCode: "QRTP",
    status: "active",
    currentRound: roundNumber,
    totalRounds: 5,
    youAreHost: false,
    players: [
      { id: "p1", name: "Grace", score: 10, isHost: false },
      { id: "p2", name: "Ada", score: 0, isHost: true },
    ],
    standings: [
      { playerId: "p1", name: "Grace", score: 10, rank: 1 },
      { playerId: "p2", name: "Ada", score: 0, rank: 2 },
    ],
    round: {
      roundNumber: 1,
      clueIndex: 0,
      clueCount: 4,
      revealedClues: ["Round one, clue one"],
      category: "History",
      status: "revealing",
      winner: null,
      answer: null,
      youLockedOut: false,
      youWon: false,
      ...round,
    },
  };
}

function show(round?: Partial<PartyRoundDto>) {
  const { rerender } = render(
    <PartyRound state={partyState(round)} playerId="p1" onLeave={() => {}} />,
  );
  return (next: Partial<PartyRoundDto>) =>
    rerender(<PartyRound state={partyState(next)} playerId="p1" onLeave={() => {}} />);
}

const guessBox = () => screen.getByRole("textbox") as HTMLInputElement;

function type(text: string) {
  fireEvent.change(guessBox(), { target: { value: text } });
}

async function submit(text: string) {
  type(text);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Guess" }));
  });
}

beforeEach(() => {
  guessAction.mockReset();
});

afterEach(cleanup);

describe("PartyRound round transitions", () => {
  it("drops the win banner once the next round starts", async () => {
    guessAction.mockResolvedValue(WON);
    const update = show();

    await submit("Cluedo");
    expect(screen.getByText(WIN_BANNER)).toBeTruthy();

    // The room sees the round resolve, then the host moves everyone on.
    update({ status: "resolved", winner: { playerId: "p1", name: "Grace" }, answer: "Cluedo" });
    update({ roundNumber: 2, revealedClues: ["Round two, clue one"] });

    expect(screen.getByText("Round two, clue one")).toBeTruthy();
    expect(screen.queryByText(WIN_BANNER)).toBeNull();
  });

  it("clears a half-typed guess when the next round starts", () => {
    const update = show();

    type("still thinking");
    update({ roundNumber: 2, revealedClues: ["Round two, clue one"] });

    expect(guessBox().value).toBe("");
  });

  it("re-enables guessing on the next round even with a guess still in flight", async () => {
    let settle: (result: PartyGuessResult) => void = () => {};
    guessAction.mockReturnValue(
      new Promise<PartyGuessResult>((resolve) => {
        settle = resolve;
      }),
    );
    const update = show();

    await submit("Cluedo");
    expect(guessBox().disabled).toBe(true); // busy while the action runs

    update({ roundNumber: 2, revealedClues: ["Round two, clue one"] });
    expect(guessBox().disabled).toBe(false);

    // The round-one answer lands late; it must not label round two.
    await act(async () => {
      settle(WON);
    });
    expect(screen.queryByText(WIN_BANNER)).toBeNull();
  });

  it("drops the lockout message when the host reveals the next clue", async () => {
    guessAction.mockResolvedValue(MISSED);
    const update = show();

    await submit("Yahtzee");
    expect(screen.getByText(LOCKOUT)).toBeTruthy();

    update({ youLockedOut: true });
    expect(screen.getByText(LOCKOUT)).toBeTruthy();
    expect(guessBox().disabled).toBe(true);

    // Revealing a clue clears every lockout server-side, so the message that
    // says otherwise has to go with it.
    update({ clueIndex: 1, revealedClues: ["Round one, clue one", "Round one, clue two"] });
    expect(screen.queryByText(LOCKOUT)).toBeNull();
    expect(guessBox().disabled).toBe(false);
  });

  it("keeps what you are typing when a new clue lands mid-round", () => {
    const update = show();

    type("half an idea");
    update({ clueIndex: 1, revealedClues: ["Round one, clue one", "Round one, clue two"] });

    expect(guessBox().value).toBe("half an idea");
  });
});
