// Which gestures are active on which screen (CLAUDE.md §7.5): protects against letters firing as commands.

export type ScreenName = "welcome" | "tutorial" | "map" | "lesson" | "results" | "bridge" | "record";
export type LetterMode = "none" | "current" | "learned";

export interface GestureContext {
  /** Cursor + pinch + dwell click. */
  cursor: boolean;
  /** Thumbs up → OK. */
  ok: boolean;
  /** Open palm held 1.5 s → back. */
  back: boolean;
  letters: LetterMode;
}

const NAVIGATION: GestureContext = { cursor: true, ok: true, back: true, letters: "none" };

export const GESTURE_CONTEXTS: Readonly<Record<ScreenName, GestureContext>> = {
  welcome: NAVIGATION,
  map: NAVIGATION,
  results: NAVIGATION,
  // Phase 4 narrows this per tutorial step (only the gesture being trained).
  tutorial: NAVIGATION,
  // Letters may look like the open palm: "back" needs 1.5 s, longer than the 1 s letter hold.
  lesson: { cursor: false, ok: false, back: true, letters: "current" },
  bridge: { cursor: false, ok: false, back: true, letters: "learned" },
  record: { cursor: true, ok: false, back: true, letters: "none" },
};

export function getGestureContext(screen: ScreenName): GestureContext {
  return GESTURE_CONTEXTS[screen];
}
