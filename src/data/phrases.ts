import type { LetterSpec } from "../recognition/letters/spec";
import { PHRASE_PREFIX, type PhraseSpec } from "../recognition/phrases/spec";
import { GENERATED_PHRASES } from "./phrases.generated";
import { PHRASE_OVERRIDES, type PhraseOverride } from "./phrases.overrides";

/**
 * Phrase gestures of talk mode (docs/TRANSLATOR_SPEC.md §4.2): drafts built from Slovo
 * (phrases.generated.ts) with the team's decisions on top (phrases.overrides.ts). Only static ones
 * with a handshape are recognized for now; dynamic phrases come with T6.
 */
export function mergePhrases(
  generated: readonly PhraseSpec[],
  overrides: Readonly<Record<string, PhraseOverride>>,
): PhraseSpec[] {
  return generated
    .filter((p) => p.kind === "static" && p.handshape && !overrides[p.id]?.excluded)
    .map((p) => {
      const o = overrides[p.id];
      return { ...p, text: o?.text ?? p.text, verified: o?.verified ?? p.verified };
    });
}

export const PHRASES: readonly PhraseSpec[] = mergePhrases(GENERATED_PHRASES, PHRASE_OVERRIDES);

/** Their handshapes, ranked together with the letters (label `#<id>`). */
export const PHRASE_HANDSHAPES: readonly LetterSpec[] = PHRASES.flatMap((p) => (p.handshape ? [p.handshape] : []));

export function isPhraseLabel(label: string): boolean {
  return label.startsWith(PHRASE_PREFIX);
}

export function getPhraseByLabel(label: string): PhraseSpec | undefined {
  return isPhraseLabel(label) ? PHRASES.find((p) => `${PHRASE_PREFIX}${p.id}` === label) : undefined;
}

/** What the user sees for a recognition label: the letter itself or the phrase text. */
export function labelText(label: string): string {
  return getPhraseByLabel(label)?.text ?? label;
}
