export type CameraErrorCode = "denied" | "notFound" | "busy" | "insecure" | "unknown";

export class CameraError extends Error {
  readonly code: CameraErrorCode;

  constructor(code: CameraErrorCode, cause?: unknown) {
    super(`Camera error: ${code}`, { cause });
    this.name = "CameraError";
    this.code = code;
  }
}

/** Maps getUserMedia failures to a user-facing error code. */
export function classifyCameraError(err: unknown): CameraErrorCode {
  if (err instanceof CameraError) return err.code;
  const name = typeof err === "object" && err !== null && "name" in err ? String(err.name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "notFound";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "busy";
    default:
      return "unknown";
  }
}

function isCoarsePointer(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/** Opens the front camera. Throws CameraError. */
export async function openCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new CameraError("insecure");
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError("notFound");

  const [width, height] = isCoarsePointer() ? [480, 360] : [640, 480];
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: width }, height: { ideal: height } },
    });
  } catch (err) {
    throw new CameraError(classifyCameraError(err), err);
  }
}
