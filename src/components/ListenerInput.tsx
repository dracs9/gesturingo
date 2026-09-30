import { useState, type FormEvent } from "react";
import { strings } from "../data/strings.ru";
import s from "./ListenerPanel.module.css";

/** Fallback without speech recognition (Firefox, no microphone): the hearing person types the answer. */
export function ListenerInput({ onSend }: { onSend(text: string): void }) {
  const t = strings.talk.stt;
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <input
        className={s.input}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
        autoComplete="off"
      />
      <button type="submit" className={s.send} disabled={text.trim() === ""}>
        {t.send}
      </button>
    </form>
  );
}
