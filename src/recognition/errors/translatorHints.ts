import { palmCenter, type Calibration } from "../control/calibration";
import type { HandFrame } from "../landmarks";
import {
  TALK_POSITION_TOLERANCE_X,
  TALK_POSITION_TOLERANCE_Y,
  TALK_SIZE_RATIO_MAX,
  TALK_SIZE_RATIO_MIN,
} from "../thresholds";
import { palmSize } from "./frameChecks";
import type { HintError } from "./hintEngine";

/**
 * Hints of the talk screen that are not about the hand shape (docs/TRANSLATOR_SPEC.md §7.2):
 * where the hand is relative to the calibrated place, in relative words («чуть выше»), and which
 * hints get a visual — an arrow to the target zone, or a rotation arrow for the palm.
 */

export type Visual = "move" | "rotate" | null;

export const POSITION_PREFIX = "position.";

export function hintVisual(hintCode: string | null | undefined): Visual {
  if (!hintCode) return null;
  if (hintCode.startsWith(POSITION_PREFIX)) return "move";
  if (hintCode.startsWith("palm.")) return "rotate";
  return null;
}

/**
 * One position hint (the biggest deviation), or none while the hand is near the calibrated place.
 * Directions are as the user sees the mirrored video: raw x grows to the left on screen.
 */
export function positionErrors(frame: HandFrame, cal: Calibration): HintError[] {
  const palm = palmSize(frame);
  if (palm <= 0 || cal.palm <= 0) return [];

  const ratio = palm / cal.palm;
  if (ratio > TALK_SIZE_RATIO_MAX) return [{ level: "control", hintCode: "position.farther", severity: 0.6 }];
  if (ratio < TALK_SIZE_RATIO_MIN) return [{ level: "control", hintCode: "position.closer", severity: 0.6 }];

  const c = palmCenter(frame);
  // In calibrated palm sizes, screen directions: +x = right on screen, +y = down.
  const dx = (-(c.x - cal.center.x) * cal.aspect) / cal.palm;
  const dy = (c.y - cal.center.y) / cal.palm;
  const ox = Math.abs(dx) / TALK_POSITION_TOLERANCE_X;
  const oy = Math.abs(dy) / TALK_POSITION_TOLERANCE_Y;
  if (ox <= 1 && oy <= 1) return [];

  const hintCode =
    ox >= oy ? (dx > 0 ? "position.left" : "position.right") : dy > 0 ? "position.up" : "position.down";
  return [
    {
      level: "control",
      hintCode,
      severity: Math.min(1, 0.5 + 0.1 * Math.max(ox, oy)),
      params: { dx: dx.toFixed(2), dy: dy.toFixed(2) },
    },
  ];
}
