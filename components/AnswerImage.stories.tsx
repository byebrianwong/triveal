import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ANSWER_IMAGES } from "../.storybook/fixtures";
import { AnswerImage } from "./AnswerImage";

/**
 * The picture beside a revealed answer, with its credit line. With no
 * picture it renders nothing, so there is no story for that case.
 */
const meta = {
  title: "Components/Answer picture",
  component: AnswerImage,
  args: { questionId: "asteroid" },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md text-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnswerImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPicture: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole("img", { name: ANSWER_IMAGES.asteroid.alt });
  },
};
