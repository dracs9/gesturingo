import type { Finger } from "../../features";
import type { EvalMode } from "./evaluate";
import type { LetterStats } from "./stats";

/** How a generated letter was built — shown on /letters so the team can judge each draft. */
export interface LetterBuildInfo {
  /** Samples after capping per signer (these are the kNN samples). */
  samples: number;
  /** Samples per dataset, e.g. { kaggle: 48, rsl: 20 }. */
  sources: Record<string, number>;
  signers: number;
  /** Samples whose MediaPipe Left/Right label was overruled by `resolveOrientation`. */
  flipped: number;
  /** kNN (k = 3) cross-validation accuracy; see `mode`. */
  accuracy: number;
  mode: EvalMode;
  freeFingers: Finger[];
  impliedTouches: string[];
  stats: LetterStats;
}
