import { useEffect, useMemo, useRef, useState } from "react";
import { playSound } from "../audio/sounds";
import { CalibrationOverlay } from "../components/CalibrationOverlay";
import { CameraView } from "../components/CameraView";
import { CandidateCard, type ReadingView } from "../components/CandidateCard";
import { CommandZones, type ZoneLabel } from "../components/CommandZones";
import { ComposerBar } from "../components/ComposerBar";
import { ConversationFeed } from "../components/ConversationFeed";
import { CorrectionArrow } from "../components/CorrectionArrow";
import { GhostPath } from "../components/GhostPath";
import { HintBanner } from "../components/HintBanner";
import { HoldRing } from "../components/HoldRing";
import { ListenerPanel } from "../components/ListenerPanel";
import { paintCorrection } from "../components/paintCorrection";
import { paintZones } from "../components/paintZones";
import { SubtitleOverlay } from "../components/SubtitleOverlay";
import { SuggestionBar } from "../components/SuggestionBar";
import { TalkLegend } from "../components/TalkLegend";
import { TargetZone } from "../components/TargetZone";
import { hintText } from "../data/hintText";
import { getLetterSpec, LETTERS } from "../data/letters";
import { DYNAMIC_PHRASES, getPhraseByLabel, isPhraseLabel, labelText, PHRASE_HANDSHAPES } from "../data/phrases";
import { loadDynamicTemplates, loadTalkModels } from "../data/samples";
import { strings } from "../data/strings.ru";
import { createCalibrator, palmCenter, type Calibrator } from "../recognition/control/calibration";
import { createCommandZones } from "../recognition/control/commandZones";
import { frameErrors, palmSize } from "../recognition/errors/frameChecks";
import { hintVisual, positionErrors } from "../recognition/errors/translatorHints";
import { LM } from "../recognition/landmarks";
import { PHRASE_PREFIX } from "../recognition/phrases/spec";
import { FRAME_DIM, writeFrameFeatures } from "../recognition/sequence/frameFeatures";
import { createPhraseMatcher, type DynamicMatch, type PhraseMatcher } from "../recognition/sequence/phraseMatcher";
import { createSequenceTracker, type MotionSegment } from "../recognition/sequence/sequenceBuffer";
import { isOpenPalm } from "../recognition/control/poses";
import { createOpenReader, type Ambiguity, type ReaderUpdate } from "../recognition/open/openReader";
import { onFrame } from "../recognition/pipeline";
import {
  POSE_GRACE_MS,
  POSE_MAX_SPEED,
  TALK_DYNAMIC_HINT_MS,
  TALK_CANCEL_PALM_MS,
  TALK_EXIT_PALM_MS,
  TALK_LETTER_HOLD_MS,
  TALK_PHRASE_HOLD_MS,
} from "../recognition/thresholds";
import { navigate, paths } from "../router";
import { useCalibration } from "../store/calibration";
import { setHighlight, setSkeletonTone } from "../store/highlight";
import { clearTalkStats, setMotionStats, setTalkStats } from "../store/talkStats";
import type { ZoneId } from "../recognition/control/commandZones";
import { useUi } from "../store/ui";
import { createAutocomplete, type Autocomplete } from "../talk/autocomplete";
import { createComposer, createConfirmation, type Candidate } from "../talk/composer";
import { useConversation } from "../talk/conversationStore";
import { useListener } from "../talk/useListener";
import { speak, warmVoices } from "../tts/speech";
import t from "./Talk.module.css";

/** How long «Отменено» stays under the card. */
const CANCELLED_NOTE_MS = 2500;

/** Everything the camera reads in talk mode: static letters and static phrase gestures (T4). */
const TALK_SPECS = [...LETTERS, ...PHRASE_HANDSHAPES];
const getTalkSpec = (label: string) => getLetterSpec(label) ?? getPhraseByLabel(label)?.handshape;
const holdMsFor = (label: string) => (isPhraseLabel(label) ? TALK_PHRASE_HOLD_MS : TALK_LETTER_HOLD_MS);

const EMPTY_READING: ReadingView = { state: "noHand", label: null, hint: null, ambiguity: null, visual: null };

/** Raw camera point → percent of the mirrored video as the user sees it. */
const toDisplay = (p: { x: number; y: number }) => ({ x: (1 - p.x) * 100, y: p.y * 100 });

/** Dynamic phrases in the app (their templates load lazily). */
const DYNAMIC_LABELS = new Set(DYNAMIC_PHRASES.map((p) => `${PHRASE_PREFIX}${p.id}`));

