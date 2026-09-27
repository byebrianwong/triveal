import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, mocked } from "storybook/test";
import { rateQuestion } from "@/app/actions";
import { RateQuestion, STORE_KEY } from "./RateQuestion";

/** The bad / okay / good faces under a finished round, and the optional note. */
const meta = {
  title: "Components/Rate question",
  component: RateQuestion,
  args: { questionId: "asteroid", mode: "daily", solved: true },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RateQuestion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotRatedYet: Story = {};

/** One tap sends the rating; the note link appears. */
export const Rated: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Good question" }));
    await canvas.findByText("Thanks!");
    await canvas.findByRole("button", { name: "Add a note" });
  },
};

export const WritingANote: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Bad question" }));
    await userEvent.click(await canvas.findByRole("button", { name: "Add a note" }));
    await userEvent.type(canvas.getByRole("textbox"), "Clue 3 gives it away.");
    await expect(canvas.getByRole("button", { name: "Send" })).toBeEnabled();
  },
};

/** Coming back to a question already rated, with a note. */
export const AlreadyRatedWithNote: Story = {
  beforeEach() {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ asteroid: { ratingId: "rating-1", rating: "okay", noted: true } }),
    );
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Note saved")).toBeVisible();
  },
};

/** The rating could not be stored: small print, and no note link. */
export const CouldNotSave: Story = {
  beforeEach() {
    mocked(rateQuestion).mockResolvedValue({ ratingId: null });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Okay question" }));
    await canvas.findByText(/Couldn’t save that/);
  },
};
