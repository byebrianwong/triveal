"use client";

import { StarHost } from "./StarHost";

/** Loading state shown while a puzzle is being fetched. */
export function StageLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-lav">
      <StarHost expression="curious" size={64} />
      <p className="text-sm">Setting the stage…</p>
    </div>
  );
}

/** Daily badge: current streak. */
export function StreakChip({ streak }: { streak: number }) {
  return (
    <div className="pill-gold flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold">
      <span aria-hidden>🔥</span>
      <span aria-label={`${streak} day streak`}>{streak}</span>
    </div>
  );
}

/** Practice badge: points banked this session. */
export function ScoreChip({ score }: { score: number }) {
  return (
    <div className="pill-gold flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold">
      <i className="ti ti-star" aria-hidden />
      <span aria-label={`${score} points this session`}>{score}</span>
    </div>
  );
}
