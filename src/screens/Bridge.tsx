import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import s from "./Screen.module.css";

export function Bridge() {
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.bridge.title}</h1>
      <p className={s.text}>{strings.bridge.description}</p>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <button className={s.button} onClick={() => navigate(paths.map())}>
          {strings.common.back}
        </button>
      </div>
    </main>
  );
}
