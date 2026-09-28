import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ANSWER_INFO, PRACTICE_PUZZLE, ROUND_LOST, ROUND_WON } from "../.storybook/fixtures";
import { PracticeResult } from "./PracticeResult";

/** Practice's finished-round panel, with the running session totals. */
const meta = {
  title: "Components/Practice result",
  component: PracticeResult,
  args: {
    round: ROUND_WON,
    answer: "Octopus",
    questionId: PRACTICE_PUZZLE.questionId,
    sessionScore: 31,
    played: 5,
    solved: 4,
    onNext: fn(),
    onExit: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    await canvas.findByRole("img", { name: ANSWER_INFO.octopus.image.alt });
  },
} satisfies Meta<typeof PracticeResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Solved: Story = {};

export const OutOfClues: Story = {
  args: { round: ROUND_LOST, sessionScore: 24, played: 5, solved: 3 },
};
