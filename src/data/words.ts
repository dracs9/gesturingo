// Words for the Bridge. Only words whose every letter is described in letters.ts AND learned are offered,
// so letters with movement (Й, Щ, Ё…) never appear until the team adds them.

export const WORDS: readonly string[] = [
  "ВОВА",
  "МАМА",
  "ПАПА",
  "ВОДА",
  "ДОМ",
  "КОТ",
  "МИР",
  "ДА",
  "НЕТ",
  "ЛЕС",
  "САД",
  "ЛУК",
  "СОК",
  "НОС",
  "РОТ",
  "ЛИСА",
  "РУКА",
  "НОГА",
  "МОРЕ",
  "ЛАМПА",
  "КНИГА",
  "ШКОЛА",
  "СЕСТРА",
  "БРАТ",
  "ДРУГ",
  "ИРА",
  "ОЛЯ",
  "АННА",
  "ПРИВЕТ",
  "СПАСИБО",
];

/** Words the learner can spell: every letter has a spec and is learned. */
export function availableWords(
  words: readonly string[],
  learned: ReadonlySet<string>,
  hasSpec: (letter: string) => boolean,
): string[] {
  return words.filter((w) => Array.from(w).every((l) => learned.has(l) && hasSpec(l)));
}

/** Random word, avoiding the previous one when there is a choice. */
export function pickWord(words: readonly string[], previous: string | null, random = Math.random): string | null {
  const pool = words.length > 1 ? words.filter((w) => w !== previous) : words;
  return pool[Math.floor(random() * pool.length)] ?? null;
}
