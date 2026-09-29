import { computeFeatures, type HandFeatures } from "./features";
import type { HandFrame, Point3 } from "./landmarks";
import { normalizeHand, type NormalizedHand } from "./normalize";

/** Everything known about the hand in one frame. */
export interface HandObservation {
  /** Raw tracker output — use for drawing and screen positions (no smoothing lag). */
  frame: HandFrame;
  /** Normalized, EMA-smoothed landmarks — use for recognition. */
  normalized: NormalizedHand;
  features: HandFeatures;
}

export function buildObservation(frame: HandFrame, smoothedLandmarks: Point3[] = frame.landmarks): HandObservation {
  const normalized = normalizeHand({ ...frame, landmarks: smoothedLandmarks });
  return { frame, normalized, features: computeFeatures(normalized) };
}
