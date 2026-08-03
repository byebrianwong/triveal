import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "@/lib/game/answerMatch";
import type { Question } from "@/lib/game/types";
import {
  ANSWER_PAGE_TITLES,
  answerImageKey,
  articleUrl,
  commonsFileUrl,
  formatCredit,
  isCommonsFile,
  pageTitleFor,
  plainText,
  searchQueryFor,
  stripThumbQuery,
  titleMatchesAnswer,
} from "./answerImage";
import { SEED_QUESTIONS } from "./seed";
import { EXTRA_QUESTIONS } from "./extraBank";

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

describe("answer image titles", () => {
  it("uses the answer itself when nothing overrides it", () => {
    expect(pageTitleFor(question())).toBe("Salt");
  });

  it("prefers a hand-picked override for ambiguous answers", () => {
    expect(pageTitleFor(question({ answer: "Apple", answerCanonical: "apple" }))).toBe("Apple Inc.");
    expect(pageTitleFor(question({ answer: "Mercury", answerCanonical: "mercury" }))).toBe(
      "Mercury (planet)",
    );
  });

  it("beats a pipeline-resolved title with the override, falls back to it otherwise", () => {
    const overridden = question({
      answer: "Queen",
      answerCanonical: "queen",
      wikipediaTitle: "Queen regnant",
    });
    expect(pageTitleFor(overridden)).toBe("Queen (band)");
    expect(pageTitleFor(question({ wikipediaTitle: "Sodium chloride" }))).toBe("Sodium chloride");
  });

  it("keys overrides by the normalized answer, articles and all", () => {
    for (const key of Object.keys(ANSWER_PAGE_TITLES)) {
      expect(normalizeAnswer(key), `override key "${key}" is not normalized`).toBe(key);
    }
    expect(answerImageKey(question({ answer: "The Hulk", answerCanonical: "the hulk" }))).toBe(
      "hulk",
    );
  });

  it("only overrides answers that are actually in the committed bank", () => {
    const keys = new Set([...SEED_QUESTIONS, ...EXTRA_QUESTIONS].map(answerImageKey));
    for (const key of Object.keys(ANSWER_PAGE_TITLES)) {
      expect(keys.has(key), `override "${key}" matches no question`).toBe(true);
    }
  });

  it("disambiguates the search fallback with the category", () => {
    expect(searchQueryFor(question({ answer: "Mercury", category: "Space" }))).toBe(
      "Mercury Space",
    );
  });
});

describe("titleMatchesAnswer", () => {
  const octopus = question({
    answer: "Octopus",
    answerCanonical: "octopus",
    answerAliases: ["octopuses", "cephalopod"],
  });

  it("accepts the answer, its aliases, and disambiguated titles", () => {
    expect(titleMatchesAnswer("Octopus", octopus)).toBe(true);
    expect(titleMatchesAnswer("Octopus (disambiguation)", octopus)).toBe(true);
    expect(titleMatchesAnswer("Cephalopod", octopus)).toBe(true);
  });

  it("ignores case, punctuation and leading articles", () => {
    const nile = question({ answer: "The Nile", answerCanonical: "the nile" });
    expect(titleMatchesAnswer("Nile", nile)).toBe(true);
    const spiderMan = question({ answer: "Spider-Man", answerCanonical: "spider man" });
    expect(titleMatchesAnswer("Spider-Man (2002 film)", spiderMan)).toBe(true);
  });

  it("rejects merely related articles", () => {
    expect(titleMatchesAnswer("Giant Pacific octopus", octopus)).toBe(false);
    expect(titleMatchesAnswer("Cephalopod intelligence", octopus)).toBe(false);
    expect(titleMatchesAnswer("Mercury (element)", question({ answer: "Mercury" }))).toBe(false);
  });
});

describe("licensing guard", () => {
  it("accepts Commons files", () => {
    expect(
      isCommonsFile("https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Salt.jpg/640px-Salt.jpg"),
    ).toBe(true);
  });

  it("drops the analytics query Wikipedia staples onto thumbnails", () => {
    expect(
      stripThumbQuery(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/R.jpg/640px-R.jpg?utm_source=en.wikipedia.org&utm_campaign=api",
      ),
    ).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/R.jpg/640px-R.jpg");
    expect(stripThumbQuery("https://upload.wikimedia.org/wikipedia/commons/a/b/Salt.jpg")).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/a/b/Salt.jpg",
    );
  });

  it("rejects Wikipedia's own (largely non-free) uploads and anything else", () => {
    expect(isCommonsFile("https://upload.wikimedia.org/wikipedia/en/2/2f/Poster.jpg")).toBe(false);
    expect(isCommonsFile("https://example.com/wikipedia/commons/a/b/Salt.jpg")).toBe(false);
    expect(isCommonsFile("http://upload.wikimedia.org/wikipedia/commons/a/b/Salt.jpg")).toBe(false);
    expect(isCommonsFile("not a url")).toBe(false);
  });
});

describe("credit line", () => {
  it("strips the markup Wikipedia returns and truncates long authors", () => {
    expect(plainText('<a href="/wiki/User:X" title="X">Jane&nbsp;Doe</a>')).toBe("Jane Doe");
    expect(plainText("A".repeat(80))).toHaveLength(44);
  });

  it("names the author and license, always crediting Commons", () => {
    expect(formatCredit({ artist: "<span>Jane Doe</span>", license: "CC BY-SA 4.0" })).toBe(
      "Jane Doe · CC BY-SA 4.0 · Wikimedia Commons",
    );
    expect(formatCredit({})).toBe("Wikimedia Commons");
  });
});

describe("link building", () => {
  it("underscores and escapes titles", () => {
    expect(articleUrl("Mercury (planet)")).toBe(
      "https://en.wikipedia.org/wiki/Mercury_(planet)",
    );
    expect(commonsFileUrl("Salt shaker.jpg")).toBe(
      "https://commons.wikimedia.org/wiki/File:Salt_shaker.jpg",
    );
  });
});
