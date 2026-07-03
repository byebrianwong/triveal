"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPracticePuzzle, type PuzzleDto } from "@/app/actions";
import type { RoundState } from "@/lib/game/roundState";
import { Game, type GameConfig } from "./Game";
import { PracticeResult } from "./PracticeResult";
import { ScoreChip, StageLoading } from "./chrome";

/**
 * Endless solo practice: random verified questions, one after another.
 * Deliberately separate from the daily — no streak, no daily persistence.
 */
export function PracticeGame({ onExit }: { onExit: () => void }) {
  const [puzzle, setPuzzle] = useState<PuzzleDto | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [played, setPlayed] = useState(0);
  const [solved, setSolved] = useState(0);
  const seenRef = useRef<string[]>([]);

  const loadNext = useCallback(() => {
    setPuzzle(null);
    fetchPracticePuzzle(seenRef.current).then((p) => {
      seenRef.current = [...seenRef.current, p.questionId].slice(-12);
      setPuzzle(p);
    });
  }, []);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  const onResolved = useCallback((round: RoundState) => {
    setSessionScore((s) => s + round.score);
    setPlayed((p) => p + 1);
    if (round.status === "won") setSolved((s) => s + 1);
  }, []);

  if (!puzzle) return <StageLoading />;

  const config: GameConfig = {
    badge: <ScoreChip score={sessionScore} />,
    sublinePrefix: "Practice",
    onResolved,
    footerLink: { label: "← Back to today's daily", onClick: onExit },
    renderResult: (round, answer) => (
      <PracticeResult
        round={round}
        answer={answer}
        sessionScore={sessionScore}
        played={played}
        solved={solved}
        onNext={loadNext}
        onExit={onExit}
      />
    ),
  };

  // key remounts Game with a fresh round for each new question.
  return <Game key={puzzle.questionId} puzzle={puzzle} config={config} />;
}
