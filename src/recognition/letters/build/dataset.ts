import type { Handedness, HandFrame } from "../../landmarks";
import { flattenPoints, normalizeHand } from "../../normalize";
import { mirrorFrame } from "../augment";

/** One photo from scripts/landmarks/<source>.json (written by scripts/extract_landmarks.py). */
export interface RawSample {
  letter: string;
  source: string;
  /** Path of the photo relative to scripts/data/. */
  file: string;
  /** Who shows the letter: one id = one person (for leave-one-signer-out). */
  signer: string;
  /** Raw MediaPipe label — unreliable on photos, see `resolveOrientation`. */
  handedness: Handedness;
  score: number;
  width: number;
  height: number;
  variant?: string;
  /** 21 × [x, y, z], normalized to the original image like HandFrame.landmarks. */
  landmarks: number[][];
}

/** A photo in the canonical (right hand) frame, 63 numbers like the app's kNN vectors. */
export interface Sample {
  letter: string;
  source: string;
  signer: string;
  file: string;
  vector: number[];
  /** true when the orientation from the MediaPipe label was overruled (see `resolveOrientation`). */
  flipped: boolean;
}

export function toHandFrame(raw: RawSample): HandFrame {
  return {
    landmarks: raw.landmarks.map(([x = 0, y = 0, z = 0]) => ({ x, y, z })),
    handedness: raw.handedness,
    score: raw.score,
    timestamp: 0,
    videoWidth: raw.width,
    videoHeight: raw.height,
  };
}

/** Normalizes a photo with the same code the app runs on every camera frame. */
export function normalizeRaw(raw: RawSample): number[] {
  return flattenPoints(normalizeHand(toHandFrame(raw)).points);
}

/** The same hand with the opposite handedness label: in the canonical frame that is x → −x. */
export const mirrorVector = mirrorFrame;

/**
 * Keeps at most `max` samples per (letter, signer), evenly spaced in file order, so one person
 * (a video of 300 frames, a camera roll of 70 photos) does not outweigh everybody else.
 */
export function capPerSigner<T extends { letter: string; signer: string; file: string }>(
  samples: readonly T[],
  max: number,
): T[] {
  const groups = new Map<string, T[]>();
  for (const s of samples) {
    const key = `${s.letter}\u0000${s.signer}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  const kept = new Set<T>();
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
    if (sorted.length <= max) {
      sorted.forEach((s) => kept.add(s));
      continue;
    }
    for (let i = 0; i < max; i++) {
      const s = sorted[Math.floor((i * sorted.length) / max)];
      if (s) kept.add(s);
    }
  }
  return samples.filter((s) => kept.has(s));
}
