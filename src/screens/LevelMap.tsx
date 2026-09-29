import { GestureButton } from "../components/GestureButton";
import { LESSONS } from "../data/lessons";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import s from "./Screen.module.css";

// P0 lesson list (the full map with stars and XP comes in Phase 7).
export function LevelMap() {
  const first = LESSONS[0];
  useGestureCommands({ ok: first ? () => navigate(paths.lesson(first.id)) : undefined });

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.levelMap.title}</h1>
      <p className={s.text}>{strings.levelMap.hint}</p>
      <div className={s.actions}>
        {LESSONS.map((lesson, i) => (
          <GestureButton key={lesson.id} variant="primary" onClick={() => navigate(paths.lesson(lesson.id))}>
            {strings.levelMap.lesson(i + 1)}
            <br />
            {strings.levelMap.lessonLetters(lesson.letters)}
          </GestureButton>
        ))}
        <GestureButton onClick={() => navigate(paths.bridge())}>{strings.levelMap.bridge}</GestureButton>
      </div>
    </main>
  );
}
