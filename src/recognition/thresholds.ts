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

// --- Control: cursor ---
/** Central share of the camera frame mapped onto the whole screen. */
export const CURSOR_ZONE = 0.7;
/** One Euro filter for the cursor (in screen fractions): lower cutoff = less jitter, higher beta = less lag. */
export const CURSOR_MIN_CUTOFF = 1.0;
export const CURSOR_BETA = 3.0;
export const CURSOR_D_CUTOFF = 1.0;
/** Cursor fades out after the hand is lost for this long. */
export const CURSOR_HIDE_MS = 500;

// --- Control: pinch (|thumb tip − index tip| in palm units) ---
export const PINCH_CLOSE_BELOW = 0.35;
export const PINCH_OPEN_ABOVE = 0.5;
export const PINCH_MIN_INTERVAL_MS = 400;
/** Click lands where the cursor was this long before the pinch closed (fingers drift while pinching). */
export const PINCH_LOOKBACK_MS = 100;

// --- Control: dwell click ---
export const DWELL_MS = 1000;
/** After any click, dwell stays disarmed until the cursor moves this far (px) or leaves the target. */
export const DWELL_REARM_PX = 48;

// --- Control: poses ---
export const THUMBS_UP_HOLD_MS = 800;
export const OPEN_PALM_HOLD_MS = 1500;
/** Max angle (degrees) between the thumb (MCP → tip) and image-up. */
export const THUMB_UP_MAX_ANGLE = 35;
/** A pose may flicker off for this long without losing its hold progress. */
export const POSE_GRACE_MS = 150;
/** Pose holds need a steady hand: wrist speed below this (palm sizes per second). */
export const POSE_MAX_SPEED = 1.5;

// --- Hints (error mode, CLAUDE.md §9.2) ---
/** An error must last this long before its hint appears (no blinking). */
export const HINT_APPEAR_MS = 700;
/** The shown hint changes at most this often. */
export const HINT_MIN_SWITCH_MS = 1000;
/** An error that disappears for less than this still counts as present. */
export const HINT_GRACE_MS = 250;
/** A landmark closer than this to the frame edge (image-normalized) → "hand partly out of frame". */
export const FRAME_EDGE_MARGIN = 0.02;

// --- Control tutorial ---
/** Step 1: nudge toward the circle after this long. */
export const TUTORIAL_MOVE_HINT_MS = 5000;
/** Step 2: after this long without a pinch, dwell turns on as the fallback. */
export const TUTORIAL_DWELL_FALLBACK_MS = 12000;
/** Step 2: how long the "aim first" hint stays relevant after a pinch that missed. */
export const PINCH_AIM_HINT_MS = 1500;

// --- Letters ---
/** Fingertips count as touching below this distance (palm units). */
export const TIPS_TOUCH_MAX = 0.25;
/** Fingertips count as apart above this distance (palm units). */
export const TIPS_APART_MIN = 0.4;
/** Majority vote over the last N frames decides whether the letter is shown correctly. */
export const LETTER_VOTE_WINDOW = 8;
export const LETTER_VOTE_SHARE = 0.6;
/** The letter must be held correctly this long to count (shorter than the 1.5 s open-palm "back"). */
export const LETTER_HOLD_MS = 1000;
export const LETTER_HOLD_GRACE_MS = 150;

// --- kNN (second layer after the rules, CLAUDE.md §8.2) ---
export const KNN_K = 5;
/** kNN "agrees" with the expected letter when at least this many of the k neighbours are that letter. */
export const KNN_MIN_VOTES = 2;
/** A confusable letter is reported when it holds at least this many of the k neighbours. */
export const KNN_CONFUSION_VOTES = 3;
/** Nearest sample further than this (63-dim distance, palm units): the hand is unlike any sample, kNN abstains. */
export const KNN_MAX_DISTANCE = 2.5;

// --- Ghost hand ---
/** A finger matches the reference when its state is the same or its angle is within this many degrees. */
export const GHOST_ANGLE_TOLERANCE = 20;
