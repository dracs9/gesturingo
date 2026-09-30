import { useEffect, useRef } from "react";
import { HAND_CONNECTIONS, type HandFrame } from "../recognition/landmarks";
import { onFrame } from "../recognition/pipeline";
import { getHighlight, getSkeletonTone, type SkeletonTone } from "../store/highlight";

const BONE_COLOR = "rgba(77, 212, 172, 0.9)";
/** Talk mode: the skeleton itself says how sure the recognition is (the UI repeats it with text + icon). */
const TONE_COLORS: Record<SkeletonTone, string> = {
  accept: "rgba(46, 204, 113, 0.95)",
  almost: "rgba(239, 71, 71, 0.95)",
  neutral: "rgba(170, 176, 186, 0.85)",
};
const JOINT_COLOR = "#f5f6f8";

function draw(ctx: CanvasRenderingContext2D, frame: HandFrame | null): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;

  const unit = Math.max(1.5, Math.min(width, height) / 120);
  const pts = frame.landmarks.map((p) => [p.x * width, p.y * height] as const);

  const tone = getSkeletonTone();
  ctx.strokeStyle = tone ? TONE_COLORS[tone] : BONE_COLOR;
  ctx.lineWidth = tone ? unit * 1.5 : unit;
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

  drawHighlight(ctx, pts, unit);
}

/** The finger named by the current hint: thick pulsing bones and joints on top of the skeleton. */
function drawHighlight(ctx: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>, unit: number) {
  const ids = getHighlight();
  if (ids.size === 0) return;

  const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 160);
  ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
  ctx.fillStyle = `rgba(255, 209, 102, ${pulse})`;
  ctx.lineWidth = unit * 2.4;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = pts[a];
    const pb = pts[b];
    if (!pa || !pb || !ids.has(b) || !(ids.has(a) || a === 0)) continue;
    ctx.moveTo(pa[0], pa[1]);
    ctx.lineTo(pb[0], pb[1]);
  }
  ctx.stroke();
  for (const id of ids) {
    const p = pts[id];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p[0], p[1], unit * 2, 0, Math.PI * 2);
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

    const unsubscribe = onFrame((observation) => draw(ctx, observation?.frame ?? null));
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
