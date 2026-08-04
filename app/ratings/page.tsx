/**
 * The review page: every question people have rated, worst first.
 *
 * Private by design — it shows answers, so anyone who could read it could
 * spoil upcoming dailies. In production it needs `?key=` matching
 * TRIVEAL_ADMIN_TOKEN, and without that variable set it simply doesn't exist
 * outside `pnpm dev`.
 */

import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { RATING_COLOR, RATING_LABEL, RatingFace } from "@/components/RatingFace";
import { ratingsBackend } from "@/lib/ratings/store";
import { buildReview, type ReviewRow } from "@/lib/ratings/review";
import type { SummarySort } from "@/lib/ratings/summary";
import { RATING_VALUES } from "@/lib/ratings/types";

export const metadata: Metadata = {
  title: "Question ratings · Triveal",
  robots: { index: false, follow: false },
};

const SORTS: { key: SummarySort; label: string }[] = [
  { key: "worst", label: "Worst first" },
  { key: "best", label: "Best first" },
  { key: "most", label: "Most rated" },
  { key: "recent", label: "Most recent" },
];

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so that case is its own check.
  return a.length === b.length && timingSafeEqual(a, b);
}

function requireAdmin(key: string | undefined): void {
  const token = process.env.TRIVEAL_ADMIN_TOKEN;
  if (token) {
    if (!tokenMatches(key, token)) notFound();
    return;
  }
  // No token configured: open in local development, absent everywhere else.
  if (process.env.NODE_ENV === "production") notFound();
}

function scoreColor(score: number): string {
  if (score >= 0.34) return "text-gold-lt";
  if (score <= -0.34) return "text-pink-lt";
  return "text-lav-lt";
}

function QuestionCard({ row }: { row: ReviewRow }) {
  const { summary } = row;
  const meta = [
    row.category,
    row.difficulty,
    `${summary.total} ${summary.total === 1 ? "rating" : "ratings"}`,
    `${summary.solved}/${summary.total} solved it`,
    `last ${summary.lastRatedAt.slice(0, 10)}`,
  ].filter(Boolean);

  return (
    <li className="rounded-2xl border border-purple-line bg-[#2c2456]/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold text-gold-lt">
            {row.answer ?? <span className="text-lav">Question no longer in the bank</span>}
          </h2>
          <p className="mt-0.5 text-[12px] text-lav">{meta.join(" · ")}</p>
          {!row.answer && (
            <p className="mt-0.5 font-mono text-[11px] text-lav-dim">{summary.questionId}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            {RATING_VALUES.map((value) => (
              <span
                key={value}
                title={RATING_LABEL[value]}
                className={`flex items-center gap-1 text-[13px] ${
                  summary.counts[value] > 0 ? RATING_COLOR[value] : "text-lav-dim"
                }`}
              >
                <RatingFace kind={value} size={20} />
                <span className="tabular-nums">{summary.counts[value]}</span>
                <span className="sr-only-live">{RATING_LABEL[value]}</span>
              </span>
            ))}
          </div>
          <div className={`w-16 text-right text-[19px] font-semibold ${scoreColor(summary.score)}`}>
            {summary.score > 0 ? "+" : ""}
            {summary.score.toFixed(2)}
          </div>
        </div>
      </div>

      {summary.comments.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-purple-line pt-3">
          {summary.comments.map((c, i) => (
            <li key={i} className="text-[13px] text-cream">
              <span className={RATING_COLOR[c.rating]}>&ldquo;{c.text}&rdquo;</span>{" "}
              <span className="text-[11.5px] text-lav">
                — {c.rating}, {c.mode}, {c.createdAt.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function RatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : undefined;
  requireAdmin(key);

  // Ratings are live data; never serve a prerendered snapshot of them.
  await connection();

  const sort = (SORTS.find((s) => s.key === params.sort)?.key ?? "worst") as SummarySort;
  const { rows, totals } = await buildReview(sort);
  const backend = ratingsBackend();

  const href = (next: SummarySort) => {
    const q = new URLSearchParams();
    if (key) q.set("key", key);
    q.set("sort", next);
    return `/ratings?${q.toString()}`;
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8">
      <h1 className="text-[26px] font-semibold text-gold-lt">Question ratings</h1>
      <p className="mt-1 text-[13px] text-lav">
        {totals.ratings} {totals.ratings === 1 ? "rating" : "ratings"} across {totals.questions}{" "}
        {totals.questions === 1 ? "question" : "questions"} · {totals.comments}{" "}
        {totals.comments === 1 ? "note" : "notes"} ·{" "}
        {backend === "supabase" ? (
          "stored in Supabase"
        ) : (
          <span className="text-[#ffd9a8]">
            stored in a local file — set SUPABASE_SERVICE_ROLE_KEY to keep these
          </span>
        )}
      </p>

      <nav className="mt-4 flex flex-wrap gap-2" aria-label="Sort ratings">
        {SORTS.map((s) => (
          <a
            key={s.key}
            href={href(s.key)}
            aria-current={s.key === sort ? "true" : undefined}
            className={`rounded-full border px-3 py-1 text-[12.5px] ${
              s.key === sort
                ? "border-gold-lt text-gold-lt"
                : "border-purple-line text-lav hover:text-cream"
            }`}
          >
            {s.label}
          </a>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-8 text-[14px] text-lav">
          No ratings yet. They appear here as soon as someone rates a question at the end of a
          round.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {rows.map((row) => (
            <QuestionCard key={row.summary.questionId} row={row} />
          ))}
        </ul>
      )}
    </main>
  );
}
