import type { Calibration } from "../recognition/control/calibration";
import { TALK_POSITION_TOLERANCE_X, TALK_POSITION_TOLERANCE_Y } from "../recognition/thresholds";
import s from "./Correction.module.css";

/**
 * The calibrated signing place as a dashed ellipse over the (mirrored) video — faint normally,
 * highlighted while a position hint asks to move there (docs/TRANSLATOR_SPEC.md §7.2).
 */
export function TargetZone({ calibration, active }: { calibration: Calibration; active: boolean }) {
  const { center, palm, aspect } = calibration;
  const width = ((2 * TALK_POSITION_TOLERANCE_X * palm) / aspect) * 100;
  const height = 2 * TALK_POSITION_TOLERANCE_Y * palm * 100;
  return (
    <div
      className={active ? `${s.target} ${s.targetActive}` : s.target}
      style={{
        left: `${(1 - center.x) * 100}%`,
        top: `${center.y * 100}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      aria-hidden="true"
    />
  );
}
