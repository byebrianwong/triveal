import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked, waitFor } from "storybook/test";
import { checkGuess, fetchAnswerInfo, fetchDailyPuzzle } from "@/app/actions";
import Home from "@/app/page";
import { localDateString } from "@/lib/game/daily";
import type { RoundState } from "@/lib/game/roundState";
import {
  ANSWER_INFO,
  DAILY_PUZZLE,
  ROUND_LAST_CLUE,
  ROUND_LOST,
  ROUND_WON,
  STATS,
} from "../.storybook/fixtures";
import { ROUND_KEY, STATS_KEY } from "./DailyGame";

/**
 * The home page as a player sees it, through each stage of the daily. These
 * render the real page; only the server actions are stand-ins.
 */
const meta = {
  title: "Screens/Daily",
  component: Home,
  parameters: { screen: true },
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Save a round (and stats) the way a returning player's browser has them. */
function seedToday(round: RoundState) {
  localStorage.setItem(ROUND_KEY(localDateString()), JSON.stringify(round));
  localStorage.setItem(STATS_KEY, JSON.stringify(STATS));
}

/** Waiting on the puzzle. */
export const Loading: Story = {
  beforeEach() {
    mocked(fetchDailyPuzzle).mockReturnValue(new Promise(() => {}));
  },
  play: async ({ canvas }) => {
    await canvas.findByText("Setting the stage…");
  },
};

/** A new player's first look: clue 1, worth 10, caret in the answer box. */
export const FirstClue: Story = {
  play: async ({ canvas }) => {
    await canvas.findByText(DAILY_PUZZLE.clues[0]);
    const box = canvas.getByRole("textbox", { name: "Your answer" });
    await waitFor(() => expect(box).toHaveFocus());
  },
};

/** A decoy guess: the miss message, the −1 badge, and clue 2 unlocked. */
export const AfterAWrongGuess: Story = {
  beforeEach() {
    mocked(checkGuess).mockResolvedValue({ correct: false, kind: "decoy", close: false });
  },
  play: async ({ canvas, userEvent }) => {
    const box = await canvas.findByRole("textbox", { name: "Your answer" });
    await userEvent.type(box, "Comet{Enter}");
    await canvas.findByText(/a fair trap, but no/);
    await canvas.findByText(DAILY_PUZZLE.clues[1]);
    await expect(canvas.getByText("Solve now for")).toBeVisible();
  },
};

/** The giveaway clue after two misses, with the earlier clues stacked above. */
export const LastClue: Story = {
  beforeEach() {
    seedToday(ROUND_LAST_CLUE);
  },
  play: async ({ canvas }) => {
    await canvas.findByText(DAILY_PUZZLE.clues[3]);
    await expect(canvas.getByText("Last clue — make it count")).toBeVisible();
  },
};

/** Solved on clue 2 after one miss, with a picture and a real streak. */
export const Solved: Story = {
  beforeEach() {
    seedToday(ROUND_WON);
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Correct!" });
    await canvas.findByRole("img", { name: ANSWER_INFO.asteroid.image.alt });
    await expect(canvas.getByText("Clues you saw")).toBeVisible();
  },
};

/** Out of clues, and the answer has no freely licensed picture: summary only. */
export const OutOfClues: Story = {
  beforeEach() {
    seedToday(ROUND_LOST);
    mocked(fetchAnswerInfo).mockResolvedValue({ ...ANSWER_INFO.asteroid, image: null });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Out of clues" });
    await canvas.findByText("Asteroid");
    await canvas.findByText(ANSWER_INFO.asteroid.summary);
  },
};
