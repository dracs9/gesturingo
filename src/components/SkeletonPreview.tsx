import { useEffect, useRef } from "react";
import { HAND_CONNECTIONS } from "../recognition/landmarks";
import { unflattenPoints } from "../recognition/normalize";

interface SkeletonPreviewProps {
  /** 63 normalized numbers (wrist at origin, y up, palm size 1). */
  frame: readonly number[] | null;
  /** Mirror horizontally to match the mirrored camera view. */
  mirror?: boolean;
  className?: string;
}

// Normalized hands fit comfortably into x ∈ [-1.5, 1.5], y ∈ [-0.6, 2.4].
const VIEW = { minX: -1.5, maxY: 2.4, size: 3 };

/** Draws a normalized hand skeleton (for /record preview, letter cards). */
export function SkeletonPreview({ frame, mirror = true, className }: SkeletonPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    if (!frame) return;

    const scale = Math.min(width, height) / VIEW.size;
    const offsetX = (width - VIEW.size * scale) / 2;
    const offsetY = (height - VIEW.size * scale) / 2;
    const pts = unflattenPoints(frame).map((p) => {
      const x = mirror ? -p.x : p.x;
      return [offsetX + (x - VIEW.minX) * scale, offsetY + (VIEW.maxY - p.y) * scale] as const;
    });

    const unit = Math.max(2, Math.min(width, height) / 90);
    ctx.strokeStyle = "rgba(27, 35, 64, 0.85)";
    ctx.lineWidth = unit;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb) continue;
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
    }
    ctx.stroke();

    ctx.fillStyle = "#16804f";
    for (const [x, y] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, unit * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [frame, mirror]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
