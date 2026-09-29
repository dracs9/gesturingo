import { useEffect, useRef, useState } from "react";
import { playSound } from "../../audio/sounds";
import { CameraView } from "../../components/CameraView";
import { Confetti } from "../../components/Confetti";
import { HintBanner } from "../../components/HintBanner";
import { HoldRing } from "../../components/HoldRing";
import { hintText } from "../../data/hintText";
import { getLetterSpec } from "../../data/letters";
import { getReference } from "../../data/references";
import type { LetterModels } from "../../data/samples";
import { strings } from "../../data/strings.ru";
import { createWordSpeller } from "../../recognition/letters/speller";
import { onFrame } from "../../recognition/pipeline";
import { setHighlight } from "../../store/highlight";
import { clearLetterStats, setLetterStats } from "../../store/letterStats";
import { speak, speakableWord, type SpeakResult } from "../../tts/speech";
import b from "./Bridge.module.css";

/** Pause on the finished word (speech + animation) before the next one. */
const NEXT_WORD_MS = 4500;

interface WordStepProps {
  word: string;
  /** Warm-up sequence of letters (not a real word): shown, but not spoken. */
  warmup: boolean;
  /** Small status line above the word (e.g. words spelled so far). */
  header: string;
  models: LetterModels | null;
  onDone(): void;
}

/** Spelling one word: camera + ghost on the left, word tiles + current letter + hint on the right. */
export function WordStep({ word, warmup, header, models, onDone }: WordStepProps) {
  const [speller] = useState(() => createWordSpeller(word, getLetterSpec));
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [speech, setSpeech] = useState<SpeakResult | "speaking" | null>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    speller.setKnn(models?.knn ?? null);
  }, [speller, models]);

  // Per frame: expected letter → rules + kNN → hint / hold ring. React state only on events.
  useEffect(() => {
    let shownHint: string | null = null;
    let finished = false;
    const unsubscribe = onFrame((observation) => {
      if (finished) return;
      const u = speller.update(observation, performance.now());
      ringRef.current?.style.setProperty("--progress", u.holdProgress.toFixed(3));
      setHighlight(u.hint?.landmarkIds);
      const current = speller.letters[u.index];
      if (current) setLetterStats(current, u.decision);

      const text = hintText(u.hint);
      if (text !== shownHint) {
        shownHint = text;
        setHint(text);
      }
      if (u.accepted) {
        playSound("success");
        setIndex(u.index);
      }
      if (u.done) {
        finished = true;
        setHighlight(null);
        setHint(null);
        setDone(true);
        if (!warmup) setSpeech("speaking");
      }
    });
    return () => {
      unsubscribe();
      setHighlight(null);
      clearLetterStats();
    };
  }, [speller, warmup]);

  // Word finished: say it aloud (text-only fallback), then move on.
  useEffect(() => {
    if (!done) return;
    let cancelled = false;
    if (!warmup) {
      void speak(speakableWord(word)).then((result) => {
        if (!cancelled) setSpeech(result);
      });
    }
    const id = window.setTimeout(() => onDoneRef.current(), NEXT_WORD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [done, warmup, word]);

  const letters = speller.letters;
  const current = letters[index];
  const ghost = current ? (getReference(current)?.frame ?? models?.medoids.get(current) ?? null) : null;
  const t = strings.bridge;

  const speechNote =
    speech === "speaking"
      ? t.speaking
      : speech === "spoken"
        ? t.spoken
        : speech === "unavailable"
          ? t.noVoice
          : speech === "muted"
            ? t.muted
            : null;

  return (
    <div className={b.layout}>
      <section className={b.camera}>
        <CameraView variant="large" ghost={done ? null : ghost} />
        {ghost && !done && <p className={b.note}>{strings.ghost.legend}</p>}
        <Confetti burst={done ? 1 : 0} originX={0.5} originY={0.35} count={160} />
      </section>

      <section className={b.card}>
        <p className={b.header}>{header}</p>
        <h1 className={b.title}>{warmup ? t.warmup : t.write(word)}</h1>
        {warmup && <p className={b.note}>{t.warmupNote}</p>}

        <ol className={done ? `${b.word} ${b.wordDone}` : b.word} aria-label={word}>
          {letters.map((letter, i) => (
            <li
              key={i}
              className={i < index || done ? `${b.tile} ${b.tileDone}` : i === index ? `${b.tile} ${b.tileNow}` : b.tile}
            >
              {letter}
            </li>
          ))}
        </ol>

        {done ? (
          <div className={b.result} role="status">
            <p className={b.resultTitle}>
              <span aria-hidden="true">✓</span> {t.done}
            </p>
            {!warmup && <p className={b.spoken}>{speakableWord(word)}</p>}
            {speechNote && <p className={b.note}>{speechNote}</p>}
            <p className={b.note}>{t.next}</p>
          </div>
        ) : (
          current && (
            <>
              <p className={b.counter}>{t.letterOf(index + 1, letters.length)}</p>
              <HoldRing ref={ringRef} className={b.ring}>
                <span className={b.letter}>{current}</span>
              </HoldRing>
              <p className={b.show}>{t.showLetter(current)}</p>
              <HintBanner text={hint} />
            </>
          )
        )}

        <p className={b.note}>✋ {strings.lesson.exitHint}</p>
      </section>
    </div>
  );
}
