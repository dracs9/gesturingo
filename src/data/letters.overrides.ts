import type { LetterSpec } from "../recognition/letters/spec";

/**
 * Team decisions on top of letters.generated.ts. A field set here replaces the generated field
 * (e.g. `fingers`, `extra`, `confusedWith`, `verified`), so `npm run build:letters` never erases them.
 * Check every letter against the official table on /letters and paste the exported JSON here.
 */
export type LetterOverride = Partial<Omit<LetterSpec, "letter">>;

export const LETTER_OVERRIDES: Readonly<Record<string, LetterOverride>> = {};
