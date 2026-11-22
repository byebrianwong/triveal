"use client";

import { useEffect, type RefObject } from "react";

/**
 * How much shorter than the window the visible area must be before it counts
 * as an on-screen keyboard. Phone keyboards take 250px or more. This leaves
 * out the slim shortcut bar an iPad shows when a hardware keyboard is
 * attached, and small differences from the browser's own toolbars.
 */
export const KEYBOARD_MIN_HEIGHT_PX = 120;

/**
 * Keep a full-window frame inside the part of the screen the player can still
 * see while an on-screen keyboard is up, and mark it `data-keyboard="up"` so
 * screens can drop what they don't need while typing (the `keyboard-up:`
 * variant in globals.css).
 *
 * Safari on iOS, and Chrome on Android, don't shrink the page when the
 * keyboard opens. They keep laying it out at full height and slide it up
 * until the focused field clears the keyboard, which pushes the header and
 * the clues off the top of the screen. `window.visualViewport` reports what
 * is still visible: its height, and how far it sits below the top of the
 * window (`offsetTop`). While the keyboard is up, the frame is pinned to the
 * window (`position: fixed`) so it stays put when the browser slides the
 * page, sized to that height, and moved down by that offset, which puts it
 * exactly over the visible area.
 *
 * Once the keyboard closes the frame goes back to its own classes. Keeping it
 * fixed would expose it to an iOS 26 Safari bug that leaves fixed elements
 * out of place after the keyboard closes:
 * https://developer.apple.com/forums/thread/800125
 *
 * Writes to the element directly rather than through React state, since the
 * browser can report a new offset on every frame while the page slides.
 */
export function useFitAboveKeyboard(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const frame = ref.current;
    if (!viewport || !frame) return;
    // Narrowed copies for the closures below.
    const vv = viewport;
    const el = frame;
    let fittedHeight: number | null = null;

    function release() {
      el.style.position = "";
      el.style.inset = "";
      el.style.height = "";
      el.style.transform = "";
      delete el.dataset.keyboard;
      fittedHeight = null;
    }

    function sync() {
      // Pinch-zoom shrinks the visible area too. Leave the frame alone then,
      // so zooming in still magnifies the page instead of reflowing it.
      const zoomed = Math.abs(vv.scale - 1) > 0.01;
      const keyboardUp = !zoomed && window.innerHeight - vv.height >= KEYBOARD_MIN_HEIGHT_PX;
      if (!keyboardUp) {
        if (fittedHeight !== null) release();
        return;
      }
      el.style.position = "fixed";
      el.style.inset = "0 0 auto 0";
      el.style.height = `${vv.height}px`;
      el.style.transform = `translateY(${vv.offsetTop}px)`;
      el.dataset.keyboard = "up";
      if (vv.height !== fittedHeight) {
        fittedHeight = vv.height;
        // The browser slid the page to bring the focused field into view.
        // A field inside a scrolling list (a note under the result, a party
        // guess under the clues) can now sit below the shrunken list's
        // visible part, so scroll the list to it.
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && el.contains(focused)) {
          focused.scrollIntoView({ block: "nearest" });
        }
      }
    }

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      release();
    };
  }, [ref]);
}
