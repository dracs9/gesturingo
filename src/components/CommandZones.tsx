import { forwardRef } from "react";
import { strings } from "../data/strings.ru";
import { ZONE_IDS, type ZoneId } from "../recognition/control/commandZones";
import { TALK_ZONES } from "../recognition/thresholds";
import s from "./CommandZones.module.css";
import { HoldRing } from "./HoldRing";

interface CommandZonesProps {
  /** Replaces a zone's label, e.g. the two letters of an «А или Б?» choice. */
  labels?: Partial<Record<ZoneId, string>>;
}

/** Semi-transparent command zones over the camera view (drawn unmirrored, as the user sees them). */
export const CommandZones = forwardRef<HTMLDivElement, CommandZonesProps>(function CommandZones({ labels }, ref) {
  const t = strings.talk;
  return (
    <div ref={ref} className={s.zones} aria-hidden="true">
      {ZONE_IDS.map((id) => {
        const r = TALK_ZONES[id];
        const label = labels?.[id];
        return (
          <div
            key={id}
            data-zone={id}
            className={label ? `${s.zone} ${s.pick}` : s.zone}
            style={{
              left: `${r.x0 * 100}%`,
              top: `${r.y0 * 100}%`,
              width: `${(r.x1 - r.x0) * 100}%`,
              height: `${(r.y1 - r.y0) * 100}%`,
            }}
          >
            <HoldRing className={s.ring}>
              <span className={s.icon}>{label ?? t.zoneIcons[id]}</span>
            </HoldRing>
            <span className={s.label}>{label ? t.pick : t.zones[id]}</span>
          </div>
        );
      })}
    </div>
  );
});
