import { useEffect, useRef } from "react";
import { strings } from "../data/strings.ru";
import { useConversation } from "../talk/conversationStore";
import s from "./ConversationFeed.module.css";
import { MessageBubble } from "./MessageBubble";

/** Dialogue history of the talk screen; scrolls to the newest message. */
export function ConversationFeed() {
  const messages = useConversation((st) => st.messages);
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <section ref={listRef} className={s.feed} aria-label={strings.talk.feedTitle}>
      {messages.length === 0 ? (
        <p className={s.empty}>{strings.talk.feedEmpty}</p>
      ) : (
        <ol className={s.list} aria-live="polite">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ol>
      )}
    </section>
  );
}
