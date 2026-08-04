import { describe, expect, it } from "vitest";
import { overallTotals, sortSummaries, summarize } from "./summary";
import type { RatingRecord, RatingValue } from "./types";

let seq = 0;

function rating(
  questionId: string,
  value: RatingValue,
  extra: Partial<RatingRecord> = {},
): RatingRecord {
  seq += 1;
  return {
    id: `r${seq}`,
    questionId,
    rating: value,
    comment: null,
    mode: "daily",
    solved: true,
    // Ordered timestamps unless a test pins its own.
    createdAt: `2026-01-${String(seq).padStart(2, "0")}T00:00:00.000Z`,
    ...extra,
  };
}

describe("summarize", () => {
  it("counts each face and averages them into a score", () => {
    const [salt] = summarize([
      rating("salt", "good"),
      rating("salt", "good"),
      rating("salt", "bad"),
      rating("salt", "okay"),
    ]);

    expect(salt.counts).toEqual({ bad: 1, okay: 1, good: 2 });
    expect(salt.total).toBe(4);
    // (+1 +1 −1 +0) / 4
    expect(salt.score).toBeCloseTo(0.25);
  });

  it("scores a unanimous verdict at the ends of the range", () => {
    const [good] = summarize([rating("a", "good"), rating("a", "good")]);
    const [bad] = summarize([rating("b", "bad")]);
    const [okay] = summarize([rating("c", "okay")]);

    expect(good.score).toBe(1);
    expect(bad.score).toBe(-1);
    expect(okay.score).toBe(0);
  });

  it("groups by question and tracks how many raters solved it", () => {
    const summaries = summarize([
      rating("salt", "good", { solved: true }),
      rating("salt", "bad", { solved: false }),
      rating("octopus", "bad", { solved: false }),
    ]);

    expect(summaries).toHaveLength(2);
    const salt = summaries.find((s) => s.questionId === "salt")!;
    expect(salt.total).toBe(2);
    expect(salt.solved).toBe(1);
    expect(summaries.find((s) => s.questionId === "octopus")!.solved).toBe(0);
  });

  it("collects only the ratings that carry a note, newest first", () => {
    const [salt] = summarize([
      rating("salt", "bad", { comment: "older", createdAt: "2026-02-01T00:00:00.000Z" }),
      rating("salt", "good"),
      rating("salt", "okay", { comment: "newer", createdAt: "2026-03-01T00:00:00.000Z" }),
    ]);

    expect(salt.comments.map((c) => c.text)).toEqual(["newer", "older"]);
    expect(salt.comments[0].rating).toBe("okay");
  });

  it("reports the most recent rating regardless of input order", () => {
    const [salt] = summarize([
      rating("salt", "good", { createdAt: "2026-05-01T00:00:00.000Z" }),
      rating("salt", "bad", { createdAt: "2026-09-01T00:00:00.000Z" }),
      rating("salt", "okay", { createdAt: "2026-07-01T00:00:00.000Z" }),
    ]);

    expect(salt.lastRatedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("has nothing to say about an empty set", () => {
    expect(summarize([])).toEqual([]);
  });
});

describe("sortSummaries", () => {
  const summaries = summarize([
    // one lone thumbs-down
    rating("lonely-bad", "bad", { createdAt: "2026-01-01T00:00:00.000Z" }),
    // three people agreed it was bad
    rating("really-bad", "bad", { createdAt: "2026-02-01T00:00:00.000Z" }),
    rating("really-bad", "bad", { createdAt: "2026-02-02T00:00:00.000Z" }),
    rating("really-bad", "bad", { createdAt: "2026-02-03T00:00:00.000Z" }),
    rating("loved", "good", { createdAt: "2026-04-01T00:00:00.000Z" }),
    rating("loved", "good", { createdAt: "2026-04-02T00:00:00.000Z" }),
  ]);
  const order = (sort: Parameters<typeof sortSummaries>[1]) =>
    sortSummaries(summaries, sort).map((s) => s.questionId);

  it("puts the most-agreed-bad question above a lone thumbs-down", () => {
    expect(order("worst")).toEqual(["really-bad", "lonely-bad", "loved"]);
  });

  it("flips for best-first, still ranking agreement above a single voice", () => {
    expect(order("best")).toEqual(["loved", "really-bad", "lonely-bad"]);
  });

  it("orders by rating count, then by worst, for most-rated", () => {
    expect(order("most")).toEqual(["really-bad", "loved", "lonely-bad"]);
  });

  it("orders by the newest rating for recent", () => {
    expect(order("recent")).toEqual(["loved", "really-bad", "lonely-bad"]);
  });

  it("leaves the input untouched", () => {
    const before = summaries.map((s) => s.questionId);
    sortSummaries(summaries, "best");
    expect(summaries.map((s) => s.questionId)).toEqual(before);
  });
});

describe("overallTotals", () => {
  it("adds up every rating and note across questions", () => {
    const totals = overallTotals(
      summarize([
        rating("salt", "good", { comment: "nice one" }),
        rating("salt", "bad"),
        rating("octopus", "okay"),
      ]),
    );

    expect(totals).toEqual({
      counts: { bad: 1, okay: 1, good: 1 },
      comments: 1,
      questions: 2,
      ratings: 3,
    });
  });
});
