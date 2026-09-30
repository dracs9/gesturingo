import { strings } from "../data/strings.ru";
import type { ListenStatus, SttErrorKind } from "../stt/stt";
import { Icon } from "./Icon";
import { ListenerInput } from "./ListenerInput";
import s from "./ListenerPanel.module.css";

interface ListenerPanelProps {
  supported: boolean;
  status: ListenStatus;
  error: SttErrorKind | null;
  onRetry(): void;
  onSend(text: string): void;
}

/** Errors after which speaking cannot work right now: offer typing instead. */
const TYPE_INSTEAD: ReadonlySet<SttErrorKind> = new Set(["denied", "noMic", "network"]);

/**
 * The hearing person's side (docs/TRANSLATOR_SPEC.md §6): one status line — the microphone listens by
 * itself; after an error, a button to turn it on again; without recognition, a text field.
 */
export function ListenerPanel({ supported, status, error, onRetry, onSend }: ListenerPanelProps) {
  const t = strings.talk.stt;
  const typing = !supported || (error !== null && TYPE_INSTEAD.has(error));
  return (
    <section className={s.panel} aria-label={t.panelTitle}>
      {supported ? (
        <div className={s.status} data-status={status} role="status">
          <span className={s.dot} aria-hidden="true" />
          <Icon name="mic" size={20} className={s.statusIcon} />
          <span className={s.statusText}>{error ? t.errors[error] : t.status[status]}</span>
          {(status === "error" || status === "off") && (
            <button type="button" className={s.retry} onClick={onRetry}>
              {t.retry}
            </button>
          )}
        </div>
      ) : (
        <p className={s.message} role="status">
          {t.unsupported}
        </p>
      )}
      {typing && <ListenerInput onSend={onSend} />}
    </section>
  );
}
