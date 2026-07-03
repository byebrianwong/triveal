"use client";

import { useEffect, useRef, useState } from "react";

/** The gold prize medallion: current clue value + wrong-guess penalty badge. */
export function Medallion({ value, penalty }: { value: number; penalty: number }) {
  const [tick, setTick] = useState(false);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setTick(true);
      const t = setTimeout(() => setTick(false), 400);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <div className="relative flex-none">
      <div
        className={`medallion relative flex h-20 w-20 flex-col items-center justify-center rounded-full ${tick ? "medallion-tick" : ""}`}
      >
        <span className="medallion-shine" />
        <span className="text-[29px] font-semibold leading-none">{value}</span>
        <span className="text-[8px] uppercase tracking-[1.5px]">points</span>
      </div>
      {penalty > 0 && (
        <div className="absolute -right-2 -top-1.5 rounded-full border-2 border-[#221b40] bg-pink px-2 py-px text-xs font-semibold text-white">
          −{penalty}
        </div>
      )}
    </div>
  );
}
