import { DWELL_MS, DWELL_REARM_PX } from "../thresholds";
import type { ScreenPoint } from "./cursor";

export interface DwellOptions {
  dwellMs?: number;
  rearmPx?: number;
}

export interface DwellUpdate<T> {
  /** 0..1 fill of the dwell ring (0 while disarmed). */
  progress: number;
  /** Target to click on this frame, if the dwell completed. */
  fired: T | null;
}

export interface Dwell<T> {
  update(target: T | null, position: ScreenPoint, timestamp: number): DwellUpdate<T>;
  /**
   * Called after any click/command. Dwell stays off until the cursor moves `rearmPx` away or
   * rests on empty space — so a button that appears under a resting cursor on the next screen
   * is not pressed by itself.
   */
  disarm(position: ScreenPoint): void;
  reset(): void;
}

export function createDwell<T>({ dwellMs = DWELL_MS, rearmPx = DWELL_REARM_PX }: DwellOptions = {}): Dwell<T> {
  let current: T | null = null;
  let since = 0;
  let disarmedAt: ScreenPoint | null = null;

  const disarm = (position: ScreenPoint) => {
    disarmedAt = position;
  };

  return {
    update(target, position, t) {
      if (disarmedAt) {
        const moved = Math.hypot(position.x - disarmedAt.x, position.y - disarmedAt.y) > rearmPx;
        if (moved || target === null) {
          disarmedAt = null;
          current = null;
        }
      }

      if (target !== current) {
        current = target;
        since = t;
      }
      if (disarmedAt || current === null) return { progress: 0, fired: null };

      const progress = Math.min(1, (t - since) / dwellMs);
      if (progress < 1) return { progress, fired: null };

      const fired = current;
      disarm(position);
      return { progress: 1, fired };
    },
    disarm,
    reset() {
      current = null;
      disarmedAt = null;
    },
  };
}
