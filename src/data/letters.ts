import type { LetterSpec } from "../recognition/letters/spec";
import { ALPHABET } from "./alphabet";
import { isDynamicLetter } from "./dynamicLetters";
import { isExcludedLetter } from "./excludedLetters";
import { GENERATED_LETTERS } from "./letters.generated";
import { LETTER_OVERRIDES, type LetterOverride } from "./letters.overrides";

/**
 * Static letters the app teaches: drafts generated from data statistics (letters.generated.ts)
 * with the team's decisions on top, field by field (letters.overrides.ts). Letters with movement
 * and excluded letters are left out. Shapes are never invented here (CLAUDE.md §8.1).
 */
export function mergeLetters(
  generated: readonly LetterSpec[],
  overrides: Readonly<Record<string, LetterOverride>>,
): LetterSpec[] {
  return generated
    .filter((spec) => !isDynamicLetter(spec.letter) && !isExcludedLetter(spec.letter))
    .map((spec) => ({ ...spec, ...overrides[spec.letter], letter: spec.letter }))
    .sort((a, b) => ALPHABET.indexOf(a.letter) - ALPHABET.indexOf(b.letter));
}

export const LETTERS: readonly LetterSpec[] = mergeLetters(GENERATED_LETTERS, LETTER_OVERRIDES);

export function getLetterSpec(letter: string): LetterSpec | undefined {
  return LETTERS.find((l) => l.letter === letter);
}

/** Letters of the alphabet the camera does not check yet: with movement, excluded or without data. */
export function unavailableLetters(): string[] {
  return ALPHABET.filter((l) => !getLetterSpec(l));
}
