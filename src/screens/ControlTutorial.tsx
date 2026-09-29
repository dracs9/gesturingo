import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import s from "./Screen.module.css";

export function ControlTutorial() {
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
        <button className={`${s.button} ${s.primary}`} onClick={() => navigate(paths.map())}>
          {strings.common.skip}
        </button>
      </div>
    </main>
  );
}
