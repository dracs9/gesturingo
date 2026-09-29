import type { Finger } from "../features";
import { HINT_APPEAR_MS, HINT_GRACE_MS, HINT_MIN_SWITCH_MS } from "../thresholds";

/** Checks run top-down: a frame problem hides control/letter problems (CLAUDE.md §9.1). */
export type HintLevel = "frame" | "control" | "confusion" | "shape";

const LEVEL_RANK: Record<HintLevel, number> = { frame: 0, control: 1, confusion: 2, shape: 3 };

export interface HintError {
  level: HintLevel;
  /** Key into `strings.hints`; also identifies the error. */
  hintCode: string;
  /** 0..1, higher = more important within a level. */
  severity: number;
  finger?: Finger;
  /** Landmarks to highlight on the skeleton. */
  landmarkIds?: readonly number[];
}

export function compareHints(a: HintError, b: HintError): number {
  return LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.severity - a.severity;
}

export interface HintEngineOptions {
  appearMs?: number;
  minSwitchMs?: number;
  graceMs?: number;
}

export interface HintEngine {
  /** Feed this frame's errors; returns the one hint to show (stable over time) or null. */
  update(errors: readonly HintError[], timestamp: number): HintError | null;
  readonly current: HintError | null;
  reset(): void;
}

export function createHintEngine({
  appearMs = HINT_APPEAR_MS,
  minSwitchMs = HINT_MIN_SWITCH_MS,
  graceMs = HINT_GRACE_MS,
}: HintEngineOptions = {}): HintEngine {
  // Per hintCode: since when it is continuously present, when last seen, latest payload.
  const tracked = new Map<string, { since: number; lastSeen: number; error: HintError }>();
  let current: HintError | null = null;
  let lastChange = -Infinity;

  return {
    update(errors, t) {
      for (const error of errors) {
        const entry = tracked.get(error.hintCode);
        if (entry) {
          entry.lastSeen = t;
          entry.error = error;
        } else {
          tracked.set(error.hintCode, { since: t, lastSeen: t, error });
        }
      }
      for (const [code, entry] of tracked) {
        if (t - entry.lastSeen > graceMs) tracked.delete(code);
      }

      const present = (code: string) => tracked.has(code);
      const eligible = [...tracked.values()]
        .filter((e) => t - e.since >= appearMs)
        .map((e) => e.error)
        .sort(compareHints);
      const best = eligible[0] ?? null;

      if (current && !present(current.hintCode)) {
        // Fixed: hide at once. The next hint still waits for its own delay and the switch interval.
        current = null;
        lastChange = t;
      }

      if (current) {
        const refreshed = tracked.get(current.hintCode)?.error ?? current;
        current = refreshed;
        if (best && best.hintCode !== current.hintCode && compareHints(best, current) < 0 && t - lastChange >= minSwitchMs) {
          current = best;
          lastChange = t;
        }
      } else if (best && t - lastChange >= minSwitchMs) {
        current = best;
        lastChange = t;
      }
      return current;
    },
    get current() {
      return current;
    },
    reset() {
      tracked.clear();
      current = null;
      lastChange = -Infinity;
    },
  };
}
