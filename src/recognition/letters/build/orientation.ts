import { frameDistance, pickMedoid } from "../../samples";
import { mirrorVector } from "./dataset";

const MAX_ROUNDS = 10;

/**
 * Photos of one letter come in two mirror-image orientations: MediaPipe often mislabels Left/Right
 * on stills (one person, one hand: 14 Right / 49 Left), and many photos show the back of the hand
 * (the signer's own view), which in 2D is the mirror image of the front view the webcam sees.
 * Both end up mirrored in the canonical frame. This picks, per sample, the orientation — as
 * normalized or mirrored — closer to the letter's typical shape.
 *
 * `anchored[i]` marks trusted samples (front view, known hand): they are never flipped and alone
 * define the typical shape. Without anchors the shape is re-estimated until nothing changes and
 * the side most MediaPipe labels agree with wins.
 *
 * Returns, per input vector, whether it has to be mirrored.
 */
export function resolveOrientation(
  vectors: readonly (readonly number[])[],
  anchored: readonly boolean[] = [],
): boolean[] {
  const mirrored = vectors.map((v) => mirrorVector(v));
  const closerMirrored = (i: number, center: readonly number[]) => {
    const v = vectors[i] ?? [];
    return frameDistance(mirrored[i] ?? v, center) < frameDistance(v, center);
  };

  const anchors = vectors.filter((_, i) => anchored[i]);
  if (anchors.length > 0) {
    const center = anchors[pickMedoid(anchors)] ?? [];
    return vectors.map((_, i) => !anchored[i] && closerMirrored(i, center));
  }

  let flip = vectors.map(() => false);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const current = vectors.map((v, i) => (flip[i] ? (mirrored[i] ?? v) : v));
    const center = current[pickMedoid(current)];
    if (!center) return flip;
    const next = vectors.map((_, i) => closerMirrored(i, center));
    if (next.every((f, i) => f === flip[i])) break;
    flip = next;
  }
  // Mirroring every sample gives the same clusters: keep the side most MediaPipe labels agree with.
  const flipped = flip.filter(Boolean).length;
  return flipped * 2 > flip.length ? flip.map((f) => !f) : flip;
}
