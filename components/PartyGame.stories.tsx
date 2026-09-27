import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, mocked, waitFor } from "storybook/test";
import { getPartyState } from "@/app/party-actions";
import type { PartyStateDto } from "@/app/party-actions";
import { partyRealtimeConfigured } from "@/lib/supabase/browserClient";
import {
  ANSWER_IMAGES,
  PARTY_FINISHED,
  PARTY_IDENTITY_GUEST,
  PARTY_IDENTITY_HOST,
  PARTY_LOBBY,
  PARTY_ROUND_IN_PLAY,
  PARTY_ROUND_RESOLVED,
  PRACTICE_PUZZLE,
} from "../.storybook/fixtures";
import { IDENTITY_KEY, PartyGame } from "./PartyGame";
import { StageFrame } from "./StageFrame";

/**
 * Party mode from joining to the final standings. The room state comes from
 * the stand-in `getPartyState`; the real game polls it, just as it would with
 * realtime switched off.
 */
const meta = {
  title: "Screens/Party",
  component: PartyGame,
  args: { onExit: fn() },
  parameters: { screen: true },
  decorators: [
    (Story) => (
      <StageFrame>
        <Story />
      </StageFrame>
    ),
  ],
} satisfies Meta<typeof PartyGame>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seat this browser in the room as `identity`, looking at `state`. */
function inRoom(identity: { gameId: string; playerId: string }, state: PartyStateDto) {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  mocked(getPartyState).mockResolvedValue(state);
}

/** A deployment without Supabase keys. */
export const NotSetUp: Story = {
  beforeEach() {
    mocked(partyRealtimeConfigured).mockReturnValue(false);
  },
  play: async ({ canvas }) => {
    await canvas.findByText("Party mode isn't set up yet");
  },
};

export const CreateRoom: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole("heading", { name: "Party mode" });
    const name = canvas.getByRole("textbox", { name: "Your name" });
    await waitFor(() => expect(name).toHaveFocus());
  },
};

export const JoinRoom: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "Join room" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Your name" }), "Grace");
    await userEvent.type(canvas.getByRole("textbox", { name: "Room code" }), "qzrt");
    await expect(canvas.getByRole("textbox", { name: "Room code" })).toHaveValue("QZRT");
  },
};

export const LobbyAsHost: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_HOST, PARTY_LOBBY);
  },
  play: async ({ canvas }) => {
    await canvas.findByText("QZRT");
    await expect(canvas.getByRole("button", { name: /Start game/ })).toBeEnabled();
  },
};

export const LobbyAsGuest: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_GUEST, { ...PARTY_LOBBY, youAreHost: false });
  },
  play: async ({ canvas }) => {
    await canvas.findByText("Waiting for the host to start…");
  },
};

/** The host's view mid-round: guess box, reveal button, live scores. */
export const RoundInPlay: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_HOST, PARTY_ROUND_IN_PLAY);
  },
  play: async ({ canvas }) => {
    await canvas.findByText(PRACTICE_PUZZLE.clues[1]);
    await expect(canvas.getByRole("button", { name: "Reveal next clue" })).toBeVisible();
  },
};

/** A guest who guessed wrong on this clue and has to wait for the next. */
export const LockedOut: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_GUEST, {
      ...PARTY_ROUND_IN_PLAY,
      youAreHost: false,
      round: { ...PARTY_ROUND_IN_PLAY.round!, youLockedOut: true },
    });
  },
  play: async ({ canvas }) => {
    const box = await canvas.findByPlaceholderText("Locked out — wait for the next clue");
    await expect(box).toBeDisabled();
  },
};

/** Someone else got it: the answer, its picture, and the host's Next button. */
export const RoundResolved: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_HOST, PARTY_ROUND_RESOLVED);
  },
  play: async ({ canvas }) => {
    await canvas.findByText("won this round!", { exact: false });
    await canvas.findByRole("img", { name: ANSWER_IMAGES.octopus.alt });
    await expect(canvas.getByRole("button", { name: /Next round/ })).toBeVisible();
  },
};

export const FinalResults: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_HOST, PARTY_FINISHED);
  },
  play: async ({ canvas }) => {
    await canvas.findByText("🥇 Grace wins!");
  },
};

/** The room could not be reached. */
export const ConnectionLost: Story = {
  beforeEach() {
    inRoom(PARTY_IDENTITY_GUEST, PARTY_LOBBY);
    mocked(getPartyState).mockRejectedValue(new Error("Lost connection to the game."));
  },
  play: async ({ canvas }) => {
    await canvas.findByText("Lost connection to the game.");
    await expect(canvas.getByRole("button", { name: "Leave game" })).toBeVisible();
  },
};
