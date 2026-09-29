import { describe, expect, it } from "vitest";
import { summarizeLesson } from "./summary";

describe("summarizeLesson", () => {
  it("computes stars, accuracy, XP and the most frequent errors", () => {
    const summary = summarizeLesson({
      lessonId: "1",
      letters: [
        { letter: "В", stars: 3, hints: 0, timeMs: 3000 },
        { letter: "А", stars: 1, hints: 3, timeMs: 9000 },
        { letter: "О", stars: 2, hints: 1, timeMs: 5000 },
      ],
      hintLog: [
        { letter: "А", hintCode: "finger.bend.index", timestamp: 1 },
        { letter: "А", hintCode: "palm.faceCamera", timestamp: 2 },
        { letter: "А", hintCode: "finger.bend.index", timestamp: 3 },
        { letter: "О", hintCode: "tips.touch.thumb-index", timestamp: 4 },
      ],
    });
    expect(summary).toMatchObject({ stars: 6, maxStars: 9, accuracy: 67, hints: 4, xp: 60 });
    expect(summary.topErrors[0]).toEqual({ hintCode: "finger.bend.index", count: 2 });
    expect(summary.topErrors).toHaveLength(3);
  });

  it("handles an empty lesson", () => {
    expect(summarizeLesson({ lessonId: "1", letters: [], hintLog: [] })).toMatchObject({ accuracy: 0, xp: 0 });
  });
});
