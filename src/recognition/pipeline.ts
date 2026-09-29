import { HAND_MODEL_URL, MEDIAPIPE_WASM_URL } from "../config";
import { CameraError } from "./camera";
import { getHandStatus, type HandStatus } from "./errors/frameChecks";
import { createHandTracker, type Delegate, type HandTracker } from "./handTracker";
import type { HandFrame } from "./landmarks";
import { buildObservation, type HandObservation } from "./observation";
import { createPointsEma, createStableValue } from "./smoothing";
import { HAND_STATUS_HOLD_MS, LANDMARK_EMA_ALPHA } from "./thresholds";

/**
 * Recognition loop singleton: owns the camera stream, a hidden <video> used for
 * detection, the tracker and the requestAnimationFrame loop. Per-frame data goes
 * to listeners (canvas drawers); only status changes are meant for React.
 */

export type PipelineError = CameraError | Error;
export type { HandObservation };

type FrameListener = (observation: HandObservation | null) => void;
type StatusListener = (status: HandStatus) => void;
type ErrorListener = (error: PipelineError) => void;

export interface PipelineStats {
  fps: number;
  delegate: Delegate | null;
  observation: HandObservation | null;
}

const frameListeners = new Set<FrameListener>();
const statusListeners = new Set<StatusListener>();
const errorListeners = new Set<ErrorListener>();

let trackerPromise: Promise<HandTracker> | null = null;
let tracker: HandTracker | null = null;
let triedCpuFallback = false;

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let rafId: number | null = null;
let lastVideoTime = -1;
let lastTimestamp = 0;

let lastObservation: HandObservation | null = null;
const landmarkEma = createPointsEma(LANDMARK_EMA_ALPHA);
const handStatus = createStableValue<HandStatus>("noHand", HAND_STATUS_HOLD_MS);
let emittedStatus: HandStatus = "noHand";

let fps = 0;
let fpsCount = 0;
let fpsWindowStart = 0;

function subscribe<T>(set: Set<T>, listener: T): () => void {
  set.add(listener);
  return () => {
    set.delete(listener);
  };
}

export const onFrame = (fn: FrameListener) => subscribe(frameListeners, fn);
export const onHandStatus = (fn: StatusListener) => subscribe(statusListeners, fn);
export const onPipelineError = (fn: ErrorListener) => subscribe(errorListeners, fn);

export function getStream(): MediaStream | null {
  return stream;
}

export function getStats(): PipelineStats {
  return { fps, delegate: tracker?.delegate ?? null, observation: lastObservation };
}

/** Starts loading the model (idempotent). Safe to call early, e.g. on the Welcome screen. */
export function preloadTracker(): Promise<HandTracker> {
  trackerPromise ??= createHandTracker({ wasmUrl: MEDIAPIPE_WASM_URL, modelUrl: HAND_MODEL_URL }).catch(
    (err: unknown) => {
      trackerPromise = null;
      throw err;
    },
  );
  return trackerPromise;
}

function ensureVideo(): HTMLVideoElement {
  if (video) return video;
  const el = document.createElement("video");
  el.muted = true;
  el.autoplay = true;
  el.playsInline = true;
  el.setAttribute("playsinline", "");
  el.setAttribute("aria-hidden", "true");
  // Kept in the DOM (not display:none) so iOS Safari keeps decoding frames.
  Object.assign(el.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(el);
  video = el;
  return el;
}

function fail(error: PipelineError): void {
  stopLoop();
  for (const fn of errorListeners) fn(error);
}

export async function startPipeline(mediaStream: MediaStream): Promise<void> {
  tracker = await preloadTracker();

  if (stream && stream !== mediaStream) {
    for (const track of stream.getTracks()) track.stop();
  }
  stream = mediaStream;
  for (const track of mediaStream.getVideoTracks()) {
    track.addEventListener("ended", () => fail(new CameraError("notFound")));
  }

  const el = ensureVideo();
  el.srcObject = mediaStream;
  try {
    await el.play();
  } catch {
    // Muted inline video normally autoplays; the loop waits for readyState anyway.
  }
  startLoop();
}

function startLoop(): void {
  if (rafId !== null) return;
  fpsWindowStart = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stopLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

function recoverFromDetectError(err: unknown): void {
  if (!tracker || tracker.delegate !== "GPU" || triedCpuFallback) {
    // Drop the broken tracker so a retry creates a fresh one.
    tracker?.close();
    tracker = null;
    trackerPromise = null;
    fail(err instanceof Error ? err : new Error(String(err)));
    return;
  }
  // Some GPUs initialise fine but fail on the first frames: retry once on CPU.
  triedCpuFallback = true;
  tracker.close();
  tracker = null;
  trackerPromise = createHandTracker({ wasmUrl: MEDIAPIPE_WASM_URL, modelUrl: HAND_MODEL_URL, delegate: "CPU" });
  trackerPromise.then(
    (t) => {
      tracker = t;
    },
    (e: unknown) => fail(e instanceof Error ? e : new Error(String(e))),
  );
}

function observe(frame: HandFrame): HandObservation {
  // Never blend landmarks of a different hand.
  if (lastObservation?.frame.handedness !== frame.handedness) landmarkEma.reset();
  return buildObservation(frame, landmarkEma.update(frame.landmarks));
}

function tick(): void {
  rafId = requestAnimationFrame(tick);
  if (!video || !tracker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const now = Math.max(performance.now(), lastTimestamp + 1);
  lastTimestamp = now;

  let frame: HandFrame | null;
  try {
    frame = tracker.detect(video, now);
  } catch (err) {
    recoverFromDetectError(err);
    return;
  }

  fpsCount += 1;
  if (now - fpsWindowStart >= 1000) {
    fps = (fpsCount * 1000) / (now - fpsWindowStart);
    fpsCount = 0;
    fpsWindowStart = now;
  }

  const observation = frame ? observe(frame) : null;
  if (!frame) landmarkEma.reset();
  lastObservation = observation;
  for (const fn of frameListeners) safeCall(fn, observation);

  const status = handStatus.update(getHandStatus(frame), now);
  if (status !== emittedStatus) {
    emittedStatus = status;
    for (const fn of statusListeners) safeCall(fn, status);
  }
}

const reported = new WeakSet<object>();

/** One broken listener (a drawer, a screen) must not stop the others or the loop. Logged once per listener. */
function safeCall<T>(fn: (value: T) => void, value: T): void {
  try {
    fn(value);
  } catch (err) {
    if (!reported.has(fn)) {
      reported.add(fn);
      console.error("Gesturingo frame listener failed:", err);
    }
  }
}

// iOS Safari pauses camera video in background tabs: resume when the page is visible again.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && video?.paused && stream) {
      video.play().catch(() => {});
    }
  });
}
