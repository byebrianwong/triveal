import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mocked, fn } from "storybook/test";
import { fetchAnswerInfo } from "@/app/actions";
import { ANSWER_INFO, DAILY_PUZZLE, ROUND_LOST, ROUND_WON, STATS } from "../.storybook/fixtures";
import { ResultPanel } from "./ResultPanel";

/**
 * The daily's finished-round panel on its own. On desktop the round's grid
 * splits it into two columns; that layout is in Screens/Daily.
 */
const meta = {
  title: "Components/Daily result",
  component: ResultPanel,
  args: {
    round: ROUND_WON,
    answer: "Asteroid",
    questionId: DAILY_PUZZLE.questionId,
    dailyNumber: DAILY_PUZZLE.dailyNumber,
    clueCount: DAILY_PUZZLE.clueCount,
    stats: STATS,
    onSecondary: fn(),
    secondaryLabel: "Practice more questions",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-md">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResultPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const waitForPicture: Story["play"] = async ({ canvas }) => {
  await canvas.findByRole("img", { name: ANSWER_INFO.asteroid.image.alt });
};

/** Solved on clue 2 after a miss: the score breakdown line shows. */
export const SolvedAfterAMiss: Story = { play: waitForPicture };

/** A clean solve on the first clue: full 10 points, no breakdown line. */
export const SolvedOnClueOne: Story = {
  args: {
    round: { clueIndex: 0, wrongGuesses: [], status: "won", solvedClueIndex: 0, score: 10 },
  },
  play: waitForPicture,
};

export const OutOfClues: Story = {
  args: { round: ROUND_LOST },
  play: waitForPicture,
};

/** First game ever, and an answer Wikipedia has nothing on. */
export const FirstGameNoPicture: Story = {
  args: {
    round: ROUND_LOST,
    stats: { ...STATS, gamesPlayed: 1, wins: 0, currentStreak: 0, maxStreak: 0, solveDistribution: [0, 0, 0, 0, 0] },
  },
  beforeEach() {
    mocked(fetchAnswerInfo).mockResolvedValue(null);
  },
};
