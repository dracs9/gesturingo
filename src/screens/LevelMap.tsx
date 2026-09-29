import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import s from "./Screen.module.css";

export function LevelMap() {
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.levelMap.title}</h1>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <button className={`${s.button} ${s.primary}`} onClick={() => navigate(paths.lesson("1"))}>
          {strings.levelMap.lesson(1)}
        </button>
        <button className={s.button} onClick={() => navigate(paths.bridge())}>
          {strings.levelMap.bridge}
        </button>
      </div>
    </main>
  );
}
