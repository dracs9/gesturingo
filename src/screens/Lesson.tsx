import { useEffect, useRef, useState } from "react";
import { getLesson } from "../data/lessons";
import { getLetterSpec } from "../data/letters";
import { loadLetterModels, type LetterModels } from "../data/samples";
import { strings } from "../data/strings.ru";
import type { HintLogEntry } from "../recognition/letters/practice";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useLessonRun, type LetterResult } from "../store/lessonRun";
import { progressSnapshot, useProgress } from "../store/progress";
import { REVIEW_LESSON_ID, weakLetters } from "../store/progressLogic";
import { useUi } from "../store/ui";
import { practiceLetters } from "../talk/summary";
import { lessonTitle } from "./lesson/lessonTitle";
import { LetterStep } from "./lesson/LetterStep";
import s from "./Screen.module.css";

/**
 * Letters of a lesson; the review lesson takes the weakest letters at the moment it opens, a practice
 * lesson (from the talk summary) the letters named in its id.
 */
function lessonLetters(lessonId: string): readonly string[] {
  if (lessonId === REVIEW_LESSON_ID) return weakLetters(progressSnapshot());
  const practice = practiceLetters(lessonId);
  if (practice) return practice.filter((l) => getLetterSpec(l) !== undefined);
  return getLesson(lessonId)?.letters ?? [];
}

export function Lesson({ lessonId }: { lessonId: string }) {
  const [letters] = useState(() => lessonLetters(lessonId));
  const specs = letters.flatMap((letter) => getLetterSpec(letter) ?? []);
  const [index, setIndex] = useState(0);
  const results = useRef<LetterResult[]>([]);
  const hintLog = useRef<HintLogEntry[]>([]);
  const setLastResult = useLessonRun((st) => st.setLastResult);
  const recordLesson = useProgress((st) => st.recordLesson);
  const setDockHidden = useUi((st) => st.setDockHidden);

  // Exit is the open palm (the cursor is off in lessons, CLAUDE.md §7.5).
  useGestureCommands({ back: () => navigate(paths.map()) });

  useEffect(() => {
    setDockHidden(true);
    return () => setDockHidden(false);
  }, [setDockHidden]);

  // kNN samples load in the background; the rules work alone until they arrive.
  const [models, setModels] = useState<LetterModels | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadLetterModels().then((m) => {
      if (!cancelled) setModels(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const spec = specs[index];
  if (!spec) {
    const empty = lessonId === REVIEW_LESSON_ID ? strings.review.empty : strings.lesson.notFound;
    return (
      <main className={s.screen}>
        <h1 className={s.title}>{empty}</h1>
        <p className={s.text}>{strings.lesson.exitHint}</p>
      </main>
    );
  }

  const onDone = (result: LetterResult, log: readonly HintLogEntry[]) => {
    results.current.push(result);
    hintLog.current.push(...log);
    if (index + 1 < specs.length) {
      setIndex(index + 1);
      return;
    }
    const lessonResult = { lessonId, letters: results.current, hintLog: hintLog.current };
    recordLesson(lessonResult);
    setLastResult(lessonResult);
    navigate(paths.results(lessonId));
  };

  return (
    <main aria-label={lessonTitle(lessonId)}>
      <LetterStep key={index} spec={spec} index={index} total={specs.length} models={models} onDone={onDone} />
    </main>
  );
}