/** Wrist speed smoothing for the open-palm commands (as in the control layer): a waving hand is no command. */
const WRIST_SPEED_EMA = 0.3;

interface DynamicHint {
  text: string;
  /** Template path in display percent, from where the user's motion started. */
  ghost: { x: number; y: number }[];
  at: number;
}

/** Where the template says the hand should have gone, drawn from the start of the user's motion. */
function ghostPoints(segment: MotionSegment, ghost: readonly { x: number; y: number }[], aspect: number) {
  const first = segment.frames[0];
  if (!first || aspect <= 0) return [];
  const wx = first[10] ?? 0;
  const wy = first[11] ?? 0;
  const palm = first[12] ?? 0;
  return ghost.map((g) => toDisplay({ x: (wx + g.x * palm) / aspect, y: wy + g.y * palm }));
}

function dynamicHintText(result: Extract<DynamicMatch, { kind: "almost" }>): string {
  return strings.talk.dynamic[result.reason](labelText(result.label));
}

function readingView(u: ReaderUpdate): ReadingView {
  const amb = u.ambiguity;
  return {
    state: u.state,
    label: u.label && labelText(u.label),
    // The «А или Б?» card already explains the difference: no second banner.
    hint: amb ? null : hintText(u.hint),
    ambiguity: amb ? { a: labelText(amb.labels[0]), b: labelText(amb.labels[1]), advice: hintText(amb.hint) } : null,
    visual: amb ? null : hintVisual(u.hint?.hintCode),
  };
}

/**
 * «Разговор» (docs/TRANSLATOR_SPEC.md): fingerspelling without a target → words → a phrase that is
 * spoken only after a confirmation ring (T1). Unsure readings never type or speak: they show
 * "almost" / «А или Б?» with a concrete hint. Commands are zones at the top of the frame.
 * The hearing person answers by voice (or typing): subtitles over the video + the feed (T2).
 * Up to 3 dictionary words complete the typed prefix; the «Пробел» zone inserts the first one (T3).
 * A static phrase gesture from Slovo («Я», «Что»…) adds its word and goes straight to confirmation (T4).
 * First an open palm at chest level calibrates the signing place: hints then say «чуть выше» with an
 * arrow to a dashed target zone, and a palm-orientation hint gets a rotation arrow (T5).
 */
