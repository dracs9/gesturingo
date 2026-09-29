import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LessonResult } from "./lessonRun";
import { applyLessonResult, EMPTY_PROGRESS, type Progress } from "./progressLogic";
import { safeStorage } from "./storage";

interface ProgressState extends Progress {
  recordLesson(result: LessonResult): void;
  markTutorialDone(): void;
  reset(): void;
}

const pick = ({ xp, letters, hintCounts, tutorialDone }: Progress): Progress => ({ xp, letters, hintCounts, tutorialDone });

/** Learning progress, kept in localStorage of this browser only. */
export const useProgress = create<ProgressState>()(
  persist<ProgressState, [], [], Progress>(
    (set, get) => ({
      ...EMPTY_PROGRESS,
      recordLesson: (result) => set(applyLessonResult(pick(get()), result)),
      markTutorialDone: () => set({ tutorialDone: true }),
      reset: () => set({ ...EMPTY_PROGRESS }),
    }),
    {
      name: "gesturingo.progress",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: pick,
      // A damaged or foreign value must not crash the app: fall back to an empty progress.
      merge: (persisted, current) => {
        const p = persisted as Partial<Progress> | undefined;
        return {
          ...current,
          xp: typeof p?.xp === "number" ? p.xp : 0,
          letters: p?.letters && typeof p.letters === "object" ? p.letters : {},
          hintCounts: p?.hintCounts && typeof p.hintCounts === "object" ? p.hintCounts : {},
          tutorialDone: p?.tutorialDone === true,
        };
      },
    },
  ),
);

/** Plain snapshot of the progress data (without actions). */
export function progressSnapshot(): Progress {
  return pick(useProgress.getState());
}
