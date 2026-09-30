import { useCallback, useEffect, useRef, useState } from "react";
import { playSound } from "../audio/sounds";
import { CameraView } from "../components/CameraView";
import { GestureButton } from "../components/GestureButton";
import { HintBanner } from "../components/HintBanner";
import { strings } from "../data/strings.ru";
import { createHintEngine } from "../recognition/errors/hintEngine";
import { PINCH_AIM_HINT_MS, TUTORIAL_DWELL_FALLBACK_MS } from "../recognition/thresholds";
import { navigate, paths } from "../router";
import { onControl } from "../store/controlStats";
import { GESTURE_ENTER } from "../store/gestureEvents";
import { useGestureCommands } from "../store/gestureCommands";
import { setHighlight } from "../store/highlight";
import { useProgress } from "../store/progress";
import { useUi } from "../store/ui";
import t from "./ControlTutorial.module.css";
import s from "./Screen.module.css";
import { nextStep, stepContext, stepErrors, TRAINING_STEPS, type TutorialStep } from "./tutorial/steps";

const SUCCESS_MS = 1100;
/** Step 1 circles, in % of the viewport: right, left, bottom — so the user reaches the edges (below the hint banner). */
const CURSOR_TARGETS = [
  { x: 78, y: 62 },
  { x: 22, y: 62 },
  { x: 50, y: 78 },
] as const;
const ICONS: Record<TutorialStep, string> = { cursor: "☝️", pinch: "🤏", thumbsUp: "👍", openPalm: "✋", done: "🎉" };

