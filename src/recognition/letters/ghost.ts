import { computeFeatures, FINGERS, type Finger, type HandFeatures } from "../features";
import type { HandFrame, Point3 } from "../landmarks";
import { denormalizePoints, handTransform, unflattenPoints } from "../normalize";
import { GHOST_ANGLE_TOLERANCE } from "../thresholds";

/**
 * Fits the letter reference (one clean normalized frame) onto the user's hand (CLAUDE.md §8.3):
 * moved to their wrist, scaled to their palm, rotated like their wrist → middle MCP, mirrored for a left hand.
 * Returns image-normalized landmarks, drawable exactly like the tracked hand.
 */
export function fitReference(reference: readonly number[], frame: HandFrame): Point3[] {
  return denormalizePoints(unflattenPoints(reference), handTransform(frame));
}

/** Features of a reference frame (stored canonical = right hand). */
export function referenceFeatures(reference: readonly number[]): HandFeatures {
  return computeFeatures({ points: unflattenPoints(reference), handedness: "Right" });
}

/** Per finger: does the user's finger match the reference? (same state, or a close angle). */
export function compareFingers(user: HandFeatures, reference: HandFeatures): Record<Finger, boolean> {
  return Object.fromEntries(
    FINGERS.map((f) => {
      const u = user.fingers[f];
      const r = reference.fingers[f];
      return [f, u.state === r.state || Math.abs(u.angle - r.angle) <= GHOST_ANGLE_TOLERANCE];
    }),
  ) as Record<Finger, boolean>;
}

/** Finger of each landmark (wrist = null). */
export function fingerOfLandmark(id: number): Finger | null {
  if (id <= 0 || id > 20) return null;
  return FINGERS[Math.floor((id - 1) / 4)] ?? null;
}
