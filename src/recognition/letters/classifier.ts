import type { HintError } from "../errors/hintEngine";
import { flattenPoints } from "../normalize";
import type { HandObservation } from "../observation";
import { KNN_CONFUSION_VOTES, KNN_MAX_DISTANCE, KNN_MIN_VOTES } from "../thresholds";
import type { Knn, KnnPrediction } from "./knn";
import { checkLetter, typicalDeviation, type LetterError } from "./rules";
import type { LetterSpec } from "./spec";

export interface LetterDecision {
  /** Violated rules + a confusion error when kNN sees a similar letter. */
  errors: HintError[];
  rulesOk: boolean;
  /** null when kNN has no samples of this letter or the hand is unlike any sample (it abstains). */
  knn: { prediction: KnnPrediction; agrees: boolean } | null;
  /** Rules pass AND (if kNN has a say) kNN agrees (CLAUDE.md §8.2). */
  correct: boolean;
}

const bySeverity = (a: LetterError, b: LetterError) => b.severity - a.severity;

/**
 * Checks the EXPECTED letter only (lesson and Bridge always know it): rules first, then kNN over
 * all letters must give it ≥ KNN_MIN_VOTES of k votes. kNN on the 63 normalized coordinates catches
 * shapes the rules allow but that look like another letter.
 */
export function classifyLetter(spec: LetterSpec, obs: HandObservation, knn: Knn | null): LetterDecision {
  const shape = checkLetter(spec, obs.features).sort(bySeverity);
  const rulesOk = shape.length === 0;

  let knnInfo: LetterDecision["knn"] = null;
  if (knn?.labels.has(spec.letter)) {
    const prediction = knn.predict(flattenPoints(obs.normalized.points));
    const nearest = prediction?.neighbors[0]?.distance ?? Infinity;
    if (prediction && nearest <= KNN_MAX_DISTANCE) {
      knnInfo = { prediction, agrees: (prediction.votes[spec.letter] ?? 0) >= KNN_MIN_VOTES };
    }
  }

  const errors: HintError[] = [...shape];
  if (knnInfo && !knnInfo.agrees) {
    const other = knnInfo.prediction.label;
    const otherVotes = knnInfo.prediction.votes[other] ?? 0;
    // What to fix: the worst broken rule, else the finger furthest from the letter's typical shape.
    const worst = shape[0];
    const advice = worst
      ? { hintCode: worst.hintCode, finger: worst.finger, landmarkIds: worst.landmarkIds }
      : typicalDeviation(spec, obs.features);
    if (spec.confusedWith?.includes(other) && otherVotes >= KNN_CONFUSION_VOTES) {
      // «Похоже на О — согни безымянный палец».
      errors.push({
        level: "confusion",
        hintCode: "confusion.looksLike",
        severity: 0.9,
        params: { letter: other, advice: advice?.hintCode ?? "ghost.match" },
        finger: advice?.finger,
        landmarkIds: advice?.landmarkIds,
      });
    } else if (rulesOk) {
      // Rules pass, but the shape is off from the samples in a way the rules don't name.
      errors.push({
        level: "shape",
        hintCode: advice?.hintCode ?? "ghost.match",
        severity: 0.3,
        finger: advice?.finger,
        landmarkIds: advice?.landmarkIds,
      });
    }
  }

  return { errors, rulesOk, knn: knnInfo, correct: rulesOk && (knnInfo === null || knnInfo.agrees) };
}
