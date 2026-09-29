import type { HintError } from "../errors/hintEngine";
import { flattenPoints } from "../normalize";
import type { HandObservation } from "../observation";
import { KNN_CONFUSION_VOTES, KNN_MAX_DISTANCE, KNN_MIN_VOTES } from "../thresholds";
import type { Knn, KnnPrediction } from "./knn";
import { checkLetter, type LetterError } from "./rules";
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

/** Rules first; kNN on the 63 normalized coordinates tells similar letters apart and confirms the rules. */
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
    const worst = shape[0];
    if (spec.confusedWith?.includes(other) && otherVotes >= KNN_CONFUSION_VOTES) {
      // «Похоже на О — …» + the most important thing to fix (from the rules, or the ghost hand).
      errors.push({
        level: "confusion",
        hintCode: "confusion.looksLike",
        severity: 0.9,
        params: { letter: other, advice: worst?.hintCode ?? "ghost.match" },
        finger: worst?.finger,
        landmarkIds: worst?.landmarkIds,
      });
    } else if (rulesOk) {
      // Rules pass, but the shape is off from the recorded samples in a way the rules don't name.
      errors.push({ level: "shape", hintCode: "ghost.match", severity: 0.3 });
    }
  }

  return { errors, rulesOk, knn: knnInfo, correct: rulesOk && (knnInfo === null || knnInfo.agrees) };
}
