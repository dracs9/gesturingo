import { frameErrors } from "../errors/frameChecks";
import type { HintError } from "../errors/hintEngine";
import type { HandFeatures } from "../features";
import { checkLetter, typicalDeviation, type LetterError } from "../letters/rules";
import type { LetterSpec } from "../letters/spec";
import type { HandObservation } from "../observation";
import {
  KNN_MAX_DISTANCE,
  KNN_MIN_VOTES,
  TALK_ALMOST_MAX_DISTANCE,
  TALK_ALMOST_MAX_ERRORS,
  TALK_MARGIN_RATIO,
} from "../thresholds";
import type { OpenRanking } from "./openClassifier";

/**
 * One frame of talk mode (docs/TRANSLATOR_SPEC.md §7.1):
 * - accept — the closest letter passes its rules and is clearly closer than the next one;
 * - almost — the closest letter is near but breaks 1–2 rules: say what to fix, type nothing;
 * - ambiguous — two letters are about as close: «А или Б?» with the key difference;
 * - neutral — no hand, a bad frame or a shape unlike any letter.
 */
export type OpenDecision =
  | { kind: "neutral"; errors: HintError[] }
  | { kind: "accept"; label: string; margin: number }
  | { kind: "almost"; label: string; errors: LetterError[]; margin: number }
  | { kind: "ambiguous"; labels: [string, string]; hint: HintError; margin: number };

export const AMBIGUOUS_HINT_CODE = "talk.ambiguous";

const NEUTRAL: OpenDecision = { kind: "neutral", errors: [] };
const bySeverity = (a: LetterError, b: LetterError) => b.severity - a.severity;

/** «А или Б?» + what to do to make it `b` (its worst broken rule, else its most different finger). */
function ambiguity(a: string, b: string, specB: LetterSpec, features: HandFeatures, margin: number): OpenDecision {
  const worst = checkLetter(specB, features).sort(bySeverity)[0];
  const advice = worst
    ? { hintCode: worst.hintCode, finger: worst.finger, landmarkIds: worst.landmarkIds }
    : typicalDeviation(specB, features);
  return {
    kind: "ambiguous",
    labels: [a, b],
    margin,
    hint: {
      level: "confusion",
      hintCode: AMBIGUOUS_HINT_CODE,
      severity: 0.9,
      params: advice ? { a, b, advice: advice.hintCode } : { a, b },
      finger: advice?.finger,
      landmarkIds: advice?.landmarkIds,
    },
  };
}

export function decideFrame(
  obs: HandObservation | null,
  ranked: OpenRanking | null,
  getSpec: (letter: string) => LetterSpec | undefined,
): OpenDecision {
  // Top-down (CLAUDE.md §9.1): a frame problem hides letter problems.
  const frame = frameErrors(obs?.frame ?? null);
  if (!obs || frame.length > 0) return { kind: "neutral", errors: frame };
  if (!ranked) return NEUTRAL;

  const [first, second] = ranked.ranking;
  const spec1 = first ? getSpec(first.label) : undefined;
  if (!first || !spec1) return NEUTRAL;
  const spec2 = second ? getSpec(second.label) : undefined;
  const errors1 = checkLetter(spec1, obs.features).sort(bySeverity);

  // Without samples the "distance" is the number of broken rules.
  if (ranked.source === "rules") {
    const margin = second ? second.distance - first.distance : Infinity;
    if (first.distance === 0 && margin > 0) return { kind: "accept", label: first.label, margin };
    if (first.distance === 0 && second && spec2) return ambiguity(first.label, second.label, spec2, obs.features, margin);
    if (errors1.length <= TALK_ALMOST_MAX_ERRORS) return { kind: "almost", label: first.label, errors: errors1, margin };
    return NEUTRAL;
  }

  // The hand is unlike any sample: no guess at all.
  if (first.distance > KNN_MAX_DISTANCE) return NEUTRAL;
  const margin = second ? second.distance / Math.max(first.distance, 1e-6) : Infinity;
  const votes = ranked.prediction?.votes[first.label] ?? 0;
  const clear = margin >= TALK_MARGIN_RATIO && votes >= KNN_MIN_VOTES;

  if (errors1.length === 0) {
    if (clear) return { kind: "accept", label: first.label, margin };
    // Rules pass, but another letter is about as close (or holds the kNN vote).
    const voted = ranked.prediction?.label;
    const rival = voted && voted !== first.label ? voted : second?.label;
    const rivalSpec = rival ? getSpec(rival) : undefined;
    if (rival && rivalSpec) return ambiguity(first.label, rival, rivalSpec, obs.features, margin);
    return NEUTRAL;
  }

  // The closest letter breaks its rules while an equally close one fits: ask which one is meant.
  if (second && spec2 && margin < TALK_MARGIN_RATIO && checkLetter(spec2, obs.features).length === 0) {
    return ambiguity(second.label, first.label, spec1, obs.features, margin);
  }
  if (errors1.length <= TALK_ALMOST_MAX_ERRORS && first.distance <= TALK_ALMOST_MAX_DISTANCE) {
    return { kind: "almost", label: first.label, errors: errors1, margin };
  }
  return NEUTRAL;
}
