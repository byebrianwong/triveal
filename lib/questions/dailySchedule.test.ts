import { describe, expect, it } from "vitest";
import { addDays, planDailySchedule, type ScheduleRow, type SchedulableQuestion } from "./dailySchedule";
import { categoryGroup } from "./select";

/** Deterministic stand-in for Math.random (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES = ["Science", "History", "Music", "Movies", "Sports"];

function bank(n: number, prefix = "q"): SchedulableQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    category: CATEGORIES[i % CATEGORIES.length],
  }));
}

/** A schedule that plays `ids` one per day starting on `start`. */
function schedule(start: string, ids: string[]): ScheduleRow[] {
  return ids.map((questionId, i) => ({ playDate: addDays(start, i), questionId }));
}

const TODAY = "2026-10-03";
const FROM = "2026-10-06"; // today plus the two frozen days, plus one

describe("planDailySchedule", () => {
  it("leaves a schedule alone when it covers every question and runs far enough ahead", () => {
    const qs = bank(400);
    const rows = schedule("2026-09-01", qs.map((q) => q.id));
    expect(planDailySchedule({ rows, questions: qs, today: TODAY, rand: seeded(1) })).toBeNull();
  });

  it("gives every unscheduled question a day, starting after the frozen days", () => {
    const old = bank(400);
    const added = bank(50, "new");
    const rows = schedule("2026-09-01", old.map((q) => q.id));
    const plan = planDailySchedule({ rows, questions: [...old, ...added], today: TODAY, rand: seeded(2) });

    expect(plan).not.toBeNull();
    expect(plan!.from).toBe(FROM);
    expect(plan!.rows[0].playDate).toBe(FROM);
    expect(plan!.reasons.join(" ")).toMatch(/50 question\(s\) due a play have no day/);
    const planned = new Set(plan!.rows.map((r) => r.questionId));
    for (const q of added) expect(planned.has(q.id)).toBe(true);
  });

  it("plays every owed question once before anything already played comes back", () => {
    const old = bank(400);
    const added = bank(50, "new");
    const rows = schedule("2026-09-01", old.map((q) => q.id));
    const plan = planDailySchedule({ rows, questions: [...old, ...added], today: TODAY, rand: seeded(3) })!;

    const playedBefore = new Set(rows.filter((r) => r.playDate < FROM).map((r) => r.questionId));
    const owedCount = 450 - playedBefore.size;
    const firstRound = plan.rows.slice(0, owedCount).map((r) => r.questionId);
    expect(new Set(firstRound).size).toBe(owedCount);
    for (const id of firstRound) expect(playedBefore.has(id)).toBe(false);
  });

  it("writes one row per date with no gaps and reaches the horizon", () => {
    const qs = bank(100);
    const plan = planDailySchedule({ rows: [], questions: qs, today: TODAY, rand: seeded(4) })!;
    plan.rows.forEach((r, i) => expect(r.playDate).toBe(addDays(FROM, i)));
    expect(plan.rows.length).toBeGreaterThanOrEqual(365);
    expect(plan.to).toBe(plan.rows[plan.rows.length - 1].playDate);
    // Whole rounds of the bank: 4 rounds of 100 to pass 365 days.
    expect(plan.rows.length).toBe(400);
  });

  it("never puts the same category group on two days in a row when it can avoid it", () => {
    const qs: SchedulableQuestion[] = [
      ...bank(60).map((q) => ({ ...q, category: "Geography" })),
      ...bank(60, "l").map((q) => ({ ...q, category: "Landmarks" })),
      ...bank(120, "m").map((q, i) => ({ ...q, category: i % 2 ? "Music" : "Science" })),
    ];
    const byId = new Map(qs.map((q) => [q.id, q]));
    // Half the bank is one group (Geography and Landmarks count together),
    // which only works if the shuffle alternates all the way to the end.
    for (let seed = 1; seed <= 20; seed++) {
      const plan = planDailySchedule({ rows: [], questions: qs, today: TODAY, rand: seeded(seed) })!;
      for (let i = 1; i < 240; i++) {
        const a = categoryGroup(byId.get(plan.rows[i - 1].questionId)!.category);
        const b = categoryGroup(byId.get(plan.rows[i].questionId)!.category);
        expect(a === b, `seed ${seed}: ${plan.rows[i].playDate} repeats ${a}`).toBe(false);
      }
    }
  });

  it("drops questions that are no longer served from upcoming days", () => {
    const qs = bank(400);
    const rows = schedule("2026-09-01", qs.map((q) => q.id));
    const remaining = qs.filter((q) => q.id !== "q300");
    const plan = planDailySchedule({ rows, questions: remaining, today: TODAY, rand: seeded(6) })!;
    expect(plan.reasons.join(" ")).toMatch(/no longer served/);
    expect(plan.rows.some((r) => r.questionId === "q300")).toBe(false);
  });

  it("extends a schedule that is about to run out", () => {
    const qs = bank(40);
    const rows = schedule("2026-09-01", qs.map((q) => q.id)); // ends 2026-10-10
    const plan = planDailySchedule({ rows, questions: qs, today: TODAY, rand: seeded(7) })!;
    expect(plan.reasons.join(" ")).toMatch(/day\(s\) scheduled ahead/);
    expect(plan.rows.length).toBeGreaterThanOrEqual(365);
  });

  it("re-plans when an upcoming date has no question", () => {
    const qs = bank(400);
    const rows = schedule("2026-09-01", qs.map((q) => q.id)).filter((r) => r.playDate !== "2026-11-01");
    const plan = planDailySchedule({ rows, questions: qs, today: TODAY, rand: seeded(8) })!;
    expect(plan.reasons.join(" ")).toMatch(/no question for 2026-11-01/);
  });

  it("keeps a question played in the last month out of the first days of the next round", () => {
    const qs = bank(40);
    // Every question has been played exactly once, the last ones just now.
    const rows = schedule(addDays(FROM, -40), qs.map((q) => q.id));
    const plan = planDailySchedule({ rows, questions: qs, today: TODAY, rand: seeded(9) })!;
    const lastMonth = new Set(rows.slice(-30).map((r) => r.questionId));
    const opening = plan.rows.slice(0, 10).map((r) => r.questionId);
    for (const id of opening) expect(lastMonth.has(id)).toBe(false);
  });
});
