// @vitest-environment jsdom

/**
 * The rating control after a finished round. The interesting behaviour is all
 * about not asking twice: one tap sends one rating, changing your mind revises
 * that same rating rather than stacking another, and a question you already
 * rated comes back showing your verdict.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RateQuestion } from "./RateQuestion";

// The real module is a "use server" file that reaches for the question bank.
vi.mock("@/app/actions", () => ({
  rateQuestion: vi.fn(),
  commentOnRating: vi.fn(),
}));

import { commentOnRating, rateQuestion } from "@/app/actions";

const rate = vi.mocked(rateQuestion);
const comment = vi.mocked(commentOnRating);

const face = (label: string) => screen.getByRole("button", { name: label });

async function click(label: string) {
  await act(async () => {
    fireEvent.click(face(label));
  });
}

function show(props: Partial<React.ComponentProps<typeof RateQuestion>> = {}) {
  return render(
    <RateQuestion questionId="salt" mode="daily" solved={true} {...props} />,
  );
}

beforeEach(() => {
  localStorage.clear();
  rate.mockReset();
  comment.mockReset();
  rate.mockResolvedValue({ ratingId: "rating-1" });
  comment.mockResolvedValue(true);
});

afterEach(cleanup);

describe("RateQuestion", () => {
  it("sends the rating with the round's context on the first tap", async () => {
    show({ solved: false });
    await click("Good question");

    expect(rate).toHaveBeenCalledTimes(1);
    expect(rate).toHaveBeenCalledWith({
      questionId: "salt",
      rating: "good",
      mode: "daily",
      solved: false,
    });
    expect(face("Good question").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Thanks!")).toBeTruthy();
  });

  it("revises the rating already sent instead of adding a second one", async () => {
    show();
    await click("Bad question");
    await click("Good question");

    expect(rate).toHaveBeenCalledTimes(2);
    expect(rate.mock.calls[1][0]).toMatchObject({ rating: "good", ratingId: "rating-1" });
    expect(face("Bad question").getAttribute("aria-pressed")).toBe("false");
  });

  it("ignores a tap on the face already chosen", async () => {
    show();
    await click("Okay question");
    await click("Okay question");

    expect(rate).toHaveBeenCalledTimes(1);
  });

  it("keeps the note out of the way until it is asked for", async () => {
    show();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a note" })).toBeNull();

    await click("Bad question");
    expect(screen.queryByRole("textbox")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
    });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("attaches a note to the rating already sent", async () => {
    show();
    await click("Bad question");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add a note" }));
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  clue 3 gives it away  " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });

    expect(comment).toHaveBeenCalledWith("rating-1", "clue 3 gives it away");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Note saved")).toBeTruthy();
  });

  it("shows your earlier verdict when a rated question comes back", async () => {
    show();
    await click("Good question");
    cleanup();

    show();
    await waitFor(() => expect(face("Good question").getAttribute("aria-pressed")).toBe("true"));
    expect(rate).toHaveBeenCalledTimes(1); // re-rendering is not a re-rating
  });

  it("does not confuse one question's rating for another's", async () => {
    show();
    await click("Bad question");
    cleanup();

    show({ questionId: "octopus" });
    await act(async () => {});
    expect(face("Bad question").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("How was this question?")).toBeTruthy();
  });

  it("says so when the rating could not be stored", async () => {
    rate.mockResolvedValue({ ratingId: null });
    show();
    await click("Bad question");

    expect(screen.getByText(/Couldn’t save that/)).toBeTruthy();
    // No note prompt — there is no stored rating to attach one to.
    expect(screen.queryByRole("button", { name: "Add a note" })).toBeNull();
  });
});
