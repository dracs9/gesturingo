// External resources (CDN). Keep version in sync with @mediapipe/tasks-vision in package.json (added in Phase 1).
export const MEDIAPIPE_VERSION = "1.0.1";
export const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Debug overlay (FPS, angles, pinch state, kNN top-3) is enabled with `?debug=1`. */
export function isDebug(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("debug") === "1";
}
