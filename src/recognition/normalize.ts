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

/** Parameters that map a camera frame onto the canonical frame (and back, for the ghost hand). */
export interface HandTransform {
  aspect: number;
  /** Wrist in aspect-corrected, y-up image coordinates. */
  wrist: Point3;
  /** |wrist → middle MCP| in the same units. */
  length: number;
  /** In-plane rotation that makes wrist → middle MCP point to +Y. */
  beta: number;
  mirror: 1 | -1;
}

export function handTransform(frame: HandFrame): HandTransform {
  const aspect = frame.videoHeight > 0 ? frame.videoWidth / frame.videoHeight : 1;
  const w = frame.landmarks[LM.WRIST] ?? { x: 0, y: 0, z: 0 };
  const m = frame.landmarks[LM.MIDDLE_MCP] ?? { x: 0, y: -1, z: 0 };
  const wrist = { x: w.x * aspect, y: -w.y, z: w.z * aspect };
  const mid = { x: m.x * aspect - wrist.x, y: -m.y - wrist.y, z: m.z * aspect - wrist.z };
  const length = Math.hypot(mid.x, mid.y, mid.z);
  return {
    aspect,
    wrist,
    length: length > 1e-9 ? length : 1,
    beta: Math.PI / 2 - Math.atan2(mid.y, mid.x),
    mirror: trueHandedness(frame) === "Left" ? -1 : 1,
  };
}

export function normalizeHand(frame: HandFrame): NormalizedHand {
  const { aspect, wrist, length, beta, mirror } = handTransform(frame);
  const cos = Math.cos(beta);
  const sin = Math.sin(beta);

  // Aspect-correct and y-up → wrist at origin → rotate 0→9 to +Y → scale to palm = 1 → mirror left hands.
  const points = frame.landmarks.map((p) => {
    const x = p.x * aspect - wrist.x;
    const y = -p.y - wrist.y;
    const z = p.z * aspect - wrist.z;
    return {
      x: (mirror * (x * cos - y * sin)) / length,
      y: (x * sin + y * cos) / length,
      z: z / length,
    };
  });

  return { points, handedness: trueHandedness(frame) };
}

/** Inverse of `normalizeHand`: canonical points → image-normalized landmarks of the hand described by `t`. */
export function denormalizePoints(points: readonly Point3[], t: HandTransform): Point3[] {
  const cos = Math.cos(-t.beta);
  const sin = Math.sin(-t.beta);
  return points.map((p) => {
    const x0 = t.mirror * p.x * t.length;
    const y0 = p.y * t.length;
    const x = x0 * cos - y0 * sin + t.wrist.x;
    const y = x0 * sin + y0 * cos + t.wrist.y;
    return { x: x / t.aspect, y: -y, z: (p.z * t.length + t.wrist.z) / t.aspect };
  });
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
