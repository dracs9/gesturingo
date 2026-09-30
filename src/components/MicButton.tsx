import { strings } from "../data/strings.ru";
import s from "./ListenerPanel.module.css";

interface MicButtonProps {
  listening: boolean;
  /** Our TTS is speaking: listening now would subtitle our own voice. */
  blocked: boolean;
  onClick(): void;
}

/** Push-to-talk for the hearing person: a big ordinary button (mouse / touch are fine for them). */
export function MicButton({ listening, blocked, onClick }: MicButtonProps) {
  const t = strings.talk.stt;
  return (
    <button
      type="button"
      className={`${s.mic} ${listening ? s.micOn : ""}`}
      aria-pressed={listening}
      disabled={blocked && !listening}
      onClick={onClick}
    >
      <span className={s.micIcon} aria-hidden="true">
        {blocked && !listening ? "🔊" : "🎤"}
      </span>
      <span>{listening ? t.listening : blocked ? t.blocked : t.mic}</span>
    </button>
  );
}
