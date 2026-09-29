import { strings } from "../data/strings.ru";
import s from "./Stars.module.css";

/** 0–3 stars, earned ones gold; the count is also given as text (not colour only). */
export function Stars({ value, className }: { value: number; className?: string }) {
  const n = Math.max(0, Math.min(3, Math.round(value)));
  return (
    <span className={`${s.stars} ${className ?? ""}`} role="img" aria-label={strings.progress.starsLabel(n)}>
      {"★".repeat(n)}
      <span className={s.off}>{"★".repeat(3 - n)}</span>
    </span>
  );
}
