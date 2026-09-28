/**
 * Server-side lookup of the picture and summary shown with a revealed answer.
 *
 * Two calls to the MediaWiki API, both cached hard: the article's lead image
 * and intro (`prop=pageimages|extracts`), then that file's author/license
 * (`prop=imageinfo`) for the credit line. Everything is best-effort — a
 * non-free image just drops the picture, and any failure or timeout resolves
 * to `null` so the reveal renders the answer on its own.
 *
 * Zero configuration: no API key, no env vars. Deployments without network
 * access to Wikipedia just never show either.
 */

import "server-only";
import type { Question } from "@/lib/game/types";
import {
  SUMMARY_SENTENCES,
  THUMB_WIDTH,
  answerInfoKey,
  articleUrl,
  cleanSummary,
  commonsFileUrl,
  formatCredit,
  isCommonsFile,
  pageTitleFor,
  searchQueryFor,
  stripThumbQuery,
  titleMatchesAnswer,
  type AnswerImage,
  type AnswerInfo,
} from "./answerInfo";

const API = "https://en.wikipedia.org/w/api.php";
// Wikimedia's API etiquette asks for a descriptive agent with a contact URL.
const USER_AGENT = "Triveal/0.1 (https://github.com/byebrianwong/triveal)";
/** Answer info is effectively static; a month between refetches is plenty. */
const REVALIDATE_SECONDS = 60 * 60 * 24 * 30;
const TIMEOUT_MS = 6000;
/** Search results to walk before settling for no picture. */
const MAX_SEARCH_CANDIDATES = 3;
const MEMO_LIMIT = 500;

/**
 * Per-process memo on top of the fetch cache, negatives included — a daily
 * question is revealed by every player at once, and answers without an article
 * shouldn't re-ask Wikipedia every time.
 */
const memo = new Map<string, AnswerInfo | null>();

interface WikiPage {
  title: string;
  missing?: boolean;
  /** Lead image file name, without the "File:" prefix. */
  pageimage?: string;
  thumbnail?: { source: string; width: number; height: number };
  pageprops?: { disambiguation?: string };
  /** Plain-text intro, cut to `SUMMARY_SENTENCES` sentences. */
  extract?: string;
}

interface PagesResponse {
  query?: { pages?: WikiPage[] };
}

interface SearchResponse {
  query?: { search?: { title: string }[] };
}

interface FileResponse {
  query?: {
    pages?: {
      imageinfo?: {
        descriptionurl?: string;
        extmetadata?: Record<string, { value?: string } | undefined>;
      }[];
    }[];
  };
}

async function wikiQuery<T>(params: Record<string, string>): Promise<T | null> {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const request = fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "force-cache",
    next: { revalidate: REVALIDATE_SECONDS },
  })
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null);
  // Race rather than abort: a slow request still fills the cache for next time,
  // and no reveal ever waits on Wikipedia for longer than this.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([request, timeout]);
}

/** The article's lead image at `THUMB_WIDTH` and its intro, following redirects. */
async function lookupPage(title: string): Promise<WikiPage | null> {
  const data = await wikiQuery<PagesResponse>({
    action: "query",
    redirects: "1",
    prop: "pageimages|pageprops|extracts",
    piprop: "thumbnail|name",
    pithumbsize: String(THUMB_WIDTH),
    ppprop: "disambiguation",
    exintro: "1",
    explaintext: "1",
    exsentences: String(SUMMARY_SENTENCES),
    titles: title,
  });
  return data?.query?.pages?.[0] ?? null;
}

async function searchTitles(query: string): Promise<string[]> {
  const data = await wikiQuery<SearchResponse>({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "5",
  });
  return (data?.query?.search ?? []).map((r) => r.title);
}

/** Author + license for the credit line, plus the file description page. */
async function fileCredit(fileName: string): Promise<{ credit: string; creditUrl: string }> {
  const data = await wikiQuery<FileResponse>({
    action: "query",
    prop: "imageinfo",
    iiprop: "extmetadata|url",
    iiextmetadatafilter: "Artist|LicenseShortName",
    titles: `File:${fileName}`,
  });
  const info = data?.query?.pages?.[0]?.imageinfo?.[0];
  return {
    credit: formatCredit({
      artist: info?.extmetadata?.Artist?.value,
      license: info?.extmetadata?.LicenseShortName?.value,
    }),
    creditUrl: info?.descriptionurl ?? commonsFileUrl(fileName),
  };
}

/**
 * A real article: exists and is not a disambiguation page. The flag's value
 * is an empty string, so it is the key's presence that counts.
 */
function isArticle(page: WikiPage | null): page is WikiPage {
  return Boolean(page && !page.missing && page.pageprops?.disambiguation === undefined);
}

type PicturedPage = WikiPage & {
  pageimage: string;
  thumbnail: NonNullable<WikiPage["thumbnail"]>;
};

/** An article whose lead image is a free (Commons) file. */
function hasFreePicture(page: WikiPage | null): page is PicturedPage {
  return Boolean(
    isArticle(page) && page.pageimage && page.thumbnail && isCommonsFile(page.thumbnail.source),
  );
}

/**
 * Fallback when the answer's own title has no free picture (a redlink, a
 * disambiguation page, a non-free lead image): search, then keep only results
 * whose title is the answer.
 */
async function searchForPicturedPage(question: Question): Promise<PicturedPage | null> {
  const titles = (await searchTitles(searchQueryFor(question)))
    .filter((t) => titleMatchesAnswer(t, question))
    .slice(0, MAX_SEARCH_CANDIDATES);
  for (const title of titles) {
    const page = await lookupPage(title);
    if (hasFreePicture(page)) return page;
  }
  return null;
}

async function pictureFor(page: PicturedPage, question: Question): Promise<AnswerImage> {
  const { credit, creditUrl } = await fileCredit(page.pageimage);
  return {
    src: stripThumbQuery(page.thumbnail.source),
    width: page.thumbnail.width,
    height: page.thumbnail.height,
    alt: `Picture of ${question.answer}`,
    credit,
    creditUrl,
  };
}

async function resolveAnswerInfo(question: Question): Promise<AnswerInfo | null> {
  const title = pageTitleFor(question);
  if (!title) return null;

  // One article supplies both, so the summary always describes the picture.
  // Prefer one with a free picture; failing that, the answer's own article
  // still has a summary worth showing.
  const direct = await lookupPage(title);
  const page = hasFreePicture(direct)
    ? direct
    : ((await searchForPicturedPage(question)) ?? (isArticle(direct) ? direct : null));
  if (!page) return null;

  const summary = cleanSummary(page.extract ?? "") || null;
  const image = hasFreePicture(page) ? await pictureFor(page, question) : null;
  if (!summary && !image) return null;
  return { pageUrl: articleUrl(page.title), summary, image };
}

/**
 * The picture and summary for a revealed answer, or `null` when Wikipedia has
 * neither. Never throws: the round is already over and this is a garnish.
 */
export async function getAnswerInfo(question: Question): Promise<AnswerInfo | null> {
  const key = answerInfoKey(question);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let info: AnswerInfo | null = null;
  try {
    info = await resolveAnswerInfo(question);
  } catch {
    info = null;
  }

  if (memo.size >= MEMO_LIMIT) memo.clear();
  memo.set(key, info);
  return info;
}
