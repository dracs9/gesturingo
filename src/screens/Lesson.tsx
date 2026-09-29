import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import s from "./Screen.module.css";

export function Lesson({ lessonId }: { lessonId: string }) {
  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.lesson.title(lessonId)}</h1>
      <p className={s.text}>{strings.lesson.exitHint}</p>
      <p className={s.placeholder}>{strings.common.wip}</p>
      <div className={s.actions}>
        <button className={s.button} onClick={() => navigate(paths.map())}>
          {strings.common.back}
        </button>
        <button className={`${s.button} ${s.primary}`} onClick={() => navigate(paths.results(lessonId))}>
          {strings.lesson.finish}
        </button>
      </div>
    </main>
  );
}
