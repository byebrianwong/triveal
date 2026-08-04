"use client";

import { useId, useState } from "react";
import { commentOnRating, rateQuestion } from "@/app/actions";
import { MAX_COMMENT_LENGTH, RATING_VALUES, type RatingMode, type RatingValue } from "@/lib/ratings/types";
import { RATING_COLOR, RATING_LABEL, RatingFace } from "./RatingFace";

/**
 * Three faces under a finished round: was that question bad, okay or good?
 *
 * One tap is the whole interaction — the rating posts immediately, and the
 * note is a small link most people will never open. Changing your mind revises
 * the rating you already sent rather than stacking another one, and what you
 * chose is remembered locally so re-opening a finished daily shows your
 * verdict instead of asking again.
 */

// Remembering the rating client-side is only about not re-asking (and not
// double-counting) the same finished round — the ratings themselves live
// server-side.
const STORE_KEY = "triveal:ratings";
const REMEMBERED = 50;

interface RememberedRating {
  ratingId: string | null;
  rating: RatingValue;
  noted?: boolean;
}

function readRemembered(questionId: string): RememberedRating | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, RememberedRating>;
    return all[questionId] ?? null;
  } catch {
    return null;
  }
}

function remember(questionId: string, value: RememberedRating) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, RememberedRating>) : {};
    all[questionId] = value;
    const keys = Object.keys(all);
    // Insertion-ordered keys: drop the oldest so this can't grow forever.
    for (const stale of keys.slice(0, Math.max(0, keys.length - REMEMBERED))) delete all[stale];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    // storage full/blocked — the rating still reached the server
  }
}

export function RateQuestion({
  questionId,
  mode,
  solved,
}: {
  questionId: string;
  mode: RatingMode;
  /** Whether this player solved the round, stored alongside the rating. */
  solved: boolean;
}) {
  // Read at mount rather than in an effect. Safe from hydration mismatch
  // because a result panel only ever exists after a round resolves in the
  // browser — the server always renders the loading stage or a live round —
  // and each question mounts its own control, so there is nothing to re-read.
  const [prior] = useState(() =>
    typeof window === "undefined" ? null : readRemembered(questionId),
  );
  const [choice, setChoice] = useState<RatingValue | null>(prior?.rating ?? null);
  const [ratingId, setRatingId] = useState<string | null>(prior?.ratingId ?? null);
  const [failed, setFailed] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(Boolean(prior?.noted));
  const [busy, setBusy] = useState(false);
  const noteId = useId();

  async function pick(rating: RatingValue) {
    if (busy || rating === choice) return;
    setChoice(rating);
    setFailed(false);
    setBusy(true);
    try {
      const res = await rateQuestion({
        questionId,
        rating,
        mode,
        solved,
        ...(ratingId ? { ratingId } : {}),
      });
      setRatingId(res.ratingId);
      setFailed(res.ratingId === null);
      remember(questionId, { ratingId: res.ratingId, rating, noted: noteSaved });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function sendNote() {
    const text = note.trim();
    if (!text || !ratingId || busy) return;
    setBusy(true);
    try {
      const ok = await commentOnRating(ratingId, text);
      setFailed(!ok);
      if (ok) {
        setNoteSaved(true);
        setNoteOpen(false);
        if (choice) remember(questionId, { ratingId, rating: choice, noted: true });
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 w-full rounded-2xl border border-purple-line/70 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="text-[11.5px] text-lav">
          {choice ? "Thanks!" : "How was this question?"}
        </span>
        <div className="flex gap-1" role="group" aria-label="Rate this question">
          {RATING_VALUES.map((value) => {
            const on = choice === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => pick(value)}
                aria-label={RATING_LABEL[value]}
                aria-pressed={on}
                className={`rounded-full p-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${
                  on ? `${RATING_COLOR[value]} bg-[#3a3168]/70` : "text-lav-dim hover:text-cream"
                }`}
              >
                <RatingFace kind={value} />
              </button>
            );
          })}
        </div>
        {/* No note prompt without an id to attach it to — a rating that failed
            to store has nothing to hang a comment on. */}
        {choice && ratingId && !noteOpen && !noteSaved && (
          <button
            type="button"
            onClick={() => setNoteOpen(true)}
            className="rounded px-1 text-[11.5px] text-lav underline decoration-dotted underline-offset-2 hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            Add a note
          </button>
        )}
        {noteSaved && <span className="text-[11.5px] text-lav-dim">Note saved</span>}
      </div>

      {noteOpen && (
        <div className="mt-2 flex items-start gap-2">
          <label htmlFor={noteId} className="sr-only-live">
            Anything to add about this question?
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Optional — what made it good or bad?"
            autoFocus
            className="field-dark min-h-[38px] flex-1 rounded-xl px-2.5 py-1.5 text-[12.5px]"
          />
          <button
            type="button"
            onClick={sendNote}
            disabled={busy || !note.trim()}
            className="btn-gold rounded-xl px-3 py-1.5 text-[12.5px] font-semibold"
          >
            Send
          </button>
        </div>
      )}

      {failed && (
        <p className="mt-1.5 text-center text-[11px] text-lav-dim">
          Couldn&rsquo;t save that just now.
        </p>
      )}
    </div>
  );
}
