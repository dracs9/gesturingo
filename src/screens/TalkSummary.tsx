import { useEffect, useState } from "react";
import { GestureButton } from "../components/GestureButton";
import { getLetterSpec } from "../data/letters";
import { labelText } from "../data/phrases";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useTalkHistory } from "../store/talkHistory";
import { useConversation } from "../talk/conversationStore";
import { practiceLessonId, summarizeConversation } from "../talk/summary";
import r from "./results/Results.module.css";
import s from "./Screen.module.css";

const RESET_CONFIRM_MS = 4000;

/**
 * «Сводка» after a conversation (docs/TRANSLATOR_SPEC.md §8): messages both ways, hints and
 * corrections, the gestures that needed help most + «Потренировать эти жесты». The conversation is
 * added once to the all-time aggregates (localStorage keeps numbers, never the words).
 */
export function TalkSummary() {
  const t = strings.talkSummary;
  const conversation = useConversation();
  const history = useTalkHistory();
  const [confirmReset, setConfirmReset] = useState(false);

  const summary = summarizeConversation(conversation, labelText, (label) => getLetterSpec(label) !== undefined);

  // Thumbs up = back to the map (the usual "next" on menu screens).
  useGestureCommands({ ok: () => navigate(paths.map()), back: () => navigate(paths.map()) });

  useEffect(() => {
    const c = useConversation.getState();
    if (c.recorded || (c.messages.length === 0 && c.hintLog.length === 0)) return;
    const byGesture: Record<string, number> = {};
    for (const h of c.hintLog) if (h.letter) byGesture[labelText(h.letter)] = (byGesture[labelText(h.letter)] ?? 0) + 1;
    useTalkHistory.getState().record(summarizeConversation(c, labelText, (l) => getLetterSpec(l) !== undefined), byGesture);
    c.markRecorded();
  }, []);

  useEffect(() => {
    if (!confirmReset) return;
    const id = window.setTimeout(() => setConfirmReset(false), RESET_CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [confirmReset]);

  const newConversation = () => {
    conversation.clear();
    navigate(paths.talk());
  };
  const onReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    history.reset();
    setConfirmReset(false);
  };

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{t.title}</h1>

      <dl className={r.stats}>
        <div>
          <dt>{t.signed}</dt>
          <dd>🤟 {summary.signed}</dd>
        </div>
        <div>
          <dt>{t.heard}</dt>
          <dd>🎤 {summary.heard}</dd>
        </div>
        <div>
          <dt>{t.hints}</dt>
          <dd>{summary.hints}</dd>
        </div>
        <div>
          <dt>{t.corrections}</dt>
          <dd>{summary.cancels + summary.deletes}</dd>
        </div>
      </dl>

      {summary.needHelp.length > 0 ? (
        <section className={r.panel}>
          <h2>{t.needHelp}</h2>
          <ol className={r.errors}>
            {summary.needHelp.map((g) => (
              <li key={g.gesture}>
                <strong>{g.gesture}</strong> <span className={r.muted}>{strings.results.timesShown(g.hints)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className={s.text}>{t.noHelp}</p>
      )}

      <p className={s.text}>
        {t.allTime(history.conversations, history.signed, history.heard)}
      </p>

      <div className={s.actions}>
        {summary.practice.length > 0 && (
          <GestureButton variant="primary" onClick={() => navigate(paths.lesson(practiceLessonId(summary.practice)))}>
            {t.practice(summary.practice)}
          </GestureButton>
        )}
        <GestureButton onClick={() => navigate(paths.talk())}>{t.back}</GestureButton>
        <GestureButton onClick={newConversation}>{t.newConversation}</GestureButton>
        <GestureButton onClick={() => navigate(paths.map())}>{strings.common.toMap}</GestureButton>
      </div>
      <GestureButton className={r.muted} onClick={onReset}>
        {confirmReset ? t.resetConfirm : t.reset}
      </GestureButton>
    </main>
  );
}
