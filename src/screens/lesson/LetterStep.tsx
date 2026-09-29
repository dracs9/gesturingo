import { useEffect, useRef, useState } from "react";
import { CameraView } from "../../components/CameraView";
import { GestureButton } from "../../components/GestureButton";
import { HintBanner } from "../../components/HintBanner";
import { HoldRing } from "../../components/HoldRing";
import { SkeletonPreview } from "../../components/SkeletonPreview";
import { getReference } from "../../data/references";
import { strings } from "../../data/strings.ru";
import { createLetterPractice, starsForHints, type HintLogEntry } from "../../recognition/letters/practice";
import type { LetterSpec } from "../../recognition/letters/spec";
import { onFrame } from "../../recognition/pipeline";
import { setHighlight } from "../../store/highlight";
import type { LetterResult } from "../../store/lessonRun";
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
  onDone(result: LetterResult, hintLog: readonly HintLogEntry[]): void;
}

/** One letter of a lesson: camera + skeleton on the left, letter card with hold ring, checklist and hint. */
export function LetterStep({ spec, index, total, onDone }: LetterStepProps) {
  const [practice] = useState(() => createLetterPractice(spec));
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [checks, setChecks] = useState({ frameOk: false, failing: [] as string[] });
  const [stars, setStars] = useState<1 | 2 | 3 | null>(null);
  const [canSkip, setCanSkip] = useState(false);
  const ringRef = useRef<HTMLDivElement>(null);
  const startRef = useRef(0);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // Per frame: rules → hint engine → hold ring. React state changes only on events.
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

      const code = u.hint?.hintCode ?? null;
      if (code !== shownHint) {
        shownHint = code;
        setHintCode(code);
      }
      const key = `${u.frameOk}|${u.failing.join(",")}`;
      if (key !== checksKey) {
        checksKey = key;
        setChecks({ frameOk: u.frameOk, failing: u.failing });
      }
      if (u.accepted) {
        finished = true;
        setHighlight(null);
        setHintCode(null);
        setStars(starsForHints(practice.hintLog.length));
      }
    });

    const skipTimer = window.setTimeout(() => setCanSkip(true), SKIP_OFFER_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(skipTimer);
      setHighlight(null);
    };
  }, [practice]);

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

  const reference = getReference(spec.letter);
  const hintText = hintCode ? (strings.hints[hintCode] ?? null) : null;
  const t = strings.lesson;

  return (
    <div className={l.layout}>
      <section className={l.camera}>
        <CameraView variant="large" />
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
      </section>

      <section className={l.card}>
        <p className={l.counter}>{t.letterOf(index + 1, total)}</p>
        <HoldRing ref={ringRef} size={168} className={l.ring}>
          <span className={l.letter}>{spec.letter}</span>
        </HoldRing>
        <h1 className={l.show}>{t.show(spec.letter)}</h1>
        <p className={l.sub}>{t.hold}</p>

        <HintBanner text={stars === null ? hintText : null} />

        <div className={l.howTo}>
          <h2>{t.howTo}</h2>
          {reference && <SkeletonPreview frame={reference.frame} className={l.reference} />}
          <ul className={l.rules}>
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
          {!spec.verified && <p className={l.unverified}>⚠️ {t.unverified}</p>}
        </div>

        <p className={l.exit}>✋ {t.exitHint}</p>
        {canSkip && stars === null && (
          <GestureButton noGesture onClick={skip}>
            {t.skipLetter}
          </GestureButton>
        )}
      </section>
    </div>
  );
}
