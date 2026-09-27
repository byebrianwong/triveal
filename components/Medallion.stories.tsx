import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Medallion } from "./Medallion";

/** The prize medallion: what solving now is worth, and the wrong-guess badge. */
const meta = {
  title: "Components/Medallion",
  component: Medallion,
  decorators: [
    (Story) => (
      <div className="flex justify-center py-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Medallion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullValue: Story = { args: { value: 10, penalty: 0 } };

export const AfterTwoMisses: Story = { args: { value: 8, penalty: 2 } };

export const Giveaway: Story = { args: { value: 4, penalty: 0 } };
