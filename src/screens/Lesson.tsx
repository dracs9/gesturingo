import { GestureButton } from "../components/GestureButton";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import s from "./Screen.module.css";

export function Lesson({ lessonId }: { lessonId: string }) {
  const exit = () => navigate(paths.map());
  useGestureCommands({ back: exit });

  // The cursor is off in lessons (CLAUDE.md §7.5): exit is the open palm. The buttons are a mouse fallback
  // until the real lesson flow (Phase 5).
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.lesson.title(lessonId)}</h1>
      <p className={s.text}>{strings.lesson.exitHint}</p>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <GestureButton onClick={exit}>{strings.common.back}</GestureButton>
        <GestureButton variant="primary" onClick={() => navigate(paths.results(lessonId))}>
          {strings.lesson.finish}
        </GestureButton>
      </div>
    </main>
  );
}
