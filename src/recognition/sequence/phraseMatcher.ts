import {
  TALK_DTW_ALMOST,
  TALK_DTW_LENGTH,
  TALK_DTW_MARGIN,
  TALK_DTW_WINDOW,
  TALK_DYNAMIC_COOLDOWN_MS,
} from "../thresholds";
import { dtw, resample } from "./dtw";
import { mirrorSequence, toSequence, travelPath } from "./frameFeatures";
import type { MotionSegment } from "./sequenceBuffer";

/** Templates of one dynamic phrase (built from Slovo by scripts/build-phrases.ts). */
export interface DynamicTemplates {
  /** Recognition label, `#<id>`. */
  label: string;
  /** DTW sequences (SEQ_DIM per frame), resampled to TALK_DTW_LENGTH. */
  templates: number[][][];
  /** Largest DTW distance still accepted (from the spread inside the class). */
  threshold: number;
  /** Usual duration of the sign, ms: outside it → «чуть медленнее / быстрее». */
  durationMin: number;
  durationMax: number;
}

export type DynamicMatch =
  | { kind: "accept"; label: string; score: number; margin: number }
  | {
      kind: "almost";
      label: string;
      score: number;
      reason: "slower" | "faster" | "direction";
      /** The template's wrist path (palm sizes from the start, image x right / y down) for the ghost. */
      ghost: { x: number; y: number }[];
    }
  | { kind: "none" };

export interface MatchReport {
  result: DynamicMatch;
  /** Best phrases by score (DTW distance / threshold), for the debug panel. */
  top: { label: string; score: number }[];
}

export interface PhraseMatcher {
  match(segment: MotionSegment): MatchReport;
  readonly size: number;
}

/** Angle between two travel vectors, degrees; null if either is too short to have a direction. */
function directionGap(a: { x: number; y: number }, b: { x: number; y: number }, minLength = 0.5): number | null {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la < minLength || lb < minLength) return null;
  const cos = (a.x * b.x + a.y * b.y) / (la * lb);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

const DIRECTION_GAP_DEG = 60;

/**
 * Compares a finished motion with every phrase's templates (both hands / mirror orientations) by DTW
 * with a Sakoe–Chiba band (docs/TRANSLATOR_SPEC.md §4.2). Accepts the best phrase only if it is within
 * its threshold, clearly better than the next one and at a usual speed; then ignores motions for a
 * cooldown so one sign is not added twice.
 */
export function createPhraseMatcher(
  sets: readonly DynamicTemplates[],
  { cooldownMs = TALK_DYNAMIC_COOLDOWN_MS, length = TALK_DTW_LENGTH } = {},
): PhraseMatcher {
  const window = Math.max(1, Math.round(length * TALK_DTW_WINDOW));
  const variants = sets.map((set) => ({
    set,
    sequences: set.templates.flatMap((tpl) => [tpl, mirrorSequence(tpl)]),
  }));
  let lastAccept = -Infinity;

  return {
    size: sets.length,
    match(segment) {
      const seq = resample(toSequence(segment.frames), length);
      const scored = variants
        .map(({ set, sequences }) => {
          let best = Infinity;
          let bestSeq = sequences[0] ?? [];
          for (const s of sequences) {
            const d = dtw(seq, s, window);
            if (d < best) {
              best = d;
              bestSeq = s;
            }
          }
          return { set, score: best / (set.threshold || 1), bestSeq };
        })
        .sort((a, b) => a.score - b.score);
      const top = scored.slice(0, 3).map((s) => ({ label: s.set.label, score: s.score }));
      const first = scored[0];
      if (!first || segment.startT < lastAccept + cooldownMs) return { result: { kind: "none" }, top };

      const margin = scored[1] ? scored[1].score / Math.max(first.score, 1e-6) : Infinity;
      const ghost = travelPath(first.bestSeq);
      if (first.score <= 1 && margin >= TALK_DTW_MARGIN) {
        const { durationMin, durationMax } = first.set;
        if (segment.durationMs < durationMin) {
          return { result: { kind: "almost", label: first.set.label, score: first.score, reason: "slower", ghost }, top };
        }
        if (segment.durationMs > durationMax) {
          return { result: { kind: "almost", label: first.set.label, score: first.score, reason: "faster", ghost }, top };
        }
        lastAccept = segment.endT;
        return { result: { kind: "accept", label: first.set.label, score: first.score, margin }, top };
      }
      if (first.score <= TALK_DTW_ALMOST) {
        // Close, but not it: say so only when the hand clearly went the wrong way.
        const mine = travelPath(seq).at(-1) ?? { x: 0, y: 0 };
        const theirs = ghost.at(-1) ?? { x: 0, y: 0 };
        const gap = directionGap(mine, theirs);
        if (gap !== null && gap > DIRECTION_GAP_DEG) {
          return { result: { kind: "almost", label: first.set.label, score: first.score, reason: "direction", ghost }, top };
        }
      }
      return { result: { kind: "none" }, top };
    },
  };
}
