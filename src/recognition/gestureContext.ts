// Which gestures are active on which screen (CLAUDE.md §7.5): protects against letters firing as commands.

export type ScreenName = "welcome" | "tutorial" | "map" | "lesson" | "results" | "bridge" | "record";
export type LetterMode = "none" | "current" | "learned";

export interface GestureContext {
  /** Cursor + pinch click. */
  cursor: boolean;
  /** Dwell click (needs the cursor). */
  dwell: boolean;
  /** Thumbs up → OK. */
  ok: boolean;
  /** Open palm held 1.5 s → back. */
  back: boolean;
  letters: LetterMode;
}

const NAVIGATION: GestureContext = { cursor: true, dwell: true, ok: true, back: true, letters: "none" };

export const GESTURE_CONTEXTS: Readonly<Record<ScreenName, GestureContext>> = {
  welcome: NAVIGATION,
  map: NAVIGATION,
  results: NAVIGATION,
  // The tutorial narrows this per step via the UI store override (only the gesture being trained).
  tutorial: NAVIGATION,
  // Letters may look like the open palm: "back" needs 1.5 s, longer than the 1 s letter hold.
  lesson: { cursor: false, dwell: false, ok: false, back: true, letters: "current" },
  bridge: { cursor: false, dwell: false, ok: false, back: true, letters: "learned" },
  record: { cursor: true, dwell: true, ok: false, back: true, letters: "none" },
};

export function getGestureContext(screen: ScreenName): GestureContext {
  return GESTURE_CONTEXTS[screen];
}
