import {
  KNN_AUG_MIRROR,
  KNN_AUG_NOISE_COPIES,
  KNN_AUG_NOISE_SIGMA,
  KNN_AUG_ROTATIONS_DEG,
} from "../thresholds";

export interface AugmentOptions {
  mirror: boolean;
  rotationsDeg: readonly number[];
  noiseSigma: number;
  noiseCopies: number;
}

export const DEFAULT_AUGMENT: AugmentOptions = {
  mirror: KNN_AUG_MIRROR,
  rotationsDeg: KNN_AUG_ROTATIONS_DEG,
  noiseSigma: KNN_AUG_NOISE_SIGMA,
  noiseCopies: KNN_AUG_NOISE_COPIES,
};

/** The same hand with the other Left/Right label: in the canonical frame that is x → −x. */
export function mirrorFrame(v: readonly number[]): number[] {
  return v.map((x, i) => (i % 3 === 0 ? -x : x));
}

/** In-plane rotation around the wrist (the origin of the normalized frame), degrees. */
export function rotateFrame(v: readonly number[], deg: number): number[] {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const out = [...v];
  for (let i = 0; i + 1 < v.length; i += 3) {
    const x = v[i] ?? 0;
    const y = v[i + 1] ?? 0;
    out[i] = x * cos - y * sin;
    out[i + 1] = x * sin + y * cos;
  }
  return out;
}

/** Small deterministic PRNG (mulberry32): the same samples always give the same kNN. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** Gaussian noise on every coordinate except the wrist, which stays at the origin. */
export function noisyFrame(v: readonly number[], sigma: number, random: () => number): number[] {
  return v.map((x, i) => (i < 3 ? x : x + sigma * gaussian(random)));
}

/**
 * The sample itself + its variants: mirrored, rotated around the wrist, with noise. Rotation and
 * noise are applied to both orientations, so a mirrored hand is as well covered as the original.
 */
export function augmentFrame(
  v: readonly number[],
  random: () => number,
  opts: AugmentOptions = DEFAULT_AUGMENT,
): number[][] {
  const bases = opts.mirror ? [[...v], mirrorFrame(v)] : [[...v]];
  const out: number[][] = [];
  for (const base of bases) {
    out.push(base);
    for (const deg of opts.rotationsDeg) out.push(rotateFrame(base, deg));
    for (let n = 0; n < opts.noiseCopies; n++) out.push(noisyFrame(base, opts.noiseSigma, random));
  }
  return out;
}
