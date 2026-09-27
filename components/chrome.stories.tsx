import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ScoreChip, StreakChip } from "./chrome";

/** The gold chip in the top-right corner: streak on the daily, score in practice. */
const meta = {
  title: "Components/Chips",
  component: StreakChip,
  args: { streak: 6 },
} satisfies Meta<typeof StreakChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StreakAndScore: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <StreakChip streak={0} />
      <StreakChip streak={6} />
      <StreakChip streak={128} />
      <ScoreChip score={0} />
      <ScoreChip score={34} />
    </div>
  ),
};
