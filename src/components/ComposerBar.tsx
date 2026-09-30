import { strings } from "../data/strings.ru";
import s from "./ComposerBar.module.css";

interface ComposerBarProps {
  words: readonly string[];
  current: string;
}

/** The message being typed: finished words, the current word and a blinking cursor. */
export function ComposerBar({ words, current }: ComposerBarProps) {
  const empty = words.length === 0 && current === "";
  return (
    <div className={s.bar} aria-label={strings.talk.draftLabel} aria-live="polite">
      {empty ? (
        <span className={s.placeholder}>{strings.talk.draftEmpty}</span>
      ) : (
        <span className={s.text}>
          {words.join(" ")}
          {words.length > 0 && " "}
          <span className={s.current}>{current}</span>
        </span>
      )}
      <span className={s.cursor} aria-hidden="true" />
    </div>
  );
}
