import { useEffect, useRef, useState } from "react";
import { playSound } from "../../audio/sounds";
import { CameraView } from "../../components/CameraView";
import { Confetti } from "../../components/Confetti";
import { GestureButton } from "../../components/GestureButton";
import { HintBanner } from "../../components/HintBanner";
import { HoldRing } from "../../components/HoldRing";
import { hintText } from "../../data/hintText";
import { getLetterPhoto } from "../../data/letterPhotos";
import type { LetterModels } from "../../data/samples";
import { strings } from "../../data/strings.ru";
import { createLetterPractice, starsForHints, type HintLogEntry } from "../../recognition/letters/practice";
import type { LetterSpec } from "../../recognition/letters/spec";
import { onFrame } from "../../recognition/pipeline";
import { setHighlight } from "../../store/highlight";
import type { LetterResult } from "../../store/lessonRun";
import { clearLetterStats, setLetterStats } from "../../store/letterStats";
import l from "./Lesson.module.css";

const SUCCESS_MS = 1300;
/** A letter that won't come out can be skipped with the mouse after this long (the hand exits with the palm). */
const SKIP_OFFER_MS = 20_000;

interface Rule {
  code: string;
  label: string;
}

/** The letter's conditions as a readable checklist, keyed like `checkLetter` error codes. */
function rulesOf(spec: LetterSpec): Rule[] {
  const t = strings.lesson;
  const rules: Rule[] = [];
  for (const [finger, rule] of Object.entries(spec.fingers)) {
    const f = finger as keyof typeof strings.fingers;
    rules.push({ code: `finger.${f}.state`, label: t.fingerRule(strings.fingers[f], strings.fingerStates[rule.state]) });
  }
  for (const extra of spec.extra ?? []) {
    switch (extra.type) {
      case "palmFacing":
        rules.push({ code: "palmFacing", label: t.palmRule(strings.palmFacing[extra.value]) });
        break;
      case "thumbPosition":
        rules.push({ code: "thumbPosition", label: t.thumbRule(strings.thumbPosition[extra.value]) });
        break;
      case "tipsTouch":
      case "tipsApart": {
        const label = extra.type === "tipsTouch" ? t.tipsTouchRule : t.tipsApartRule;
        rules.push({
          code: `${extra.type}.${extra.a}-${extra.b}`,
          label: label(strings.fingers[extra.a].toLowerCase(), strings.fingers[extra.b].toLowerCase()),
        });
        break;
      }
    }
  }
  return rules;
}

interface LetterStepProps {
  spec: LetterSpec;
  index: number;
  total: number;
  /** kNN + sample medoids; null while loading (the rules work alone meanwhile). */
  models: LetterModels | null;
  onDone(result: LetterResult, hintLog: readonly HintLogEntry[]): void;
}

