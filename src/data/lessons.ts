// Lessons of 3–4 letters (CLAUDE.md §10.3). The first letters are chosen so a common mistake
// (thumb sticking out, a finger not bent) is likely — the error-mode hint shows up by itself (§9.3).

export interface LessonDef {
  id: string;
  letters: readonly string[];
}

export const LESSONS: readonly LessonDef[] = [{ id: "1", letters: ["В", "А", "О"] }];

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
