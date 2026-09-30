import { useEffect, useRef, useState } from "react";
import { playSound } from "../audio/sounds";
import { CameraView } from "../components/CameraView";
import { CandidateCard, type ReadingView } from "../components/CandidateCard";
import { CommandZones } from "../components/CommandZones";
import { ComposerBar } from "../components/ComposerBar";
import { ConversationFeed } from "../components/ConversationFeed";
import { HoldRing } from "../components/HoldRing";
import { paintZones } from "../components/paintZones";
import { TalkLegend } from "../components/TalkLegend";
import { hintText } from "../data/hintText";
import { getLetterSpec, LETTERS } from "../data/letters";
import { loadLetterModels } from "../data/samples";
import { strings } from "../data/strings.ru";
import { createCommandZones } from "../recognition/control/commandZones";
import { isOpenPalm } from "../recognition/control/poses";
import { createOpenReader, type Ambiguity, type ReaderUpdate } from "../recognition/open/openReader";
import { onFrame } from "../recognition/pipeline";
import { POSE_GRACE_MS, TALK_CANCEL_PALM_MS, TALK_EXIT_PALM_MS } from "../recognition/thresholds";
import { navigate, paths } from "../router";
import { setHighlight, setSkeletonTone } from "../store/highlight";
import { clearTalkStats, setTalkStats } from "../store/talkStats";
import { useUi } from "../store/ui";
import { createComposer, createConfirmation, type Candidate } from "../talk/composer";
import { useConversation } from "../talk/conversationStore";
import { speak, warmVoices } from "../tts/speech";
import t from "./Talk.module.css";

/** How long «Отменено» stays under the card. */
const CANCELLED_NOTE_MS = 2500;

const EMPTY_READING: ReadingView = { state: "noHand", label: null, hint: null, ambiguity: null };

function readingView(u: ReaderUpdate): ReadingView {
  const amb = u.ambiguity;
  return {
    state: u.state,
    label: u.label,
    // The «А или Б?» card already explains the difference: no second banner.
    hint: amb ? null : hintText(u.hint),
    ambiguity: amb ? { a: amb.labels[0], b: amb.labels[1], advice: hintText(amb.hint) } : null,
  };
}

/**
 * «Разговор» (docs/TRANSLATOR_SPEC.md, phase T1): fingerspelling without a target → words → a phrase
 * that is spoken only after a confirmation ring. Unsure readings never type or speak: they show
 * "almost" / «А или Б?» with a concrete hint. Commands are zones at the top of the frame.
 */
export function Talk() {
  const setDockHidden = useUi((st) => st.setDockHidden);
  const addMessage = useConversation((st) => st.addMessage);
  const setSpeech = useConversation((st) => st.setSpeech);
  const logHints = useConversation((st) => st.logHints);

  const [reader] = useState(() => createOpenReader({ specs: LETTERS, getSpec: getLetterSpec }));
  const [composer] = useState(createComposer);
  const [confirmation] = useState(() => createConfirmation());
  const [zones] = useState(() => createCommandZones());

  const [draft, setDraft] = useState<{ words: readonly string[]; current: string }>({ words: [], current: "" });
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [reading, setReading] = useState<ReadingView>(EMPTY_READING);
  const [cancelledAt, setCancelledAt] = useState<number | null>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef<HTMLDivElement>(null);
  const palmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDockHidden(true);
    return () => setDockHidden(false);
  }, [setDockHidden]);

  // Voices load asynchronously: fetch them now so the first phrase starts right away.
  useEffect(() => warmVoices(), []);

  useEffect(() => {
    let cancelled = false;
    void loadLetterModels().then((m) => {
      if (!cancelled) reader.setKnn(m.knn);
    });
    return () => {
      cancelled = true;
    };
  }, [reader]);

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
    const loggedFrom = reader.hintLog.length;

    const unsubscribe = onFrame((obs) => {
      if (left) return;
      const now = performance.now();

      // 1. Open palm: cancels the candidate (1.2 s) or, without one, leaves the screen (2 s).
      if (obs !== null && isOpenPalm(obs)) {
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
          composer.addLetter(letter);
          reader.resolve(letter);
          playSound("click");
        } else if (z.fired === "delete") {
          composer.deleteLast();
        } else if (z.fired === "space") {
          composer.space();
        } else {
          propose(now);
        }
        syncDraft();
      }

      // 3. Letters: nothing is typed while the hand gives a command or a phrase waits.
      const u = reader.update(obs, now, { suppressed: z.active !== null || confirmation.candidate !== null });
      ambiguity = u.ambiguity;
      if (u.accepted) {
        composer.addLetter(u.accepted);
        playSound("click");
        syncDraft();
      }

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
  }, [reader, composer, confirmation, zones, addMessage, setSpeech, logHints]);

  const amb = reading.ambiguity;

  return (
    <main className={t.layout} aria-label={strings.talk.title}>
      <section className={t.camera}>
        <CameraView variant="large">
          <CommandZones ref={zonesRef} labels={amb && !candidate ? { delete: amb.a, say: amb.b } : undefined} />
          <div ref={palmRef} className={t.palm} aria-hidden="true">
            <HoldRing className={t.palmRing}>
              <span className={t.palmIcon}>✋</span>
            </HoldRing>
          </div>
        </CameraView>
        <p className={t.frame}>{strings.talk.frame}</p>
      </section>

      <section className={t.side}>
        <h1 className={t.title}>{strings.talk.title}</h1>
        <ComposerBar words={draft.words} current={draft.current} />
        <CandidateCard ref={ringRef} candidate={candidate} reading={reading} cancelled={cancelledAt !== null} />
        <ConversationFeed />
      </section>

      <TalkLegend />
    </main>
  );
}
