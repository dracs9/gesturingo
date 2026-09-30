import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ConversationSummary } from "../talk/summary";
import { safeStorage } from "./storage";

interface TalkHistoryState {
  conversations: number;
  signed: number;
  heard: number;
  hints: number;
  /** Hints per gesture over all conversations. */
  byGesture: Record<string, number>;
  record(summary: ConversationSummary, hintsByGesture: Readonly<Record<string, number>>): void;
  reset(): void;
}

type Persisted = Pick<TalkHistoryState, "conversations" | "signed" | "heard" | "hints" | "byGesture">;

const EMPTY: Persisted = { conversations: 0, signed: 0, heard: 0, hints: 0, byGesture: {} };

/**
 * All-time talk statistics (docs/TRANSLATOR_SPEC.md §8): aggregates only — never the words said.
 * In localStorage, cleared with «Очистить статистику».
 */
export const useTalkHistory = create<TalkHistoryState>()(
  persist<TalkHistoryState, [], [], Persisted>(
    (set) => ({
      ...EMPTY,
      record: (summary, hintsByGesture) =>
        set((s) => {
          const byGesture = { ...s.byGesture };
          for (const [g, n] of Object.entries(hintsByGesture)) byGesture[g] = (byGesture[g] ?? 0) + n;
          return {
            conversations: s.conversations + 1,
            signed: s.signed + summary.signed,
            heard: s.heard + summary.heard,
            hints: s.hints + summary.hints,
            byGesture,
          };
        }),
      reset: () => set(EMPTY),
    }),
    {
      name: "gesturingo.talkHistory",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ conversations, signed, heard, hints, byGesture }) => ({ conversations, signed, heard, hints, byGesture }),
    },
  ),
);
