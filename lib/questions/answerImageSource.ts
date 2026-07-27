/**
 * Server-side lookup of the picture shown with a revealed answer.
 *
 * Two calls to the MediaWiki API, both cached hard: the article's lead image
 * (`prop=pageimages`), then that file's author/license (`prop=imageinfo`) for
 * the credit line. Everything is best-effort — any failure, timeout or
 * non-free image resolves to `null` and the reveal renders without a picture.
 *
 * Zero configuration: no API key, no env vars. Deployments with neither
 * network access to Wikipedia nor a picture for the answer just never show one.
 */

import "server-only";
import type { Question } from "@/lib/game/types";
import {
  THUMB_WIDTH,
  answerImageKey,
  articleUrl,
  commonsFileUrl,
  formatCredit,
  isCommonsFile,
  pageTitleFor,
  searchQueryFor,
  titleMatchesAnswer,
  type AnswerImage,
} from "./answerImage";

const API = "https://en.wikipedia.org/w/api.php";
// Wikimedia's API etiquette asks for a descriptive agent with a contact URL.
const USER_AGENT = "Cluedown/0.1 (https://github.com/byebrianwong/triveal)";
/** Answer artwork is effectively static; a month between refetches is plenty. */
const REVALIDATE_SECONDS = 60 * 60 * 24 * 30;
const TIMEOUT_MS = 6000;
/** Search results to walk before giving up on a picture. */
const MAX_SEARCH_CANDIDATES = 3;
const MEMO_LIMIT = 500;

/**
 * Per-process memo on top of the fetch cache, negatives included — a daily
 * question is revealed by every player at once, and answers without a picture
 * shouldn't re-ask Wikipedia every time.
 */
const memo = new Map<string, AnswerImage | null>();

interface WikiPage {
  title: string;
  missing?: boolean;
  /** Lead image file name, without the "File:" prefix. */
  pageimage?: string;
  thumbnail?: { source: string; width: number; height: number };
  pageprops?: { disambiguation?: string };
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

/** The article's lead image at `THUMB_WIDTH`, following redirects. */
async function leadImage(title: string): Promise<WikiPage | null> {
  const data = await wikiQuery<PagesResponse>({
    action: "query",
    redirects: "1",
    prop: "pageimages|pageprops",
    piprop: "thumbnail|name",
    pithumbsize: String(THUMB_WIDTH),
    ppprop: "disambiguation",
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

/** A page we can actually use: exists, not a disambiguation, free picture. */
function usablePage(page: WikiPage | null): page is WikiPage & { pageimage: string } {
  return Boolean(
    page &&
      !page.missing &&
      !page.pageprops?.disambiguation &&
      page.pageimage &&
      page.thumbnail &&
      isCommonsFile(page.thumbnail.source),
  );
}

/**
 * Fallback when the answer's own title misses (a redlink, a disambiguation
 * page, a non-free lead image): search, then keep only results whose title is
 * the answer.
 */
async function searchForPage(question: Question): Promise<WikiPage | null> {
  const titles = (await searchTitles(searchQueryFor(question)))
    .filter((t) => titleMatchesAnswer(t, question))
    .slice(0, MAX_SEARCH_CANDIDATES);
  for (const title of titles) {
    const page = await leadImage(title);
    if (usablePage(page)) return page;
  }
  return null;
}

async function resolveAnswerImage(question: Question): Promise<AnswerImage | null> {
  const title = pageTitleFor(question);
  if (!title) return null;

  const direct = await leadImage(title);
  const page = usablePage(direct) ? direct : await searchForPage(question);
  if (!usablePage(page) || !page.thumbnail) return null;

  const { credit, creditUrl } = await fileCredit(page.pageimage);
  return {
    src: page.thumbnail.source,
    width: page.thumbnail.width,
    height: page.thumbnail.height,
    alt: `Picture of ${question.answer}`,
    pageUrl: articleUrl(page.title),
    credit,
    creditUrl,
  };
}

/**
 * The picture for a revealed answer, or `null` when there isn't a usable one.
 * Never throws: the round is already over and the picture is a garnish.
 */
export async function getAnswerImage(question: Question): Promise<AnswerImage | null> {
  const key = answerImageKey(question);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let image: AnswerImage | null = null;
  try {
    image = await resolveAnswerImage(question);
  } catch {
    image = null;
  }

  if (memo.size >= MEMO_LIMIT) memo.clear();
  memo.set(key, image);
  return image;
}
