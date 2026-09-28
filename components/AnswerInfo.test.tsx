// @vitest-environment jsdom

/**
 * The picture and summary under a revealed answer. What matters: the summary
 * shows with or without a picture, the credit line is shown whole, and the
 * previous answer's info never lingers while the next one loads.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { AnswerInfo as AnswerInfoData } from "@/lib/questions/answerInfo";
import { AnswerInfo } from "./AnswerInfo";

// The real module is a "use server" file that reaches for the question bank.
vi.mock("@/app/actions", () => ({
  fetchAnswerInfo: vi.fn(),
}));

import { fetchAnswerInfo } from "@/app/actions";

const fetchInfo = vi.mocked(fetchAnswerInfo);

const CREDIT =
  'Screenshot from "Internet Archive" of the movie Dracula (1931) · Public domain · Wikimedia Commons';

const DRACULA: AnswerInfoData = {
  pageUrl: "https://en.wikipedia.org/wiki/Dracula",
  summary: "Dracula is an 1897 Gothic horror novel by Irish author Bram Stoker.",
  image: {
    src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Dracula.jpg/960px-Dracula.jpg",
    width: 640,
    height: 891,
    alt: "Picture of Dracula",
    credit: CREDIT,
    creditUrl: "https://commons.wikimedia.org/wiki/File:Dracula.jpg",
  },
};

beforeEach(() => {
  fetchInfo.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("AnswerInfo", () => {
  it("shows the picture, its full credit, the summary and a link to the article", async () => {
    fetchInfo.mockResolvedValue(DRACULA);
    render(<AnswerInfo questionId="dracula" />);

    expect(await screen.findByText(DRACULA.summary!)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Picture of Dracula" })).toBeTruthy();
    expect(screen.getByRole("link", { name: CREDIT }).getAttribute("href")).toBe(
      DRACULA.image!.creditUrl,
    );
    expect(
      screen.getByRole("link", { name: /Read more on Wikipedia/ }).getAttribute("href"),
    ).toBe(DRACULA.pageUrl);
    expect(screen.getByRole("link", { name: "CC BY-SA 4.0" })).toBeTruthy();
  });

  it("shows the summary on its own when there is no free picture", async () => {
    fetchInfo.mockResolvedValue({ ...DRACULA, image: null });
    render(<AnswerInfo questionId="dracula" />);

    expect(await screen.findByText(DRACULA.summary!)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("drops the license note when there is no summary to credit", async () => {
    fetchInfo.mockResolvedValue({ ...DRACULA, summary: null });
    render(<AnswerInfo questionId="dracula" />);

    await screen.findByRole("img", { name: "Picture of Dracula" });
    expect(screen.queryByRole("link", { name: "CC BY-SA 4.0" })).toBeNull();
  });

  it("renders nothing when Wikipedia has nothing", async () => {
    fetchInfo.mockResolvedValue(null);
    const { container } = render(<AnswerInfo questionId="zzyzx" />);

    await vi.waitFor(() => expect(fetchInfo).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("hides the previous answer's info while the next one loads", async () => {
    fetchInfo.mockResolvedValueOnce(DRACULA);
    const { rerender } = render(<AnswerInfo questionId="dracula" />);
    await screen.findByText(DRACULA.summary!);

    fetchInfo.mockReturnValueOnce(new Promise(() => {}));
    rerender(<AnswerInfo questionId="octopus" />);
    expect(screen.queryByText(DRACULA.summary!)).toBeNull();
  });
});
