import { strings } from "../data/strings.ru";
import type { GestureContext } from "../recognition/gestureContext";
import s from "./GestureLegend.module.css";

interface GestureLegendProps {
  context: GestureContext;
}

/** Always-visible reminder of the control gestures; unavailable ones are dimmed and labelled. */
export function GestureLegend({ context }: GestureLegendProps) {
  const t = strings.gestureLegend;
  const items = [
    { icon: "☝️", label: t.cursor, active: context.cursor },
    { icon: "🤏", label: t.pinch, active: context.cursor },
    { icon: "👍", label: t.thumbUp, active: context.ok },
    { icon: "✋", label: t.openPalm, active: context.back },
  ];

  return (
    <ul className={s.legend} aria-label={t.title}>
      {items.map((item) => (
        <li key={item.label} className={item.active ? s.item : `${s.item} ${s.off}`}>
          <span className={s.icon} aria-hidden="true">
            {item.icon}
          </span>
          <span className={s.label}>
            {item.label}
            {!item.active && <span className={s.offLabel}> ({t.unavailable})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
