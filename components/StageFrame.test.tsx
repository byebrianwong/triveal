// @vitest-environment jsdom

/**
 * The page frame while a phone keyboard is up. Phone browsers don't shrink
 * the page for the keyboard: they slide it up under the keyboard, and the
 * header and clues go off the top of the screen. The frame instead sizes
 * itself to the visible area the browser reports and moves to where that
 * area is, so nothing the player needs leaves the screen.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StageFrame } from "./StageFrame";
import { KEYBOARD_MIN_HEIGHT_PX } from "./useFitAboveKeyboard";

const WINDOW_HEIGHT = 700;

/** A stand-in for `window.visualViewport`, which jsdom doesn't have. */
class FakeVisualViewport extends EventTarget {
  height = WINDOW_HEIGHT;
  offsetTop = 0;
  scale = 1;

  /** The browser moves or resizes the visible area, as it does for a keyboard. */
  set(next: Partial<Pick<FakeVisualViewport, "height" | "offsetTop" | "scale">>) {
    Object.assign(this, next);
    act(() => {
      this.dispatchEvent(new Event("resize"));
      this.dispatchEvent(new Event("scroll"));
    });
  }
}

let viewport: FakeVisualViewport;
let scrollIntoView: ReturnType<typeof vi.fn<Element["scrollIntoView"]>>;

function renderFrame() {
  render(
    <StageFrame>
      <input aria-label="Your answer" />
    </StageFrame>,
  );
  // The outermost element StageFrame renders.
  return screen.getByRole("textbox").closest(".stage") as HTMLElement;
}

beforeEach(() => {
  viewport = new FakeVisualViewport();
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerHeight", WINDOW_HEIGHT);
  scrollIntoView = vi.fn<Element["scrollIntoView"]>();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StageFrame with an on-screen keyboard", () => {
  it("fills the window as usual while no keyboard is up", () => {
    const frame = renderFrame();

    expect(frame.style.height).toBe("");
    expect(frame.style.transform).toBe("");
    expect(frame.dataset.keyboard).toBeUndefined();
  });

  it("fits the visible area above the keyboard and moves to where it is", () => {
    const frame = renderFrame();

    viewport.set({ height: 400, offsetTop: 300 });

    // Pinned to the window, so the browser sliding the page doesn't move it.
    expect(frame.style.position).toBe("fixed");
    expect(frame.style.height).toBe("400px");
    expect(frame.style.transform).toBe("translateY(300px)");
    expect(frame.dataset.keyboard).toBe("up");
  });

  it("follows the visible area when the browser slides the page again", () => {
    const frame = renderFrame();
    viewport.set({ height: 400, offsetTop: 300 });

    viewport.set({ offsetTop: 120 });

    expect(frame.style.transform).toBe("translateY(120px)");
  });

  it("goes back to filling the window when the keyboard closes", () => {
    const frame = renderFrame();
    viewport.set({ height: 400, offsetTop: 300 });

    viewport.set({ height: WINDOW_HEIGHT, offsetTop: 0 });

    expect(frame.style.position).toBe("");
    expect(frame.style.height).toBe("");
    expect(frame.style.transform).toBe("");
    expect(frame.dataset.keyboard).toBeUndefined();
  });

  it("scrolls the focused field into view once the frame has shrunk", () => {
    renderFrame();
    act(() => screen.getByRole("textbox").focus());

    viewport.set({ height: 400, offsetTop: 300 });
    // Sliding alone doesn't change the frame's size, so the field stays put.
    viewport.set({ offsetTop: 280 });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("leaves a pinch-zoomed page alone", () => {
    const frame = renderFrame();

    viewport.set({ height: WINDOW_HEIGHT / 2, offsetTop: 100, scale: 2 });

    expect(frame.style.height).toBe("");
    expect(frame.dataset.keyboard).toBeUndefined();
  });

  it("ignores a strip too short to be a keyboard", () => {
    const frame = renderFrame();

    viewport.set({ height: WINDOW_HEIGHT - (KEYBOARD_MIN_HEIGHT_PX - 1) });

    expect(frame.dataset.keyboard).toBeUndefined();
  });

  it("does nothing in a browser without visualViewport", () => {
    vi.stubGlobal("visualViewport", undefined);

    const frame = renderFrame();

    expect(frame.style.height).toBe("");
    expect(frame.dataset.keyboard).toBeUndefined();
  });
});
