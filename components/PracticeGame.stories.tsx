import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { ANSWER_IMAGES, PRACTICE_PUZZLE } from "../.storybook/fixtures";
import { PracticeGame } from "./PracticeGame";
import { StageFrame } from "./StageFrame";

/** Endless practice: a round, then the result with the running session score. */
const meta = {
  title: "Screens/Practice",
  component: PracticeGame,
  args: { onExit: fn() },
  parameters: { screen: true },
  decorators: [
    (Story) => (
      <StageFrame>
        <Story />
      </StageFrame>
    ),
  ],
} satisfies Meta<typeof PracticeGame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstClue: Story = {
  play: async ({ canvas }) => {
    await canvas.findByText(PRACTICE_PUZZLE.clues[0]);
    await expect(canvas.getByText("← Back to today's daily")).toBeVisible();
  },
};

/** Solved on the first clue: 10 points banked in the score chip. */
export const Solved: Story = {
  play: async ({ canvas, userEvent }) => {
    const box = await canvas.findByRole("textbox", { name: "Your answer" });
    await userEvent.type(box, "Octopus{Enter}");
    await canvas.findByRole("heading", { name: "Correct!" });
    await canvas.findByRole("img", { name: ANSWER_IMAGES.octopus.alt });
    await expect(canvas.getByLabelText("10 points this session")).toBeVisible();
  },
};

export const GaveUp: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Give up" }));
    await canvas.findByRole("heading", { name: "Out of clues" });
    await canvas.findByRole("img", { name: ANSWER_IMAGES.octopus.alt });
  },
};
