import { FINGERS, type HandFeatures } from "../features";
import { LM, type Point3 } from "../landmarks";
import { TALK_DTW_POSITION_WEIGHT, TALK_DTW_SHAPE_WEIGHT, TALK_DTW_SMOOTHING } from "../thresholds";

/**
 * Per-frame features of a motion (docs/TRANSLATOR_SPEC.md §4.2, dynamic phrases), shared by the app
 * and the offline build so templates and live motions are measured the same way:
 *   0–4   finger angles / 180 (thumb … pinky)
 *   5–7   palm normal (x, y, z) in the canonical hand frame
 *   8–9   cos / sin of the hand's roll in the image (wrist → middle MCP vs "up"): waving rotates the hand,
 *         which the canonical frame removes
 *   10–11 wrist in the image (aspect-corrected, video-height units)
 *   12    palm size (|wrist → middle MCP|, same units)
 */
export const FRAME_DIM = 13;
/** DTW features: the same, but the wrist becomes its travel from the start of the motion (weighted). */
export const SEQ_DIM = 12;

const I_NORMAL_X = 5;
const I_SIN = 9;
const I_DX = 10;

/** Writes one frame's features into `out` at `offset` (a slot of the sequence buffer: no allocation per frame). */
export function writeFrameFeatures(
  features: HandFeatures,
  landmarks: readonly Point3[],
  aspect: number,
  out: Float32Array | number[],
  offset = 0,
): void {
  FINGERS.forEach((f, i) => {
    out[offset + i] = features.fingers[f].angle / 180;
  });
  out[offset + 5] = features.palmNormal.x;
  out[offset + 6] = features.palmNormal.y;
  out[offset + 7] = features.palmNormal.z;
  const w = landmarks[LM.WRIST] ?? { x: 0, y: 0, z: 0 };
  const m = landmarks[LM.MIDDLE_MCP] ?? w;
  const vx = (m.x - w.x) * aspect;
  const vy = m.y - w.y;
  const len = Math.hypot(vx, vy) || 1;
  out[offset + 8] = -vy / len; // cos: 1 when the fingers point up
  out[offset + 9] = vx / len; // sin: > 0 when they lean to the image right
  out[offset + 10] = w.x * aspect;
  out[offset + 11] = w.y;
  out[offset + 12] = len;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
};

/** Centered moving average over `k` frames (k odd), per dimension. */
export function smoothFrames(frames: readonly ArrayLike<number>[], k = TALK_DTW_SMOOTHING): number[][] {
  const half = Math.floor(k / 2);
  return frames.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(frames.length - 1, i + half);
    const out = new Array<number>(FRAME_DIM).fill(0);
    for (let j = from; j <= to; j++) for (let d = 0; d < FRAME_DIM; d++) out[d] = (out[d] ?? 0) + (frames[j]?.[d] ?? 0);
    return out.map((x) => x / (to - from + 1));
  });
}

/**
 * A motion as a DTW sequence (smoothed): weighted finger angles, palm normal, roll, and the wrist's
 * travel from the first frame in palm sizes — so the sign is compared wherever and at whatever
 * distance it is shown.
 */
export function toSequence(frames: readonly ArrayLike<number>[]): number[][] {
  const smooth = smoothFrames(frames);
  const first = smooth[0];
  if (!first) return [];
  const palm = median(smooth.map((f) => f[12] ?? 0)) || 1;
  const x0 = first[10] ?? 0;
  const y0 = first[11] ?? 0;
  return smooth.map((f) => {
    const v = Array.from({ length: SEQ_DIM }, (_, i) => (i < 5 ? (f[i] ?? 0) * TALK_DTW_SHAPE_WEIGHT : (f[i] ?? 0)));
    v[I_DX] = (((f[10] ?? 0) - x0) / palm) * TALK_DTW_POSITION_WEIGHT;
    v[I_DX + 1] = (((f[11] ?? 0) - y0) / palm) * TALK_DTW_POSITION_WEIGHT;
    return v;
  });
}

/**
 * The same motion by the other hand / in a mirrored recording: x flips for the palm normal, the roll
 * and the wrist travel. Templates are compared in both orientations.
 */
export function mirrorSequence(seq: readonly (readonly number[])[]): number[][] {
  return seq.map((v) => v.map((x, i) => (i === I_NORMAL_X || i === I_SIN || i === I_DX ? -x : x)));
}

/** Wrist travel of a sequence in palm sizes (image x right, y down) — for direction hints and the ghost path. */
export function travelPath(seq: readonly (readonly number[])[]): { x: number; y: number }[] {
  return seq.map((v) => ({ x: (v[I_DX] ?? 0) / TALK_DTW_POSITION_WEIGHT, y: (v[I_DX + 1] ?? 0) / TALK_DTW_POSITION_WEIGHT }));
}

/**
 * How fast the hand changes between two frames, per second: shape (finger angles, palm normal, roll)
 * plus wrist travel in palm sizes. Used to cut motions out of the stream (start / end of a sign).
 */
export function motionSpeed(
  data: ArrayLike<number>,
  a: number,
  b: number,
  dtMs: number,
): number {
  if (dtMs <= 0) return 0;
  let shape = 0;
  for (let k = 0; k < 10; k++) {
    const d = (data[b + k] ?? 0) - (data[a + k] ?? 0);
    shape += d * d;
  }
  const palm = ((data[a + 12] ?? 0) + (data[b + 12] ?? 0)) / 2 || 1;
  const wrist = Math.hypot((data[b + 10] ?? 0) - (data[a + 10] ?? 0), (data[b + 11] ?? 0) - (data[a + 11] ?? 0)) / palm;
  return (Math.sqrt(shape) + wrist) / (dtMs / 1000);
}
