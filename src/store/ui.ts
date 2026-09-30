import { create } from "zustand";
import type { GestureContext } from "../recognition/gestureContext";

interface UiState {
  /** Screen-specific narrowing of the route's gesture context (e.g. per tutorial step). */
  gestureOverride: Partial<GestureContext> | null;
  /** Hide the mini camera dock (screens with their own camera view). */
  dockHidden: boolean;
  /** The «Как пользоваться» sheet is open: screens pause their own hand commands. */
  helpOpen: boolean;
  setGestureOverride(override: Partial<GestureContext> | null): void;
  setDockHidden(hidden: boolean): void;
  setHelpOpen(open: boolean): void;
}

export const useUi = create<UiState>()((set) => ({
  gestureOverride: null,
  dockHidden: false,
  helpOpen: false,
  setGestureOverride: (gestureOverride) => set({ gestureOverride }),
  setDockHidden: (dockHidden) => set({ dockHidden }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
