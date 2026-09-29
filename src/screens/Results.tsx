import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import s from "./Screen.module.css";

export function Results({ lessonId }: { lessonId: string }) {
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.results.title}</h1>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <button className={s.button} onClick={() => navigate(paths.lesson(lessonId))}>
          {strings.common.retry}
        </button>
        <button className={`${s.button} ${s.primary}`} onClick={() => navigate(paths.map())}>
          {strings.common.toMap}
        </button>
      </div>
    </main>
  );
}
