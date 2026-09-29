import { LM, type HandFrame } from "../landmarks";
import { FRAME_EDGE_MARGIN, MIN_HAND_SCORE, PALM_SIZE_MAX, PALM_SIZE_MIN } from "../thresholds";
import type { HintError } from "./hintEngine";

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

/** Landmarks that touch the frame border (the hand is cut off there). */
export function landmarksOutOfFrame(frame: HandFrame, margin = FRAME_EDGE_MARGIN): number[] {
  const out: number[] = [];
  frame.landmarks.forEach((p, i) => {
    if (p.x < margin || p.x > 1 - margin || p.y < margin || p.y > 1 - margin) out.push(i);
  });
  return out;
}

/** Frame-level errors (CLAUDE.md §9.1): when any is present, gesture/letter hints are not shown. */
export function frameErrors(frame: HandFrame | null): HintError[] {
  const status = getHandStatus(frame);
  if (status !== "ok") return [{ level: "frame", hintCode: `frame.${status}`, severity: 1 }];
  if (!frame) return [];
  const out = landmarksOutOfFrame(frame);
  return out.length > 0 ? [{ level: "frame", hintCode: "frame.partlyOut", severity: 0.8, landmarkIds: out }] : [];
}
