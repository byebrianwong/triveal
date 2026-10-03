/**
 * Daily schedule planning. Daily mode plays whichever question the
 * `triveal_daily_questions` table assigns to a date. This module decides how
 * that table should change when the question bank changes, so new questions
 * get days without anyone regenerating the schedule by hand.
 *
 * The rule: every question plays once before any question plays again. A
 * question "owes" a play when it has been played fewer times than the
 * most-played question. A re-plan deals the owed questions, shuffled, into
 * the days nobody has reached yet, then adds whole rounds of the full bank
 * until the schedule reaches a year ahead.
 *
 * Today and the next `frozenDays` dates are never changed. Players switch
 * days at their own local midnight, so the furthest-ahead time zone is
 * already on tomorrow's question while UTC is still on today's.
 *
 * Pure: no network and no clock. `pipeline/schedule-daily.ts` reads the
 * table, calls `planDailySchedule`, and writes the result.
 */

import { categoryGroup } from "./select";

export interface ScheduleRow {
  /** YYYY-MM-DD */
  playDate: string;
  questionId: string;
}

export interface SchedulableQuestion {
  id: string;
  category: string;
}

export interface DailyPlan {
  /** First date the plan writes. Every date before it is left alone. */
  from: string;
  /** Last date the plan writes. Rows after it should be deleted. */
  to: string;
  /** One row per date from `from` to `to`, with no gaps. */
  rows: ScheduleRow[];
  /** Why the schedule needed changing, for the log. */
  reasons: string[];
}

export interface PlanOptions {
  /** The current schedule, in any order. */
  rows: ScheduleRow[];
  /** Every question daily mode may serve (the verified ones). */
  questions: SchedulableQuestion[];
  /** Today's date in UTC, YYYY-MM-DD. */
  today: string;
  rand?: () => number;
  /** Dates after today that are also left alone. */
  frozenDays?: number;
  /** Re-plan when fewer days than this are scheduled past the frozen ones. */
  minDaysAhead?: number;
  /** A re-plan schedules at least this many days. */
  horizonDays?: number;
}

export const FROZEN_DAYS = 2;
export const MIN_DAYS_AHEAD = 60;
export const HORIZON_DAYS = 365;

/** Played this recently, a question goes to the back of the next round. */
const RECENT_DAYS = 30;

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle one round of questions. Recently played ones go to the back, and no
 * two days in a row share a category group unless nothing else is left.
 */
function arrange(
  questions: SchedulableQuestion[],
  prevGroup: string | null,
  recent: Set<string>,
  rand: () => number,
): SchedulableQuestion[] {
  const shuffled = shuffle(questions, rand);
  const queue = [
    ...shuffled.filter((q) => !recent.has(q.id)),
    ...shuffled.filter((q) => recent.has(q.id)),
  ];
  const left = new Map<string, number>();
  for (const q of queue) left.set(categoryGroup(q.category), (left.get(categoryGroup(q.category)) ?? 0) + 1);

  const out: SchedulableQuestion[] = [];
  let prev = prevGroup;
  while (queue.length > 0) {
    // If the biggest group is more than half of what is left, skipping it
    // now would force two of its questions together later.
    let biggest: string | null = null;
    for (const [group, n] of left) if (biggest === null || n > left.get(biggest)!) biggest = group;
    const mustTake = biggest !== prev && left.get(biggest!)! > Math.ceil((queue.length - 1) / 2);

    let i = mustTake
      ? queue.findIndex((q) => categoryGroup(q.category) === biggest)
      : queue.findIndex((q) => categoryGroup(q.category) !== prev);
    if (i === -1) i = 0;
    const [q] = queue.splice(i, 1);
    const group = categoryGroup(q.category);
    left.set(group, left.get(group)! - 1);
    out.push(q);
    prev = group;
  }
  return out;
}

/**
 * Returns the new rows for every date from the first unfrozen one on, or
 * null when the schedule already covers the bank and runs far enough ahead.
 */
export function planDailySchedule(opts: PlanOptions): DailyPlan | null {
  const {
    rows,
    questions,
    today,
    rand = Math.random,
    frozenDays = FROZEN_DAYS,
    minDaysAhead = MIN_DAYS_AHEAD,
    horizonDays = HORIZON_DAYS,
  } = opts;
  if (questions.length === 0) return null;

  const from = addDays(today, frozenDays + 1);
  const sorted = [...rows].sort((a, b) => a.playDate.localeCompare(b.playDate));
  const past = sorted.filter((r) => r.playDate < from);
  const future = sorted.filter((r) => r.playDate >= from);
  const byId = new Map(questions.map((q) => [q.id, q]));

  const plays = new Map<string, number>();
  for (const r of past) plays.set(r.questionId, (plays.get(r.questionId) ?? 0) + 1);
  const mostPlays = Math.max(...questions.map((q) => plays.get(q.id) ?? 0));
  const owed = questions.filter((q) => (plays.get(q.id) ?? 0) < mostPlays);

  const reasons: string[] = [];
  const futureIds = new Set(future.map((r) => r.questionId));
  const unscheduled = owed.filter((q) => !futureIds.has(q.id));
  if (unscheduled.length > 0) {
    reasons.push(`${unscheduled.length} question(s) due a play have no day`);
  }
  const gone = future.filter((r) => !byId.has(r.questionId));
  if (gone.length > 0) {
    reasons.push(`${gone.length} upcoming day(s) use a question that is no longer served`);
  }
  if (future.length < minDaysAhead) {
    reasons.push(`only ${future.length} day(s) scheduled ahead`);
  }
  const gap = future.findIndex((r, i) => r.playDate !== addDays(from, i));
  if (gap !== -1) {
    reasons.push(`no question for ${addDays(from, gap)}`);
  }
  if (reasons.length === 0) return null;

  const lastPast = past.length > 0 ? byId.get(past[past.length - 1].questionId) : undefined;
  let prevGroup = lastPast ? categoryGroup(lastPast.category) : null;
  let recent = new Set(past.slice(-RECENT_DAYS).map((r) => r.questionId));

  const seq: SchedulableQuestion[] = [];
  const addRound = (round: SchedulableQuestion[]) => {
    seq.push(...arrange(round, prevGroup, recent, rand));
    const last = seq[seq.length - 1];
    prevGroup = last ? categoryGroup(last.category) : prevGroup;
    recent = new Set([...past.map((r) => r.questionId), ...seq.map((q) => q.id)].slice(-RECENT_DAYS));
  };
  addRound(owed);
  while (seq.length < horizonDays) addRound(questions);

  const newRows = seq.map((q, i) => ({ playDate: addDays(from, i), questionId: q.id }));
  return { from, to: newRows[newRows.length - 1].playDate, rows: newRows, reasons };
}
