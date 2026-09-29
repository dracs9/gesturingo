import type { Finger, FingerState, PalmFacing, ThumbPosition } from "../features";

export type { Finger, FingerState };

/** Extra conditions of a letter shape (CLAUDE.md §8.1). */
export type LetterExtra =
  | { type: "tipsTouch"; a: Finger; b: Finger; hintCode: string }
  | { type: "tipsApart"; a: Finger; b: Finger; hintCode: string }
  | { type: "palmFacing"; value: PalmFacing; hintCode: string }
  | { type: "thumbPosition"; value: ThumbPosition; hintCode: string };

/** A static letter of the Russian fingerspelling alphabet, as rules the camera can check. */
export interface LetterSpec {
  letter: string;
  /** true only after checking against the official table. */
  verified: boolean;
  fingers: Partial<Record<Finger, { state: FingerState; hintCode: string }>>;
  extra?: LetterExtra[];
  /** Similar letters: kNN tells them apart, a hit gives the "looks like …" hint. */
  confusedWith?: string[];
  /**
   * The most common state of every finger in the data, rules or not. When kNN disagrees but the
   * rules pass, the finger furthest from its typical state becomes the hint.
   */
  typical?: Partial<Record<Finger, FingerState>>;
  /** Path to the ghost-hand reference, e.g. "references/А.json". */
  reference: string;
}
