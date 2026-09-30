import { strings } from "../data/strings.ru";
import type { SttErrorKind } from "../stt/stt";
import { ListenerInput } from "./ListenerInput";
import s from "./ListenerPanel.module.css";
import { MicButton } from "./MicButton";

interface ListenerPanelProps {
  supported: boolean;
  listening: boolean;
  ttsSpeaking: boolean;
  error: SttErrorKind | null;
  onMic(): void;
  onSend(text: string): void;
}

/** Errors after which speaking cannot work right now: offer typing instead. */
const TYPE_INSTEAD: ReadonlySet<SttErrorKind> = new Set(["denied", "noMic", "network"]);

/** The hearing person's side (docs/TRANSLATOR_SPEC.md §6): microphone, or a text field without one. */
export function ListenerPanel({ supported, listening, ttsSpeaking, error, onMic, onSend }: ListenerPanelProps) {
  const t = strings.talk.stt;
  const typing = !supported || (error !== null && TYPE_INSTEAD.has(error));
  return (
    <section className={s.panel} aria-label={t.panelTitle}>
      <h2 className={s.title}>
        <span aria-hidden="true">🎤 </span>
        {t.panelTitle}
      </h2>
      {supported && <MicButton listening={listening} blocked={ttsSpeaking} onClick={onMic} />}
      {!supported && (
        <p className={s.message} role="status">
          <span aria-hidden="true">ℹ️ </span>
          {t.unsupported}
        </p>
      )}
      {error && (
        <p className={s.message} role="alert">
          <span aria-hidden="true">⚠️ </span>
          {t.errors[error]}
        </p>
      )}
      {typing && <ListenerInput onSend={onSend} />}
      <p className={s.privacy}>
        <span aria-hidden="true">🔒 </span>
        {t.privacy}
      </p>
    </section>
  );
}
