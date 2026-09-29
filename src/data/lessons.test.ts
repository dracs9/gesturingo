import { describe, expect, it } from "vitest";
import { buildLessons, LESSONS } from "./lessons";
import { LETTER_BUILD_INFO } from "./letters.generated";
import { LETTERS } from "./letters";

describe("lessons", () => {
  it("start with the 3 most accurate letters, then follow the alphabet in balanced groups", () => {
    const acc: Record<string, number> = { А: 0.5, Б: 0.9, В: 0.8, Г: 0.95, Е: 0.1, Ж: 0.2, И: 0.3, К: 0.4, Л: 0.6 };
    const lessons = buildLessons(Object.keys(acc), (l) => acc[l] ?? 0);
    expect(lessons.map((l) => l.letters)).toEqual([
      ["Б", "В", "Г"],
      ["А", "Е", "Ж"],
      ["И", "К", "Л"],
    ]);
    expect(lessons.map((l) => l.id)).toEqual(["1", "2", "3"]);
  });

  it("cover every taught letter exactly once, 3–4 letters each", () => {
    const all = LESSONS.flatMap((l) => l.letters);
    expect([...all].sort()).toEqual(LETTERS.map((l) => l.letter).sort());
    for (const lesson of LESSONS) {
      expect(lesson.letters.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(lesson.letters.length, lesson.id).toBeLessThanOrEqual(4);
    }
  });

  it("open with the best-recognized letters", () => {
    const acc = (l: string) => LETTER_BUILD_INFO[l]?.accuracy ?? 0;
    const firstWorst = Math.min(...(LESSONS[0]?.letters ?? []).map(acc));
    const restBest = Math.max(...LESSONS.slice(1).flatMap((l) => l.letters).map(acc));
    expect(firstWorst).toBeGreaterThanOrEqual(restBest);
  });
});
