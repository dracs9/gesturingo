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
  /** Similar letters (kNN tells them apart in Phase 6). */
  confusedWith?: string[];
  /** Path to the ghost-hand reference, e.g. "references/А.json". */
  reference: string;
}
