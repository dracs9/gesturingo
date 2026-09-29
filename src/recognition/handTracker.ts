import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { HandFrame, Handedness } from "./landmarks";
import {
  TRACKER_MIN_DETECTION_CONFIDENCE,
  TRACKER_MIN_PRESENCE_CONFIDENCE,
  TRACKER_MIN_TRACKING_CONFIDENCE,
} from "./thresholds";

export type Delegate = "GPU" | "CPU";

export interface HandTrackerOptions {
  wasmUrl: string;
  modelUrl: string;
  /** Force a delegate. Without it GPU is tried first, then CPU. */
  delegate?: Delegate;
}

export interface HandTracker {
  readonly delegate: Delegate;
  /** Runs detection on the current video frame. `timestamp` must strictly increase. */
  detect(video: HTMLVideoElement, timestamp: number): HandFrame | null;
  close(): void;
}

// The MediaPipe bundle is large: load it lazily so the first screen renders fast.
type VisionModule = typeof import("@mediapipe/tasks-vision");
let visionModule: Promise<VisionModule> | null = null;

function loadVision(): Promise<VisionModule> {
  visionModule ??= import("@mediapipe/tasks-vision").catch((err: unknown) => {
    visionModule = null;
    throw err;
  });
  return visionModule;
}

async function createLandmarker(options: HandTrackerOptions, delegate: Delegate): Promise<HandLandmarker> {
  const { FilesetResolver, HandLandmarker } = await loadVision();
  const fileset = await FilesetResolver.forVisionTasks(options.wasmUrl);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: options.modelUrl, delegate },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: TRACKER_MIN_DETECTION_CONFIDENCE,
    minHandPresenceConfidence: TRACKER_MIN_PRESENCE_CONFIDENCE,
    minTrackingConfidence: TRACKER_MIN_TRACKING_CONFIDENCE,
  });
}

function toHandFrame(result: HandLandmarkerResult, video: HTMLVideoElement, timestamp: number): HandFrame | null {
  const landmarks = result.landmarks[0];
  const category = result.handedness[0]?.[0];
  if (!landmarks || landmarks.length === 0 || !category) return null;
  return {
    landmarks: landmarks.map(({ x, y, z }) => ({ x, y, z })),
    handedness: (category.categoryName === "Left" ? "Left" : "Right") satisfies Handedness,
    score: category.score,
    timestamp,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
  };
}

export async function createHandTracker(options: HandTrackerOptions): Promise<HandTracker> {
  let delegate: Delegate = options.delegate ?? "GPU";
  let landmarker: HandLandmarker;
  try {
    landmarker = await createLandmarker(options, delegate);
  } catch (err) {
    if (delegate === "CPU") throw err;
    delegate = "CPU";
    landmarker = await createLandmarker(options, delegate);
  }

  return {
    delegate,
    detect(video, timestamp) {
      return toHandFrame(landmarker.detectForVideo(video, timestamp), video, timestamp);
    },
    close() {
      landmarker.close();
    },
  };
}
