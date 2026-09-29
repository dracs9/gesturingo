import { create } from "zustand";
import type { GestureContext } from "../recognition/gestureContext";

interface UiState {
  /** Screen-specific narrowing of the route's gesture context (e.g. per tutorial step). */
  gestureOverride: Partial<GestureContext> | null;
  /** Hide the mini camera dock (screens with their own camera view). */
  dockHidden: boolean;
  setGestureOverride(override: Partial<GestureContext> | null): void;
  setDockHidden(hidden: boolean): void;
}

export const useUi = create<UiState>()((set) => ({
  gestureOverride: null,
  dockHidden: false,
  setGestureOverride: (gestureOverride) => set({ gestureOverride }),
  setDockHidden: (dockHidden) => set({ dockHidden }),
}));
