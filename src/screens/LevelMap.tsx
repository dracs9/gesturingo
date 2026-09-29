import { GestureButton } from "../components/GestureButton";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import s from "./Screen.module.css";

export function LevelMap() {
  const openLesson = () => navigate(paths.lesson("1"));
  useGestureCommands({ ok: openLesson });

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.levelMap.title}</h1>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <GestureButton variant="primary" onClick={openLesson}>
          {strings.levelMap.lesson(1)}
        </GestureButton>
        <GestureButton onClick={() => navigate(paths.bridge())}>{strings.levelMap.bridge}</GestureButton>
      </div>
    </main>
  );
}
