import { cursorErrors, openPalmErrors, pinchErrors, thumbsUpErrors } from "../../recognition/errors/controlChecks";
import { frameErrors } from "../../recognition/errors/frameChecks";
import type { HintError } from "../../recognition/errors/hintEngine";
import type { GestureContext } from "../../recognition/gestureContext";
import type { HandObservation } from "../../recognition/observation";
import { TUTORIAL_DWELL_FALLBACK_MS, TUTORIAL_MOVE_HINT_MS } from "../../recognition/thresholds";

export type TutorialStep = "cursor" | "pinch" | "thumbsUp" | "openPalm" | "done";

export const TRAINING_STEPS = ["cursor", "pinch", "thumbsUp", "openPalm"] as const satisfies readonly TutorialStep[];

export function nextStep(step: TutorialStep): TutorialStep {
  const i = TRAINING_STEPS.indexOf(step as (typeof TRAINING_STEPS)[number]);
  return i >= 0 && i < TRAINING_STEPS.length - 1 ? (TRAINING_STEPS[i + 1] ?? "done") : "done";
}

/** Only the trained gesture is on (CLAUDE.md §7.5). The cursor stays on for the «Пропустить» button. */
export function stepContext(step: TutorialStep, elapsedMs: number): GestureContext {
  const base: GestureContext = { cursor: true, dwell: true, ok: false, back: false, letters: "none" };
  switch (step) {
    case "cursor":
      return base;
    case "pinch":
      // Teach the pinch first; dwell becomes the fallback for those who can't pinch.
      return { ...base, dwell: elapsedMs >= TUTORIAL_DWELL_FALLBACK_MS };
    case "thumbsUp":
      return { ...base, ok: true };
    case "openPalm":
      return { ...base, back: true };
    case "done":
      return { ...base, ok: true, back: true };
  }
}

export interface StepInput {
  observation: HandObservation | null;
  pinchRatio: number | null;
  wristSpeed: number;
  /** Time spent on the current step. */
  elapsedMs: number;
  now: number;
  /** A pinch missed the target: the "aim first" hint is relevant until this time. */
  offTargetUntil: number;
}

const control = (hintCode: string, severity: number): HintError => ({ level: "control", hintCode, severity });

/** All errors for the current step; frame problems come first and hide the rest. */
export function stepErrors(step: TutorialStep, input: StepInput): HintError[] {
  if (step === "done") return [];
  const { observation: obs } = input;
  const frame = frameErrors(obs?.frame ?? null);
  if (frame.length > 0 || !obs) return frame;

  switch (step) {
    case "cursor":
      return [
        ...cursorErrors(obs),
        ...(input.elapsedMs >= TUTORIAL_MOVE_HINT_MS ? [control("cursor.moveToTarget", 0.3)] : []),
      ];
    case "pinch":
      return [
        ...pinchErrors(input.pinchRatio),
        ...(input.now < input.offTargetUntil ? [control("pinch.aim", 0.7)] : []),
        ...(input.elapsedMs >= TUTORIAL_DWELL_FALLBACK_MS ? [control("pinch.useDwell", 0.4)] : []),
      ];
    case "thumbsUp":
      return thumbsUpErrors(obs, input.wristSpeed);
    case "openPalm":
      return openPalmErrors(obs, input.wristSpeed);
  }
}
