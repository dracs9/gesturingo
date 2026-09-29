import { fingerLandmarkIds } from "../errors/controlChecks";
import type { HintError } from "../errors/hintEngine";
import { FINGERS, tipDistance, type FingerState, type HandFeatures } from "../features";
import {
  FINGER_BENT_MAX_ANGLE,
  FINGER_STRAIGHT_MIN_ANGLE,
  THUMB_BENT_MAX_ANGLE,
  THUMB_STRAIGHT_MIN_ANGLE,
  TIPS_APART_MIN,
  TIPS_TOUCH_MAX,
} from "../thresholds";
import type { Finger, LetterSpec } from "./spec";

/** A violated condition of a letter spec (CLAUDE.md §8.2): `{ code, finger?, severity, hintCode, landmarkIds }`. */
export interface LetterError extends HintError {
  level: "shape";
  /** Stable id of the violated condition, e.g. "finger.ring.state", "tipsTouch.thumb-index". */
  code: string;
}

/** How far (degrees) a finger angle is from the band of the required state. */
function stateDeviation(finger: Finger, angle: number, required: FingerState): number {
  const [straightMin, bentMax] =
    finger === "thumb"
      ? [THUMB_STRAIGHT_MIN_ANGLE, THUMB_BENT_MAX_ANGLE]
      : [FINGER_STRAIGHT_MIN_ANGLE, FINGER_BENT_MAX_ANGLE];
  switch (required) {
    case "straight":
      return Math.max(0, straightMin - angle);
    case "bent":
      return Math.max(0, angle - bentMax);
    case "half":
      return angle > straightMin ? angle - straightMin : angle < bentMax ? bentMax - angle : 0;
  }
}

/** Bigger mistakes first: 0.5 for a borderline miss, up to 1 for a finger far off. */
const severityFor = (deviationDeg: number) => 0.5 + Math.min(0.5, deviationDeg / 120);

/** Checks every condition of the letter; each violation becomes one error with its own hint. */
export function checkLetter(spec: LetterSpec, features: HandFeatures): LetterError[] {
  const errors: LetterError[] = [];

  for (const finger of FINGERS) {
    const rule = spec.fingers[finger];
    if (!rule) continue;
    const { state, angle } = features.fingers[finger];
    if (state === rule.state) continue;
    errors.push({
      level: "shape",
      code: `finger.${finger}.state`,
      hintCode: rule.hintCode,
      severity: severityFor(stateDeviation(finger, angle, rule.state)),
      finger,
      landmarkIds: fingerLandmarkIds(finger),
    });
  }

  for (const extra of spec.extra ?? []) {
    switch (extra.type) {
      case "palmFacing":
        // Orientation first: finger checks are meaningless with the hand turned the wrong way.
        if (features.palmFacing !== extra.value) {
          errors.push({ level: "shape", code: "palmFacing", hintCode: extra.hintCode, severity: 1 });
        }
        break;
      case "thumbPosition":
        if (features.thumbPosition !== extra.value) {
          errors.push({
            level: "shape",
            code: "thumbPosition",
            hintCode: extra.hintCode,
            severity: 0.8,
            finger: "thumb",
            landmarkIds: fingerLandmarkIds("thumb"),
          });
        }
        break;
      case "tipsTouch":
      case "tipsApart": {
        const d = tipDistance(features, extra.a, extra.b);
        const ok = extra.type === "tipsTouch" ? d <= TIPS_TOUCH_MAX : d >= TIPS_APART_MIN;
        if (!ok) {
          errors.push({
            level: "shape",
            code: `${extra.type}.${extra.a}-${extra.b}`,
            hintCode: extra.hintCode,
            severity: 0.7,
            landmarkIds: [...fingerLandmarkIds(extra.a).slice(-1), ...fingerLandmarkIds(extra.b).slice(-1)],
          });
        }
        break;
      }
    }
  }

  return errors;
}
