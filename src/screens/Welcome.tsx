import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import s from "./Screen.module.css";

export function Welcome() {
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.welcome.title}</h1>
      <p className={s.text}>{strings.welcome.description}</p>
      <div className={s.actions}>
        <button className={`${s.button} ${s.primary}`} onClick={() => navigate(paths.tutorial())}>
          {strings.welcome.enableCamera}
        </button>
      </div>
      <p className={s.text}>{strings.welcome.privacy}</p>
    </main>
  );
}
