import { create } from "zustand";
import { CameraError, classifyCameraError, openCamera, type CameraErrorCode } from "../recognition/camera";
import type { HandStatus } from "../recognition/errors/frameChecks";
import { onHandStatus, onPipelineError, preloadTracker, startPipeline } from "../recognition/pipeline";

export type CameraStatus = "idle" | "requesting" | "loadingModel" | "ready" | "error";
export type SessionErrorCode = CameraErrorCode | "modelFailed";

interface SessionState {
  cameraStatus: CameraStatus;
  cameraError: SessionErrorCode | null;
  handStatus: HandStatus;
  startCamera(): Promise<void>;
}

export const useSession = create<SessionState>()((set, get) => ({
  cameraStatus: "idle",
  cameraError: null,
  handStatus: "noHand",

  async startCamera() {
    const { cameraStatus } = get();
    if (cameraStatus === "requesting" || cameraStatus === "loadingModel" || cameraStatus === "ready") return;

    set({ cameraStatus: "requesting", cameraError: null });
    // Load the model while the user answers the permission prompt.
    const tracker = preloadTracker();
    tracker.catch(() => {});

    let stream: MediaStream;
    try {
      stream = await openCamera();
    } catch (err) {
      set({ cameraStatus: "error", cameraError: classifyCameraError(err) });
      return;
    }

    set({ cameraStatus: "loadingModel" });
    try {
      await tracker;
      await startPipeline(stream);
    } catch {
      for (const track of stream.getTracks()) track.stop();
      set({ cameraStatus: "error", cameraError: "modelFailed" });
      return;
    }
    set({ cameraStatus: "ready" });
  },
}));

onHandStatus((handStatus) => useSession.setState({ handStatus }));

onPipelineError((err) => {
  const code: SessionErrorCode = err instanceof CameraError ? err.code : "modelFailed";
  useSession.setState({ cameraStatus: "error", cameraError: code, handStatus: "noHand" });
});
