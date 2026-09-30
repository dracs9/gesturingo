import { KNN_K } from "../thresholds";

/** One training vector: 63 normalized coordinates of one frame, labelled with its letter. */
export interface LabeledVector {
  label: string;
  vector: readonly number[];
}

export interface KnnNeighbor {
  label: string;
  distance: number;
}

export interface KnnPrediction {
  /** Most voted label among the k nearest (ties → the closer one). */
  label: string;
  /** Votes per label among the k nearest. */
  votes: Readonly<Record<string, number>>;
  /** k nearest samples, closest first. */
  neighbors: readonly KnnNeighbor[];
  /** Labels by votes, for the debug panel (top-3). */
  ranking: ReadonlyArray<{ label: string; votes: number }>;
  /** Every label with the distance to its closest sample, closest first (open-set ranking of all classes). */
  nearestByLabel: readonly KnnNeighbor[];
}

export interface Knn {
  readonly size: number;
  readonly labels: ReadonlySet<string>;
  predict(vector: readonly number[]): KnnPrediction | null;
}

function squaredDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return sum;
}

/** Own k-nearest-neighbours classifier (no libraries): Euclidean distance, majority vote of k. */
export function createKnn(samples: readonly LabeledVector[], k = KNN_K): Knn {
  const labels = new Set(samples.map((s) => s.label));

  return {
    size: samples.length,
    labels,
    predict(vector) {
      if (samples.length === 0) return null;

      // Keep the k best in a small sorted array: O(n·k) with tiny k, no full sort per frame.
      const best: Array<{ label: string; d2: number }> = [];
      const perLabel = new Map<string, number>();
      for (const s of samples) {
        const d2 = squaredDistance(vector, s.vector);
        if (d2 < (perLabel.get(s.label) ?? Infinity)) perLabel.set(s.label, d2);
        if (best.length === k && d2 >= (best[k - 1]?.d2 ?? Infinity)) continue;
        let i = best.length;
        while (i > 0 && (best[i - 1]?.d2 ?? 0) > d2) i--;
        best.splice(i, 0, { label: s.label, d2 });
        if (best.length > k) best.pop();
      }

      const votes: Record<string, number> = {};
      for (const n of best) votes[n.label] = (votes[n.label] ?? 0) + 1;
      // Ranking by votes; ties keep the order of the closest neighbour (`best` is sorted by distance).
      const order = [...new Set(best.map((n) => n.label))];
      const ranking = order
        .map((label) => ({ label, votes: votes[label] ?? 0 }))
        .sort((a, b) => b.votes - a.votes || order.indexOf(a.label) - order.indexOf(b.label));

      return {
        label: ranking[0]?.label ?? "",
        votes,
        neighbors: best.map((n) => ({ label: n.label, distance: Math.sqrt(n.d2) })),
        ranking,
        nearestByLabel: [...perLabel]
          .map(([label, d2]) => ({ label, distance: Math.sqrt(d2) }))
          .sort((a, b) => a.distance - b.distance),
      };
    },
  };
}
