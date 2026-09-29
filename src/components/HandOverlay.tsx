import { useEffect, useRef } from "react";
import { HAND_CONNECTIONS, type HandFrame } from "../recognition/landmarks";
import { onFrame } from "../recognition/pipeline";

const BONE_COLOR = "rgba(77, 212, 172, 0.9)";
const JOINT_COLOR = "#f5f6f8";

function draw(ctx: CanvasRenderingContext2D, frame: HandFrame | null): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;

  const unit = Math.max(1.5, Math.min(width, height) / 120);
  const pts = frame.landmarks.map((p) => [p.x * width, p.y * height] as const);

  ctx.strokeStyle = BONE_COLOR;
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

  ctx.fillStyle = JOINT_COLOR;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, unit * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Canvas that draws the tracked hand skeleton. Draws in raw video coords; mirror it with CSS. */
export function HandOverlay({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const unsubscribe = onFrame((frame) => draw(ctx, frame));
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
