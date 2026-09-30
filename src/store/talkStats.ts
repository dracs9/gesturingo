import type { ReaderUpdate } from "../recognition/open/openReader";

// Latest talk-mode reading, for the `?debug=1` panel (top-3 with distances, margin).
let last: ReaderUpdate | null = null;

export function setTalkStats(update: ReaderUpdate): void {
  last = update;
}

export function clearTalkStats(): void {
  last = null;
  motion = null;
}

export function getTalkStats(): ReaderUpdate | null {
  return last;
}

/** Motion segmentation and the last DTW ranking (dynamic phrases). */
export interface MotionStats {
  speed: number;
  moving: boolean;
  top: { label: string; score: number }[];
}

let motion: MotionStats | null = null;

export function setMotionStats(next: MotionStats): void {
  motion = next;
}

export function getMotionStats(): MotionStats | null {
  return motion;
}
