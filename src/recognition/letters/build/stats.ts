import {
  computeFeatures,
  FINGERS,
  type Finger,
  type FingerState,
  type PalmFacing,
  type ThumbPosition,
} from "../../features";
import { unflattenPoints } from "../../normalize";
import { TIPS_TOUCH_MAX } from "../../thresholds";

export type Shares<K extends string> = Record<K, number>;

export interface FingerStats {
  /** Share of samples per state (sums to 1). */
  states: Shares<FingerState>;
  /** Representative angle (the one `fingerState` uses), degrees. */
  medianAngle: number;
  /** 25th and 75th percentile of that angle. */
  quartiles: [number, number];
}

/** What the samples of one letter have in common — the base for the rule draft. */
export interface LetterStats {
  samples: number;
  fingers: Record<Finger, FingerStats>;
  /** Share of samples where the two fingertips touch (< TIPS_TOUCH_MAX), per pair of FINGER_PAIRS ("thumb-index"). */
  tipsTouch: Record<string, number>;
  palmFacing: Shares<PalmFacing>;
  thumbPosition: Shares<ThumbPosition>;
}

export const FINGER_PAIRS: readonly [Finger, Finger][] = FINGERS.flatMap((a, i) =>
  FINGERS.slice(i + 1).map((b): [Finger, Finger] => [a, b]),
);

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (pos - lo);
}

function shares<K extends string>(keys: readonly K[], values: readonly K[]): Shares<K> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Shares<K>;
  for (const v of values) out[v] += 1;
  if (values.length > 0) for (const k of keys) out[k] /= values.length;
  return out;
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Feature statistics over normalized 63-number vectors of one letter, via the app's `computeFeatures`. */
export function letterStats(vectors: readonly (readonly number[])[]): LetterStats {
  const features = vectors.map((v) => computeFeatures({ points: unflattenPoints(v), handedness: "Right" }));

  const fingers = Object.fromEntries(
    FINGERS.map((f) => {
      const angles = features.map((x) => x.fingers[f].angle).sort((a, b) => a - b);
      const st = shares<FingerState>(["straight", "half", "bent"], features.map((x) => x.fingers[f].state));
      const stats: FingerStats = {
        states: { straight: round(st.straight, 3), half: round(st.half, 3), bent: round(st.bent, 3) },
        medianAngle: round(quantile(angles, 0.5), 1),
        quartiles: [round(quantile(angles, 0.25), 1), round(quantile(angles, 0.75), 1)],
      };
      return [f, stats];
    }),
  ) as Record<Finger, FingerStats>;

  const tipsTouch: Record<string, number> = {};
  for (const [a, b] of FINGER_PAIRS) {
    const touching = features.filter((x) => (x.tipDistances[`${a}-${b}`] ?? Infinity) < TIPS_TOUCH_MAX).length;
    tipsTouch[`${a}-${b}`] = round(features.length ? touching / features.length : 0, 3);
  }

  const roundShares = <K extends string>(s: Shares<K>) =>
    Object.fromEntries(Object.entries(s).map(([k, v]) => [k, round(v as number, 3)])) as Shares<K>;

  return {
    samples: vectors.length,
    fingers,
    tipsTouch,
    palmFacing: roundShares(shares<PalmFacing>(["camera", "side", "away"], features.map((x) => x.palmFacing))),
    thumbPosition: roundShares(
      shares<ThumbPosition>(["acrossPalm", "side", "up"], features.map((x) => x.thumbPosition)),
    ),
  };
}
