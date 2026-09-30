/**
 * Prefix autocomplete for fingerspelling (docs/TRANSLATOR_SPEC.md §4.1): up to 3 frequent words that
 * start with the letters typed so far. Completions may contain letters the camera cannot read yet
 * (Д, П, М…), so «СПАСИБО» is reachable from «С».
 */
export const SUGGESTION_COUNT = 3;

/** Ё is typed as Е (and often written so): match both. */
const fold = (s: string) => s.toLocaleUpperCase("ru-RU").replaceAll("Ё", "Е");

export interface Autocomplete {
  readonly size: number;
  /** Most frequent words longer than the prefix and starting with it (no two differing only by Ё). */
  suggest(prefix: string, limit?: number): string[];
}

/** `words` must be ordered by frequency, most frequent first. */
export function createAutocomplete(words: readonly string[]): Autocomplete {
  const entries = words.map((word) => ({ word, key: fold(word) }));
  return {
    size: entries.length,
    suggest(prefix, limit = SUGGESTION_COUNT) {
      const p = fold(prefix.trim());
      if (p === "") return [];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const { word, key } of entries) {
        if (key.length <= p.length || !key.startsWith(p) || seen.has(key)) continue;
        seen.add(key);
        out.push(word);
        if (out.length >= limit) break;
      }
      return out;
    },
  };
}