/** Circle that counts as reached when the hand cursor (or the mouse) enters it. */
function CursorTarget({ x, y, onReached }: { x: number; y: number; onReached: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onReachedRef = useRef(onReached);

  useEffect(() => {
    onReachedRef.current = onReached;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onReachedRef.current();
    el.addEventListener(GESTURE_ENTER, handler);
    return () => el.removeEventListener(GESTURE_ENTER, handler);
  }, []);

  return (
    <div
      ref={ref}
      className={t.target}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-gesture-target=""
      onMouseEnter={onReached}
      aria-hidden="true"
    />
  );
}

export function ControlTutorial() {
  const [step, setStep] = useState<TutorialStep>("cursor");
  const [celebrating, setCelebrating] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [hintCode, setHintCode] = useState<string | null>(null);
  const [dwellFallback, setDwellFallback] = useState(false);

  const setGestureOverride = useUi((st) => st.setGestureOverride);
  const setDockHidden = useUi((st) => st.setDockHidden);

  // Per-frame state read by the control listener without re-subscribing.
  const stepRef = useRef(step);
  const celebratingRef = useRef(celebrating);
  const stepStartRef = useRef(0);
  const offTargetUntilRef = useRef(0);

  useEffect(() => {
    stepRef.current = step;
    stepStartRef.current = performance.now();
    offTargetUntilRef.current = 0;
  }, [step]);

  useEffect(() => {
    celebratingRef.current = celebrating;
  }, [celebrating]);

  // Finishing or skipping the tutorial: next visits start from the lessons.
  const markTutorialDone = useProgress((st) => st.markTutorialDone);
  // Skip is for repeat runs (§10.2). On the first run it is touch/mouse only: on a phone the hand
  // near the camera easily rests on or pinches the corner button and skipped the whole tutorial.
  const [repeatRun] = useState(() => useProgress.getState().tutorialDone);
  const toMap = useCallback(() => {
    markTutorialDone();
    navigate(paths.map());
  }, [markTutorialDone]);
  const succeed = useCallback(() => {
    playSound("success");
    setCelebrating(true);
  }, []);

  useEffect(() => {
    if (step !== "done") return;
    markTutorialDone();
    playSound("fanfare");
  }, [step, markTutorialDone]);

  // Success → «Отлично!» → next step.
  useEffect(() => {
    if (!celebrating) return;
    const id = window.setTimeout(() => {
      setCelebrating(false);
      setTargetIndex(0);
      setDwellFallback(false);
      setStep((current) => nextStep(current));
    }, SUCCESS_MS);
    return () => window.clearTimeout(id);
  }, [celebrating]);

  // Pinch step: after a while, dwell becomes the fallback.
  useEffect(() => {
    if (step !== "pinch") return;
    const id = window.setTimeout(() => setDwellFallback(true), TUTORIAL_DWELL_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [step]);

  // Only the trained gesture is active; poses get a big camera view instead of the dock.
  useEffect(() => {
    setGestureOverride(stepContext(step, dwellFallback ? TUTORIAL_DWELL_FALLBACK_MS : 0));
    setDockHidden(step === "thumbsUp" || step === "openPalm");
  }, [step, dwellFallback, setGestureOverride, setDockHidden]);

  useEffect(
    () => () => {
      setGestureOverride(null);
      setDockHidden(false);
    },
    [setGestureOverride, setDockHidden],
  );

  useGestureCommands({
    ok: step === "thumbsUp" && !celebrating ? succeed : step === "done" ? toMap : undefined,
    back: step === "openPalm" && !celebrating ? succeed : undefined,
  });

  // Error mode: every frame → step errors → hint engine → re-render only when the hint changes.
  useEffect(() => {
    const engine = createHintEngine();
    let engineStep: TutorialStep | null = null;
    let shown: string | null = null;

    const unsubscribe = onControl((out, observation) => {
      const now = performance.now();
      const current = stepRef.current;
      if (engineStep !== current || celebratingRef.current) {
        engine.reset();
        engineStep = current;
      }

      const click = out.click;
      if (current === "pinch" && click?.source === "pinch" && click.target?.dataset.tutorialTarget === undefined) {
        offTargetUntilRef.current = now + PINCH_AIM_HINT_MS;
      }

      const errors = celebratingRef.current
        ? []
        : stepErrors(current, {
            observation,
            pinchRatio: out.debug.pinchRatio,
            wristSpeed: out.debug.wristSpeed,
            elapsedMs: now - stepStartRef.current,
            now,
            offTargetUntil: offTargetUntilRef.current,
          });
      const hint = engine.update(errors, now);
      setHighlight(hint?.landmarkIds);
      const code = hint?.hintCode ?? null;
      if (code !== shown) {
        shown = code;
        setHintCode(code);
      }
    });

    return () => {
      unsubscribe();
      setHighlight(null);
    };
  }, []);

  const stepIndex = TRAINING_STEPS.indexOf(step as (typeof TRAINING_STEPS)[number]);
  const hintText = hintCode ? (strings.hints[hintCode] ?? null) : null;
  const target = CURSOR_TARGETS[targetIndex];

  const reachTarget = () => {
    if (celebratingRef.current) return;
    if (targetIndex + 1 >= CURSOR_TARGETS.length) succeed();
    else setTargetIndex((i) => i + 1);
  };

  if (step === "done") {
    return (
      <main className={s.screen}>
        <span className={`${t.icon} ${t.iconDone}`} aria-hidden="true">
          {ICONS.done}
        </span>
        <h1 className={s.title}>{strings.tutorial.done}</h1>
        <p className={s.text}>{strings.tutorial.doneText}</p>
        <div className={s.actions}>
          <GestureButton variant="primary" onClick={toMap}>
            {strings.tutorial.toLessons}
          </GestureButton>
        </div>
      </main>
    );
  }

  return (
    <main className={t.layout}>
      <GestureButton className={t.skip} onClick={toMap} noGesture={!repeatRun}>
        {strings.common.skip}
      </GestureButton>

      <header className={t.header}>
        <p className={t.progress}>
          {TRAINING_STEPS.map((st, i) => (
            <span key={st} className={i <= stepIndex ? `${t.dot} ${t.dotOn}` : t.dot} aria-hidden="true" />
          ))}
          <span>{strings.tutorial.stepOf(stepIndex + 1, TRAINING_STEPS.length)}</span>
        </p>
        <span className={`${t.icon} ${t[`icon_${step}`] ?? ""}`} aria-hidden="true">
          {ICONS[step]}
        </span>
        <h1 className={t.instruction}>{strings.tutorial.steps[stepIndex]}</h1>
        {step === "cursor" && (
          <p className={t.sub}>{strings.tutorial.targetsLeft(CURSOR_TARGETS.length - targetIndex)}</p>
        )}
      </header>

      <HintBanner text={celebrating ? null : hintText} />

      <section className={t.stage}>
        {celebrating && (
          <p className={t.success} role="status">
            <span aria-hidden="true">✓</span> {strings.tutorial.success}
          </p>
        )}

        {!celebrating && step === "cursor" && target && (
          <CursorTarget key={targetIndex} x={target.x} y={target.y} onReached={reachTarget} />
        )}

        {!celebrating && step === "pinch" && (
          <GestureButton variant="primary" className={t.pinchTarget} data-tutorial-target="" onClick={succeed}>
            {strings.tutorial.press}
          </GestureButton>
        )}

        {(step === "thumbsUp" || step === "openPalm") && (
          <div className={t.camera}>
            <CameraView variant="large" />
          </div>
        )}
      </section>
    </main>
  );
}
