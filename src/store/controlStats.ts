import type { ControlOutput } from "../recognition/control/controller";
import type { HandObservation } from "../recognition/observation";

// Latest control-layer output, kept outside React (debug panel, screens that react per frame).
let lastOutput: ControlOutput<HTMLElement> | null = null;

type ControlListener = (output: ControlOutput<HTMLElement>, observation: HandObservation | null) => void;
const listeners = new Set<ControlListener>();

/** Called by GestureLayer after each frame is processed. */
export function emitControl(output: ControlOutput<HTMLElement>, observation: HandObservation | null): void {
  lastOutput = output;
  for (const fn of listeners) fn(output, observation);
}

export function clearControlStats(): void {
  lastOutput = null;
}

export function getControlStats(): ControlOutput<HTMLElement> | null {
  return lastOutput;
}

/** Per-frame control data, in sync with the cursor and clicks. Returns an unsubscribe function. */
export function onControl(fn: ControlListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
