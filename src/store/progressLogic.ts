import type { LessonDef } from "../data/lessons";
import type { LessonResult } from "./lessonRun";

export type Stars = 0 | 1 | 2 | 3;

export interface LetterProgress {
  bestStars: Stars;
  lastStars: Stars;
  attempts: number;
  /** Letter-level hints shown over all attempts. */
  hints: number;
}

/** Everything remembered between visits (CLAUDE.md §10.7). No accounts, only this browser. */
export interface Progress {
  xp: number;
  letters: Record<string, LetterProgress>;
  /** How often each hint was shown — the learner's frequent mistakes. */
  hintCounts: Record<string, number>;
  tutorialDone: boolean;
}

export const EMPTY_PROGRESS: Progress = { xp: 0, letters: {}, hintCounts: {}, tutorialDone: false };

export const XP_PER_STAR = 10;
export const REVIEW_LESSON_ID = "review";
const MAX_REVIEW_LETTERS = 3;

const maxStars = (a: Stars, b: Stars): Stars => (a >= b ? a : b);

export function applyLessonResult(progress: Progress, result: LessonResult): Progress {
  const letters = { ...progress.letters };
  for (const r of result.letters) {
    const prev = letters[r.letter];
    letters[r.letter] = {
      bestStars: maxStars(prev?.bestStars ?? 0, r.stars),
      lastStars: r.stars,
      attempts: (prev?.attempts ?? 0) + 1,
      hints: (prev?.hints ?? 0) + r.hints,
    };
  }
  const hintCounts = { ...progress.hintCounts };
  for (const h of result.hintLog) hintCounts[h.hintCode] = (hintCounts[h.hintCode] ?? 0) + 1;
  const earned = result.letters.reduce((sum, l) => sum + l.stars, 0) * XP_PER_STAR;
  return { ...progress, xp: progress.xp + earned, letters, hintCounts };
}

/** A lesson is passed when every letter has at least one star (skipped letters don't count). */
export function isLessonCompleted(progress: Progress, lesson: LessonDef): boolean {
  return lesson.letters.every((l) => (progress.letters[l]?.bestStars ?? 0) >= 1);
}

/** The next lesson opens after the current one is passed (CLAUDE.md §10.3). */
export function isLessonUnlocked(progress: Progress, lessons: readonly LessonDef[], index: number): boolean {
  if (index <= 0) return true;
  const previous = lessons[index - 1];
  return previous !== undefined && isLessonCompleted(progress, previous);
}

/** 0–3 stars of a lesson: the weakest-average view, 3 only when every letter has 3. */
export function lessonStars(progress: Progress, lesson: LessonDef): Stars {
  if (lesson.letters.length === 0) return 0;
  const sum = lesson.letters.reduce((s, l) => s + (progress.letters[l]?.bestStars ?? 0), 0);
  return Math.floor(sum / lesson.letters.length) as Stars;
}

export function totalStars(progress: Progress): number {
  return Object.values(progress.letters).reduce((s, l) => s + l.bestStars, 0);
}

/** Letters shown at least once correctly — the ones the Bridge may use. */
export function learnedLetters(progress: Progress): string[] {
  return Object.entries(progress.letters)
    .filter(([, l]) => l.bestStars >= 1)
    .map(([letter]) => letter);
}

/** «Повтори слабые буквы»: last result below 3 stars, worst first, then the most hinted. */
export function weakLetters(progress: Progress, max = MAX_REVIEW_LETTERS): string[] {
  return Object.entries(progress.letters)
    .filter(([, l]) => l.lastStars < 3)
    .sort(([, a], [, b]) => a.lastStars - b.lastStars || b.hints - a.hints || b.attempts - a.attempts)
    .slice(0, max)
    .map(([letter]) => letter);
}
