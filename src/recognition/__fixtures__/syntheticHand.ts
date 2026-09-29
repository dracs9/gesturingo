// Test-only: builds synthetic hands in the canonical frame and projects them into camera frames.
import type { Finger, FingerState } from "../features";
import { LANDMARK_COUNT, LM, type HandFrame, type Handedness, type Point3 } from "../landmarks";

/** `pinch` = thumb tip touching the index tip. */
export type ThumbPreset = "side" | "up" | "across" | "pinch";

export interface SyntheticHandOptions {
  fingers?: Partial<Record<Exclude<Finger, "thumb">, FingerState>>;
  thumb?: ThumbPreset;
  /** Rotation around the vertical (Y) axis in degrees: 0 = palm to camera, 180 = back of the hand, 90 = edge-on. */
  yaw?: number;
}

/** Flexion (degrees) at MCP, PIP, DIP for each finger state. */
const FLEX: Record<FingerState, [number, number, number]> = {
  straight: [0, 5, 5],
  half: [10, 50, 30],
  bent: [70, 100, 60],
};

const MCP: Record<Exclude<Finger, "thumb">, Point3> = {
  index: { x: 0.35, y: 0.95, z: 0 },
  middle: { x: 0, y: 1, z: 0 },
  ring: { x: -0.3, y: 0.95, z: 0 },
  pinky: { x: -0.55, y: 0.85, z: 0 },
};

const MCP_INDEX: Record<Exclude<Finger, "thumb">, number> = {
  index: LM.INDEX_MCP,
  middle: LM.MIDDLE_MCP,
  ring: LM.RING_MCP,
  pinky: LM.PINKY_MCP,
};

const SEGMENTS: [number, number, number] = [0.45, 0.28, 0.22];

const THUMBS: Record<Exclude<ThumbPreset, "pinch">, [Point3, Point3, Point3, Point3]> = {
  side: [
    { x: 0.25, y: 0.2, z: 0 },
    { x: 0.5, y: 0.35, z: 0 },
    { x: 0.72, y: 0.48, z: 0 },
    { x: 0.9, y: 0.59, z: 0 },
  ],
  up: [
    { x: 0.25, y: 0.2, z: 0 },
    { x: 0.4, y: 0.5, z: 0 },
    { x: 0.5, y: 0.8, z: 0 },
    { x: 0.6, y: 1.3, z: 0 },
  ],
  across: [
    { x: 0.25, y: 0.2, z: 0 },
    { x: 0.35, y: 0.4, z: -0.1 },
    { x: 0.2, y: 0.55, z: -0.2 },
    { x: 0, y: 0.55, z: -0.25 },
  ],
};

/** Canonical right hand, y-up, wrist at origin, |wrist → middle MCP| = 1. Fingers curl toward the camera (−z). */
export function canonicalHand({ fingers = {}, thumb = "side", yaw = 0 }: SyntheticHandOptions = {}): Point3[] {
  const pts: Point3[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));

  const [cmc, mcp, ip, tip] = THUMBS[thumb === "pinch" ? "side" : thumb];
  pts[LM.THUMB_CMC] = cmc;
  pts[LM.THUMB_MCP] = mcp;
  pts[LM.THUMB_IP] = ip;
  pts[LM.THUMB_TIP] = tip;

  for (const finger of ["index", "middle", "ring", "pinky"] as const) {
    const base = MCP[finger];
    const len = Math.hypot(base.x, base.y);
    const dir = { x: base.x / len, y: base.y / len };
    const flex = FLEX[fingers[finger] ?? "straight"];
    let pos = base;
    let theta = 0;
    const start = MCP_INDEX[finger];
    pts[start] = base;
    for (let j = 0; j < 3; j++) {
      theta += ((flex[j] ?? 0) * Math.PI) / 180;
      const seg = SEGMENTS[j] ?? 0;
      pos = {
        x: pos.x + seg * Math.cos(theta) * dir.x,
        y: pos.y + seg * Math.cos(theta) * dir.y,
        z: pos.z - seg * Math.sin(theta),
      };
      pts[start + j + 1] = pos;
    }
  }

  if (thumb === "pinch") {
    const indexTip = pts[LM.INDEX_TIP] ?? { x: 0, y: 0, z: 0 };
    const thumbMcp = pts[LM.THUMB_MCP] ?? { x: 0, y: 0, z: 0 };
    pts[LM.THUMB_TIP] = { x: indexTip.x + 0.03, y: indexTip.y - 0.03, z: indexTip.z };
    pts[LM.THUMB_IP] = {
      x: (thumbMcp.x + indexTip.x) / 2,
      y: (thumbMcp.y + indexTip.y) / 2,
      z: (thumbMcp.z + indexTip.z) / 2,
    };
  }

  const a = (yaw * Math.PI) / 180;
  return pts.map((p) => ({
    x: p.x * Math.cos(a) + p.z * Math.sin(a),
    y: p.y,
    z: -p.x * Math.sin(a) + p.z * Math.cos(a),
  }));
}

export interface ProjectionOptions {
  handedness?: Handedness;
  /** Palm size in video-height units. */
  scale?: number;
  /** In-plane rotation in degrees. */
  roll?: number;
  /** Wrist position in image-normalized coords. */
  wrist?: { x: number; y: number };
  width?: number;
  height?: number;
}

/**
 * Projects canonical points into a camera frame (inverse of normalizeHand).
 * A left hand is the mirror image of the canonical right hand.
 */
export function toFrame(
  canonical: readonly Point3[],
  { handedness = "Right", scale = 0.2, roll = 0, wrist = { x: 0.5, y: 0.7 }, width = 640, height = 480 }: ProjectionOptions = {},
): HandFrame {
  const aspect = width / height;
  const r = (roll * Math.PI) / 180;
  const mirror = handedness === "Left" ? -1 : 1;
  const landmarks = canonical.map((p) => {
    const x0 = mirror * p.x;
    const X = (x0 * Math.cos(r) - p.y * Math.sin(r)) * scale;
    const Y = (x0 * Math.sin(r) + p.y * Math.cos(r)) * scale;
    const Z = p.z * scale;
    return { x: wrist.x + X / aspect, y: wrist.y - Y, z: Z / aspect };
  });
  return { landmarks, handedness, score: 0.95, timestamp: 0, videoWidth: width, videoHeight: height };
}
