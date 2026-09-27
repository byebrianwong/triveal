// @vitest-environment jsdom

/**
 * Enter-to-continue and desktop autofocus. The rules that matter: Enter only
 * fires when no control has a use for it, never in the first moments after a
 * screen appears (a double-tapped Enter must not skip the answer reveal), and
 * nothing grabs focus on a touchscreen.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ENTER_ARM_DELAY_MS, focusForTyping, useEnterKey } from "./keyboard";

function Screen({ onEnter, enabled }: { onEnter: () => void; enabled?: boolean }) {
  useEnterKey(onEnter, enabled);
  return (
    <div>
      <input aria-label="note" />
      <button type="button">Share</button>
    </div>
  );
}

function pressEnter(target: Element = document.body, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(target, { key: "Enter", ...init });
}

function stubPointer(kind: "fine" | "coarse") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === `(pointer: ${kind})`,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useEnterKey", () => {
  it("fires on Enter once the screen has settled", () => {
    const onEnter = vi.fn();
    render(<Screen onEnter={onEnter} />);

    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);
    pressEnter();

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("ignores an Enter that arrives with the screen", () => {
    const onEnter = vi.fn();
    render(<Screen onEnter={onEnter} />);

    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS - 50);
    pressEnter();

    expect(onEnter).not.toHaveBeenCalled();
  });

  it("leaves Enter to a focused field or button", () => {
    const onEnter = vi.fn();
    render(<Screen onEnter={onEnter} />);
    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);

    pressEnter(screen.getByRole("textbox"));
    pressEnter(screen.getByRole("button", { name: "Share" }));

    expect(onEnter).not.toHaveBeenCalled();
  });

  it("ignores held keys, modified Enter and other keys", () => {
    const onEnter = vi.fn();
    render(<Screen onEnter={onEnter} />);
    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);

    pressEnter(document.body, { repeat: true });
    pressEnter(document.body, { metaKey: true });
    pressEnter(document.body, { shiftKey: true });
    fireEvent.keyDown(document.body, { key: " " });

    expect(onEnter).not.toHaveBeenCalled();
  });

  it("does nothing while disabled or after unmount", () => {
    const onEnter = vi.fn();
    const { rerender, unmount } = render(<Screen onEnter={onEnter} enabled={false} />);
    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);
    pressEnter();
    expect(onEnter).not.toHaveBeenCalled();

    rerender(<Screen onEnter={onEnter} enabled />);
    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);
    unmount();
    pressEnter();
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("calls the latest handler without re-arming", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Screen onEnter={first} />);
    vi.advanceTimersByTime(ENTER_ARM_DELAY_MS);

    rerender(<Screen onEnter={second} />);
    pressEnter();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("focusForTyping", () => {
  it("focuses the field with a mouse or trackpad", () => {
    stubPointer("fine");
    render(<input aria-label="answer" />);
    focusForTyping(screen.getByRole("textbox"));
    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it("leaves a touchscreen alone so no keyboard pops up", () => {
    stubPointer("coarse");
    render(<input aria-label="answer" />);
    focusForTyping(screen.getByRole("textbox"));
    expect(document.activeElement).toBe(document.body);
  });
});
