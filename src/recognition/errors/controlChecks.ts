import { isOpenPalm, isThumbsUp, thumbAngleFromUp } from "../control/poses";
import { FINGER_LANDMARKS, FINGERS, type Finger } from "../features";
import type { HandObservation } from "../observation";
import { PINCH_CLOSE_BELOW, PINCH_OPEN_ABOVE, POSE_MAX_SPEED, THUMB_UP_MAX_ANGLE } from "../thresholds";
import type { HintError } from "./hintEngine";

// Control-level errors (CLAUDE.md §9.1): why a control gesture is not recognized, as a concrete action.

/** Landmarks of one finger, without the wrist. */
export function fingerLandmarkIds(finger: Finger): number[] {
  return FINGER_LANDMARKS[finger].slice(1);
}

function control(hintCode: string, severity: number, finger?: Finger, landmarkIds?: readonly number[]): HintError {
  return { level: "control", hintCode, severity, finger, landmarkIds: landmarkIds ?? (finger && fingerLandmarkIds(finger)) };
}

const holdStill = () => control("pose.holdStill", 0.5);

/** The cursor follows the index fingertip: it has to be extended. */
export function cursorErrors({ features }: HandObservation): HintError[] {
  return features.fingers.index.state === "straight" ? [] : [control("finger.straighten.index", 0.6, "index")];
}

/** Fingertips close but not touching: the pinch hovers inside the hysteresis band. */
export function pinchErrors(ratio: number | null): HintError[] {
  return ratio !== null && ratio >= PINCH_CLOSE_BELOW && ratio <= PINCH_OPEN_ABOVE ? [control("pinch.closer", 0.8)] : [];
}

export function thumbsUpErrors(obs: HandObservation, wristSpeed: number): HintError[] {
  if (isThumbsUp(obs)) return wristSpeed >= POSE_MAX_SPEED ? [holdStill()] : [];

  const { fingers } = obs.features;
  if (fingers.thumb.state === "bent") return [control("finger.straighten.thumb", 0.9, "thumb")];

  const open = FINGERS.filter((f) => f !== "thumb" && fingers[f].state === "straight");
  if (open.length > 0) {
    return [control("thumb.foldOthers", 0.8, undefined, open.flatMap(fingerLandmarkIds))];
  }
  if (thumbAngleFromUp(obs.frame) > THUMB_UP_MAX_ANGLE) {
    return [control("thumb.pointUp", 0.7, "thumb")];
  }
  return [control("thumb.pointUp", 0.6, "thumb")];
}

export function openPalmErrors(obs: HandObservation, wristSpeed: number): HintError[] {
  if (isOpenPalm(obs)) return wristSpeed >= POSE_MAX_SPEED ? [holdStill()] : [];

  const { features } = obs;
  if (features.palmFacing !== "camera") return [control("palm.faceCamera", 0.9)];

  // Name the single most bent finger — one concrete action at a time.
  const bent = FINGERS.filter((f) => features.fingers[f].state !== "straight").sort(
    (a, b) => features.fingers[a].angle - features.fingers[b].angle,
  );
  const worst = bent[0];
  return worst ? [control(`finger.straighten.${worst}`, 0.8, worst)] : [];
}