/** One letter of a lesson: camera on the left, letter card with the chart drawing, hold ring, hint and checklist. */
export function LetterStep({ spec, index, total, models, onDone }: LetterStepProps) {
  const [practice] = useState(() => createLetterPractice(spec));
  const [hint, setHint] = useState<string | null>(null);
  const [checks, setChecks] = useState({ frameOk: false, failing: [] as string[] });
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    practice.setKnn(models?.knn ?? null);
  }, [practice, models]);

  // Per frame: rules + kNN → hint engine → hold ring. React state changes only on events.
  useEffect(() => {
    startRef.current = performance.now();
    let shownHint: string | null = null;
    let checksKey = "";
    let finished = false;

    const unsubscribe = onFrame((observation) => {
      if (finished) return;
      const u = practice.update(observation, performance.now());
      ringRef.current?.style.setProperty("--progress", u.holdProgress.toFixed(3));
      setHighlight(u.hint?.landmarkIds);
      setLetterStats(spec.letter, u.decision);

      const text = hintText(u.hint);
      if (text !== shownHint) {
        // A soft tone for a new letter hint (not for «подойди ближе» and the like).
        if (text && u.hint?.level !== "frame") playSound("hint");
        shownHint = text;
        setHint(text);
      }
      const key = `${u.frameOk}|${u.failing.join(",")}`;
      if (key !== checksKey) {
        checksKey = key;
        setChecks({ frameOk: u.frameOk, failing: u.failing });
      }
      if (u.accepted) {
        finished = true;
        playSound("success");
        setHighlight(null);
        setHint(null);
        setStars(starsForHints(practice.hintLog.length));
      }
    });

    const skipTimer = window.setTimeout(() => setCanSkip(true), SKIP_OFFER_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(skipTimer);
      setHighlight(null);
      clearLetterStats();
    };
  }, [practice, spec.letter]);

  // Letter accepted: celebrate, then report to the lesson.
  useEffect(() => {
    if (stars === null) return;
    const id = window.setTimeout(() => {
      onDoneRef.current(
        { letter: spec.letter, stars, hints: practice.hintLog.length, timeMs: performance.now() - startRef.current },
        practice.hintLog,
      );
    }, SUCCESS_MS);
    return () => window.clearTimeout(id);
  }, [stars, spec.letter, practice]);

  const skip = () =>
    onDone(
      { letter: spec.letter, stars: 0, hints: practice.hintLog.length, timeMs: performance.now() - startRef.current },
      practice.hintLog,
    );

  const photo = getLetterPhoto(spec.letter);
  const t = strings.lesson;

  // Everything fits one screen (no scrolling): the camera and the drawing shrink with the window height.
  return (
    <div className={l.layout}>
      <section className={l.camera}>
        <CameraView variant="large" className={l.cameraView}>
          {stars !== null && (
            <div className={l.success} role="status">
              <span className={l.successTitle}>
                <span aria-hidden="true">✓</span> {t.done}
              </span>
              <span className={l.stars} aria-label={t.starsLabel(stars)}>
                {"★".repeat(stars)}
                <span className={l.starsOff}>{"★".repeat(3 - stars)}</span>
              </span>
            </div>
          )}
        </CameraView>
        <Confetti burst={stars ?? 0} originX={0.3} count={stars === 3 ? 140 : 70} />
      </section>

      <section className={l.card}>
        <header className={l.top}>
          <p className={l.counter}>{t.letterOf(index + 1, total)}</p>
          <ol className={l.dots} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className={i < index ? l.dotDone : i === index ? l.dotNow : undefined} />
            ))}
          </ol>
        </header>

        <div className={l.sample}>
          <HoldRing ref={ringRef} className={l.ring}>
            <span className={l.letter}>{spec.letter}</span>
          </HoldRing>
          {photo && (
            <figure className={l.photo}>
              <img src={photo} alt={t.photoAlt(spec.letter)} />
            </figure>
          )}
        </div>

        <div className={l.task}>
          <h1 className={l.show}>{t.show(spec.letter)}</h1>
          <p className={l.sub}>{t.hold}</p>
        </div>

        <HintBanner className={l.hint} text={stars === null ? hint : null} />

        <ul className={l.rules} aria-label={t.howTo}>
          {rulesOf(spec).map((rule) => {
            const state = !checks.frameOk ? "unknown" : checks.failing.includes(rule.code) ? "fail" : "ok";
            const mark = state === "ok" ? "✓" : state === "fail" ? "✗" : "○";
            const label = state === "ok" ? t.ruleOk : state === "fail" ? t.ruleFail : t.ruleUnknown;
            return (
              <li key={rule.code} className={l[`rule_${state}`]}>
                <span className={l.mark} aria-hidden="true">
                  {mark}
                </span>
                {rule.label}
                <span className={l.srOnly}> — {label}</span>
              </li>
            );
          })}
        </ul>

        <footer className={l.footer}>
          <p className={l.exit}>
            <span aria-hidden="true">✋</span> {t.exitHint}
          </p>
          {canSkip && stars === null && (
            <GestureButton noGesture className={l.skip} onClick={skip}>
              {t.skipLetter}
            </GestureButton>
          )}
        </footer>
        {!spec.verified && <p className={l.unverified}>{t.unverified}</p>}
      </section>
    </div>
  );
}
