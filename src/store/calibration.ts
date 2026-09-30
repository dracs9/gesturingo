import { create } from "zustand";
import type { Calibration } from "../recognition/control/calibration";

export type CalibrationPhase = "pending" | "done" | "skipped";

interface CalibrationState {
  /** "pending" = the talk screen asks for the open palm first. */
  phase: CalibrationPhase;
  calibration: Calibration | null;
  finish(calibration: Calibration): void;
  skip(): void;
  restart(): void;
}

/**
 * Talk-mode calibration (docs/TRANSLATOR_SPEC.md §4.5). Kept for the session only: the camera and the
 * person may change between visits, and a stale calibration would give wrong position hints.
 */
export const useCalibration = create<CalibrationState>()((set) => ({
  phase: "pending",
  calibration: null,
  finish: (calibration) => set({ phase: "done", calibration }),
  skip: () => set({ phase: "skipped", calibration: null }),
  restart: () => set({ phase: "pending", calibration: null }),
}));
