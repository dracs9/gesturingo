import { useEffect, useState } from "react";
import { CameraView } from "../components/CameraView";
import { GestureButton } from "../components/GestureButton";
import { SkeletonPreview } from "../components/SkeletonPreview";
import { ALPHABET } from "../data/alphabet";
import { strings } from "../data/strings.ru";
import { getHandStatus } from "../recognition/errors/frameChecks";
import type { Handedness } from "../recognition/landmarks";
import { flattenPoints, normalizeHand } from "../recognition/normalize";
import { onFrame } from "../recognition/pipeline";
import {
  majorityHandedness,
  pickMedoid,
  referenceFileName,
  roundFrame,
  sampleFileName,
  serializeReferenceFile,
  serializeSampleFile,
} from "../recognition/samples";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useSession } from "../store/session";
import r from "./Record.module.css";
import s from "./Screen.module.css";

const COUNTDOWN_S = 3;
const FRAME_OPTIONS = [50, 60, 80, 100] as const;
const SIGNER_KEY = "gesturingo.signer";

type Phase = "idle" | "countdown" | "recording" | "done";

interface Recording {
  frames: number[][];
  handedness: Handedness;
}

function loadSigner(): string {
  try {
    return localStorage.getItem(SIGNER_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveSigner(value: string): void {
  try {
    localStorage.setItem(SIGNER_KEY, value);
  } catch {
    // Storage unavailable (private mode) — not critical.
  }
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Service page for recording kNN samples and ghost-hand references. Reachable only by URL `/record`.
export function Record() {
  const t = strings.record;
  const handStatus = useSession((st) => st.handStatus);

  const [letter, setLetter] = useState<string>(ALPHABET[0] ?? "А");
  const [signer, setSigner] = useState(loadSigner);
  const [frameCount, setFrameCount] = useState<number>(60);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_S);
  const [progress, setProgress] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [selected, setSelected] = useState(0);

  // 3-2-1 countdown, then start recording.
  useEffect(() => {
    if (phase !== "countdown") return;
    const timers = Array.from({ length: COUNTDOWN_S - 1 }, (_, i) =>
      window.setTimeout(() => setCountdown(COUNTDOWN_S - i - 1), (i + 1) * 1000),
    );
    timers.push(window.setTimeout(() => setPhase("recording"), COUNTDOWN_S * 1000));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [phase]);

  // Capture raw (not EMA-smoothed) normalized frames while the hand is well placed.
  useEffect(() => {
    if (phase !== "recording") return;
    const frames: number[][] = [];
    const hands: Handedness[] = [];
    const unsubscribe = onFrame((observation) => {
      if (!observation || getHandStatus(observation.frame) !== "ok") return;
      const normalized = normalizeHand(observation.frame);
      frames.push(roundFrame(flattenPoints(normalized.points)));
      hands.push(normalized.handedness);
      setProgress(frames.length);
      if (frames.length >= frameCount) {
        unsubscribe();
        setRecording({ frames, handedness: majorityHandedness(hands) });
        setSelected(Math.max(0, pickMedoid(frames)));
        setPhase("done");
      }
    });
    return unsubscribe;
  }, [phase, frameCount]);

  const start = () => {
    saveSigner(signer);
    setCountdown(COUNTDOWN_S);
    setProgress(0);
    setRecording(null);
    setPhase("countdown");
  };

  const cancel = () => setPhase(recording ? "done" : "idle");

  const signerId = signer.trim() || t.signerPlaceholder;
  const selectedFrame = recording?.frames[selected] ?? null;

  const downloadSamples = () => {
    if (!recording) return;
    download(
      sampleFileName(letter, signerId),
      serializeSampleFile({ letter, signer: signerId, handedness: recording.handedness, frames: recording.frames }),
    );
  };

  const saveReference = () => {
    if (!recording || !selectedFrame) return;
    download(
      referenceFileName(letter),
      serializeReferenceFile({ letter, signer: signerId, handedness: recording.handedness, frame: selectedFrame }),
    );
  };

  const busy = phase === "countdown" || phase === "recording";
  // While recording, a letter that looks like an open palm must not leave the page.
  useGestureCommands({ back: busy ? undefined : () => navigate(paths.map()) });

  return (
    <main className={r.layout}>
      <section className={r.camera}>
        <CameraView variant="large" />
        {phase === "countdown" && (
          <div className={r.overlay} role="status">
            <span className={r.overlayLabel}>{t.getReady}</span>
            <span className={r.countdown}>{countdown}</span>
          </div>
        )}
        {phase === "recording" && (
          <div className={r.recordingBar} role="status">
            <span>{t.recording(progress, frameCount)}</span>
            {handStatus !== "ok" && <strong>⚠️ {t.showHand}</strong>}
            <progress max={frameCount} value={progress} />
          </div>
        )}
      </section>

      <section className={r.panel}>
        <h1 className={r.title}>{t.title}</h1>
        <p className={s.text}>{t.intro}</p>

        <div className={r.fields}>
          <label className={r.field}>
            {t.letter}
            <select value={letter} onChange={(e) => setLetter(e.target.value)} disabled={busy}>
              {ALPHABET.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={r.field}>
            {t.signer}
            <input
              value={signer}
              placeholder={t.signerPlaceholder}
              onChange={(e) => setSigner(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className={r.field}>
            {t.frameCount}
            <select value={frameCount} onChange={(e) => setFrameCount(Number(e.target.value))} disabled={busy}>
              {FRAME_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={r.actions}>
          {busy ? (
            // Mouse only: the hand is busy showing the letter and must not cancel by accident.
            <GestureButton noGesture onClick={cancel}>
              {t.cancel}
            </GestureButton>
          ) : (
            <GestureButton variant="primary" onClick={start}>
              {recording ? t.again : t.start}
            </GestureButton>
          )}
        </div>

        {phase === "done" && recording && (
          <div className={r.preview}>
            <h2>{t.preview}</h2>
            <SkeletonPreview frame={selectedFrame} className={r.skeleton} />
            <input
              type="range"
              min={0}
              max={recording.frames.length - 1}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              aria-label={t.frameOf(selected + 1, recording.frames.length)}
            />
            <p>
              {t.frameOf(selected + 1, recording.frames.length)} · {t.handedness(strings.hand[recording.handedness])}
            </p>
            <p className={r.hint}>{t.referenceHint}</p>
            <div className={r.actions}>
              <GestureButton variant="primary" onClick={downloadSamples}>
                {t.downloadSamples}
              </GestureButton>
              <GestureButton onClick={saveReference}>{t.saveReference}</GestureButton>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
