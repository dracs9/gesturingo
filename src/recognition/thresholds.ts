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

// --- Normalization ---
/** MediaPipe's handedness label is correct for our unmirrored camera frames (checked on PC and phone). */
export const FLIP_HANDEDNESS = false;

// --- Smoothing ---
/** EMA weight of the newest landmarks (1 = no smoothing). */
export const LANDMARK_EMA_ALPHA = 0.5;

// --- Finger states (degrees; representative angle = min of the base joints) ---
export const FINGER_STRAIGHT_MIN_ANGLE = 160;
export const FINGER_BENT_MAX_ANGLE = 100;
export const THUMB_STRAIGHT_MIN_ANGLE = 150;
export const THUMB_BENT_MAX_ANGLE = 120;

// --- Palm & thumb ---
/** |palm normal · camera axis| above this → palm faces camera / away, below → side. */
export const PALM_FACING_MIN = 0.5;
/** Thumb tip past index MCP toward pinky MCP, in units of |index MCP → pinky MCP|. */
export const THUMB_ACROSS_MIN = 0.25;
/** Thumb tip above index MCP along wrist → middle MCP, in palm units. */
export const THUMB_UP_MIN = 0.3;
