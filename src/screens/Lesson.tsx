import { useEffect, useRef, useState } from "react";
import { getLesson, lessonNumber } from "../data/lessons";
import { getLetterSpec } from "../data/letters";
import { strings } from "../data/strings.ru";
import type { HintLogEntry } from "../recognition/letters/practice";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useLessonRun, type LetterResult } from "../store/lessonRun";
import { useUi } from "../store/ui";
import { LetterStep } from "./lesson/LetterStep";
import s from "./Screen.module.css";

export function Lesson({ lessonId }: { lessonId: string }) {
  const lesson = getLesson(lessonId);
  const specs = (lesson?.letters ?? []).flatMap((letter) => getLetterSpec(letter) ?? []);
  const [index, setIndex] = useState(0);
  const results = useRef<LetterResult[]>([]);
  const hintLog = useRef<HintLogEntry[]>([]);
  const setLastResult = useLessonRun((st) => st.setLastResult);
  const setDockHidden = useUi((st) => st.setDockHidden);

  // Exit is the open palm (the cursor is off in lessons, CLAUDE.md §7.5).
  useGestureCommands({ back: () => navigate(paths.map()) });

  useEffect(() => {
    setDockHidden(true);
    return () => setDockHidden(false);
  }, [setDockHidden]);

  const spec = specs[index];
  if (!lesson || !spec) {
    return (
      <main className={s.screen}>
        <h1 className={s.title}>{strings.lesson.notFound}</h1>
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
    setLastResult({ lessonId, letters: results.current, hintLog: hintLog.current });
    navigate(paths.results(lessonId));
  };

  return (
    <main aria-label={strings.lesson.title(lessonNumber(lessonId))}>
      <LetterStep key={index} spec={spec} index={index} total={specs.length} onDone={onDone} />
    </main>
  );
}
