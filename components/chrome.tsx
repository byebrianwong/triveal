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

const ARCADE_URL = "https://byebrianwong.com";
const GITHUB_URL = "https://github.com/byebrianwong";

/**
 * Small links to Brian's other apps and his GitHub. On desktop the page frame
 * shows them along the bottom of the window. On phones they go at the end of
 * the result screens, because the playing screen has no spare room.
 */
export function SiteLinks({ className = "" }: { className?: string }) {
  const link =
    "flex items-center gap-1.5 rounded px-1 text-lav hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
  return (
    <nav aria-label="More from Brian Wong" className={`text-[12.5px] lg:text-[13px] ${className}`}>
      <a href={ARCADE_URL} className={link}>
        More from Brian&rsquo;s App Arcade
      </a>
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={link}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        @byebrianwong
      </a>
    </nav>
  );
}
