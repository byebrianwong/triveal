import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/game/types";
import { getAnswerImage } from "./answerImageSource";

/** A Commons thumbnail (freely licensed) vs. an English-Wikipedia upload. */
const commonsThumb = (name: string) => ({
  source: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/${name}/640px-${name}`,
  width: 640,
  height: 480,
});
const nonFreeThumb = {
  source: "https://upload.wikimedia.org/wikipedia/en/2/2f/Poster.jpg",
  width: 300,
  height: 450,
};

interface WikiPage {
  title: string;
  missing?: boolean;
  pageimage?: string;
  thumbnail?: { source: string; width: number; height: number };
  pageprops?: { disambiguation?: string };
}

interface Fixture {
  /** Article title -> what prop=pageimages returns for it. */
  pages: Record<string, WikiPage>;
  /** Titles list=search returns, in order. */
  search?: string[];
  /** File name -> imageinfo payload. */
  files?: Record<string, unknown>;
}

/** Stands in for the MediaWiki API, recording every request it answers. */
function stubWikipedia(fixture: Fixture): string[] {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(url);
    const params = new URL(url).searchParams;
    let body: unknown;
    if (params.get("list") === "search") {
      body = { query: { search: (fixture.search ?? []).map((title) => ({ title })) } };
    } else if (params.get("prop") === "imageinfo") {
      const file = (params.get("titles") ?? "").replace(/^File:/, "");
      body = { query: { pages: [fixture.files?.[file] ?? {}] } };
    } else {
      const title = params.get("titles") ?? "";
      body = { query: { pages: [fixture.pages[title] ?? { title, missing: true }] } };
    }
    return { ok: true, json: async () => body };
  });
  return calls;
}

function question(over: Partial<Question> = {}): Question {
  return {
    id: "q",
    answer: "Salt",
    answerCanonical: "salt",
    answerAliases: [],
    category: "Science",
    difficulty: "easy",
    clues: [],
    decoys: [],
    ...over,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAnswerImage", () => {
  it("returns the article's lead image with author and license credit", async () => {
    stubWikipedia({
      pages: {
        Salt: { title: "Salt", pageimage: "Salt shaker.jpg", thumbnail: commonsThumb("Salt.jpg") },
      },
      files: {
        "Salt shaker.jpg": {
          imageinfo: [
            {
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Salt_shaker.jpg",
              extmetadata: {
                Artist: { value: '<a href="/wiki/User:Chef">Chef</a>' },
                LicenseShortName: { value: "CC BY-SA 4.0" },
              },
            },
          ],
        },
      },
    });

    expect(await getAnswerImage(question())).toEqual({
      src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Salt.jpg/640px-Salt.jpg",
      width: 640,
      height: 480,
      alt: "Picture of Salt",
      pageUrl: "https://en.wikipedia.org/wiki/Salt",
      credit: "Chef · CC BY-SA 4.0 · Wikimedia Commons",
      creditUrl: "https://commons.wikimedia.org/wiki/File:Salt_shaker.jpg",
    });
  });

  it("searches past a disambiguation page and takes the matching article", async () => {
    stubWikipedia({
      pages: {
        Neptune: { title: "Neptune", pageprops: { disambiguation: "" } },
        "Neptune (planet)": {
          title: "Neptune (planet)",
          pageimage: "Neptune.jpg",
          thumbnail: commonsThumb("Neptune.jpg"),
        },
      },
      search: ["Neptune in fiction", "Neptune (planet)"],
    });

    const image = await getAnswerImage(
      question({ answer: "Neptune", answerCanonical: "neptune", category: "Space" }),
    );
    expect(image?.pageUrl).toBe("https://en.wikipedia.org/wiki/Neptune_(planet)");
    // Loosely related search hits are never opened, let alone shown.
    expect(image?.src).toContain("/wikipedia/commons/");
  });

  it("follows a hand-picked override instead of the bare answer", async () => {
    const calls = stubWikipedia({
      pages: {
        "Apple Inc.": {
          title: "Apple Inc.",
          pageimage: "Apple logo.svg",
          thumbnail: commonsThumb("Apple.png"),
        },
      },
    });

    const image = await getAnswerImage(
      question({ answer: "Apple", answerCanonical: "apple", category: "Technology" }),
    );
    expect(image?.pageUrl).toBe("https://en.wikipedia.org/wiki/Apple_Inc.");
    expect(calls.join(" ")).not.toContain("titles=Apple&");
  });

  it("skips non-free Wikipedia uploads rather than reusing fair-use art", async () => {
    stubWikipedia({
      pages: {
        "Star Wars": { title: "Star Wars", pageimage: "Poster.jpg", thumbnail: nonFreeThumb },
      },
      search: ["Star Wars"],
    });

    expect(
      await getAnswerImage(
        question({ answer: "Star Wars", answerCanonical: "star wars", category: "Film" }),
      ),
    ).toBeNull();
  });

  it("gives up quietly when the answer has no article at all", async () => {
    stubWikipedia({ pages: {}, search: ["Something else entirely"] });
    expect(
      await getAnswerImage(question({ answer: "Zzyzx Widget", answerCanonical: "zzyzx widget" })),
    ).toBeNull();
  });

  it("survives a failing API without breaking the reveal", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    expect(
      await getAnswerImage(question({ answer: "Kangaroo", answerCanonical: "kangaroo" })),
    ).toBeNull();
  });

  it("memoizes per answer, misses included", async () => {
    const calls = stubWikipedia({
      pages: {
        Chess: { title: "Chess", pageimage: "Chess.jpg", thumbnail: commonsThumb("Chess.jpg") },
      },
    });

    const first = await getAnswerImage(question({ answer: "Chess", answerCanonical: "chess" }));
    const before = calls.length;
    const second = await getAnswerImage(question({ answer: "Chess", answerCanonical: "chess" }));
    expect(second).toEqual(first);
    expect(calls.length).toBe(before);
  });
});
