"use client";

import { StarHost } from "./StarHost";

/** Loading state shown while a puzzle is being fetched. */
export function StageLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-lav">
      <StarHost expression="curious" size={64} />
      <p className="text-sm lg:text-base">Setting the stage…</p>
    </div>
  );
}

/**
 * Scroll area for a screen that can be taller than the window.
 *
 * The page frame never scrolls: it is exactly the window's height and hides
 * overflow. So a screen whose content can grow must scroll itself, or the
 * bottom of it is cut off with no way to reach it. The scroll area spans the
 * full width, so on desktop the scrollbar sits at the window edge.
 * `className` styles the centred column inside it.
 *
 * With `center`, a column shorter than the window is centred vertically. A
 * taller one starts at the top and scrolls. (Centring with justify-center
 * instead would push the top of a tall column above the scroll area, out of
 * reach.)
 */
export function ScrollScreen({
  className,
  center = false,
  children,
}: {
  className: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className={`mx-auto w-full flex-none ${center ? "my-auto" : ""} ${className}`}>
        {children}
      </div>
    </div>
  );
}

/** Daily badge: current streak. */
export function StreakChip({ streak }: { streak: number }) {
  return (
    <div className="pill-gold flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold lg:px-3.5 lg:py-1.5 lg:text-[15px]">
      <span aria-hidden>🔥</span>
      <span aria-label={`${streak} day streak`}>{streak}</span>
    </div>
  );
}

/** Practice badge: points banked this session. */
export function ScoreChip({ score }: { score: number }) {
  return (
    <div className="pill-gold flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold lg:px-3.5 lg:py-1.5 lg:text-[15px]">
      <span aria-hidden>★</span>
      <span aria-label={`${score} points this session`}>{score}</span>
    </div>
  );
}
