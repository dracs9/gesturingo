import { useEffect } from "react";
import { playSound } from "../audio/sounds";
import { Confetti } from "../components/Confetti";
import { GestureButton } from "../components/GestureButton";
import { Stars } from "../components/Stars";
import { XpCounter } from "../components/XpCounter";
import { getNextLesson, LESSONS } from "../data/lessons";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useLessonRun } from "../store/lessonRun";
import { useProgress } from "../store/progress";
import { isLessonUnlocked } from "../store/progressLogic";
import { lessonTitle } from "./lesson/lessonTitle";
import r from "./results/Results.module.css";
import { summarizeLesson } from "./results/summary";
import s from "./Screen.module.css";

/** Good enough for confetti: at least two thirds of the stars. */
const CELEBRATE_ACCURACY = 67;

export function Results({ lessonId }: { lessonId: string }) {
  const t = strings.results;
  const result = useLessonRun((st) => st.lastResult);
  const progress = useProgress();
  const toMap = () => navigate(paths.map());
  // «Дальше» = the next lesson if the one just played opened it, otherwise back to the map.
  const next = getNextLesson(lessonId);
  const nextOpen = next !== undefined && isLessonUnlocked(progress, LESSONS, LESSONS.indexOf(next));
  const goNext = () => navigate(next && nextOpen ? paths.lesson(next.id) : paths.map());

  useGestureCommands({ ok: goNext, back: toMap });

  const valid = result !== null && result.lessonId === lessonId;
  useEffect(() => {
    if (valid) playSound("fanfare");
  }, [valid]);

  if (!result || !valid) {
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
      <Confetti burst={summary.accuracy >= CELEBRATE_ACCURACY ? 1 : 0} count={160} />
      <h1 className={s.title}>{lessonTitle(lessonId)}</h1>
      <p className={s.text}>{t.title}</p>
      <XpCounter value={progress.xp} from={progress.xp - summary.xp} />

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
              <Stars value={l.stars} className={r.stars} />
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
