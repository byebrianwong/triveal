import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StarHost, type StarExpression } from "./StarHost";

const EXPRESSIONS: { expression: StarExpression; beat: string }[] = [
  { expression: "curious", beat: "playing" },
  { expression: "wince", beat: "wrong guess" },
  { expression: "encourage", beat: "last clue" },
  { expression: "cheer", beat: "solved" },
  { expression: "sad", beat: "out of clues" },
];

/** The star host's five faces, one per game beat. */
const meta = {
  title: "Components/Star host",
  component: StarHost,
  args: { expression: "curious" },
  parameters: {
    // Fixed-size art with no responsive styles: one size is enough.
    chromatic: { modes: { desktop: { disable: true } } },
  },
} satisfies Meta<typeof StarHost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllExpressions: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-6 text-center text-[12px] text-lav sm:grid-cols-5">
      {EXPRESSIONS.map(({ expression, beat }) => (
        <figure key={expression} className="flex flex-col items-center gap-1">
          <StarHost expression={expression} size={76} />
          <figcaption>
            <b className="block font-semibold text-cream">{expression}</b>
            {beat}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};
