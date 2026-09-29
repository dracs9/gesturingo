import { GestureButton } from "../components/GestureButton";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import s from "./Screen.module.css";

export function Bridge() {
  const exit = () => navigate(paths.map());
  useGestureCommands({ back: exit });

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.bridge.title}</h1>
      <p className={s.text}>{strings.bridge.description}</p>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <GestureButton onClick={exit}>{strings.common.back}</GestureButton>
      </div>
    </main>
  );
}
