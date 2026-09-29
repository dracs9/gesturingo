import { ALPHABET } from "./alphabet";
import type { LetterOverride } from "./letters.overrides";

/**
 * The team's "checked against the official table" marks from /letters as the new content of
 * LETTER_OVERRIDES: existing overrides are kept field by field, `verified` comes from the marks.
 * Letters without a mark and without overrides are left out. Alphabet order.
 */
export function exportOverrides(
  letters: readonly string[],
  marks: Readonly<Record<string, boolean>>,
  existing: Readonly<Record<string, LetterOverride>>,
): Record<string, LetterOverride> {
  const out: Record<string, LetterOverride> = {};
  const all = [...new Set([...letters, ...Object.keys(existing)])].sort(
    (a, b) => ALPHABET.indexOf(a) - ALPHABET.indexOf(b),
  );
  for (const letter of all) {
    const base = existing[letter] ?? {};
    const mark = marks[letter];
    if (mark) {
      out[letter] = { ...base, verified: true };
    } else {
      // Unmarked: drop a stale `verified: true`, keep the team's other decisions.
      const { verified: _dropped, ...rest } = base;
      void _dropped;
      if (Object.keys(rest).length > 0) out[letter] = rest;
    }
  }
  return out;
}

/** Text to paste as the value of LETTER_OVERRIDES (JSON is a valid TS object literal). */
export function overridesText(overrides: Readonly<Record<string, LetterOverride>>): string {
  return `${JSON.stringify(overrides, null, 2)}\n`;
}
