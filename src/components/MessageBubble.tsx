import { strings } from "../data/strings.ru";
import type { Message } from "../talk/conversationStore";
import s from "./ConversationFeed.module.css";

/** One message: the signer on the left (hand icon), the hearing person on the right (microphone icon). */
export function MessageBubble({ message }: { message: Message }) {
  const t = strings.talk;
  const signer = message.side === "signer";
  const note =
    message.speech === "speaking"
      ? t.speaking
      : message.speech === "unavailable"
        ? t.noVoice
        : message.speech === "muted"
          ? t.muted
          : null;
  return (
    <li className={`${s.bubble} ${signer ? s.signer : s.listener} ${message.speech === "speaking" ? s.speaking : ""}`}>
      <span className={s.who}>
        <span aria-hidden="true">{signer ? "🤟" : "🎤"}</span> {signer ? t.signer : t.listener}
      </span>
      <span className={s.text}>{message.text}</span>
      {note && (
        <span className={s.note}>
          <span aria-hidden="true">{message.speech === "speaking" ? "🔊" : "🔇"}</span> {note}
        </span>
      )}
    </li>
  );
}
