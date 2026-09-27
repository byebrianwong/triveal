import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DAILY_PUZZLE, ROUND_LAST_CLUE } from "../.storybook/fixtures";
import { ClueStack } from "./ClueStack";

/**
 * The clue ladder during a round. On phones it fills the space above the
 * answer box and scrolls; on desktop it is only as tall as its clues.
 */
const meta = {
  title: "Components/Clue stack",
  component: ClueStack,
  args: { clues: DAILY_PUZZLE.clues, clueIndex: 0, wrongGuesses: [] },
  decorators: [
    (Story) => (
      <div className="mx-auto flex h-[560px] w-full max-w-xl flex-col lg:h-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ClueStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstClue: Story = {};

export const SecondClueAfterAMiss: Story = {
  args: { clueIndex: 1, wrongGuesses: [{ clueIndex: 0, guess: "Comet" }] },
};

export const Giveaway: Story = {
  args: { clueIndex: 3, wrongGuesses: ROUND_LAST_CLUE.wrongGuesses },
};
