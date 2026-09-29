// Lessons of 3–4 letters (CLAUDE.md §10.3), computed from the letter data so a rebuild or an
// override updates them. Lesson 1 = the letters the camera recognizes best across people
// (leave-one-signer-out kNN accuracy): the jury's first try should succeed. The rest follow the alphabet.
import { ALPHABET } from "./alphabet";
import { LETTER_BUILD_INFO } from "./letters.generated";
import { LETTERS } from "./letters";

export interface LessonDef {
  id: string;
  letters: readonly string[];
}

const FIRST_LESSON_SIZE = 3;
const LESSON_SIZE = 4;

/**
 * Splits letters into lessons: the `FIRST_LESSON_SIZE` most accurate first, then the rest in
 * alphabet order in groups of at most `LESSON_SIZE`, sizes balanced (4·4·3·3 rather than 4·4·4·1).
 */
export function buildLessons(letters: readonly string[], accuracy: (letter: string) => number): LessonDef[] {
  const byAlphabet = (a: string, b: string) => ALPHABET.indexOf(a) - ALPHABET.indexOf(b);
  const first = [...letters].sort((a, b) => accuracy(b) - accuracy(a) || byAlphabet(a, b)).slice(0, FIRST_LESSON_SIZE);
  const rest = letters.filter((l) => !first.includes(l)).sort(byAlphabet);

  const groups: string[][] = [first.sort(byAlphabet)];
  const count = Math.ceil(rest.length / LESSON_SIZE);
  let start = 0;
  for (let g = 0; g < count; g++) {
    const size = Math.floor(rest.length / count) + (g < rest.length % count ? 1 : 0);
    groups.push(rest.slice(start, start + size));
    start += size;
  }
  return groups.filter((g) => g.length > 0).map((g, i) => ({ id: String(i + 1), letters: g }));
}

export const LESSONS: readonly LessonDef[] = buildLessons(
  LETTERS.map((l) => l.letter),
  (letter) => LETTER_BUILD_INFO[letter]?.accuracy ?? 0,
);

export function getLesson(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function getNextLesson(id: string): LessonDef | undefined {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? LESSONS[i + 1] : undefined;
}

export function lessonNumber(id: string): number {
  return LESSONS.findIndex((l) => l.id === id) + 1;
}
