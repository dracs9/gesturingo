import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { getStream } from "../recognition/pipeline";
import s from "./CameraView.module.css";
import { HandOverlay } from "./HandOverlay";

interface CameraViewProps {
  variant?: "mini" | "large";
  className?: string;
  /** Drawn over the video, unmirrored (e.g. a success overlay that must match the video's size). */
  children?: ReactNode;
}

/** Mirrored camera preview with the hand skeleton drawn on top. */
export function CameraView({ variant = "large", className, children }: CameraViewProps) {
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
    // `--aspect` lets a parent fit the view into a box by height: `width: min(100cqw, 100cqh * var(--aspect))`.
    <div
      className={`${s.view} ${s[variant]} ${className ?? ""}`}
      style={{ aspectRatio: aspect, "--aspect": aspect } as CSSProperties}
    >
      <div className={s.mirror}>
        <video ref={videoRef} className={s.layer} muted playsInline autoPlay />
        <HandOverlay className={s.layer} />
      </div>
      {children}
    </div>
  );
}
