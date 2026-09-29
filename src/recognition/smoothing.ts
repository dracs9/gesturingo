import type { Point3 } from "./landmarks";

/**
 * Holds a value until a new candidate has persisted for `holdMs`.
 * `update` returns the current stable value.
 */
export interface StableValue<T> {
  update(candidate: T, now: number): T;
  readonly value: T;
}

export function createStableValue<T>(initial: T, holdMs: number): StableValue<T> {
  let value = initial;
  let candidate = initial;
  let candidateSince = 0;

  return {
    update(next, now) {
      if (next === value) {
        candidate = value;
        return value;
      }
      if (next !== candidate) {
        candidate = next;
        candidateSince = now;
      }
      if (now - candidateSince >= holdMs) value = candidate;
      return value;
    },
    get value() {
      return value;
    },
  };
}

/** Exponential moving average over a list of points (e.g. 21 landmarks). */
export interface PointsEma {
  update(points: readonly Point3[]): Point3[];
  reset(): void;
}

export function createPointsEma(alpha: number): PointsEma {
  let prev: Point3[] | null = null;
  return {
    update(points) {
      const next =
        prev && prev.length === points.length
          ? points.map((p, i) => {
              const q = prev?.[i] ?? p;
              return {
                x: alpha * p.x + (1 - alpha) * q.x,
                y: alpha * p.y + (1 - alpha) * q.y,
                z: alpha * p.z + (1 - alpha) * q.z,
              };
            })
          : points.map((p) => ({ ...p }));
      prev = next;
      return next;
    },
    reset() {
      prev = null;
    },
  };
}

/**
 * One Euro filter (Casiez et al. 2012): low jitter when still, low lag when moving fast.
 * `minCutoff` (Hz) — smoothing at rest; `beta` — speed coefficient; `dCutoff` (Hz) — derivative smoothing.
 */
export interface OneEuroOptions {
  minCutoff: number;
  beta: number;
  dCutoff?: number;
}

export interface OneEuroFilter {
  /** `timestampMs` must increase; returns the filtered value. */
  filter(value: number, timestampMs: number): number;
  reset(): void;
}

function smoothingFactor(dtSeconds: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dtSeconds;
  return r / (r + 1);
}

export function createOneEuroFilter({ minCutoff, beta, dCutoff = 1 }: OneEuroOptions): OneEuroFilter {
  let prevValue: number | null = null;
  let prevDerivative = 0;
  let prevTime = 0;

  return {
    filter(value, timestampMs) {
      if (prevValue === null) {
        prevValue = value;
        prevTime = timestampMs;
        return value;
      }
      const dt = (timestampMs - prevTime) / 1000;
      if (dt <= 0) return prevValue;

      const aD = smoothingFactor(dt, dCutoff);
      const derivative = aD * ((value - prevValue) / dt) + (1 - aD) * prevDerivative;
      const a = smoothingFactor(dt, minCutoff + beta * Math.abs(derivative));
      const filtered = a * value + (1 - a) * prevValue;

      prevValue = filtered;
      prevDerivative = derivative;
      prevTime = timestampMs;
      return filtered;
    },
    reset() {
      prevValue = null;
      prevDerivative = 0;
    },
  };
}

/** Majority vote over the last `size` values; returns the winner only if it holds ≥ `minShare` of the window. */
export interface MajorityVote<T> {
  push(value: T): T | null;
  reset(): void;
}

export function createMajorityVote<T>(size: number, minShare = 0.5): MajorityVote<T> {
  const window: T[] = [];
  const quorum = Math.ceil(size * minShare);
  return {
    push(value) {
      window.push(value);
      if (window.length > size) window.shift();

      const counts = new Map<T, number>();
      let best: T | null = null;
      let bestCount = 0;
      for (const v of window) {
        const c = (counts.get(v) ?? 0) + 1;
        counts.set(v, c);
        if (c > bestCount) {
          best = v;
          bestCount = c;
        }
      }
      return bestCount >= quorum ? best : null;
    },
    reset() {
      window.length = 0;
    },
  };
}
