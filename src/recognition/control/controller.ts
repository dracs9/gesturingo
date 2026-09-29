import { palmSize } from "../errors/frameChecks";
import { LM } from "../landmarks";
import type { HandObservation } from "../observation";
import {
  OPEN_PALM_HOLD_MS,
  PINCH_LOOKBACK_MS,
  POSE_GRACE_MS,
  POSE_MAX_SPEED,
  THUMBS_UP_HOLD_MS,
} from "../thresholds";
import { createCursor, type CursorState, type Viewport } from "./cursor";
import { createDwell } from "./dwell";
import { createPinch, pinchRatio, type PinchState } from "./pinch";
import { createHold, isOpenPalm, isThumbsUp } from "./poses";

export type Command = "ok" | "back";

export interface ControlContext {
  cursor: boolean;
  /** Dwell click (only with the cursor). Off e.g. while the tutorial teaches the pinch. */
  dwell: boolean;
  ok: boolean;
  back: boolean;
}

export interface ControlOutput<T> {
  cursor: CursorState & { hover: T | null; dwell: number; pinched: boolean };
  click: { x: number; y: number; target: T | null; source: "pinch" | "dwell" } | null;
  /** Pose currently being held (for the hold ring). */
  pose: { kind: Command; progress: number } | null;
  command: Command | null;
  debug: {
    pinchRatio: number | null;
    pinchState: PinchState;
    wristSpeed: number;
    thumbsUp: boolean;
    openPalm: boolean;
  };
}

export interface ControlLayerOptions<T> {
  /** Returns the clickable target under a screen point (px), or null. */
  hitTest(x: number, y: number): T | null;
}

export interface ControlLayer<T> {
  update(observation: HandObservation | null, timestamp: number, ctx: ControlContext, viewport: Viewport): ControlOutput<T>;
  reset(): void;
}

/** Wrist speed smoothing: one noisy frame must not break or fake a steady pose. */
const SPEED_EMA = 0.3;

export function createControlLayer<T>({ hitTest }: ControlLayerOptions<T>): ControlLayer<T> {
  const cursor = createCursor();
  const pinch = createPinch();
  const dwell = createDwell<T>();
  const okHold = createHold(THUMBS_UP_HOLD_MS, POSE_GRACE_MS);
  const backHold = createHold(OPEN_PALM_HOLD_MS, POSE_GRACE_MS);
  let prevWrist: { x: number; y: number; t: number } | null = null;
  let speed = 0;

  function updateSpeed(obs: HandObservation | null, t: number): number {
    const wrist = obs?.frame.landmarks[LM.WRIST];
    if (!obs || !wrist) {
      prevWrist = null;
      speed = 0;
      return speed;
    }
    const { frame } = obs;
    const aspect = frame.videoHeight > 0 ? frame.videoWidth / frame.videoHeight : 1;
    if (prevWrist && t > prevWrist.t) {
      const dist = Math.hypot((wrist.x - prevWrist.x) * aspect, wrist.y - prevWrist.y) / (palmSize(frame) || 1);
      const instant = dist / ((t - prevWrist.t) / 1000);
      speed = speed * (1 - SPEED_EMA) + instant * SPEED_EMA;
    }
    prevWrist = { x: wrist.x, y: wrist.y, t };
    return speed;
  }

  return {
    update(obs, t, ctx, viewport) {
      // --- Poses (need a steady hand, so moving an open hand around never means "back") ---
      const still = updateSpeed(obs, t) < POSE_MAX_SPEED;
      const thumbsUp = obs !== null && ctx.ok && isThumbsUp(obs);
      const openPalm = obs !== null && ctx.back && isOpenPalm(obs);
      const ok = okHold.update(thumbsUp && still, t);
      const back = backHold.update(openPalm && still, t);

      const command: Command | null = ok.fired ? "ok" : back.fired ? "back" : null;
      const pose: ControlOutput<T>["pose"] =
        back.progress > 0 && back.progress >= ok.progress
          ? { kind: "back", progress: back.progress }
          : ok.progress > 0
            ? { kind: "ok", progress: ok.progress }
            : null;

      const ratio = obs ? pinchRatio(obs.normalized.points) : null;
      const debug = { pinchRatio: ratio, pinchState: pinch.state, wristSpeed: speed, thumbsUp, openPalm };

      // --- Cursor, pinch and dwell ---
      if (!ctx.cursor) {
        cursor.reset();
        pinch.reset();
        dwell.reset();
        return {
          cursor: { x: 0, y: 0, visible: false, hover: null, dwell: 0, pinched: false },
          click: null,
          pose,
          command,
          debug,
        };
      }

      const tip = obs?.frame.landmarks[LM.INDEX_TIP];
      const cur = cursor.update(tip ? { x: tip.x, y: tip.y } : null, t, viewport);
      const hover = cur.visible && obs ? hitTest(cur.x, cur.y) : null;
      const pinchUpdate = pinch.update(ratio, t);
      debug.pinchState = pinchUpdate.state;

      const poseActive = pose !== null || command !== null;
      let click: ControlOutput<T>["click"] = null;
      if (pinchUpdate.clicked && !poseActive && cur.visible) {
        // The fingertip drifts while pinching: click where the cursor was just before.
        const at = cursor.positionAt(t - PINCH_LOOKBACK_MS) ?? cur;
        click = { x: at.x, y: at.y, target: hitTest(at.x, at.y), source: "pinch" };
      }

      let dwellProgress = 0;
      if (poseActive) {
        dwell.disarm(cur);
      } else if (!ctx.dwell) {
        dwell.reset();
      } else {
        const d = dwell.update(hover, cur, t);
        dwellProgress = d.progress;
        if (!click && d.fired !== null) click = { x: cur.x, y: cur.y, target: d.fired, source: "dwell" };
      }
      if (click || command) dwell.disarm(cur);

      return {
        cursor: { ...cur, hover, dwell: dwellProgress, pinched: pinchUpdate.state === "closed" },
        click,
        pose,
        command,
        debug,
      };
    },

    reset() {
      cursor.reset();
      pinch.reset();
      dwell.reset();
      okHold.reset();
      backHold.reset();
      prevWrist = null;
      speed = 0;
    },
  };
}
