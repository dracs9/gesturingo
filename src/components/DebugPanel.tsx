import { useEffect, useRef } from "react";
import { strings } from "../data/strings.ru";
import { palmSize } from "../recognition/errors/frameChecks";
import { FINGERS } from "../recognition/features";
import { getStats } from "../recognition/pipeline";
import { getControlStats } from "../store/controlStats";
import { getLetterStats } from "../store/letterStats";
import { getMotionStats, getTalkStats } from "../store/talkStats";
import s from "./DebugPanel.module.css";

const REFRESH_MS = 250;

/** `?debug=1` overlay. Writes textContent directly to avoid React re-renders every frame. */
export function DebugPanel() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const t = strings.debug;
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const { fps, delegate, observation } = getStats();
      const lines = [`${t.fps}: ${fps.toFixed(1)}`, `${t.delegate}: ${delegate ?? t.none}`];

      if (observation) {
        const { frame, features } = observation;
        lines.push(
          `${t.hand}: ${frame.handedness} (${frame.score.toFixed(2)})`,
          `${t.palmSize}: ${palmSize(frame).toFixed(3)}`,
          `${t.palmFacing}: ${strings.palmFacing[features.palmFacing]} (n.z ${features.palmNormal.z.toFixed(2)})`,
          `${t.thumbPosition}: ${strings.thumbPosition[features.thumbPosition]}`,
          "",
          ...FINGERS.map((f) => {
            const { angles, angle, state } = features.fingers[f];
            const name = strings.fingers[f].padEnd(12);
            const joints = angles.map((a) => a.toFixed(0).padStart(3)).join(" ");
            return `${name} ${strings.fingerStates[state].padEnd(10)} ${angle.toFixed(0).padStart(3)}° [${joints}]`;
          }),
        );
      } else {
        lines.push(`${t.hand}: ${t.none}`);
      }

      const control = getControlStats();
      if (control) {
        const { pinchRatio, pinchState, wristSpeed } = control.debug;
        const pose = control.pose ? `${control.pose.kind} ${(control.pose.progress * 100).toFixed(0)}%` : t.none;
        lines.push(
          "",
          `${t.pinch}: ${pinchRatio === null ? t.none : pinchRatio.toFixed(2)} (${pinchState})`,
          `${t.speed}: ${wristSpeed.toFixed(2)}`,
          `${t.pose}: ${pose}`,
          `${t.dwell}: ${(control.cursor.dwell * 100).toFixed(0)}%`,
        );
      }

      const letter = getLetterStats();
      if (letter) {
        const d = letter.decision;
        const knn = d?.knn
          ? d.knn.prediction.ranking
              .slice(0, 3)
              .map((r) => `${r.label} ${r.votes}`)
              .join(" · ")
          : t.knnOff;
        lines.push(
          "",
          `${t.letter}: ${letter.letter}`,
          `${t.rules}: ${d ? (d.rulesOk ? "✓" : "✗") : t.none}`,
          `kNN: ${knn}${d?.knn ? ` (${d.knn.prediction.neighbors[0]?.distance.toFixed(2) ?? ""})` : ""}`,
        );
      }
      const talk = getTalkStats();
      if (talk) {
        const d = talk.decision;
        const margin = d && "margin" in d && Number.isFinite(d.margin) ? d.margin.toFixed(2) : t.none;
        lines.push(
          "",
          `${t.talk}: ${talk.state}${talk.label ? ` ${talk.label}` : ""} (${d?.kind ?? t.none})`,
          `${t.talkTop}: ${talk.top.map((c) => `${c.label} ${c.distance.toFixed(2)}`).join(" · ") || t.none}`,
          `${t.talkMargin}: ${margin}`,
          `${t.talkBlocked}: ${talk.blocked ?? t.none}`,
        );
      }
      const motion = getMotionStats();
      if (motion) {
        lines.push(
          `${t.motion}: ${motion.speed.toFixed(2)}${motion.moving ? " ▶" : ""}`,
          `DTW: ${motion.top.map((c) => `${c.label} ${c.score.toFixed(2)}`).join(" · ") || t.none}`,
        );
      }
      el.textContent = lines.join("\n");
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  return <pre ref={ref} className={s.panel} />;
}
