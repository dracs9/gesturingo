import { GestureButton } from "../components/GestureButton";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import s from "./Screen.module.css";

export function ControlTutorial() {
  const skip = () => navigate(paths.map());
  useGestureCommands({ ok: skip, back: () => navigate(paths.welcome()) });

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.tutorial.title}</h1>
      <ol className={`${s.text} ${s.list}`}>
        {strings.tutorial.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <GestureButton variant="primary" onClick={skip}>
          {strings.common.skip}
        </GestureButton>
      </div>
    </main>
  );
}
