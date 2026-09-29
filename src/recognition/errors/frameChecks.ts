import { LM, type HandFrame } from "../landmarks";
import { MIN_HAND_SCORE, PALM_SIZE_MAX, PALM_SIZE_MIN } from "../thresholds";

export type HandStatus = "noHand" | "tooFar" | "tooClose" | "ok";

/** |wrist → middle MCP| in pixels divided by video height (aspect-correct). */
export function palmSize(frame: HandFrame): number {
  const w = frame.landmarks[LM.WRIST];
  const m = frame.landmarks[LM.MIDDLE_MCP];
  if (!w || !m || frame.videoHeight <= 0) return 0;
  const dx = (m.x - w.x) * frame.videoWidth;
  const dy = (m.y - w.y) * frame.videoHeight;
  return Math.hypot(dx, dy) / frame.videoHeight;
}

export function getHandStatus(frame: HandFrame | null): HandStatus {
  if (!frame || frame.score < MIN_HAND_SCORE) return "noHand";
  const size = palmSize(frame);
  if (size < PALM_SIZE_MIN) return "tooFar";
  if (size > PALM_SIZE_MAX) return "tooClose";
  return "ok";
}
