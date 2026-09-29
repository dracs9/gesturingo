import { describe, expect, it } from "vitest";
import type { LessonDef } from "../data/lessons";
import type { LessonResult } from "./lessonRun";
import {
  applyLessonResult,
  EMPTY_PROGRESS,
  isLessonCompleted,
  isLessonUnlocked,
  learnedLetters,
  lessonStars,
  totalStars,
  weakLetters,
} from "./progressLogic";

const LESSONS: LessonDef[] = [
  { id: "1", letters: ["А", "Б", "В"] },
  { id: "2", letters: ["Г", "Д"] },
];

const run = (letters: Array<[string, 0 | 1 | 2 | 3, number]>, hintCodes: string[] = []): LessonResult => ({
  lessonId: "1",
  letters: letters.map(([letter, stars, hints]) => ({ letter, stars, hints, timeMs: 1000 })),
  hintLog: hintCodes.map((hintCode, i) => ({ letter: "А", hintCode, timestamp: i })),
});

describe("progress", () => {
  it("records stars, XP and hint counts", () => {
    const p = applyLessonResult(EMPTY_PROGRESS, run([["А", 3, 0], ["Б", 1, 2], ["В", 2, 1]], ["x", "x", "y"]));
    expect(p.xp).toBe(60);
    expect(p.letters.Б).toEqual({ bestStars: 1, lastStars: 1, attempts: 1, hints: 2 });
    expect(p.hintCounts).toEqual({ x: 2, y: 1 });
    expect(totalStars(p)).toBe(6);
  });

  it("keeps the best stars and remembers the last result", () => {
    let p = applyLessonResult(EMPTY_PROGRESS, run([["А", 3, 0]]));
    p = applyLessonResult(p, run([["А", 1, 2]]));
    expect(p.letters.А).toMatchObject({ bestStars: 3, lastStars: 1, attempts: 2, hints: 2 });
    expect(p.xp).toBe(40);
  });

  it("does not mutate the previous progress", () => {
    const before = structuredClone(EMPTY_PROGRESS);
    applyLessonResult(EMPTY_PROGRESS, run([["А", 3, 0]]));
    expect(EMPTY_PROGRESS).toEqual(before);
  });

  it("opens the next lesson only after every letter has a star", () => {
    expect(isLessonUnlocked(EMPTY_PROGRESS, LESSONS, 0)).toBe(true);
    expect(isLessonUnlocked(EMPTY_PROGRESS, LESSONS, 1)).toBe(false);
    const skipped = applyLessonResult(EMPTY_PROGRESS, run([["А", 3, 0], ["Б", 0, 0], ["В", 2, 0]]));
    expect(isLessonCompleted(skipped, LESSONS[0] as LessonDef)).toBe(false);
    const passed = applyLessonResult(skipped, run([["Б", 1, 3]]));
    expect(isLessonUnlocked(passed, LESSONS, 1)).toBe(true);
  });

  it("rates a lesson by its letters", () => {
    const p = applyLessonResult(EMPTY_PROGRESS, run([["А", 3, 0], ["Б", 3, 0], ["В", 2, 1]]));
    expect(lessonStars(p, LESSONS[0] as LessonDef)).toBe(2);
    expect(lessonStars(p, LESSONS[1] as LessonDef)).toBe(0);
  });

  it("lists learned and weak letters", () => {
    const p = applyLessonResult(EMPTY_PROGRESS, run([["А", 3, 0], ["Б", 0, 0], ["В", 1, 3], ["Г", 1, 1]]));
    expect(learnedLetters(p).sort()).toEqual(["А", "В", "Г"]);
    expect(weakLetters(p)).toEqual(["Б", "В", "Г"]);
    expect(weakLetters(p, 1)).toEqual(["Б"]);
    expect(weakLetters(EMPTY_PROGRESS)).toEqual([]);
  });
});
