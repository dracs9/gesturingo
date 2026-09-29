/**
 * Letters shown with a movement. A photo cannot capture movement, so they get no rules and no kNN
 * samples, appear on the lesson map as "coming soon" and never in Bridge words.
 */
// TODO: команда уточнит список по официальной таблице
export const DYNAMIC_LETTERS: readonly string[] = ["Д", "Ё", "З", "Й", "Щ"];

export function isDynamicLetter(letter: string): boolean {
  return DYNAMIC_LETTERS.includes(letter);
}
