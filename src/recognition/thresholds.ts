// ALL recognition thresholds live here. Values are starting points — tune on real data.

// --- Tracker (MediaPipe HandLandmarker) ---
export const TRACKER_MIN_DETECTION_CONFIDENCE = 0.5;
export const TRACKER_MIN_PRESENCE_CONFIDENCE = 0.5;
export const TRACKER_MIN_TRACKING_CONFIDENCE = 0.5;

// --- Frame checks ---
/** Handedness score below this counts as "no hand". */
export const MIN_HAND_SCORE = 0.5;
/** Palm size = |wrist → middle MCP| in pixels ÷ video height. */
export const PALM_SIZE_MIN = 0.08;
export const PALM_SIZE_MAX = 0.45;
/** Hand status must persist this long before the UI switches to it. */
export const HAND_STATUS_HOLD_MS = 150;
