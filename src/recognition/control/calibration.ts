import { frameErrors, palmSize } from "../errors/frameChecks";
import { LM, type HandFrame } from "../landmarks";
import type { HandObservation } from "../observation";
import {
  POSE_GRACE_MS,
  TALK_CALIBRATION_HOLD_MS,
  TALK_CALIBRATION_MAX_DRIFT,
  TALK_CALIBRATION_TIMEOUT_MS,
} from "../thresholds";
import { isOpenPalm } from "./poses";

/**
 * Where this person signs (docs/TRANSLATOR_SPEC.md §4.5): the palm centre and size in the camera frame
 * while an open palm is held at chest level. Position hints («чуть выше») are measured from it.
 */
export interface Calibration {
  /** Palm centre, image-normalized raw camera coordinates (not mirrored). */
  center: { x: number; y: number };
  /** Palm size in video-height units (see `palmSize`). */
  palm: number;
  /** Video width / height when calibrated. */
  aspect: number;
}

const PALM_POINTS = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];

/** Centre of the palm (wrist and the four finger bases): steadier than any single landmark. */
export function palmCenter(frame: HandFrame): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const i of PALM_POINTS) {
    x += frame.landmarks[i]?.x ?? 0;
    y += frame.landmarks[i]?.y ?? 0;
  }
  return { x: x / PALM_POINTS.length, y: y / PALM_POINTS.length };
}

export type CalibrationStatus = "waiting" | "holding" | "done" | "failed";

export interface CalibrationUpdate {
  status: CalibrationStatus;
  /** 0..1 of the steady hold. */
  progress: number;
  /** Time left before calibration is skipped. */
  remainingMs: number;
  result: Calibration | null;
}

export interface Calibrator {
  update(observation: HandObservation | null, timestamp: number): CalibrationUpdate;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
};

/** Open palm held steady for `holdMs` → calibration; nothing within `timeoutMs` → "failed" (talk goes on without). */
export function createCalibrator({
  holdMs = TALK_CALIBRATION_HOLD_MS,
  timeoutMs = TALK_CALIBRATION_TIMEOUT_MS,
  maxDrift = TALK_CALIBRATION_MAX_DRIFT,
} = {}): Calibrator {
  let startedAt: number | null = null;
  let holdStart: number | null = null;
  let lastSeen = 0;
  let samples: { x: number; y: number; palm: number; aspect: number }[] = [];
  let finished: CalibrationUpdate | null = null;

  return {
    update(obs, t) {
      if (finished) return finished;
      startedAt ??= t;
      const remainingMs = Math.max(0, timeoutMs - (t - startedAt));

      const usable = obs !== null && frameErrors(obs.frame).length === 0 && isOpenPalm(obs);
      if (usable && obs) {
        const c = palmCenter(obs.frame);
        const palm = palmSize(obs.frame);
        const aspect = obs.frame.videoHeight > 0 ? obs.frame.videoWidth / obs.frame.videoHeight : 1;
        const first = samples[0];
        // Moving away from where the hold began starts it over: the calibrated place must be a steady one.
        const drift = first ? Math.hypot((c.x - first.x) * aspect, c.y - first.y) / (palm || 1) : 0;
        if (holdStart === null || drift > maxDrift) {
          holdStart = t;
          samples = [];
        }
        samples.push({ x: c.x, y: c.y, palm, aspect });
        lastSeen = t;
      } else if (holdStart !== null && t - lastSeen > POSE_GRACE_MS) {
        holdStart = null;
        samples = [];
      }

      const progress = holdStart === null ? 0 : Math.min(1, (t - holdStart) / holdMs);
      if (progress >= 1 && samples.length > 0) {
        finished = {
          status: "done",
          progress: 1,
          remainingMs,
          result: {
            center: { x: median(samples.map((s) => s.x)), y: median(samples.map((s) => s.y)) },
            palm: median(samples.map((s) => s.palm)),
            aspect: samples[0]?.aspect ?? 1,
          },
        };
        return finished;
      }
      if (remainingMs <= 0) {
        finished = { status: "failed", progress: 0, remainingMs: 0, result: null };
        return finished;
      }
      return { status: holdStart === null ? "waiting" : "holding", progress, remainingMs, result: null };
    },
  };
}
