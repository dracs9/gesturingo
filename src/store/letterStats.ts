import type { LetterDecision } from "../recognition/letters/classifier";

// Latest letter decision in a lesson, for the `?debug=1` panel (kNN top-3).
let last: { letter: string; decision: LetterDecision | null } | null = null;

export function setLetterStats(letter: string, decision: LetterDecision | null): void {
  last = { letter, decision };
}

export function clearLetterStats(): void {
  last = null;
}

export function getLetterStats(): typeof last {
  return last;
}