export function Talk() {
  const setDockHidden = useUi((st) => st.setDockHidden);
  const addMessage = useConversation((st) => st.addMessage);
  const setSpeech = useConversation((st) => st.setSpeech);
  const logHints = useConversation((st) => st.logHints);

  const [reader] = useState(() => createOpenReader({ specs: TALK_SPECS, getSpec: getTalkSpec, holdMsFor }));
  const [composer] = useState(createComposer);
  const [confirmation] = useState(() => createConfirmation());
  const [zones] = useState(() => createCommandZones());
  const listener = useListener();
  const phase = useCalibration((st) => st.phase);
  const calibration = useCalibration((st) => st.calibration);
  const finishCalibration = useCalibration((st) => st.finish);
  const skipCalibration = useCalibration((st) => st.skip);
  const restartCalibration = useCalibration((st) => st.restart);
  // The frame loop reads the calibration without re-subscribing.
  const calRef = useRef({ phase, calibration });
  useEffect(() => {
    calRef.current = { phase, calibration };
  }, [phase, calibration]);

  const [draft, setDraft] = useState<{ words: readonly string[]; current: string }>({ words: [], current: "" });
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [reading, setReading] = useState<ReadingView>(EMPTY_READING);
  const [cancelledAt, setCancelledAt] = useState<number | null>(null);
  const [autocomplete, setAutocomplete] = useState<Autocomplete | null>(null);
  const [dynamicHint, setDynamicHint] = useState<DynamicHint | null>(null);
  const matcherRef = useRef<PhraseMatcher | null>(null);
  const topSuggestion = useRef<string | null>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef<HTMLDivElement>(null);
  const palmRef = useRef<HTMLDivElement>(null);
  const calibrationRingRef = useRef<HTMLDivElement>(null);
  const calibrationLeftRef = useRef<HTMLSpanElement>(null);
  const correctionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDockHidden(true);
    return () => setDockHidden(false);
  }, [setDockHidden]);

  // Voices load asynchronously: fetch them now so the first phrase starts right away.
  useEffect(() => warmVoices(), []);

  useEffect(() => {
    let cancelled = false;
    void loadTalkModels().then((knn) => {
      if (!cancelled) reader.setKnn(knn);
    });
    return () => {
      cancelled = true;
    };
  }, [reader]);

  // Dynamic phrases: DTW templates load with the talk screen; without them only letters and static phrases work.
  useEffect(() => {
    let cancelled = false;
    void loadDynamicTemplates(DYNAMIC_LABELS).then((sets) => {
      if (!cancelled && sets.length > 0) matcherRef.current = createPhraseMatcher(sets);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dynamicHint) return;
    const id = window.setTimeout(() => setDynamicHint(null), TALK_DYNAMIC_HINT_MS);
    return () => window.clearTimeout(id);
  }, [dynamicHint]);

  // The dictionary (~55 KB) is loaded only here, not on the first screen.
  useEffect(() => {
    let cancelled = false;
    void import("../data/dictionary.ru").then(
      (m) => {
        if (!cancelled) setAutocomplete(createAutocomplete(m.DICTIONARY));
      },
      () => undefined, // Without the dictionary the screen simply has no suggestions.
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const typing = draft.current;
  const suggestions = useMemo(
    () => (autocomplete && !candidate ? autocomplete.suggest(typing) : []),
    [autocomplete, candidate, typing],
  );
  useEffect(() => {
    topSuggestion.current = suggestions[0] ?? null;
  }, [suggestions]);

  const pickSuggestion = (word: string) => {
    composer.complete(word);
    setDraft({ words: composer.words, current: composer.current });
  };

  useEffect(() => {
    if (cancelledAt === null) return;
    const id = window.setTimeout(() => setCancelledAt(null), CANCELLED_NOTE_MS);
    return () => window.clearTimeout(id);
  }, [cancelledAt]);

  // Per frame: palm → zones → letters → pauses → confirmation. React state only on events.
  useEffect(() => {
    const syncDraft = () => setDraft({ words: composer.words, current: composer.current });
    const propose = (now: number) => {
      const words = composer.take();
      syncDraft();
      if (words.length > 0) setCandidate(confirmation.propose(words, now));
    };
    // A letter is typed; a phrase gesture adds its whole word and goes straight to confirmation (§4.3).
    // When letters were typed (a dynamic phrase recognized later takes back the ones typed during its motion).
    let typedAt: number[] = [];
    const typeLabel = (label: string, now: number) => {
      const phrase = getPhraseByLabel(label);
      if (!phrase) {
        composer.addLetter(label);
        typedAt.push(now);
        return;
      }
      composer.space();
      composer.complete(phrase.text.toLocaleUpperCase("ru-RU"));
      propose(now);
    };
    const say = (c: Candidate) => {
      const id = addMessage({ side: "signer", text: c.text, source: "dactyl", timestamp: Date.now(), speech: "speaking" });
      void speak(c.speakable).then((result) => setSpeech(id, result));
    };

    let palmSince: number | null = null;
    let palmLast = 0;
    let palmUsed = false;
    let ambiguity: Ambiguity | null = null;
    let shown = JSON.stringify(EMPTY_READING);
    let left = false;
    let calibrator: Calibrator | null = null;
    const tracker = createSequenceTracker();
    const scratch = new Float32Array(FRAME_DIM);
    let prevWrist: { x: number; y: number; t: number } | null = null;
    let wristSpeed = 0;
    const loggedFrom = reader.hintLog.length;

    const unsubscribe = onFrame((obs) => {
      if (left) return;
      const now = performance.now();

      // 0. Calibration first (§4.5): only the open palm counts — no commands, nothing typed.
      const cal = calRef.current;
      if (cal.phase === "pending") {
        calibrator ??= createCalibrator();
        const c = calibrator.update(obs, now);
        calibrationRingRef.current?.style.setProperty("--progress", c.progress.toFixed(3));
        if (calibrationLeftRef.current) calibrationLeftRef.current.textContent = String(Math.ceil(c.remainingMs / 1000));
        if (c.status === "done" && c.result) {
          calRef.current = { phase: "done", calibration: c.result };
          finishCalibration(c.result);
          playSound("success");
          // The palm is still up: it must come down before it can mean «выход».
          palmSince = now;
          palmLast = now;
          palmUsed = true;
        } else if (c.status === "failed") {
          calRef.current = { phase: "skipped", calibration: null };
          skipCalibration();
        }
        paintZones(zonesRef.current, null);
        paintCorrection(correctionRef.current, null, null, null);
        palmRef.current?.toggleAttribute("data-active", false);
        setHighlight(null);
        setSkeletonTone(obs ? "neutral" : null);
        return;
      }
      calibrator = null;

      // Motion features into the sequence buffer (dynamic phrases); nothing while a phrase waits.
      const usable = obs !== null && frameErrors(obs.frame).length === 0;
      const aspect = obs && obs.frame.videoHeight > 0 ? obs.frame.videoWidth / obs.frame.videoHeight : 1;
      if (usable && obs) writeFrameFeatures(obs.features, obs.frame.landmarks, aspect, scratch);
      const motion = tracker.push(usable && !confirmation.candidate ? scratch : null, now);

      // Wrist speed: the open palm is a command only while the hand is still (a wave is not «выход»).
      const wrist = obs?.frame.landmarks[LM.WRIST];
      if (wrist && obs) {
        if (prevWrist && now > prevWrist.t) {
          const dist = Math.hypot((wrist.x - prevWrist.x) * aspect, wrist.y - prevWrist.y) / (palmSize(obs.frame) || 1);
          wristSpeed = wristSpeed * (1 - WRIST_SPEED_EMA) + (dist / ((now - prevWrist.t) / 1000)) * WRIST_SPEED_EMA;
        }
        prevWrist = { x: wrist.x, y: wrist.y, t: now };
      } else {
        prevWrist = null;
        wristSpeed = 0;
      }

      // 1. Open palm: cancels the candidate (1.2 s) or, without one, leaves the screen (2 s).
      if (obs !== null && isOpenPalm(obs) && wristSpeed < POSE_MAX_SPEED) {
        palmSince ??= now;
        palmLast = now;
      } else if (palmSince !== null && now - palmLast > POSE_GRACE_MS) {
        palmSince = null;
        palmUsed = false;
      }
      const palmMs = palmSince !== null && !palmUsed ? now - palmSince : 0;
      const palmLimit = confirmation.candidate ? TALK_CANCEL_PALM_MS : TALK_EXIT_PALM_MS;
      const palmProgress = Math.min(1, palmMs / palmLimit);
      palmRef.current?.toggleAttribute("data-active", palmProgress > 0);
      palmRef.current?.style.setProperty("--progress", palmProgress.toFixed(3));
      if (palmProgress >= 1) {
        palmUsed = true;
        if (confirmation.candidate) {
          const dropped = confirmation.cancel();
          if (dropped) composer.restore(dropped.words);
          setCandidate(null);
          setCancelledAt(now);
          syncDraft();
        } else {
          left = true;
          navigate(paths.map());
          return;
        }
      }

      // 2. Command zones (the wrist raised into a top zone).
      const z = zones.update(obs, now);
      paintZones(zonesRef.current, z);
      if (z.fired && !confirmation.candidate) {
        if (ambiguity && (z.fired === "delete" || z.fired === "say")) {
          // «А или Б?»: the left zone picks the first letter, the right one the second.
          const letter = ambiguity.labels[z.fired === "delete" ? 0 : 1];
          typeLabel(letter, now);
          reader.resolve(letter);
          playSound("click");
        } else if (z.fired === "delete") {
          composer.deleteLast();
        } else if (z.fired === "space") {
          // With a suggestion the zone inserts the first word; otherwise it is a plain space.
          const top = topSuggestion.current;
          if (top && composer.current !== "") composer.complete(top);
          else composer.space();
        } else {
          propose(now);
        }
        syncDraft();
      }

      // 3. Letters: nothing is typed while the hand gives a command or a phrase waits.
      // After calibration, a hand far from the signing place gets «чуть выше» before any shape hint.
      const extraErrors =
        cal.calibration && obs && !confirmation.candidate ? positionErrors(obs.frame, cal.calibration) : [];
      const u = reader.update(obs, now, {
        suppressed: z.active !== null || confirmation.candidate !== null,
        extraErrors,
      });
      ambiguity = u.ambiguity;
      if (u.accepted) {
        typeLabel(u.accepted, now);
        playSound("click");
        syncDraft();
      }

      // 3b. A motion just ended: is it a dynamic phrase? (Not while a zone command or a phrase is going on.)
      const matcher = matcherRef.current;
      let top: { label: string; score: number }[] = [];
      if (motion.segment && matcher && z.active === null && !confirmation.candidate) {
        const report = matcher.match(motion.segment);
        top = report.top;
        const result = report.result;
        if (result.kind === "accept") {
          // Letters «typed» while the hand was moving through the sign were not meant: take them back.
          let undo = typedAt.filter((at) => at >= (motion.segment?.startT ?? now)).length;
          typedAt = typedAt.filter((at) => at < (motion.segment?.startT ?? now));
          while (undo > 0 && composer.current !== "") {
            composer.deleteLast();
            undo--;
          }
          reader.resolve(result.label);
          typeLabel(result.label, now);
          playSound("click");
          setDynamicHint(null);
        } else if (result.kind === "almost") {
          setDynamicHint({ text: dynamicHintText(result), ghost: ghostPoints(motion.segment, result.ghost, aspect), at: now });
          logHints([{ letter: labelText(result.label), hintCode: `dynamic.${result.reason}`, timestamp: now }]);
        }
      }
      setMotionStats({ speed: motion.speed, moving: motion.moving, top });

      // 4. Pauses without a hand: end of word, then end of phrase.
      const tick = composer.tick(now, obs !== null);
      if (tick.changed) syncDraft();
      if (tick.phraseReady && !confirmation.candidate) propose(now);

      // 5. The confirmation ring; when it is full the phrase goes to the feed and is spoken.
      const c = confirmation.update(now);
      ringRef.current?.style.setProperty("--progress", (c.candidate ? c.progress : u.holdProgress).toFixed(3));
      if (c.confirmed) {
        setCandidate(null);
        say(c.confirmed);
      }

      const waiting = confirmation.candidate !== null;
      paintCorrection(
        correctionRef.current,
        waiting || u.ambiguity ? null : hintVisual(u.hint?.hintCode),
        obs ? toDisplay(palmCenter(obs.frame)) : null,
        cal.calibration ? toDisplay(cal.calibration.center) : null,
      );
      setHighlight(waiting ? null : u.hint?.landmarkIds);
      setSkeletonTone(obs ? (waiting ? "neutral" : u.tone) : null);
      setTalkStats(u);

      const view = readingView(u);
      const key = JSON.stringify(view);
      if (key !== shown) {
        shown = key;
        setReading(view);
      }
    });

    return () => {
      unsubscribe();
      setHighlight(null);
      setSkeletonTone(null);
      clearTalkStats();
      logHints(reader.hintLog.slice(loggedFrom));
    };
  }, [reader, composer, confirmation, zones, addMessage, setSpeech, logHints, finishCalibration, skipCalibration]);

  const amb = reading.ambiguity;
  const zoneLabels: Partial<Record<ZoneId, ZoneLabel>> = {};
  if (!candidate && amb) {
    zoneLabels.delete = { text: amb.a, caption: strings.talk.pick };
    zoneLabels.say = { text: amb.b, caption: strings.talk.pick };
  }
  if (!candidate && suggestions[0]) zoneLabels.space = { text: suggestions[0], caption: strings.talk.suggestions.insert };

  return (
    <main className={t.layout} aria-label={strings.talk.title}>
      <section className={t.camera}>
        <CameraView variant="large">
          {calibration && phase === "done" && <TargetZone calibration={calibration} active={reading.visual === "move"} />}
          <CorrectionArrow ref={correctionRef} />
          {dynamicHint && <GhostPath points={dynamicHint.ghost} />}
          {phase !== "pending" && <CommandZones ref={zonesRef} labels={zoneLabels} />}
          <div ref={palmRef} className={t.palm} aria-hidden="true">
            <HoldRing className={t.palmRing}>
              <span className={t.palmIcon}>✋</span>
            </HoldRing>
          </div>
          <SubtitleOverlay subtitle={listener.subtitle} />
          {phase === "pending" && <CalibrationOverlay ringRef={calibrationRingRef} remainingRef={calibrationLeftRef} />}
        </CameraView>
        <p className={t.calibrationLine}>
          <span>
            {phase === "done"
              ? strings.talk.calibration.done
              : phase === "skipped"
                ? strings.talk.calibration.skipped
                : strings.talk.calibration.text}
          </span>
          <button
            type="button"
            className={t.linkButton}
            onClick={phase === "pending" ? skipCalibration : restartCalibration}
          >
            {phase === "pending"
              ? strings.talk.calibration.skip
              : phase === "done"
                ? strings.talk.calibration.redo
                : strings.talk.calibration.start}
          </button>
        </p>
        <p className={t.frame}>{strings.talk.frame}</p>
      </section>

      <section className={t.side}>
        <h1 className={t.title}>{strings.talk.title}</h1>
        <ComposerBar words={draft.words} current={draft.current} />
        <SuggestionBar words={suggestions} onPick={pickSuggestion} />
        <CandidateCard ref={ringRef} candidate={candidate} reading={reading} cancelled={cancelledAt !== null} />
        {dynamicHint && !candidate && <HintBanner text={dynamicHint.text} />}
        <ConversationFeed />
        <ListenerPanel
          supported={listener.supported}
          listening={listener.listening}
          ttsSpeaking={listener.ttsSpeaking}
          error={listener.error}
          onMic={listener.toggleMic}
          onSend={listener.send}
        />
      </section>

      <TalkLegend />
    </main>
  );
}
