import {
  TALK_MOTION_END,
  TALK_MOTION_END_MS,
  TALK_MOTION_MAX_MS,
  TALK_MOTION_MIN_MS,
  TALK_MOTION_START,
  TALK_SEQ_CAPACITY,
} from "../thresholds";
import { FRAME_DIM, motionSpeed } from "./frameFeatures";

/**
 * Ring buffer of the last frames' features + cutting motions out of the stream by speed
 * (docs/TRANSLATOR_SPEC.md §4.2): a motion starts when the hand speeds up above TALK_MOTION_START and
 * ends when it stays below TALK_MOTION_END for TALK_MOTION_END_MS. Typed arrays, no allocation per
 * frame — only a finished motion is copied out.
 */
export interface MotionSegment {
  /** Frames of the motion (FRAME_DIM numbers each). */
  frames: number[][];
  startT: number;
  endT: number;
  durationMs: number;
}

export interface SequenceUpdate {
  /** Smoothed motion speed (see `motionSpeed`). */
  speed: number;
  moving: boolean;
  /** A motion that just ended, if any. */
  segment: MotionSegment | null;
}

export interface SequenceTracker {
  /** One frame's features (copied), or null when there is no usable hand. */
  push(frame: ArrayLike<number> | null, timestamp: number): SequenceUpdate;
  reset(): void;
}

export interface SequenceTrackerOptions {
  capacity?: number;
  start?: number;
  end?: number;
  endMs?: number;
  minMs?: number;
  maxMs?: number;
}

const SPEED_EMA = 0.5;
/** Frames before the speed-up that still belong to the motion (the speed is measured with a lag). */
const LEAD_FRAMES = 2;

export function createSequenceTracker({
  capacity = TALK_SEQ_CAPACITY,
  start = TALK_MOTION_START,
  end = TALK_MOTION_END,
  endMs = TALK_MOTION_END_MS,
  minMs = TALK_MOTION_MIN_MS,
  maxMs = TALK_MOTION_MAX_MS,
}: SequenceTrackerOptions = {}): SequenceTracker {
  const data = new Float32Array(capacity * FRAME_DIM);
  const times = new Float64Array(capacity);
  let total = 0;
  /** First frame of the current run of consecutive hand frames. */
  let runStart = 0;
  let prevPresent = false;
  let speed = 0;
  let moving = false;
  let segStart = 0;
  let stillSince: number | null = null;
  let stillAt = 0;

  const slot = (abs: number) => (abs % capacity) * FRAME_DIM;
  const timeOf = (abs: number) => times[abs % capacity] ?? 0;

  function cut(from: number, to: number): MotionSegment | null {
    const first = Math.max(from, total - capacity, runStart);
    if (to - first + 1 < 3) return null;
    const startT = timeOf(first);
    const endT = timeOf(to);
    const durationMs = endT - startT;
    if (durationMs < minMs || durationMs > maxMs) return null;
    const frames: number[][] = [];
    for (let i = first; i <= to; i++) frames.push(Array.from(data.subarray(slot(i), slot(i) + FRAME_DIM)));
    return { frames, startT, endT, durationMs };
  }

  return {
    push(frame, t) {
      if (!frame) {
        // The hand left: a motion in progress ends with its last frame.
        const segment = moving && prevPresent ? cut(segStart, total - 1) : null;
        moving = false;
        prevPresent = false;
        speed = 0;
        stillSince = null;
        return { speed, moving, segment };
      }

      const abs = total++;
      const o = slot(abs);
      for (let k = 0; k < FRAME_DIM; k++) data[o + k] = frame[k] ?? 0;
      times[abs % capacity] = t;

      if (prevPresent) {
        const instant = motionSpeed(data, slot(abs - 1), o, t - timeOf(abs - 1));
        speed = speed * (1 - SPEED_EMA) + instant * SPEED_EMA;
      } else {
        runStart = abs;
        speed = 0;
      }
      prevPresent = true;

      let segment: MotionSegment | null = null;
      if (!moving) {
        if (speed > start) {
          moving = true;
          segStart = Math.max(runStart, abs - LEAD_FRAMES);
          stillSince = null;
        }
      } else if (t - timeOf(segStart) > maxMs) {
        // Too long for a sign (hand wandering): drop it and wait for the next one.
        moving = false;
      } else if (speed < end) {
        if (stillSince === null) {
          stillSince = t;
          stillAt = abs;
        }
        if (t - stillSince >= endMs) {
          segment = cut(segStart, stillAt);
          moving = false;
          stillSince = null;
        }
      } else {
        stillSince = null;
      }
      return { speed, moving, segment };
    },
    reset() {
      total = 0;
      runStart = 0;
      prevPresent = false;
      speed = 0;
      moving = false;
      stillSince = null;
    },
  };
}
