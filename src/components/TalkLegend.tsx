import { strings } from "../data/strings.ru";
import s from "./GestureLegend.module.css";

/** Gestures of the talk screen, in place of the control legend (there is no cursor here). */
export function TalkLegend() {
  const t = strings.talk.legend;
  const items = [
    { icon: "⬆️", label: t.zones },
    { icon: "⏸️", label: t.pause },
    { icon: "〰️", label: t.motion },
    { icon: "✋", label: t.cancel },
    { icon: "🚪", label: t.exit },
  ];
  return (
    <ul className={`${s.legend} ${s.compact}`} aria-label={strings.talk.legendTitle}>
      {items.map((item) => (
        <li key={item.label} className={s.item}>
          <span className={s.icon} aria-hidden="true">
            {item.icon}
          </span>
          <span className={s.label}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
