import { useEffect, useState } from "react";
import { GestureButton } from "../components/GestureButton";
import { Stars } from "../components/Stars";
import { XpCounter } from "../components/XpCounter";
import { LESSONS } from "../data/lessons";
import { unavailableLetters } from "../data/letters";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useProgress } from "../store/progress";
import {
  isLessonCompleted,
  isLessonUnlocked,
  learnedLetters,
  lessonStars,
  REVIEW_LESSON_ID,
  totalStars,
  weakLetters,
} from "../store/progressLogic";
import { useSettings } from "../store/settings";
import m from "./LevelMap.module.css";
import s from "./Screen.module.css";

const RESET_CONFIRM_MS = 4000;

/** Letters with movement, excluded or without data — shown as "coming soon". */
const comingSoon = unavailableLetters();

export function LevelMap() {
  const t = strings.levelMap;
  const progress = useProgress();
  const soundOn = useSettings((st) => st.soundOn);
  const toggleSound = useSettings((st) => st.toggleSound);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const id = window.setTimeout(() => setConfirmReset(false), RESET_CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [confirmReset]);

  const weak = weakLetters(progress);
  const bridgeOpen = learnedLetters(progress).length > 0;

  // Thumbs up = the natural next step: the first open lesson not yet passed, else review, else lesson 1.
  const nextLesson = LESSONS.find((l, i) => isLessonUnlocked(progress, LESSONS, i) && !isLessonCompleted(progress, l));
  const continueId = nextLesson?.id ?? (weak.length > 0 ? REVIEW_LESSON_ID : LESSONS[0]?.id);
  useGestureCommands({ ok: continueId ? () => navigate(paths.lesson(continueId)) : undefined });

  const onReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    progress.reset();
    setConfirmReset(false);
  };

  return (
    <main className={s.screen}>
      <header className={m.header}>
        <h1 className={s.title}>{t.title}</h1>
        <div className={m.totals}>
          <XpCounter value={progress.xp} />
          <span className={m.totalStars}>
            <span aria-hidden="true">★</span> {t.totalStars(totalStars(progress))}
          </span>
        </div>
      </header>
      <p className={s.text}>{t.hint}</p>

      <div className={m.grid}>
        {LESSONS.map((lesson, i) => {
          const open = isLessonUnlocked(progress, LESSONS, i);
          return (
            <GestureButton
              key={lesson.id}
              variant={lesson.id === nextLesson?.id ? "primary" : "secondary"}
              className={m.tile}
              disabled={!open}
              onClick={() => navigate(paths.lesson(lesson.id))}
            >
              <span className={m.tileTitle}>
                {!open && <span aria-hidden="true">🔒 </span>}
                {t.lesson(i + 1)}
                {!open && <span className={m.srOnly}> — {t.lockedLabel}</span>}
              </span>
              <span className={m.tileLetters}>{t.lessonLetters(lesson.letters)}</span>
              {open ? <Stars value={lessonStars(progress, lesson)} /> : <span className={m.muted}>{t.locked(i)}</span>}
            </GestureButton>
          );
        })}

        <GestureButton className={m.tile} disabled={!bridgeOpen} onClick={() => navigate(paths.bridge())}>
          <span className={m.tileTitle}>
            {!bridgeOpen && <span aria-hidden="true">🔒 </span>}🌉 {t.bridge}
          </span>
          {!bridgeOpen && <span className={m.muted}>{t.bridgeLocked}</span>}
        </GestureButton>

        <GestureButton
          className={m.tile}
          disabled={weak.length === 0}
          onClick={() => navigate(paths.lesson(REVIEW_LESSON_ID))}
        >
          <span className={m.tileTitle}>🔁 {t.weakLetters}</span>
          <span className={m.tileLetters}>{weak.length > 0 ? t.weakLettersList(weak) : t.noWeakLetters}</span>
        </GestureButton>

        {comingSoon.length > 0 && (
          <GestureButton className={m.tile} disabled>
            <span className={m.tileTitle}>
              <span aria-hidden="true">⏳ </span>
              {t.comingSoon}
            </span>
            <span className={m.tileLetters}>{t.lessonLetters(comingSoon)}</span>
            <span className={m.muted}>{t.comingSoonHint}</span>
          </GestureButton>
        )}
      </div>

      <footer className={m.settings}>
        <GestureButton className={m.small} onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? strings.progress.soundOn : strings.progress.soundOff}
        </GestureButton>
        <GestureButton className={`${m.small} ${confirmReset ? m.danger : ""}`} onClick={onReset}>
          {confirmReset ? strings.progress.resetConfirm : strings.progress.reset}
        </GestureButton>
      </footer>
    </main>
  );
}
