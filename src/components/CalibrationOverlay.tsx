import type { Ref } from "react";
import { strings } from "../data/strings.ru";
import s from "./Correction.module.css";
import { HoldRing } from "./HoldRing";

interface CalibrationOverlayProps {
  /** Hold progress: `--progress` is set on it per frame. */
  ringRef: Ref<HTMLDivElement>;
  /** Seconds left before calibration is skipped: textContent set per frame. */
  remainingRef: Ref<HTMLSpanElement>;
}

/** Over the camera while talk mode calibrates (docs/TRANSLATOR_SPEC.md §4.5): «открытая ладонь на уровне груди». */
export function CalibrationOverlay({ ringRef, remainingRef }: CalibrationOverlayProps) {
  const t = strings.talk.calibration;
  return (
    <div className={s.calibration} role="status">
      <div className={s.chestGuide} aria-hidden="true" />
      <div className={s.calibrationCard}>
        <HoldRing ref={ringRef} className={s.calibrationRing}>
          <span className={s.calibrationIcon} aria-hidden="true">
            ✋
          </span>
        </HoldRing>
        <p className={s.calibrationTitle}>{t.text}</p>
        <p className={s.calibrationNote}>
          {t.note} <span ref={remainingRef}>10</span> {t.seconds}
        </p>
      </div>
    </div>
  );
}
