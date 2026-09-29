import { GestureButton } from "../components/GestureButton";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import s from "./Screen.module.css";

export function Results({ lessonId }: { lessonId: string }) {
  const toMap = () => navigate(paths.map());
  useGestureCommands({ ok: toMap, back: toMap });

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.results.title}</h1>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <GestureButton onClick={() => navigate(paths.lesson(lessonId))}>{strings.common.retry}</GestureButton>
        <GestureButton variant="primary" onClick={toMap}>
          {strings.common.toMap}
        </GestureButton>
      </div>
    </main>
  );
}
