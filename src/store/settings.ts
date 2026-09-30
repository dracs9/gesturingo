import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "./storage";

/** Speech rate range of the talk settings (docs/TRANSLATOR_SPEC.md §4.4). */
export const SPEECH_RATE_MIN = 0.8;
export const SPEECH_RATE_MAX = 1.3;

interface SettingsState {
  /** Sounds can be turned off (CLAUDE.md §12). */
  soundOn: boolean;
  /** Speech: rate 0.8–1.3, volume 0.2–1, chosen voice (null = the best Russian one). */
  speechRate: number;
  speechVolume: number;
  voiceURI: string | null;
  /** Talk mode: speak a recognized phrase without the confirmation ring (off by default, §4.3). */
  speakImmediately: boolean;
  toggleSound(): void;
  setSpeechRate(rate: number): void;
  setSpeechVolume(volume: number): void;
  setVoice(uri: string | null): void;
  setSpeakImmediately(on: boolean): void;
}

type Persisted = Pick<SettingsState, "soundOn" | "speechRate" | "speechVolume" | "voiceURI" | "speakImmediately">;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

export const useSettings = create<SettingsState>()(
  persist<SettingsState, [], [], Persisted>(
    (set) => ({
      soundOn: true,
      speechRate: 0.9,
      speechVolume: 1,
      voiceURI: null,
      speakImmediately: false,
      toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
      setSpeechRate: (rate) => set({ speechRate: clamp(rate, SPEECH_RATE_MIN, SPEECH_RATE_MAX) }),
      setSpeechVolume: (volume) => set({ speechVolume: clamp(volume, 0.2, 1) }),
      setVoice: (voiceURI) => set({ voiceURI }),
      setSpeakImmediately: (speakImmediately) => set({ speakImmediately }),
    }),
    {
      name: "gesturingo.settings",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ soundOn, speechRate, speechVolume, voiceURI, speakImmediately }) => ({
        soundOn,
        speechRate,
        speechVolume,
        voiceURI,
        speakImmediately,
      }),
    },
  ),
);
