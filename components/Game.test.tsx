// @vitest-environment jsdom

/**
 * Keyboard play through a round: the answer box is ready to type into the
 * moment a question opens and again after every new clue, and Enter moves on
 * from the practice result. Touchscreens keep the old behaviour, because
 * focusing the field there would pop the on-screen keyboard over the clues.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PuzzleDto } from "@/app/actions";
import { initialRoundState } from "@/lib/game/roundState";
import { Game, type GameConfig } from "./Game";
import { ENTER_ARM_DELAY_MS } from "./keyboard";
import { PracticeResult } from "./PracticeResult";

// The real module is a "use server" file that reaches for the question bank.
vi.mock("@/app/actions", () => ({
  checkGuess: vi.fn(),
  revealAnswer: vi.fn(),
  fetchAnswerImage: vi.fn(),
  rateQuestion: vi.fn(),
  commentOnRating: vi.fn(),
}));

import { checkGuess, fetchAnswerImage, revealAnswer } from "@/app/actions";

const PUZZLE: PuzzleDto = {
  questionId: "salt",
  category: "Food",
  difficulty: "medium",
  clueCount: 4,
  clues: ["Clue one", "Clue two", "Clue three", "Clue four"],
};

const CONFIG: GameConfig = {
  badge: null,
  sublinePrefix: "Practice",
  renderResult: (_round, answer) => <p>Answer: {answer}</p>,
};

function stubPointer(kind: "fine" | "coarse") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === `(pointer: ${kind})`,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}

const answerBox = () => screen.getByRole("textbox", { name: "Your answer" });

beforeEach(() => {
  // jsdom has no layout, so the clue ladder's scroll-to-latest is a no-op.
  Element.prototype.scrollTo = () => {};
  vi.mocked(checkGuess).mockReset();
  vi.mocked(revealAnswer).mockResolvedValue({ answer: "Salt" });
  vi.mocked(fetchAnswerImage).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Game keyboard play", () => {
  it("opens with the caret in the answer box", () => {
    stubPointer("fine");
    render(<Game puzzle={PUZZLE} config={CONFIG} />);
    expect(document.activeElement).toBe(answerBox());
  });

  it("puts the caret back after skipping to the next clue", () => {
    stubPointer("fine");
    render(<Game puzzle={PUZZLE} config={CONFIG} />);

    const skip = screen.getByRole("button", { name: /Next clue/ });
    skip.focus();
    fireEvent.click(skip);

    expect(screen.getByText("Clue two")).toBeTruthy();
    expect(document.activeElement).toBe(answerBox());
  });

  it("puts the caret back after a wrong guess sent with the button", async () => {
    stubPointer("fine");
    vi.mocked(checkGuess).mockResolvedValue({ correct: false, kind: "none", close: false });
    render(<Game puzzle={PUZZLE} config={CONFIG} />);

    fireEvent.change(answerBox(), { target: { value: "Pepper" } });
    const lockIn = screen.getByRole("button", { name: /Lock in your guess/ });
    lockIn.focus();
    await act(async () => {
      fireEvent.click(lockIn);
    });

    expect(screen.getByText("Clue two")).toBeTruthy();
    expect(document.activeElement).toBe(answerBox());
  });

  it("lets the clue list take keyboard focus without keeping it on a new clue", () => {
    stubPointer("fine");
    render(<Game puzzle={PUZZLE} config={CONFIG} />);

    // Focusable so a keyboard player can scroll it; the answer box keeps the caret.
    const clues = screen.getByRole("region", { name: "Clues" });
    expect(clues.tabIndex).toBe(0);
    expect(document.activeElement).toBe(answerBox());

    clues.focus();
    fireEvent.click(screen.getByRole("button", { name: /Next clue/ }));

    expect(screen.getByText("Clue two")).toBeTruthy();
    expect(document.activeElement).toBe(answerBox());
  });

  it("does not grab focus on a touchscreen", () => {
    stubPointer("coarse");
    render(<Game puzzle={PUZZLE} config={CONFIG} />);
    expect(document.activeElement).toBe(document.body);
  });

  it("does not look for an answer box on a finished round", async () => {
    stubPointer("fine");
    const restoredRound = { ...initialRoundState(), status: "lost" as const };
    await act(async () => {
      render(<Game puzzle={PUZZLE} config={{ ...CONFIG, restoredRound }} />);
    });
    expect(screen.getByText("Answer: Salt")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Your answer" })).toBeNull();
  });
});

describe("PracticeResult keyboard", () => {
  it("goes to the next question on Enter", async () => {
    vi.useFakeTimers();
    const onNext = vi.fn();
    await act(async () => {
      render(
        <PracticeResult
          round={{ ...initialRoundState(), status: "won", solvedClueIndex: 0, score: 10 }}
          answer="Salt"
          questionId="salt"
          sessionScore={10}
          played={1}
          solved={1}
          onNext={onNext}
          onExit={() => {}}
        />,
      );
    });

    // Straight away it is ignored: that is the guess's own Enter, pressed twice.
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onNext).not.toHaveBeenCalled();

    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
