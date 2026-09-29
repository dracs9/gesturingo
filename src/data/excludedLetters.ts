/**
 * Static letters the camera does not check yet. They get no rules and no kNN samples and appear on
 * the lesson map as "coming soon", like the letters with movement (dynamicLetters.ts).
 */
export const EXCLUDED_LETTERS: readonly string[] = [
  "М", // in the data no finger reaches 80% in one state — no rules; the team will describe it by hand
  "П", // same, and kNN accuracy 43%
  "Ц", // not in the datasets
  "Ъ", // not in the datasets
  "Ь", // not in the datasets
];

export function isExcludedLetter(letter: string): boolean {
  return EXCLUDED_LETTERS.includes(letter);
}
