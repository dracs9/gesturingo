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
