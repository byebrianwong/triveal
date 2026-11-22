// @vitest-environment jsdom

/**
 * Where the clue list scrolls to. The live clue sits at the bottom, so the
 * list normally scrolls all the way down. When the list is shorter than the
 * live clue (a small phone with the keyboard up), scrolling to the bottom
 * would show only the clue's last line, so it stops where the clue starts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ClueStack } from "./ClueStack";

const CLUES = ["Clue one", "Clue two", "Clue three"];

/** The "Clue N" pill sits this far above the top of the live card. */
const PILL_OFFSET = -10;

/**
 * jsdom does no layout, so give the list and the live clue the sizes and
 * positions a browser would.
 */
function layOut({ listHeight, contentHeight, liveTop }: { listHeight: number; contentHeight: number; liveTop: number }) {
  const isList = (el: Element) => el.getAttribute("role") === "region";
  vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
    return isList(this) ? listHeight : 0;
  });
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
    return isList(this) ? contentHeight : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("clue-live")) return liveTop;
    if (this.parentElement?.classList.contains("clue-live") && this.classList.contains("pill-gold")) {
      return PILL_OFFSET;
    }
    return 0;
  });
}

let scrollTo: ReturnType<typeof vi.fn<(options?: ScrollToOptions) => void>>;

beforeEach(() => {
  scrollTo = vi.fn<(options?: ScrollToOptions) => void>();
  Element.prototype.scrollTo = scrollTo as Element["scrollTo"];
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ClueStack scrolling", () => {
  it("scrolls to the bottom when the live clue fits", () => {
    // 500px of clues in a 300px list; the live clue starts at 380.
    layOut({ listHeight: 300, contentHeight: 500, liveTop: 380 });

    render(<ClueStack clues={CLUES} clueIndex={2} wrongGuesses={[]} />);

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 200, behavior: "auto" });
  });

  it("stops at the start of a live clue taller than the list", () => {
    // Only 100px of list: the bottom (400) would cut off the clue's start.
    layOut({ listHeight: 100, contentHeight: 500, liveTop: 330 });

    render(<ClueStack clues={CLUES} clueIndex={2} wrongGuesses={[]} />);

    // 330, less the pill sticking out above the card, less a 2px gap.
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 318, behavior: "auto" });
  });
});
