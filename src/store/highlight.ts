// Landmarks to emphasize on the skeleton (the finger named by the current hint). Read every frame by HandOverlay.
let highlighted: ReadonlySet<number> = new Set();

export function setHighlight(landmarkIds: readonly number[] | null | undefined): void {
  highlighted = new Set(landmarkIds ?? []);
}

export function getHighlight(): ReadonlySet<number> {
  return highlighted;
}
