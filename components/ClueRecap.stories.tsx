import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DAILY_PUZZLE, ROUND_LOST, ROUND_WON } from "../.storybook/fixtures";
import { ClueRecap } from "./ClueRecap";

/** The clues a player saw, kept on screen after the round ends. */
const meta = {
  title: "Components/Clue recap",
  component: ClueRecap,
  args: { clues: DAILY_PUZZLE.clues, lastClueIndex: 3, wrongGuesses: ROUND_LOST.wrongGuesses },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClueRecap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EveryClue: Story = {};

/** Solved early: unseen clues stay hidden, and the heading says "2 of 4". */
export const SolvedEarly: Story = {
  args: { lastClueIndex: 1, wrongGuesses: ROUND_WON.wrongGuesses },
};
