import { createOneEuroFilter } from "../smoothing";
import {
  CURSOR_BETA,
  CURSOR_D_CUTOFF,
  CURSOR_HIDE_MS,
  CURSOR_MIN_CUTOFF,
  CURSOR_ZONE,
} from "../thresholds";

export interface Viewport {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CursorState extends ScreenPoint {
  visible: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Image-normalized point (unmirrored camera frame) → screen fraction [0,1]².
 * Mirrors X (the user sees a mirror) and stretches the central `zone` of the frame to the whole screen.
 */
export function mapToScreen(imageX: number, imageY: number, zone = CURSOR_ZONE): ScreenPoint {
  const margin = (1 - zone) / 2;
  return {
    x: clamp01((1 - imageX - margin) / zone),
    y: clamp01((imageY - margin) / zone),
  };
}

export interface CursorOptions {
  zone?: number;
  minCutoff?: number;
  beta?: number;
  dCutoff?: number;
  hideMs?: number;
  historyMs?: number;
}

export interface Cursor {
  /** `tip` — index fingertip in image-normalized coords, or null without a hand. */
  update(tip: ScreenPoint | null, timestamp: number, viewport: Viewport): CursorState;
  /** Cursor position (px) at or just before `timestamp`; null if nothing recorded. */
  positionAt(timestamp: number): ScreenPoint | null;
  reset(): void;
}

export function createCursor({
  zone = CURSOR_ZONE,
  minCutoff = CURSOR_MIN_CUTOFF,
  beta = CURSOR_BETA,
  dCutoff = CURSOR_D_CUTOFF,
  hideMs = CURSOR_HIDE_MS,
  historyMs = 300,
}: CursorOptions = {}): Cursor {
  const fx = createOneEuroFilter({ minCutoff, beta, dCutoff });
  const fy = createOneEuroFilter({ minCutoff, beta, dCutoff });
  let history: Array<ScreenPoint & { t: number }> = [];
  let last: ScreenPoint | null = null;
  let lastSeen = -Infinity;

  const reset = () => {
    fx.reset();
    fy.reset();
    history = [];
    last = null;
    lastSeen = -Infinity;
  };

  return {
    update(tip, t, viewport) {
      if (!tip) {
        const visible = last !== null && t - lastSeen < hideMs;
        // Long gone: forget the old position so the cursor reappears where the hand is, without gliding.
        if (!visible) reset();
        return { x: last?.x ?? 0, y: last?.y ?? 0, visible };
      }

      const target = mapToScreen(tip.x, tip.y, zone);
      const point = { x: fx.filter(target.x, t) * viewport.width, y: fy.filter(target.y, t) * viewport.height };
      last = point;
      lastSeen = t;
      history.push({ ...point, t });
      while (history.length > 1 && (history[0]?.t ?? t) < t - historyMs) history.shift();
      return { ...point, visible: true };
    },

    positionAt(t) {
      if (history.length === 0) return null;
      let found = history[0] ?? null;
      for (const h of history) {
        if (h.t <= t) found = h;
        else break;
      }
      return found ? { x: found.x, y: found.y } : null;
    },

    reset,
  };
}
