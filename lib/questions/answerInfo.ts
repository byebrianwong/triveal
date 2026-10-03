/**
 * Answer info — what the reveal shows about the answer once a round is over:
 * a picture (a salt shaker for "Salt", an octopus for "Octopus") and the first
 * couple of sentences of its Wikipedia article.
 *
 * Both come from the answer's Wikipedia article. Pictures are its lead image,
 * restricted to files hosted on Wikimedia Commons: Commons files are freely
 * licensed, while the images English Wikipedia hosts itself
 * (upload.wikimedia.org/wikipedia/en/…) are mostly non-free fair-use posters
 * and logos we have no right to reuse. An answer whose only picture is non-free
 * gets the summary without a picture, and an answer with no article gets
 * neither — missing info is a non-event for the UI.
 *
 * This module is pure (no network, no React) so the resolution rules are unit
 * tested; `answerInfoSource.ts` does the fetching on the server.
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
  /** "Author · License · Wikimedia Commons", rendered under the picture. */
  credit: string;
  /** Commons file description page — where the credit line links. */
  creditUrl: string;
}

/** What the reveal shows about an answer. At least one of the two is set. */
export interface AnswerInfo {
  /** The Wikipedia article both come from, for a "read more" link. */
  pageUrl: string;
  /** The article's opening sentence or two, as plain text. */
  summary: string | null;
  image: AnswerImage | null;
}

/** Thumbnail width requested from Wikipedia (2x the ~320px display box). */
export const THUMB_WIDTH = 640;

/** Sentences of the article's intro to ask Wikipedia for. */
export const SUMMARY_SENTENCES = 2;

/**
 * Longest summary shown. Two sentences almost always fit; a rambling one is
 * cut at a word, and the "read more" link covers the rest.
 */
export const SUMMARY_MAX_LENGTH = 320;

/**
 * Hand-picked article titles for answers whose bare name is a disambiguation
 * page or another subject entirely ("Apple" the fruit, "Queen" the monarch).
 * Keyed by normalized answer; `null` suppresses the picture and summary
 * altogether.
 * Everything not listed here resolves from the answer itself, so this stays a
 * short list of known collisions rather than a parallel copy of the bank.
 */
export const ANSWER_PAGE_TITLES: Record<string, string | null> = {
  // Space, science and the body
  mercury: "Mercury (planet)",
  cell: "Cell (biology)",
  appendix: "Appendix (anatomy)",
  goosebumps: "Goose bumps", // the bare name is R. L. Stine's book series
  // Mythology — the bare name is a disambiguation page led by the Arizona city
  phoenix: "Phoenix (mythology)",
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
  casablanca: "Casablanca (film)", // the bare name is the Moroccan city
  dune: "Dune (novel)", // the bare name is the sand formation
  psycho: "Psycho (1960 film)", // the bare name is a disambiguation page
  // Video games — the bare name is the franchise, not the 1981 arcade game
  "donkey kong": "Donkey Kong (1981 video game)",
  // Television — bare names that are disambiguation pages
  bear: "The Bear (TV series)",
  survivor: "Survivor (American TV series)",
  // Places and acronyms whose article sits under a fuller name
  alcatraz: "Alcatraz Island",
  gps: "Global Positioning System",
  rickroll: "Rickrolling",
  // Nature — the bare names are disambiguation pages
  lotus: "Nelumbo nucifera",
  "corpse flower": "Amorphophallus titanum",
  // Art — the bare name is the biblical meal, not Leonardo's mural
  "last supper": "The Last Supper (Leonardo)",
  // Literature — the bare name is a disambiguation page
  "peter pan": "Peter Pan (character)",
  // Internet — the bare names are a Venetian ruler and a disambiguation page
  doge: "Doge (meme)",
  spam: "Email spam",
};

type AnswerLike = Pick<Question, "answer" | "answerCanonical" | "answerAliases" | "category"> &
  Partial<Pick<Question, "wikipediaTitle">>;

/** Cache/override key for a question: its fully normalized answer. */
export function answerInfoKey(question: AnswerLike): string {
  return normalizeAnswer(question.answerCanonical || question.answer);
}

/**
 * The article title to try first: a hand-picked override, then whatever the
 * pipeline resolved, then the answer itself. `null` means "nothing to show for
 * this answer" (an explicit override).
 */
export function pageTitleFor(question: AnswerLike): string | null {
  const key = answerInfoKey(question);
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
 * returns loosely related pages, and a confidently wrong picture or summary is
 * worse than none — the answer has just been revealed, so both are read as fact.
 */
export function titleMatchesAnswer(title: string, question: AnswerLike): boolean {
  const candidates = [normalizeAnswer(title), normalizeAnswer(stripDisambiguator(title))];
  const targets = [answerInfoKey(question), ...question.answerAliases.map(normalizeAnswer)];
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
 * Hosts Wikimedia serves Commons files from: scaled thumbnails come from
 * thumb.wikimedia.org, originals (and pictures already smaller than the
 * requested width) from upload.wikimedia.org. `next.config.ts` allows the same
 * two for next/image.
 */
const WIKIMEDIA_FILE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

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
      WIKIMEDIA_FILE_HOSTS.has(url.hostname) &&
      url.pathname.startsWith("/wikipedia/commons/")
    );
  } catch {
    return false;
  }
}

/** Longest author name in the credit line; the credit links to the full record. */
export const CREDIT_AUTHOR_MAX_LENGTH = 120;
const CREDIT_LICENSE_MAX_LENGTH = 40;

/** Wikipedia hands back small HTML fragments for author/license metadata. */
export function plainText(html: string, maxLength = CREDIT_AUTHOR_MAX_LENGTH): string {
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
  const parts = [
    plainText(meta.artist ?? ""),
    plainText(meta.license ?? "", CREDIT_LICENSE_MAX_LENGTH),
  ].filter(Boolean);
  parts.push("Wikimedia Commons");
  return parts.join(" · ");
}

/**
 * Tidy a plain-text intro extract for display. Wikipedia's plain-text mode
 * drops pronunciation markup but keeps the brackets around it, leaving
 * "Count Dracula () is…" and "Octopoda (, ok-TOP-ə-də)".
 */
export function cleanSummary(extract: string): string {
  const text = extract
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+([),.;:])/g, "$1")
    .trim();
  if (text.length <= SUMMARY_MAX_LENGTH) return text;
  const cut = text.slice(0, SUMMARY_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:]+$/, "")}…`;
}

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function commonsFileUrl(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, "_"))}`;
}
