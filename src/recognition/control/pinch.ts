import { LM, type Point3 } from "../landmarks";
import { PINCH_CLOSE_BELOW, PINCH_MIN_INTERVAL_MS, PINCH_OPEN_ABOVE } from "../thresholds";

export type PinchState = "unknown" | "open" | "closed";

/** |thumb tip − index tip| in palm units, from normalized points (palm = 1). */
export function pinchRatio(normalizedPoints: readonly Point3[]): number {
  const a = normalizedPoints[LM.THUMB_TIP];
  const b = normalizedPoints[LM.INDEX_TIP];
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export interface PinchOptions {
  closeBelow?: number;
  openAbove?: number;
  minIntervalMs?: number;
}

export interface PinchUpdate {
  state: PinchState;
  /** True exactly on the frame an open pinch closes (and the interval allows a click). */
  clicked: boolean;
  /** Timestamp of the last open frame before closing — used to place the click. */
  closedFrom: number | null;
}

export interface Pinch {
  /** `ratio` — pinch distance in palm units, or null when there is no hand. */
  update(ratio: number | null, timestamp: number): PinchUpdate;
  readonly state: PinchState;
  reset(): void;
}

export function createPinch({
  closeBelow = PINCH_CLOSE_BELOW,
  openAbove = PINCH_OPEN_ABOVE,
  minIntervalMs = PINCH_MIN_INTERVAL_MS,
}: PinchOptions = {}): Pinch {
  // "unknown" until we see a clearly open hand: a hand entering the frame already pinched must not click.
  let state: PinchState = "unknown";
  let lastClick = -Infinity;
  let lastOpenAt: number | null = null;

  return {
    update(ratio, t) {
      if (ratio === null) {
        state = "unknown";
        lastOpenAt = null;
        return { state, clicked: false, closedFrom: null };
      }

      let clicked = false;
      let closedFrom: number | null = null;
      if (ratio > openAbove) {
        state = "open";
        lastOpenAt = t;
      } else if (ratio < closeBelow) {
        if (state === "open" && t - lastClick >= minIntervalMs) {
          clicked = true;
          closedFrom = lastOpenAt;
          lastClick = t;
        }
        state = "closed";
      }
      // Inside the hysteresis band the state is kept as is.
      return { state, clicked, closedFrom };
    },
    get state() {
      return state;
    },
    reset() {
      state = "unknown";
      lastOpenAt = null;
    },
  };
}
