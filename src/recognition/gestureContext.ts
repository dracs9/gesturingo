// Which gestures are active on which screen (CLAUDE.md §7.5): protects against letters firing as commands.

export type ScreenName =
  | "welcome"
  | "tutorial"
  | "map"
  | "lesson"
  | "results"
  | "bridge"
  | "talk"
  | "record"
  | "letters";
export type LetterMode = "none" | "current" | "learned" | "all";

export interface GestureContext {
  /** Cursor + pinch click. */
  cursor: boolean;
  /** Dwell click (needs the cursor). */
  dwell: boolean;
  /** Thumbs up → OK. */
  ok: boolean;
  /** Open palm held 3 s → back. */
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
  // Letters may look like the open palm: "back" needs 3 s, longer than the 1 s letter hold.
  lesson: { cursor: false, dwell: false, ok: false, back: true, letters: "current" },
  bridge: { cursor: false, dwell: false, ok: false, back: true, letters: "learned" },
  // Talk (docs/TRANSLATOR_SPEC.md §5): no cursor, no poses of the control layer — the screen has its own
  // command zones and open-palm cancel (1.2 s) / exit (2 s), and letters are read without a target.
  talk: { cursor: false, dwell: false, ok: false, back: false, letters: "all" },
  record: { cursor: true, dwell: true, ok: false, back: true, letters: "none" },
  // Service page: buttons like /record; its live check narrows this to the lesson context via the UI store.
  letters: { cursor: true, dwell: true, ok: false, back: true, letters: "none" },
};

export function getGestureContext(screen: ScreenName): GestureContext {
  return GESTURE_CONTEXTS[screen];
}
