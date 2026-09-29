import { FINGERS } from "../features";
import { LM, type HandFrame } from "../landmarks";
import type { HandObservation } from "../observation";
import { THUMB_UP_MAX_ANGLE } from "../thresholds";

/** Angle (degrees, 0..180) between the thumb (MCP → tip) and image-up, aspect-corrected. */
export function thumbAngleFromUp(frame: HandFrame): number {
  const mcp = frame.landmarks[LM.THUMB_MCP];
  const tip = frame.landmarks[LM.THUMB_TIP];
  if (!mcp || !tip) return 180;
  const aspect = frame.videoHeight > 0 ? frame.videoWidth / frame.videoHeight : 1;
  const dx = (tip.x - mcp.x) * aspect;
  const dy = mcp.y - tip.y; // y-up
  return (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI;
}

/**
 * «Большой палец вверх»: thumb extended and pointing up in the image (not in the hand frame —
 * a real thumbs-up turns the fist sideways), the other fingers folded, the thumb tip highest.
 */
export function isThumbsUp({ frame, features }: HandObservation, maxAngle = THUMB_UP_MAX_ANGLE): boolean {
  const { fingers } = features;
  if (fingers.thumb.state === "bent") return false;
  if (FINGERS.some((f) => f !== "thumb" && fingers[f].state === "straight")) return false;
  if (thumbAngleFromUp(frame) > maxAngle) return false;

  const tip = frame.landmarks[LM.THUMB_TIP];
  return !!tip && frame.landmarks.every((p, i) => i === LM.THUMB_TIP || p.y >= tip.y);
}

/** «Открытая ладонь»: all five fingers straight, palm toward the camera. */
export function isOpenPalm({ features }: HandObservation): boolean {
  return features.palmFacing === "camera" && FINGERS.every((f) => features.fingers[f].state === "straight");
}

export interface HoldUpdate {
  /** 0..1 while holding (0 once fired, until the pose is released). */
  progress: number;
  fired: boolean;
}

export interface Hold {
  update(active: boolean, timestamp: number): HoldUpdate;
  reset(): void;
}

/** Fires once after `holdMs` of continuous pose; brief dropouts up to `graceMs` are tolerated. */
export function createHold(holdMs: number, graceMs: number): Hold {
  let start: number | null = null;
  let lastActive = 0;
  let done = false;

  const reset = () => {
    start = null;
    done = false;
  };

  return {
    update(active, t) {
      if (active) {
        start ??= t;
        lastActive = t;
      } else if (start !== null && t - lastActive > graceMs) {
        reset();
      }

      if (start === null || done) return { progress: 0, fired: false };
      const progress = Math.min(1, (t - start) / holdMs);
      if (active && progress >= 1) {
        done = true;
        return { progress: 1, fired: true };
      }
      return { progress, fired: false };
    },
    reset,
  };
}
