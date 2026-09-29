import type { LetterSpec } from "../recognition/letters/spec";

/**
 * Team decisions on top of letters.generated.ts. A field set here replaces the generated field
 * (e.g. `fingers`, `extra`, `confusedWith`, `verified`), so `npm run build:letters` never erases them.
 * Check every letter against the official table on /letters and paste the exported JSON here.
 */
export type LetterOverride = Partial<Omit<LetterSpec, "letter">>;

export const LETTER_OVERRIDES: Readonly<Record<string, LetterOverride>> = {
  А: { verified: true },
  Б: { verified: true },
  В: { verified: true },
  Г: { verified: true },
  Е: { verified: true },
  Ж: { verified: true },
  И: { verified: true },
  К: { verified: true },
  Л: { verified: true },
  Н: { verified: true },
  О: { verified: true },
  Р: { verified: true },
  С: { verified: true },
  Т: { verified: true },
  У: { verified: true },
  Ф: { verified: true },
  Х: { verified: true },
  Ч: { verified: true },
  Ш: { verified: true },
  Ы: { verified: true },
  Э: { verified: true },
  Ю: { verified: true },
  Я: { verified: true },
};
