import type { LetterSpec } from "../recognition/letters/spec";

/**
 * Letter shapes of the Russian fingerspelling alphabet (static letters only).
 * FILLED BY THE TEAM from the official table — do not invent shapes (CLAUDE.md §8.1).
 * The entries below are infrastructure stubs so the lesson flow can be tested end to end.
 */
export const LETTERS: readonly LetterSpec[] = [
  // TODO: сверить с официальной таблицей
  {
    letter: "В",
    verified: false,
    fingers: {
      index: { state: "straight", hintCode: "finger.straighten.index" },
      middle: { state: "straight", hintCode: "finger.straighten.middle" },
      ring: { state: "straight", hintCode: "finger.straighten.ring" },
      pinky: { state: "straight", hintCode: "finger.straighten.pinky" },
    },
    extra: [
      { type: "palmFacing", value: "camera", hintCode: "palm.faceCamera" },
      { type: "thumbPosition", value: "acrossPalm", hintCode: "thumb.pressToPalm" },
    ],
    reference: "references/В.json",
  },
  // TODO: сверить с официальной таблицей
  {
    letter: "А",
    verified: false,
    fingers: {
      thumb: { state: "straight", hintCode: "finger.straighten.thumb" },
      index: { state: "bent", hintCode: "finger.bend.index" },
      middle: { state: "bent", hintCode: "finger.bend.middle" },
      ring: { state: "bent", hintCode: "finger.bend.ring" },
      pinky: { state: "bent", hintCode: "finger.bend.pinky" },
    },
    extra: [{ type: "palmFacing", value: "camera", hintCode: "palm.faceCamera" }],
    reference: "references/А.json",
  },
  // TODO: сверить с официальной таблицей
  {
    letter: "О",
    verified: false,
    fingers: {
      index: { state: "half", hintCode: "finger.round.index" },
      middle: { state: "half", hintCode: "finger.round.middle" },
      ring: { state: "half", hintCode: "finger.round.ring" },
      pinky: { state: "half", hintCode: "finger.round.pinky" },
    },
    extra: [{ type: "tipsTouch", a: "thumb", b: "index", hintCode: "tips.touch.thumb-index" }],
    reference: "references/О.json",
  },
];

export function getLetterSpec(letter: string): LetterSpec | undefined {
  return LETTERS.find((l) => l.letter === letter);
}
