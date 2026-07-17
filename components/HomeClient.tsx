"use client";

import { useState } from "react";
import { DailyGame } from "./DailyGame";
import { PracticeGame } from "./PracticeGame";
import { PartyGame } from "./PartyGame";

type Mode = "daily" | "practice" | "party";

export function HomeClient() {
  const [mode, setMode] = useState<Mode>("daily");

  if (mode === "practice") return <PracticeGame onExit={() => setMode("daily")} />;
  if (mode === "party") return <PartyGame onExit={() => setMode("daily")} />;
  return (
    <DailyGame
      onEnterPractice={() => setMode("practice")}
      onEnterParty={() => setMode("party")}
    />
  );
}
