// @vitest-environment jsdom

/**
 * Party mode from the keyboard, before the first round: Enter in the entry
 * form creates or joins a room, and the host starts the game with Enter.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PartyStateDto } from "@/app/party-actions";
import { ENTER_ARM_DELAY_MS } from "./keyboard";
import { PartyEntry } from "./PartyEntry";
import { PartyLobby } from "./PartyLobby";

// The real module is a "use server" file that reaches for Supabase on import.
vi.mock("@/app/party-actions", () => ({
  createPartyRoom: vi.fn(),
  joinPartyRoom: vi.fn(),
  startPartyGame: vi.fn(),
}));

import { createPartyRoom, joinPartyRoom, startPartyGame } from "@/app/party-actions";

function stubFinePointer() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(pointer: fine)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}

const field = (name: string) => screen.getByRole("textbox", { name }) as HTMLInputElement;

async function pressEnterIn(input: HTMLInputElement) {
  // jsdom has no implicit submission, so do what the browser does on Enter.
  await act(async () => {
    fireEvent.submit(input.form!);
  });
}

beforeEach(() => {
  stubFinePointer();
  vi.mocked(createPartyRoom).mockReset().mockResolvedValue({ gameId: "g", playerId: "p", roomCode: "QRTP" });
  vi.mocked(joinPartyRoom).mockReset().mockResolvedValue({ gameId: "g", playerId: "p" });
  vi.mocked(startPartyGame).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PartyEntry", () => {
  it("opens with the caret in the name field", () => {
    render(<PartyEntry onEntered={() => {}} onCancel={() => {}} />);
    expect(document.activeElement).toBe(field("Your name"));
  });

  it("creates a room on Enter", async () => {
    const onEntered = vi.fn();
    render(<PartyEntry onEntered={onEntered} onCancel={() => {}} />);

    fireEvent.change(field("Your name"), { target: { value: "Ada" } });
    await pressEnterIn(field("Your name"));

    expect(createPartyRoom).toHaveBeenCalledWith("Ada");
    expect(onEntered).toHaveBeenCalledWith({ gameId: "g", playerId: "p" });
  });

  it("moves to the room code when switching to join, and joins on Enter", async () => {
    render(<PartyEntry onEntered={() => {}} onCancel={() => {}} />);
    fireEvent.change(field("Your name"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Join room" }));

    expect(document.activeElement).toBe(field("Room code"));

    await pressEnterIn(field("Room code")); // no code yet: nothing happens
    expect(joinPartyRoom).not.toHaveBeenCalled();

    fireEvent.change(field("Room code"), { target: { value: "qrtp" } });
    await pressEnterIn(field("Room code"));
    expect(joinPartyRoom).toHaveBeenCalledWith("QRTP", "Ada");
  });
});

function lobby(youAreHost: boolean): PartyStateDto {
  return {
    gameId: "game-1",
    roomCode: "QRTP",
    status: "lobby",
    currentRound: 0,
    totalRounds: 5,
    youAreHost,
    players: [{ id: "p1", name: "Ada", score: 0, isHost: youAreHost }],
    standings: [],
    round: null,
  };
}

describe("PartyLobby", () => {
  it("lets the host start the game with Enter", async () => {
    vi.useFakeTimers();
    render(<PartyLobby state={lobby(true)} playerId="p1" onLeave={() => {}} />);

    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);
    await act(async () => {
      fireEvent.keyDown(document.body, { key: "Enter" });
    });

    expect(startPartyGame).toHaveBeenCalledWith("game-1", "p1");
  });

  it("gives guests no Enter shortcut", () => {
    vi.useFakeTimers();
    render(<PartyLobby state={lobby(false)} playerId="p1" onLeave={() => {}} />);

    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);
    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(startPartyGame).not.toHaveBeenCalled();
  });
});
