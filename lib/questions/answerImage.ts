/**
 * Answer artwork — the picture shown beside the answer once a round is over
 * (a salt shaker for "Salt", an octopus for "Octopus").
 *
 * Pictures are Wikipedia's lead image for the answer's article, restricted to
 * files hosted on Wikimedia Commons: Commons files are freely licensed, while
 * the images English Wikipedia hosts itself (upload.wikimedia.org/wikipedia/en/…)
 * are mostly non-free fair-use posters and logos we have no right to reuse. An
 * answer whose only picture is non-free simply gets no picture — a missing
 * image is a non-event for the UI.
 *
 * This module is pure (no network, no React) so the resolution rules are unit
 * tested; `answerImageSource.ts` does the fetching on the server.
 */

import { normalizeAnswer } from "@/lib/game/answerMatch";
import type { Question } from "@/lib/game/types";

/** Everything the client needs to render (and credit) one picture. */
export interface AnswerImage {
  /** Wikimedia Commons thumbnail URL. */
  src: string;
  width: number;
  height: number;
  alt: string;
  /** The Wikipedia article the picture leads, for a "read more" link. */
  pageUrl: string;
  /** "Author · License · Wikimedia Commons", rendered under the picture. */
  credit: string;
  /** Commons file description page — where the credit line links. */
  creditUrl: string;
}

/** Thumbnail width requested from Wikipedia (2x the ~320px display box). */
export const THUMB_WIDTH = 640;

/**
 * Hand-picked article titles for answers whose bare name is a disambiguation
 * page or another subject entirely ("Apple" the fruit, "Queen" the monarch).
 * Keyed by normalized answer; `null` suppresses the picture altogether.
 * Everything not listed here resolves from the answer itself, so this stays a
 * short list of known collisions rather than a parallel copy of the bank.
 */
export const ANSWER_PAGE_TITLES: Record<string, string | null> = {
  // Space / science
  mercury: "Mercury (planet)",
  cell: "Cell (biology)",
  // Technology — the plain names belong to a fruit, a river and an inventor
  apple: "Apple Inc.",
  amazon: "Amazon (company)",
  tesla: "Tesla, Inc.",
  // Music — bands whose names are common nouns
  queen: "Queen (band)",
  nirvana: "Nirvana (band)",
  // Film — titles shared with the thing the film is named after
  avatar: "Avatar (2009 film)",
  frozen: "Frozen (2013 film)",
  parasite: "Parasite (2019 film)",
  barbie: "Barbie (film)",
  oppenheimer: "Oppenheimer (film)",
  "wizard of oz": "The Wizard of Oz (1939 film)",
};

type AnswerLike = Pick<Question, "answer" | "answerCanonical" | "answerAliases" | "category"> &
  Partial<Pick<Question, "wikipediaTitle">>;

/** Cache/override key for a question: its fully normalized answer. */
export function answerImageKey(question: AnswerLike): string {
  return normalizeAnswer(question.answerCanonical || question.answer);
}

/**
 * The article title to try first: a hand-picked override, then whatever the
 * pipeline resolved, then the answer itself. `null` means "no picture for this
 * answer" (an explicit override).
 */
export function pageTitleFor(question: AnswerLike): string | null {
  const key = answerImageKey(question);
  if (key in ANSWER_PAGE_TITLES) return ANSWER_PAGE_TITLES[key];
  return question.wikipediaTitle?.trim() || question.answer;
}

/** Search fallback query — the category disambiguates ("Mercury" + "Space"). */
export function searchQueryFor(question: AnswerLike): string {
  return `${question.answer} ${question.category}`.trim();
}

/** Drop a trailing "(disambiguator)": "Mercury (planet)" -> "Mercury". */
function stripDisambiguator(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, "");
}

/**
 * Guard for search results: only accept an article whose title *is* the answer
 * (an alias, or the answer plus a disambiguator). Wikipedia's search happily
 * returns loosely related pages, and a confidently wrong picture is worse than
 * none — the answer has just been revealed, so the picture is read as fact.
 */
export function titleMatchesAnswer(title: string, question: AnswerLike): boolean {
  const candidates = [normalizeAnswer(title), normalizeAnswer(stripDisambiguator(title))];
  const targets = [answerImageKey(question), ...question.answerAliases.map(normalizeAnswer)];
  return targets.some((t) => t.length > 0 && candidates.includes(t));
}

/**
 * Drop the query string Wikipedia now staples onto thumbnail URLs
 * (`?utm_source=…&utm_campaign=api`). It identifies nothing about the file, and
 * next/image's `remotePatterns` entry pins the query to empty — so a tagged URL
 * is rejected by the optimizer with a 400 and the picture renders broken.
 */
export function stripThumbQuery(src: string): string {
  const query = src.indexOf("?");
  return query === -1 ? src : src.slice(0, query);
}

/**
 * True only for Wikimedia Commons files. Wikipedia's own uploads
 * (/wikipedia/en/…) are overwhelmingly non-free fair-use art: legal for an
 * encyclopedia article, not for a game to reuse.
 */
export function isCommonsFile(src: string): boolean {
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      url.hostname === "upload.wikimedia.org" &&
      url.pathname.startsWith("/wikipedia/commons/")
    );
  } catch {
    return false;
  }
}

/** Wikipedia hands back small HTML fragments for author/license metadata. */
export function plainText(html: string, maxLength = 44): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/** "Ansel Adams · CC BY-SA 4.0 · Wikimedia Commons" (parts may be missing). */
export function formatCredit(meta: { artist?: string; license?: string }): string {
  const parts = [plainText(meta.artist ?? ""), plainText(meta.license ?? "", 24)].filter(Boolean);
  parts.push("Wikimedia Commons");
  return parts.join(" · ");
}

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function commonsFileUrl(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}`;
}
