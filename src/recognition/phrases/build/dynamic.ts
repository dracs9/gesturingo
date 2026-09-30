import { dtw } from "../../sequence/dtw";
import { mirrorSequence } from "../../sequence/frameFeatures";
import { TALK_DTW_MARGIN } from "../../thresholds";

/**
 * Offline build of dynamic phrases (docs/TRANSLATOR_SPEC.md §9): templates = the most typical clip of
 * the most typical signers (DTW medoids), a threshold from the spread inside the class, and an honest
 * check — the matcher is simulated leave-one-signer-out with templates that never saw the tested person.
 * Everything works on one precomputed distance matrix.
 */

/** Share of other signs' clips allowed under a phrase's threshold (before the margin check). */
export const FOREIGN_QUANTILE = 0.02;

export interface DynSample {
  label: string;
  signer: string;
  /** DTW sequence (resampled). */
  seq: number[][];
  durationMs: number;
}

/** Distance of two clips: the better of the two orientations (other hand / mirrored recording). */
export function clipDistance(a: readonly (readonly number[])[], b: readonly (readonly number[])[], window: number): number {
  return Math.min(dtw(a, b, window), dtw(a, mirrorSequence(b), window));
}

export function distanceMatrix(samples: readonly DynSample[], window: number): Float64Array[] {
  const n = samples.length;
  const m = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = clipDistance(samples[i]?.seq ?? [], samples[j]?.seq ?? [], window);
      (m[i] as Float64Array)[j] = d;
      (m[j] as Float64Array)[i] = d;
    }
  }
  return m;
}

const quantile = (xs: readonly number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))] ?? 0;
};

/**
 * Up to `max` templates of one class: each signer's most typical clip (smallest total distance to the
 * class), the most typical signers first. `members` are sample indices of the class.
 */
export function pickTemplates(members: readonly number[], samples: readonly DynSample[], d: Float64Array[], max = 5): number[] {
  const total = (i: number) => members.reduce((s, k) => s + (d[i]?.[k] ?? 0), 0);
  const bySigner = new Map<string, number>();
  for (const i of members) {
    const signer = samples[i]?.signer ?? "";
    const cur = bySigner.get(signer);
    if (cur === undefined || total(i) < total(cur)) bySigner.set(signer, i);
  }
  return [...bySigner.values()].sort((a, b) => total(a) - total(b)).slice(0, max);
}

/**
 * Largest accepted distance. From the class: the 90th percentile of each clip's distance to the nearest
 * template of ANOTHER signer (how far a new person usually is), with 10% slack. From everything else
 * (other signs, static or not): at most their `foreignQuantile` — so other gestures are rarely taken for it.
 */
export function classThreshold(
  members: readonly number[],
  templates: readonly number[],
  samples: readonly DynSample[],
  d: Float64Array[],
  others: readonly number[] = [],
  foreignQuantile = FOREIGN_QUANTILE,
): number {
  const nearest = (i: number, sameSignerToo: boolean) => {
    let best = Infinity;
    for (const t of templates) {
      if (!sameSignerToo && samples[t]?.signer === samples[i]?.signer) continue;
      best = Math.min(best, d[i]?.[t] ?? Infinity);
    }
    return best;
  };
  const own = members.map((i) => nearest(i, false)).filter(Number.isFinite);
  const fromClass = own.length ? quantile(own, 0.9) * 1.1 : Infinity;
  const foreign = others.map((i) => nearest(i, true)).filter(Number.isFinite);
  return foreign.length ? Math.min(fromClass, quantile(foreign, foreignQuantile)) : fromClass;
}

/** Usual duration with slack: app motions are cut by speed, Slovo clips by annotation. */
export function durationRange(durations: readonly number[]): { min: number; max: number } {
  return { min: Math.round(quantile(durations, 0.1) * 0.6), max: Math.round(quantile(durations, 0.9) * 1.6) };
}

