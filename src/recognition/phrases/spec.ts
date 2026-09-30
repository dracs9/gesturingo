import type { EvalMode } from "../letters/build/evaluate";
import type { LetterStats } from "../letters/build/stats";
import type { Finger } from "../features";
import type { LetterSpec } from "../letters/spec";

/** Label prefix that tells a phrase from a letter in the shared kNN / rules ranking. */
export const PHRASE_PREFIX = "#";

/**
 * A sign-language phrase from the Slovo dataset (docs/TRANSLATOR_SPEC.md §4.2). Never invented:
 * shapes come from data and stay `verified: false` until the team checks them against an RSL dictionary.
 */
export interface PhraseSpec {
  /** Latin id, e.g. "horosho"; the recognition label is `#horosho`. */
  id: string;
  /** Text added to the message and spoken, e.g. «Хорошо». */
  text: string;
  kind: "static" | "dynamic";
  verified: boolean;
  source: { dataset: "slovo"; label: string; samples: number };
  /** Static phrases: finger rules like a letter, `letter` = `#<id>`. */
  handshape?: LetterSpec;
  confusedWith?: string[];
}

/** How a generated phrase was built — shown on the /letters «Фразы» tab. */
export interface PhraseBuildInfo {
  videos: number;
  signers: number;
  samples: number;
  /** Share of frames with a hand found. */
  visible: number;
  /** Median wrist spread (palm sizes) and shape spread (normalized distance) per video. */
  wristSpread: number;
  shapeSpread: number;
  accuracy: number;
  mode: EvalMode;
  freeFingers: Finger[];
  stats: LetterStats;
  /** Most typical normalized frame (63 numbers) for the skeleton preview. */
  reference: number[];
}
