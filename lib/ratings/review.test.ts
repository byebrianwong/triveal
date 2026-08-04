import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/game/types";
import type { RatingRecord } from "./types";

vi.mock("./store", () => ({ listRatings: vi.fn() }));
vi.mock("@/lib/questions/source", () => ({ getQuestionById: vi.fn() }));

import { listRatings } from "./store";
import { getQuestionById } from "@/lib/questions/source";
import { buildReview } from "./review";

const ratings = vi.mocked(listRatings);
const question = vi.mocked(getQuestionById);

function rating(questionId: string, extra: Partial<RatingRecord> = {}): RatingRecord {
  return {
    id: `r-${questionId}`,
    questionId,
    rating: "bad",
    comment: null,
    mode: "daily",
    solved: false,
    createdAt: "2026-08-04T00:00:00.000Z",
    ...extra,
  };
}

function venus(clues: Question["clues"]): Question {
  return {
    id: "venus",
    answer: "Venus",
    answerCanonical: "venus",
    answerAliases: [],
    category: "Space",
    difficulty: "easy",
    clues,
    decoys: [],
  };
}

beforeEach(() => {
  ratings.mockReset();
  question.mockReset();
});

describe("buildReview", () => {
  it("lists a question's clues hardest-first, whatever order they arrive in", async () => {
    ratings.mockResolvedValue([rating("venus")]);
    question.mockResolvedValue(
      venus([
        { position: 3, text: "third" },
        { position: 1, text: "first" },
        { position: 4, text: "fourth" },
        { position: 2, text: "second" },
      ]),
    );

    const { rows } = await buildReview("worst");

    expect(rows[0].clues).toEqual(["first", "second", "third", "fourth"]);
    expect(rows[0].answer).toBe("Venus");
    expect(rows[0].category).toBe("Space");
  });

  it("still shows the ratings when the question has left the bank", async () => {
    ratings.mockResolvedValue([rating("retired-question")]);
    question.mockResolvedValue(null);

    const { rows } = await buildReview("worst");

    expect(rows).toHaveLength(1);
    expect(rows[0].answer).toBeNull();
    expect(rows[0].clues).toEqual([]);
    expect(rows[0].summary.total).toBe(1);
  });

  it("orders rows by the requested sort", async () => {
    ratings.mockResolvedValue([
      rating("loved", { rating: "good" }),
      rating("hated", { rating: "bad" }),
    ]);
    question.mockResolvedValue(venus([{ position: 1, text: "only clue" }]));

    const worst = await buildReview("worst");
    const best = await buildReview("best");

    expect(worst.rows.map((r) => r.summary.questionId)).toEqual(["hated", "loved"]);
    expect(best.rows.map((r) => r.summary.questionId)).toEqual(["loved", "hated"]);
  });

  it("pairs each row with its own question, not another row's", async () => {
    ratings.mockResolvedValue([
      rating("loved", { rating: "good" }),
      rating("hated", { rating: "bad" }),
    ]);
    question.mockImplementation(async (id: string) =>
      id === "loved"
        ? { ...venus([{ position: 1, text: "loved clue" }]), answer: "Loved" }
        : { ...venus([{ position: 1, text: "hated clue" }]), answer: "Hated" },
    );

    const { rows } = await buildReview("worst");

    expect(rows.map((r) => [r.answer, r.clues[0]])).toEqual([
      ["Hated", "hated clue"],
      ["Loved", "loved clue"],
    ]);
  });
});
