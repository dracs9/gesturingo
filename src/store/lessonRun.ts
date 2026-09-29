import { create } from "zustand";
import type { HintLogEntry } from "../recognition/letters/practice";

export interface LetterResult {
  letter: string;
  /** 0 = skipped. */
  stars: 0 | 1 | 2 | 3;
  hints: number;
  timeMs: number;
}

export interface LessonResult {
  lessonId: string;
  letters: LetterResult[];
  hintLog: HintLogEntry[];
}

interface LessonRunState {
  lastResult: LessonResult | null;
  setLastResult(result: LessonResult): void;
}

/** Result of the lesson just finished, for the Results screen (persistent progress comes in Phase 7). */
export const useLessonRun = create<LessonRunState>()((set) => ({
  lastResult: null,
  setLastResult: (lastResult) => set({ lastResult }),
}));
