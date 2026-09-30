import { LM } from "../landmarks";
import type { HandObservation } from "../observation";
import { createHold } from "../smoothing";
import { POSE_GRACE_MS, TALK_ZONE_HOLD_MS, TALK_ZONES } from "../thresholds";

/**
 * Command zones along the top of the camera frame (docs/TRANSLATOR_SPEC.md §5): on the talk screen
 * the hands are busy with fingerspelling, so there is no cursor — raising the WRIST into a zone
 * and holding it there is the command. A fingertip in a zone never counts.
 */
export type ZoneId = keyof typeof TALK_ZONES;

export interface ZoneRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const ZONE_IDS = Object.keys(TALK_ZONES) as ZoneId[];

/** Zone under an image-normalized point. Zones are defined as the user sees them: the video is mirrored. */
export function zoneAt(
  point: { x: number; y: number },
  zones: Readonly<Record<ZoneId, ZoneRect>> = TALK_ZONES,
): ZoneId | null {
  const x = 1 - point.x;
  const { y } = point;
  return ZONE_IDS.find((id) => x >= zones[id].x0 && x <= zones[id].x1 && y >= zones[id].y0 && y <= zones[id].y1) ?? null;
}

export interface ZoneUpdate {
  /** Zone the wrist is in (or just left, within the grace time). */
  active: ZoneId | null;
  /** 0..1 hold progress in the active zone. */
  progress: number;
  /** The zone whose command fires on this frame. */
  fired: ZoneId | null;
}

export interface CommandZones {
  update(observation: HandObservation | null, timestamp: number): ZoneUpdate;
  reset(): void;
}

/** Fires once per entry after `holdMs` in the same zone; a new command needs leaving the zone first. */
export function createCommandZones(holdMs = TALK_ZONE_HOLD_MS): CommandZones {
  const hold = createHold(holdMs, POSE_GRACE_MS);
  let current: ZoneId | null = null;

  return {
    update(obs, t) {
      const wrist = obs?.frame.landmarks[LM.WRIST];
      const zone = wrist ? zoneAt(wrist) : null;
      if (zone !== null && zone !== current) {
        hold.reset();
        current = zone;
      }
      const { progress, fired } = hold.update(zone !== null, t);
      if (zone === null && progress === 0) current = null;
      return { active: zone ?? (progress > 0 ? current : null), progress, fired: fired ? current : null };
    },
    reset() {
      hold.reset();
      current = null;
    },
  };
}
