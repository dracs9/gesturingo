import { useEffect, useState } from "react";
import { ALPHABET } from "../data/alphabet";
import { getLetterSpec } from "../data/letters";
import { loadLetterModels, type LetterModels } from "../data/samples";
import { strings } from "../data/strings.ru";
import { availableWords, pickWord, WORDS } from "../data/words";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { progressSnapshot } from "../store/progress";
import { learnedLetters } from "../store/progressLogic";
import { useUi } from "../store/ui";
import { WordStep } from "./bridge/WordStep";
import s from "./Screen.module.css";

const hasSpec = (letter: string) => getLetterSpec(letter) !== undefined;

/** «Мост»: learned letters become words — text on screen and voice (CLAUDE.md §10.5). */
export function Bridge() {
  const setDockHidden = useUi((st) => st.setDockHidden);

  // Only back (open palm) here: letters must not trigger commands (CLAUDE.md §7.5).
  useGestureCommands({ back: () => navigate(paths.map()) });

  useEffect(() => {
    setDockHidden(true);
    return () => setDockHidden(false);
  }, [setDockHidden]);

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

  // Words and the warm-up are fixed when the screen opens; learning more letters happens in lessons.
  const [{ words, warmup }] = useState(() => {
    const learned = learnedLetters(progressSnapshot()).filter(hasSpec);
    return {
      words: availableWords(WORDS, new Set(learned), hasSpec),
      warmup: ALPHABET.filter((l) => learned.includes(l)).join(""),
    };
  });
  const [word, setWord] = useState(() => pickWord(words, null) ?? warmup);
  const [round, setRound] = useState(0);
  const [spelled, setSpelled] = useState(0);

  if (!word) {
    return (
      <main className={s.screen}>
        <h1 className={s.title}>{strings.bridge.title}</h1>
        <p className={s.text}>{strings.bridge.noLetters}</p>
        <p className={s.text}>✋ {strings.lesson.exitHint}</p>
      </main>
    );
  }

  const next = () => {
    setSpelled((n) => n + 1);
    setWord(pickWord(words, word) ?? warmup);
    setRound((r) => r + 1);
  };

  return (
    <main aria-label={strings.bridge.title}>
      <WordStep
        key={round}
        word={word}
        warmup={words.length === 0}
        header={`🌉 ${strings.bridge.title} · ${strings.bridge.wordsDone(spelled)}`}
        models={models}
        onDone={next}
      />
    </main>
  );
}
