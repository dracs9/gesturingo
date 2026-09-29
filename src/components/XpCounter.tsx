import { useEffect, useRef } from "react";
import { strings } from "../data/strings.ru";
import s from "./XpCounter.module.css";

interface XpCounterProps {
  value: number;
  /** Count up from this value on mount (e.g. XP before the lesson). */
  from?: number;
}

const DURATION_MS = 900;

/** Total XP with a count-up animation; the number is written to the DOM directly while animating. */
export function XpCounter({ value, from = value }: XpCounterProps) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef(from);

  useEffect(() => {
    const el = numberRef.current;
    if (!el) return;
    const start = shownRef.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (start === value || reduce) {
      shownRef.current = value;
      el.textContent = String(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / DURATION_MS);
      const eased = 1 - (1 - k) ** 3;
      const current = Math.round(start + (value - start) * eased);
      shownRef.current = current;
      el.textContent = String(current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={s.xp} aria-label={strings.progress.xpLabel(value)}>
      <span ref={numberRef}>{from}</span>
      <span className={s.unit}>XP</span>
    </span>
  );
}
