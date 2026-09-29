import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./storage";

interface SettingsState {
  /** Sounds can be turned off (CLAUDE.md §12). */
  soundOn: boolean;
  toggleSound(): void;
}

export const useSettings = create<SettingsState>()(
  persist<SettingsState, [], [], Pick<SettingsState, "soundOn">>(
    (set) => ({
      soundOn: true,
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
    }),
    {
      name: "gesturingo.settings",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ soundOn }) => ({ soundOn }),
    },
  ),
);
