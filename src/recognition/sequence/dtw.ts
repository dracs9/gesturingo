/**
 * Dynamic time warping with a Sakoe–Chiba band (docs/TRANSLATOR_SPEC.md §4.2). Own implementation,
 * no libraries. Sequences are resampled to the same length first, so the band is a simple |i − j| ≤ w.
 */

function frameDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let k = 0; k < a.length; k++) {
    const d = (a[k] ?? 0) - (b[k] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Linear resampling of a sequence to `length` frames (keeps the first and the last frame). */
export function resample(seq: readonly (readonly number[])[], length: number): number[][] {
  if (seq.length === 0 || length <= 0) return [];
  if (seq.length === 1) return Array.from({ length }, () => [...(seq[0] ?? [])]);
  return Array.from({ length }, (_, i) => {
    const pos = (i * (seq.length - 1)) / Math.max(1, length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(seq.length - 1, lo + 1);
    const t = pos - lo;
    const a = seq[lo] ?? [];
    const b = seq[hi] ?? a;
    return a.map((x, k) => x + ((b[k] ?? x) - x) * t);
  });
}

/**
 * DTW distance, averaged per aligned step (so it does not grow with the length). `window` is the
 * Sakoe–Chiba radius in frames; Infinity if the band leaves no path (very different lengths).
 */
export function dtw(a: readonly (readonly number[])[], b: readonly (readonly number[])[], window: number): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  const w = Math.max(window, Math.abs(n - m));
  // Two rows of cost and of path length: O(m) memory.
  let prev = new Float64Array(m + 1).fill(Infinity);
  let prevLen = new Float64Array(m + 1);
  let cur = new Float64Array(m + 1);
  let curLen = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const from = Math.max(1, i - w);
    const to = Math.min(m, i + w);
    for (let j = from; j <= to; j++) {
      const cost = frameDistance(a[i - 1] ?? [], b[j - 1] ?? []);
      let best = prev[j - 1] ?? Infinity;
      let len = prevLen[j - 1] ?? 0;
      if ((prev[j] ?? Infinity) < best) {
        best = prev[j] ?? Infinity;
        len = prevLen[j] ?? 0;
      }
      if ((cur[j - 1] ?? Infinity) < best) {
        best = cur[j - 1] ?? Infinity;
        len = curLen[j - 1] ?? 0;
      }
      cur[j] = best + cost;
      curLen[j] = len + 1;
    }
    [prev, cur] = [cur, prev];
    [prevLen, curLen] = [curLen, prevLen];
    prev[0] = Infinity;
  }
  const total = prev[m] ?? Infinity;
  const steps = prevLen[m] ?? 0;
  return steps > 0 ? total / steps : Infinity;
}
