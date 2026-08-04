// @vitest-environment jsdom

/**
 * The clue history shown alongside the answer. What matters is that it shows
 * exactly what the player was shown: every clue they reached, the wrong guess
 * each one cost, and none of the clues they never unlocked.
 */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ClueRecap } from "./ClueRecap";

const CLUES = ["First clue", "Second clue", "Third clue", "Fourth clue", "Fifth clue"];

afterEach(cleanup);

describe("ClueRecap", () => {
  it("shows every clue the player reached", () => {
    render(<ClueRecap clues={CLUES} lastClueIndex={2} wrongGuesses={[]} />);

    expect(screen.getByText("First clue")).toBeTruthy();
    expect(screen.getByText("Second clue")).toBeTruthy();
    expect(screen.getByText("Third clue")).toBeTruthy();
  });

  it("keeps the clues never unlocked out of the recap", () => {
    render(<ClueRecap clues={CLUES} lastClueIndex={2} wrongGuesses={[]} />);

    expect(screen.queryByText("Fourth clue")).toBeNull();
    expect(screen.queryByText("Fifth clue")).toBeNull();
    expect(screen.getByText(/3 of 5/)).toBeTruthy();
  });

  it("drops the count once every clue was seen", () => {
    render(<ClueRecap clues={CLUES} lastClueIndex={4} wrongGuesses={[]} />);

    expect(screen.getByText("Fifth clue")).toBeTruthy();
    expect(screen.queryByText(/of 5/)).toBeNull();
  });

  it("attaches each wrong guess to the clue it was made on", () => {
    render(
      <ClueRecap
        clues={CLUES}
        lastClueIndex={2}
        wrongGuesses={[
          { clueIndex: 0, guess: "Thomas Jefferson" },
          { clueIndex: 1, guess: "John Adams" },
        ]}
      />,
    );

    expect(screen.getByText(/Thomas Jefferson/)).toBeTruthy();
    expect(screen.getByText(/John Adams/)).toBeTruthy();
  });

  it("renders nothing when there is no history to show", () => {
    const { container } = render(<ClueRecap clues={[]} lastClueIndex={0} wrongGuesses={[]} />);

    expect(container.firstChild).toBeNull();
  });
});
