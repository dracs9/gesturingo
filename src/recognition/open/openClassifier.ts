import type { Knn, KnnPrediction } from "../letters/knn";
import { checkLetter } from "../letters/rules";
import type { LetterSpec } from "../letters/spec";
import { flattenPoints } from "../normalize";
import type { HandObservation } from "../observation";

export interface RankedClass {
  label: string;
  /**
   * kNN: distance to the closest sample of this letter (63-dim, palm units).
   * Rules fallback: number of broken rules.
   */
  distance: number;
}

export interface OpenRanking {
  /** Every known letter, closest first. */
  ranking: RankedClass[];
  prediction: KnnPrediction | null;
  source: "knn" | "rules";
}

/**
 * Classification without an expected letter (talk mode): ranks ALL static letters.
 * With samples — by the closest kNN sample per letter; while they load (or for letters without
 * samples) — by the number of broken rules, a coarse but safe fallback.
 */
export function rankLetters(obs: HandObservation, knn: Knn | null, specs: readonly LetterSpec[]): OpenRanking {
  const prediction = knn ? knn.predict(flattenPoints(obs.normalized.points)) : null;
  if (prediction) {
    const known = new Set(specs.map((s) => s.letter));
    const ranking = prediction.nearestByLabel.filter((c) => known.has(c.label));
    if (ranking.length > 0) return { ranking, prediction, source: "knn" };
  }
  const ranking = specs
    .map((spec) => ({ label: spec.letter, distance: checkLetter(spec, obs.features).length }))
    .sort((a, b) => a.distance - b.distance);
  return { ranking, prediction: null, source: "rules" };
}
