import type { ControlOutput } from "../recognition/control/controller";

// Latest control-layer output, kept outside React for the debug panel.
let lastOutput: ControlOutput<HTMLElement> | null = null;

export function setControlStats(output: ControlOutput<HTMLElement> | null): void {
  lastOutput = output;
}

export function getControlStats(): ControlOutput<HTMLElement> | null {
  return lastOutput;
}
