import { GestureButton } from "../components/GestureButton";
import { getNextLesson, lessonNumber } from "../data/lessons";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useLessonRun } from "../store/lessonRun";
import r from "./results/Results.module.css";
import { summarizeLesson } from "./results/summary";
import s from "./Screen.module.css";

export function Results({ lessonId }: { lessonId: string }) {
  const t = strings.results;
  const result = useLessonRun((st) => st.lastResult);
  const toMap = () => navigate(paths.map());
  const next = getNextLesson(lessonId);
  const goNext = () => navigate(next ? paths.lesson(next.id) : paths.map());

  useGestureCommands({ ok: goNext, back: toMap });

  if (!result || result.lessonId !== lessonId) {
    return (
      <main className={s.screen}>
        <h1 className={s.title}>{t.title}</h1>
        <p className={s.text}>{t.noResult}</p>
        <div className={s.actions}>
          <GestureButton variant="primary" onClick={toMap}>
            {strings.common.toMap}
          </GestureButton>
        </div>
      </main>
    );
  }

  const summary = summarizeLesson(result);
  const skippedAny = result.letters.some((l) => l.stars === 0);

  return (
    <main className={s.screen}>
      <h1 className={s.title}>
        {t.title} · {strings.lesson.title(lessonNumber(lessonId))}
      </h1>

      <dl className={r.stats}>
        <div>
          <dt>{t.stars}</dt>
          <dd>
            ★ {summary.stars}/{summary.maxStars}
          </dd>
        </div>
        <div>
          <dt>{t.accuracy}</dt>
          <dd>{summary.accuracy}%</dd>
        </div>
        <div>
          <dt>{t.hints}</dt>
          <dd>{summary.hints}</dd>
        </div>
        <div>
          <dt>{t.xp}</dt>
          <dd>+{summary.xp}</dd>
        </div>
      </dl>

      <section className={r.panel}>
        <h2>{t.letters}</h2>
        <ul className={r.letters}>
          {result.letters.map((l) => (
            <li key={l.letter}>
              <span className={r.letter}>{l.letter}</span>
              <span className={r.stars} aria-label={strings.lesson.starsLabel(l.stars)}>
                {"★".repeat(l.stars)}
                <span className={r.starsOff}>{"★".repeat(3 - l.stars)}</span>
              </span>
              {l.stars === 0 && <span className={r.muted}>{t.skipped}</span>}
            </li>
          ))}
        </ul>
      </section>

      {summary.topErrors.length > 0 ? (
        <section className={r.panel}>
          <h2>{t.topErrors}</h2>
          <ol className={r.errors}>
            {summary.topErrors.map((e) => (
              <li key={e.hintCode}>
                {strings.hints[e.hintCode] ?? e.hintCode} <span className={r.muted}>{t.timesShown(e.count)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        !skippedAny && <p className={s.text}>{t.noErrors}</p>
      )}

      <div className={s.actions}>
        <GestureButton variant="primary" onClick={goNext}>
          {t.next}
        </GestureButton>
        <GestureButton onClick={() => navigate(paths.lesson(lessonId))}>{strings.common.retry}</GestureButton>
        <GestureButton onClick={toMap}>{strings.common.toMap}</GestureButton>
      </div>
    </main>
  );
}
