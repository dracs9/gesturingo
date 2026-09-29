import { LM, type Point3 } from "./landmarks";
import type { NormalizedHand } from "./normalize";
import {
  FINGER_BENT_MAX_ANGLE,
  FINGER_STRAIGHT_MIN_ANGLE,
  PALM_FACING_MIN,
  THUMB_ACROSS_MIN,
  THUMB_BENT_MAX_ANGLE,
  THUMB_STRAIGHT_MIN_ANGLE,
  THUMB_UP_MIN,
} from "./thresholds";

export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";
export type FingerState = "straight" | "half" | "bent";
export type PalmFacing = "camera" | "side" | "away";
export type ThumbPosition = "acrossPalm" | "side" | "up";
export type FingerPair = `${Finger}-${Finger}`;

export const FINGERS: readonly Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

/** Landmark chains: [base (wrist or CMC), joint1, joint2, joint3, tip]. */
export const FINGER_LANDMARKS: Record<Finger, readonly [number, number, number, number, number]> = {
  thumb: [LM.WRIST, LM.THUMB_CMC, LM.THUMB_MCP, LM.THUMB_IP, LM.THUMB_TIP],
  index: [LM.WRIST, LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP],
  middle: [LM.WRIST, LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP],
  ring: [LM.WRIST, LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP],
  pinky: [LM.WRIST, LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP],
};

export interface FingerFeatures {
  /**
   * Joint angles in degrees, 180 = straight.
   * Thumb: [CMC, MCP, IP]; other fingers: [MCP, PIP, DIP].
   */
  angles: [number, number, number];
  /** Representative angle used for the state (min of the two base joints that matter). */
  angle: number;
  state: FingerState;
}

export interface HandFeatures {
  fingers: Record<Finger, FingerFeatures>;
  /** Distances between fingertips in palm units (|wrist → middle MCP| = 1). */
  tipDistances: Record<FingerPair, number>;
  palmFacing: PalmFacing;
  /**
   * Unit palm normal = (index MCP − wrist) × (pinky MCP − wrist).
   * For the canonical (right) hand z > 0 means the index MCP is right of the pinky MCP, i.e. palm to camera.
   */
  palmNormal: Point3;
  thumbPosition: ThumbPosition;
}

// --- vector helpers ---
const sub = (a: Point3, b: Point3): Point3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Point3, b: Point3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Point3, b: Point3): Point3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const norm = (a: Point3) => Math.hypot(a.x, a.y, a.z);
const ZERO: Point3 = { x: 0, y: 0, z: 0 };

/** Angle ABC at vertex B, in degrees (0..180). */
export function angleAt(a: Point3, b: Point3, c: Point3): number {
  const ba = sub(a, b);
  const bc = sub(c, b);
  const len = norm(ba) * norm(bc);
  if (len < 1e-12) return 180;
  const cos = Math.min(1, Math.max(-1, dot(ba, bc) / len));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function distance(a: Point3, b: Point3): number {
  return norm(sub(a, b));
}

export function fingerState(finger: Finger, angle: number): FingerState {
  const [straightMin, bentMax] =
    finger === "thumb"
      ? [THUMB_STRAIGHT_MIN_ANGLE, THUMB_BENT_MAX_ANGLE]
      : [FINGER_STRAIGHT_MIN_ANGLE, FINGER_BENT_MAX_ANGLE];
  if (angle > straightMin) return "straight";
  if (angle < bentMax) return "bent";
  return "half";
}

function fingerFeatures(points: readonly Point3[], finger: Finger): FingerFeatures {
  const [p0, p1, p2, p3, p4] = FINGER_LANDMARKS[finger].map((i) => points[i] ?? ZERO) as [
    Point3,
    Point3,
    Point3,
    Point3,
    Point3,
  ];
  const angles: [number, number, number] = [angleAt(p0, p1, p2), angleAt(p1, p2, p3), angleAt(p2, p3, p4)];
  // Thumb: MCP + IP (CMC barely moves). Others: MCP + PIP (catches knuckle folds and claws).
  const angle = finger === "thumb" ? Math.min(angles[1], angles[2]) : Math.min(angles[0], angles[1]);
  return { angles, angle, state: fingerState(finger, angle) };
}

export function tipDistance(features: HandFeatures, a: Finger, b: Finger): number {
  if (a === b) return 0;
  return features.tipDistances[`${a}-${b}`] ?? features.tipDistances[`${b}-${a}`] ?? 0;
}

export function computeFeatures(hand: NormalizedHand): HandFeatures {
  const pts = hand.points;
  const at = (i: number) => pts[i] ?? ZERO;

  const fingers = Object.fromEntries(FINGERS.map((f) => [f, fingerFeatures(pts, f)])) as Record<
    Finger,
    FingerFeatures
  >;

  const tipDistances = {} as Record<FingerPair, number>;
  FINGERS.forEach((a, i) => {
    for (const b of FINGERS.slice(i + 1)) {
      tipDistances[`${a}-${b}`] = distance(at(FINGER_LANDMARKS[a][4]), at(FINGER_LANDMARKS[b][4]));
    }
  });

  // Palm frame. The z sign of the normal only depends on the 2D layout of index/pinky MCPs,
  // so it stays reliable even though MediaPipe depth is noisy.
  const wrist = at(LM.WRIST);
  const indexMcp = at(LM.INDEX_MCP);
  const pinkyMcp = at(LM.PINKY_MCP);
  const n = cross(sub(indexMcp, wrist), sub(pinkyMcp, wrist));
  const nLen = norm(n);
  const palmNormal = nLen > 1e-12 ? { x: n.x / nLen, y: n.y / nLen, z: n.z / nLen } : { x: 0, y: 0, z: 0 };
  const palmFacing: PalmFacing =
    palmNormal.z > PALM_FACING_MIN ? "camera" : palmNormal.z < -PALM_FACING_MIN ? "away" : "side";

  // Thumb tip relative to the palm: across = past the index MCP toward the pinky MCP.
  const across = sub(pinkyMcp, indexMcp);
  const acrossLen2 = dot(across, across);
  const thumbRel = sub(at(LM.THUMB_TIP), indexMcp);
  const acrossShare = acrossLen2 > 1e-12 ? dot(thumbRel, across) / acrossLen2 : 0;
  const up = sub(at(LM.MIDDLE_MCP), wrist);
  const upLen = norm(up);
  const height = upLen > 1e-12 ? dot(thumbRel, up) / upLen : 0;

  const thumbPosition: ThumbPosition =
    acrossShare > THUMB_ACROSS_MIN
      ? "acrossPalm"
      : height > THUMB_UP_MIN && fingers.thumb.state === "straight"
        ? "up"
        : "side";

  return { fingers, tipDistances, palmFacing, palmNormal, thumbPosition };
}
