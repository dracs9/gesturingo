import { useEffect, useRef, useState } from "react";
import { getStream } from "../recognition/pipeline";
import s from "./CameraView.module.css";
import { GhostHand } from "./GhostHand";
import { HandOverlay } from "./HandOverlay";

interface CameraViewProps {
  variant?: "mini" | "large";
  /** Letter reference (63 normalized numbers) to draw as the ghost hand under the skeleton. */
  ghost?: readonly number[] | null;
  className?: string;
}

/** Mirrored camera preview with the hand skeleton (and optionally the ghost hand) drawn on top. */
export function CameraView({ variant = "large", ghost = null, className }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspect, setAspect] = useState(4 / 3);

  useEffect(() => {
    const video = videoRef.current;
    const stream = getStream();
    if (!video || !stream) return;

    const updateAspect = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) setAspect(video.videoWidth / video.videoHeight);
    };
    video.srcObject = stream;
    video.addEventListener("loadedmetadata", updateAspect);
    video.addEventListener("resize", updateAspect);
    video.play().catch(() => {});
    return () => {
      video.removeEventListener("loadedmetadata", updateAspect);
      video.removeEventListener("resize", updateAspect);
      video.srcObject = null;
    };
  }, []);

  return (
    <div className={`${s.view} ${s[variant]} ${className ?? ""}`} style={{ aspectRatio: aspect }}>
      <div className={s.mirror}>
        <video ref={videoRef} className={s.layer} muted playsInline autoPlay />
        {ghost && <GhostHand reference={ghost} className={s.layer} />}
        <HandOverlay className={s.layer} />
      </div>
    </div>
  );
}
