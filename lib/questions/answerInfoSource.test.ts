import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/game/types";
import { getAnswerInfo } from "./answerInfoSource";

/** A Commons thumbnail (freely licensed) vs. an English-Wikipedia upload. */
const commonsThumb = (name: string) => ({
  source: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/${name}/640px-${name}`,
  width: 640,
  height: 480,
});
/** Where Wikipedia now serves scaled Commons thumbnails from. */
const commonsScaledThumb = (name: string) => ({
  source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b/${name}/960px-${name}?utm_source=en.wikipedia.org&utm_campaign=api`,
  width: 640,
  height: 891,
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
  extract?: string;
}

interface Fixture {
  /** Article title -> what prop=pageimages|extracts returns for it. */
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

describe("getAnswerInfo", () => {
  it("returns the article's summary and lead image with author and license credit", async () => {
    stubWikipedia({
      pages: {
        Salt: {
          title: "Salt",
          pageimage: "Salt shaker.jpg",
          thumbnail: commonsThumb("Salt.jpg"),
          extract: "Salt is a mineral composed primarily of sodium chloride.",
        },
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

    expect(await getAnswerInfo(question())).toEqual({
      pageUrl: "https://en.wikipedia.org/wiki/Salt",
      summary: "Salt is a mineral composed primarily of sodium chloride.",
      image: {
        src: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Salt.jpg/640px-Salt.jpg",
        width: 640,
        height: 480,
        alt: "Picture of Salt",
        credit: "Chef · CC BY-SA 4.0 · Wikimedia Commons",
        creditUrl: "https://commons.wikimedia.org/wiki/File:Salt_shaker.jpg",
      },
    });
  });

  it("takes the answer's own article when its thumbnail is on thumb.wikimedia.org", async () => {
    // Dracula the novel, not Count Dracula the character via the alias search.
    const calls = stubWikipedia({
      pages: {
        Dracula: {
          title: "Dracula",
          pageimage: "Dracula-First-Edition-1897.jpg",
          thumbnail: commonsScaledThumb("Dracula-First-Edition-1897.jpg"),
          extract: "Dracula is an 1897 Gothic horror novel by Irish author Bram Stoker.",
        },
        "Count Dracula": {
          title: "Count Dracula",
          pageimage: "Bela_Lugosi_as_Dracula.jpg",
          thumbnail: commonsThumb("Bela_Lugosi_as_Dracula.jpg"),
        },
      },
      search: ["Dracula", "Count Dracula"],
    });

    const info = await getAnswerInfo(
      question({
        answer: "Dracula",
        answerCanonical: "dracula",
        answerAliases: ["Count Dracula"],
        category: "Literature",
      }),
    );
    expect(info?.pageUrl).toBe("https://en.wikipedia.org/wiki/Dracula");
    expect(info?.summary).toBe("Dracula is an 1897 Gothic horror novel by Irish author Bram Stoker.");
    expect(info?.image?.src).toBe(
      "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/b/Dracula-First-Edition-1897.jpg/960px-Dracula-First-Edition-1897.jpg",
    );
    expect(calls.some((url) => url.includes("list=search"))).toBe(false);
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

    const info = await getAnswerInfo(
      question({ answer: "Neptune", answerCanonical: "neptune", category: "Space" }),
    );
    expect(info?.pageUrl).toBe("https://en.wikipedia.org/wiki/Neptune_(planet)");
    // Loosely related search hits are never opened, let alone shown.
    expect(info?.image?.src).toContain("/wikipedia/commons/");
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

    const info = await getAnswerInfo(
      question({ answer: "Apple", answerCanonical: "apple", category: "Technology" }),
    );
    expect(info?.pageUrl).toBe("https://en.wikipedia.org/wiki/Apple_Inc.");
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
      await getAnswerInfo(
        question({ answer: "Star Wars", answerCanonical: "star wars", category: "Movies" }),
      ),
    ).toBeNull();
  });

  it("still shows the summary when the only picture is non-free", async () => {
    stubWikipedia({
      pages: {
        Jaws: {
          title: "Jaws",
          pageimage: "Poster.jpg",
          thumbnail: nonFreeThumb,
          extract: "Jaws is a 1975 American thriller film directed by Steven Spielberg.",
        },
      },
      search: ["Jaws"],
    });

    expect(
      await getAnswerInfo(question({ answer: "Jaws", answerCanonical: "jaws", category: "Movies" })),
    ).toEqual({
      pageUrl: "https://en.wikipedia.org/wiki/Jaws",
      summary: "Jaws is a 1975 American thriller film directed by Steven Spielberg.",
      image: null,
    });
  });

  it("never takes a summary from a disambiguation page", async () => {
    stubWikipedia({
      pages: {
        Ruby: {
          title: "Ruby",
          pageprops: { disambiguation: "" },
          extract: "Ruby may refer to:",
        },
      },
      search: [],
    });

    expect(await getAnswerInfo(question({ answer: "Ruby", answerCanonical: "ruby" }))).toBeNull();
  });

  it("gives up quietly when the answer has no article at all", async () => {
    stubWikipedia({ pages: {}, search: ["Something else entirely"] });
    expect(
      await getAnswerInfo(question({ answer: "Zzyzx Widget", answerCanonical: "zzyzx widget" })),
    ).toBeNull();
  });

  it("survives a failing API without breaking the reveal", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    expect(
      await getAnswerInfo(question({ answer: "Kangaroo", answerCanonical: "kangaroo" })),
    ).toBeNull();
  });

  it("memoizes per answer, misses included", async () => {
    const calls = stubWikipedia({
      pages: {
        Chess: { title: "Chess", pageimage: "Chess.jpg", thumbnail: commonsThumb("Chess.jpg") },
      },
    });

    const first = await getAnswerInfo(question({ answer: "Chess", answerCanonical: "chess" }));
    const before = calls.length;
    const second = await getAnswerInfo(question({ answer: "Chess", answerCanonical: "chess" }));
    expect(second).toEqual(first);
    expect(calls.length).toBe(before);
  });
});
