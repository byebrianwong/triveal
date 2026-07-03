"use client";

import { useState } from "react";
import { DailyGame } from "./DailyGame";
import { PracticeGame } from "./PracticeGame";

export function HomeClient() {
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  return mode === "daily" ? (
    <DailyGame onEnterPractice={() => setMode("practice")} />
  ) : (
    <PracticeGame onExit={() => setMode("daily")} />
  );
}
