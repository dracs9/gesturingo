import { useEffect, useRef } from "react";
import s from "./Confetti.module.css";

const COLORS = ["#4dd4ac", "#ffd166", "#ff6b6b", "#7aa2ff", "#f5f6f8"];
const DURATION_MS = 1800;
const GRAVITY = 1400; // px/s²

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
}

interface ConfettiProps {
  /** Change this value to fire a burst (0 = nothing). */
  burst: number;
  /** Burst origin in viewport fractions. */
  originX?: number;
  originY?: number;
  count?: number;
}

/** Lightweight canvas confetti (no library). Skipped entirely with prefers-reduced-motion. */
export function Confetti({ burst, originX = 0.5, originY = 0.45, count = 120 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!burst || !canvas || !ctx) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ox = window.innerWidth * originX;
    const oy = window.innerHeight * originY;
    const particles: Particle[] = Array.from({ length: count }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 450 + Math.random() * 650;
      return {
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 6 + Math.random() * 7,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 12,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#fff",
      };
    });

    const start = performance.now();
    let last = start;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const life = (now - start) / DURATION_MS;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (life >= 1) return;
      ctx.globalAlpha = 1 - life * life;
      for (const p of particles) {
        p.vy += GRAVITY * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.spin * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [burst, originX, originY, count]);

  return <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />;
}
