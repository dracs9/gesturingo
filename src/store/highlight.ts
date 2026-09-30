// Landmarks to emphasize on the skeleton (the finger named by the current hint). Read every frame by HandOverlay.
let highlighted: ReadonlySet<number> = new Set();

export function setHighlight(landmarkIds: readonly number[] | null | undefined): void {
  highlighted = new Set(landmarkIds ?? []);
}

export function getHighlight(): ReadonlySet<number> {
  return highlighted;
}

/**
 * Colour of the whole skeleton in talk mode (docs/TRANSLATOR_SPEC.md §7.1): green = recognized,
 * red = "almost" with a hint, grey = not sure. null = the usual colour.
 */
export type SkeletonTone = "accept" | "almost" | "neutral";

let tone: SkeletonTone | null = null;

export function setSkeletonTone(next: SkeletonTone | null): void {
  tone = next;
}

export function getSkeletonTone(): SkeletonTone | null {
  return tone;
}
