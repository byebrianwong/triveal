import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked } from "storybook/test";
import { fetchAnswerInfo } from "@/app/actions";
import { ANSWER_INFO } from "../.storybook/fixtures";
import { AnswerInfo } from "./AnswerInfo";

/**
 * The picture and summary under a revealed answer, with the picture's credit
 * line. With neither it renders nothing, so there is no story for that case.
 */
const meta = {
  title: "Components/Answer info",
  component: AnswerInfo,
  args: { questionId: "asteroid" },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md text-center">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnswerInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPicture: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole("img", { name: ANSWER_INFO.asteroid.image.alt });
    await expect(canvas.getByText(ANSWER_INFO.asteroid.summary)).toBeVisible();
  },
};

/** The article's lead image is non-free art, so only the summary shows. */
export const SummaryOnly: Story = {
  beforeEach() {
    mocked(fetchAnswerInfo).mockResolvedValue({ ...ANSWER_INFO.asteroid, image: null });
  },
  play: async ({ canvas }) => {
    await canvas.findByText(ANSWER_INFO.asteroid.summary);
    await expect(canvas.queryByRole("img")).toBeNull();
  },
};

/** Commons authors can run long; the credit wraps rather than being cut off. */
const LONG_CREDIT =
  'Screenshot from "Internet Archive" of the movie Dracula (1931), cropped and retouched · Public domain · Wikimedia Commons';

export const LongCredit: Story = {
  beforeEach() {
    mocked(fetchAnswerInfo).mockResolvedValue({
      ...ANSWER_INFO.asteroid,
      image: { ...ANSWER_INFO.asteroid.image, credit: LONG_CREDIT },
    });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(LONG_CREDIT)).toBeVisible();
  },
};
