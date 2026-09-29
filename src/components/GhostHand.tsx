import { useEffect, useRef } from "react";
import { FINGERS, type Finger } from "../recognition/features";
import { HAND_CONNECTIONS } from "../recognition/landmarks";
import { compareFingers, fingerOfLandmark, fitReference, referenceFeatures } from "../recognition/letters/ghost";
import { onFrame } from "../recognition/pipeline";
import { getHighlight } from "../store/highlight";

const MATCH = "77, 212, 172"; // green: finger as in the reference
const MISMATCH = "255, 107, 107"; // red: fix this finger
const PALM = "245, 246, 248";

interface GhostHandProps {
  /** 63 normalized numbers of the letter reference. */
  reference: readonly number[];
  className?: string;
}

/**
 * Semi-transparent reference skeleton fitted onto the user's hand (CLAUDE.md §8.3).
 * Fingers that match are green, others red; the finger from the current hint pulses.
 * Draws in raw video coordinates — lives inside CameraView's mirrored layer.
 */
export function GhostHand({ reference, className }: GhostHandProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const refFeatures = referenceFeatures(reference);
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const unsubscribe = onFrame((observation) => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      if (!observation) return;

      const ghost = fitReference(reference, observation.frame).map((p) => [p.x * width, p.y * height] as const);
      const matches = compareFingers(observation.features, refFeatures);
      const highlighted = new Set<Finger>();
      for (const id of getHighlight()) {
        const f = fingerOfLandmark(id);
        if (f) highlighted.add(f);
      }
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      const unit = Math.max(2, Math.min(width, height) / 90);

      ctx.lineCap = "round";
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = ghost[a];
        const pb = ghost[b];
        if (!pa || !pb) continue;
        // Cross-palm links (5–9, 9–13, 13–17) belong to no finger.
        const finger = b - a === 4 ? null : fingerOfLandmark(b);
        const hot = finger !== null && highlighted.has(finger);
        const color = finger === null ? PALM : matches[finger] ? MATCH : MISMATCH;
        ctx.strokeStyle = `rgba(${color}, ${hot ? 0.45 + 0.5 * pulse : 0.55})`;
        ctx.lineWidth = hot ? unit * (2.6 + pulse) : unit * 1.8;
        ctx.setLineDash(finger === null ? [unit * 1.5, unit * 1.5] : []);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (const f of FINGERS) {
        // Fingertip dot: the part the eye compares first.
        const tip = ghost[4 * (FINGERS.indexOf(f) + 1)];
        if (!tip) continue;
        ctx.fillStyle = `rgba(${matches[f] ? MATCH : MISMATCH}, 0.7)`;
        ctx.beginPath();
        ctx.arc(tip[0], tip[1], unit * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [reference]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
