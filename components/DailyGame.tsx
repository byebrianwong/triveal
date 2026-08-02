"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDailyPuzzle, type DailyPuzzleDto } from "@/app/actions";
import { localDateString } from "@/lib/game/daily";
import type { RoundState } from "@/lib/game/roundState";
import { applyResult, initialStats, type PlayerStats } from "@/lib/game/stats";
import { Game, type GameConfig } from "./Game";
import { ResultPanel } from "./ResultPanel";
import { StageLoading, StreakChip } from "./chrome";

const ROUND_KEY = (date: string) => `triveal:round:${date}`;
const STATS_KEY = "triveal:stats";

// Keys before the Cluedown → Triveal rename. Read once as a fallback so the
// rename doesn't wipe an existing player's streak or their in-progress round;
// whatever is found is rewritten under the new key and the old one dropped.
const LEGACY_ROUND_KEY = (date: string) => `cluedown:round:${date}`;
const LEGACY_STATS_KEY = "cluedown:stats";

function loadJson<T>(key: string, legacyKey?: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
    if (!legacyKey) return null;
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) return null;
    localStorage.setItem(key, legacy);
    localStorage.removeItem(legacyKey);
    return JSON.parse(legacy) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/blocked — play proceeds without persistence
  }
}

export function DailyGame({
  onEnterPractice,
  onEnterParty,
}: {
  onEnterPractice: () => void;
  onEnterParty: () => void;
}) {
  const [puzzle, setPuzzle] = useState<DailyPuzzleDto | null>(null);
  const [stats, setStats] = useState<PlayerStats>(initialStats());
  const [restored, setRestored] = useState<RoundState | null | undefined>(undefined);
  const dateRef = useRef(localDateString());

  useEffect(() => {
    const dateStr = dateRef.current;
    // Load persisted state and the puzzle together, applying them once the
    // fetch resolves. The view gates on `!puzzle || restored === undefined`,
    // so a single post-fetch update renders the ready stage in one pass.
    fetchDailyPuzzle(dateStr).then((p) => {
      setStats(loadJson<PlayerStats>(STATS_KEY, LEGACY_STATS_KEY) ?? initialStats());
      setRestored(loadJson<RoundState>(ROUND_KEY(dateStr), LEGACY_ROUND_KEY(dateStr)) ?? null);
      setPuzzle(p);
    });
  }, []);

  const onRoundChange = useCallback((round: RoundState) => {
    saveJson(ROUND_KEY(dateRef.current), round);
  }, []);

  const onResolved = useCallback((round: RoundState) => {
    setStats((prev) => {
      const next = applyResult(prev, dateRef.current, round);
      saveJson(STATS_KEY, next);
      return next;
    });
  }, []);

  if (!puzzle || restored === undefined) return <StageLoading />;

  const config: GameConfig = {
    badge: <StreakChip streak={stats.currentStreak} />,
    sublinePrefix: `Daily No. ${puzzle.dailyNumber}`,
    restoredRound: restored,
    onRoundChange,
    onResolved,
    footerLink: { label: "Practice more questions →", onClick: onEnterPractice },
    footerLinkAlt: { label: "Party mode →", onClick: onEnterParty },
    renderResult: (round, answer) => (
      <ResultPanel
        round={round}
        answer={answer}
        questionId={puzzle.questionId}
        dailyNumber={puzzle.dailyNumber}
        clueCount={puzzle.clueCount}
        stats={stats}
        onSecondary={onEnterPractice}
        secondaryLabel="Practice more questions"
      />
    ),
  };

  return <Game puzzle={puzzle} config={config} />;
}
