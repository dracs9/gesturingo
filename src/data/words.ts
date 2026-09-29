import { isDynamicLetter } from "./dynamicLetters";

// Words for the Bridge. Only words whose every letter is static, described in letters.ts AND learned
// are offered, so letters with movement (dynamicLetters.ts) never appear.

// Only letters the app teaches (no Д З Ё Й Щ — movement; no М П Ц Ъ Ь — excluded); a test checks it.
export const WORDS: readonly string[] = [
  "ВОВА",
  "КОТ",
  "НЕТ",
  "ЛЕС",
  "ЛУК",
  "СОК",
  "НОС",
  "РОТ",
  "ОСА",
  "ЛИСА",
  "РУКА",
  "НОГА",
  "РЫБА",
  "ХЛЕБ",
  "ЖУК",
  "ЛЕТО",
  "ГОРА",
  "СОВА",
  "ЭХО",
  "КНИГА",
  "ШКОЛА",
  "СЕСТРА",
  "БРАТ",
  "ИРА",
  "ОЛЯ",
  "ЮЛЯ",
  "АННА",
];

/** Words the learner can spell: every letter is static, has a spec and is learned. */
export function availableWords(
  words: readonly string[],
  learned: ReadonlySet<string>,
  hasSpec: (letter: string) => boolean,
): string[] {
  return words.filter((w) => Array.from(w).every((l) => !isDynamicLetter(l) && learned.has(l) && hasSpec(l)));
}

/** Random word, avoiding the previous one when there is a choice. */
export function pickWord(words: readonly string[], previous: string | null, random = Math.random): string | null {
  const pool = words.length > 1 ? words.filter((w) => w !== previous) : words;
  return pool[Math.floor(random() * pool.length)] ?? null;
}