export interface ClassModel {
  label: string;
  templates: number[];
  threshold: number;
  durationMin: number;
  durationMax: number;
}

export function buildModel(
  label: string,
  members: readonly number[],
  samples: readonly DynSample[],
  d: Float64Array[],
  others: readonly number[] = [],
): ClassModel {
  const templates = pickTemplates(members, samples, d);
  const { min, max } = durationRange(members.map((i) => samples[i]?.durationMs ?? 0));
  return {
    label,
    templates,
    threshold: classThreshold(members, templates, samples, d, others),
    durationMin: min,
    durationMax: max,
  };
}

/** What the app's matcher would say about a clip with distances `dist(templateIndex)`. */
export function decide(
  models: readonly ClassModel[],
  dist: (templateIndex: number) => number,
  durationMs: number,
  margin = TALK_DTW_MARGIN,
): string | null {
  const scored = models
    .map((m) => ({ m, score: Math.min(...m.templates.map(dist)) / (m.threshold || 1) }))
    .sort((a, b) => a.score - b.score);
  const [first, second] = scored;
  if (!first || first.score > 1) return null;
  if (second && second.score / Math.max(first.score, 1e-6) < margin) return null;
  if (durationMs < first.m.durationMin || durationMs > first.m.durationMax) return null;
  return first.m.label;
}

export interface LabelEval {
  clips: number;
  /** Own clips recognized. */
  right: number;
  /** Clips of the OTHER selected phrases accepted as this one. */
  fromPhrases: number;
  /** Clips of signs outside the selection (static or not) accepted as this one. */
  fromNegatives: number;
}

export interface MatcherEval {
  perLabel: Map<string, LabelEval>;
  /** Clips outside the selection that were decided, and how many of them came out as some phrase. */
  negatives: number;
  falseFromNegatives: number;
}

/**
 * Leave-one-signer-out simulation of the app's matcher over `labels`: for every signer, the models
 * (templates AND thresholds) are rebuilt without them, then all their clips are decided — the phrases'
 * own clips and the `negatives` (static signs that must never match). A negative accepted as a phrase
 * counts against that phrase's precision.
 */
export function evaluateMatcher(
  labels: readonly string[],
  samples: readonly DynSample[],
  d: Float64Array[],
  negatives: readonly number[] = [],
): MatcherEval {
  const perLabel = new Map<string, LabelEval>(labels.map((l) => [l, { clips: 0, right: 0, fromPhrases: 0, fromNegatives: 0 }]));
  const negativeSet = new Set(negatives);
  const inScope = (i: number) => labels.includes(samples[i]?.label ?? "") || negativeSet.has(i);
  const indices = samples.map((_, i) => i).filter(inScope);
  const signers = [...new Set(indices.map((i) => samples[i]?.signer ?? ""))];
  let falseFromNegatives = 0;
  let negativeCount = 0;
  for (const signer of signers) {
    const models = labels.map((l) => {
      const members = indices.filter((i) => samples[i]?.label === l && samples[i]?.signer !== signer);
      const others = indices.filter((i) => samples[i]?.label !== l && samples[i]?.signer !== signer);
      return buildModel(l, members, samples, d, others);
    });
    for (const i of indices) {
      const s = samples[i];
      if (!s || s.signer !== signer) continue;
      const got = decide(models, (t) => d[i]?.[t] ?? Infinity, s.durationMs);
      const own = perLabel.get(s.label);
      if (own) {
        own.clips++;
        if (got === s.label) own.right++;
      }
      if (negativeSet.has(i)) negativeCount++;
      const as = got ? perLabel.get(got) : undefined;
      if (as && got !== s.label) {
        if (negativeSet.has(i)) {
          as.fromNegatives++;
          falseFromNegatives++;
        } else {
          as.fromPhrases++;
        }
      }
    }
  }
  return { perLabel, negatives: negativeCount, falseFromNegatives };
}
