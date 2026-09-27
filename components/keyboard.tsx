"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Keyboard play on desktop: the answer box takes focus by itself, and Enter
 * moves you on from screens that have no text field (a finished round, a
 * lobby). Touch devices are left alone, where focusing a field pops the
 * on-screen keyboard over the clues.
 */

/**
 * How long a screen ignores Enter after it appears. The Enter that locked in
 * a winning guess, pressed twice by a quick finger, would otherwise land on
 * the result screen and skip straight past the answer.
 */
export const ENTER_ARM_DELAY_MS = 400;

/** True for a mouse or trackpad, false for a phone or tablet touchscreen. */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches === true;
}

/** Put the caret in `el` so typing starts at once, on desktop only. */
export function focusForTyping(el: HTMLElement | null) {
  if (el && hasFinePointer()) el.focus({ preventScroll: true });
}

/**
 * A focused control keeps its own Enter: it submits a form, activates a
 * button, follows a link, or adds a line to a note.
 */
function ownsEnter(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, button, a[href], summary, [role=button]") !== null
  );
}

/**
 * Run `onEnter` when Enter is pressed anywhere on the page that no control
 * claims, for as long as `enabled` holds.
 */
export function useEnterKey(onEnter: () => void, enabled = true) {
  const fire = useEffectEvent(onEnter);

  useEffect(() => {
    if (!enabled) return;
    let armed = false;
    const timer = setTimeout(() => {
      armed = true;
    }, ENTER_ARM_DELAY_MS);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat || e.isComposing || e.defaultPrevented) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (!armed || ownsEnter(e.target)) return;
      e.preventDefault();
      fire();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}

/** A small "↵ Enter" key cap for a button that Enter triggers; desktop only. */
export function EnterHint() {
  return (
    <kbd
      aria-hidden
      className="ml-2 hidden rounded-md border border-current/35 px-1.5 py-px align-[1px] text-[10.5px] [font-family:inherit] font-medium tracking-wide opacity-70 pointer-fine:inline-block"
    >
      ↵ Enter
    </kbd>
  );
}
