import { strings } from "../data/strings.ru";
import s from "./SuggestionBar.module.css";

interface SuggestionBarProps {
  words: readonly string[];
  /** Mouse / touch pick (the signer picks the first one with the «Пробел» zone). */
  onPick(word: string): void;
}

/** Up to 3 autocomplete words for the word being typed; the first one is what the zone inserts. */
export function SuggestionBar({ words, onPick }: SuggestionBarProps) {
  const t = strings.talk.suggestions;
  if (words.length === 0) return null;
  return (
    <div className={s.bar} aria-label={t.title}>
      <ul className={s.list}>
        {words.map((word, i) => (
          <li key={word}>
            <button type="button" className={i === 0 ? `${s.chip} ${s.first}` : s.chip} onClick={() => onPick(word)}>
              {i === 0 && <span aria-hidden="true">⬆ </span>}
              {word}
            </button>
          </li>
        ))}
      </ul>
      <p className={s.hint}>{t.zoneHint}</p>
    </div>
  );
}
