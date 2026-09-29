import { LANDMARK_COUNT, LM, type HandFrame, type Handedness, type Point3 } from "./landmarks";
import { FLIP_HANDEDNESS } from "./thresholds";

/**
 * Hand in a canonical frame: wrist at the origin, |wrist → middle MCP| = 1,
 * wrist → middle MCP along +Y (y points up), left hands mirrored to look like right hands.
 * Units: X and Z share the scale of Y (aspect-corrected).
 */
export interface NormalizedHand {
  points: Point3[];
  handedness: Handedness;
}

export function trueHandedness(frame: HandFrame): Handedness {
  if (!FLIP_HANDEDNESS) return frame.handedness;
  return frame.handedness === "Left" ? "Right" : "Left";
}

export function normalizeHand(frame: HandFrame): NormalizedHand {
  const aspect = frame.videoHeight > 0 ? frame.videoWidth / frame.videoHeight : 1;
  const handedness = trueHandedness(frame);

  // 1. Aspect-correct, y-up.
  const raw = frame.landmarks.map((p) => ({ x: p.x * aspect, y: -p.y, z: p.z * aspect }));
  const wrist = raw[LM.WRIST] ?? { x: 0, y: 0, z: 0 };

  // 2. Wrist at origin.
  const centered = raw.map((p) => ({ x: p.x - wrist.x, y: p.y - wrist.y, z: p.z - wrist.z }));

  // 3. Scale by |wrist → middle MCP|.
  const mid = centered[LM.MIDDLE_MCP] ?? { x: 0, y: 1, z: 0 };
  const length = Math.hypot(mid.x, mid.y, mid.z);
  const scale = length > 1e-9 ? 1 / length : 1;

  // 4. Rotate in the image plane so wrist → middle MCP points to +Y.
  const beta = Math.PI / 2 - Math.atan2(mid.y, mid.x);
  const cos = Math.cos(beta);
  const sin = Math.sin(beta);
  const mirror = handedness === "Left" ? -1 : 1;

  const points = centered.map((p) => ({
    x: mirror * (p.x * cos - p.y * sin) * scale,
    y: (p.x * sin + p.y * cos) * scale,
    z: p.z * scale,
  }));

  return { points, handedness };
}

/** 21 points → 63 numbers [x0, y0, z0, x1, …]. */
export function flattenPoints(points: readonly Point3[]): number[] {
  return points.flatMap((p) => [p.x, p.y, p.z]);
}

/** 63 numbers → 21 points. */
export function unflattenPoints(flat: readonly number[]): Point3[] {
  return Array.from({ length: LANDMARK_COUNT }, (_, i) => ({
    x: flat[i * 3] ?? 0,
    y: flat[i * 3 + 1] ?? 0,
    z: flat[i * 3 + 2] ?? 0,
  }));
}
