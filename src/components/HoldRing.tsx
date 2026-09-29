import { forwardRef, type CSSProperties, type ReactNode } from "react";
import s from "./HoldRing.module.css";

interface HoldRingProps {
  /** 0..1. Omit to drive it imperatively: `ref.current.style.setProperty("--progress", "0.4")`. */
  progress?: number;
  size?: number;
  className?: string;
  children?: ReactNode;
}

const R = 45;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Circular hold-progress ring with content (icon) in the middle. */
export const HoldRing = forwardRef<HTMLDivElement, HoldRingProps>(function HoldRing(
  { progress, size = 72, className, children },
  ref,
) {
  const style = {
    width: size,
    height: size,
    "--circumference": CIRCUMFERENCE,
    ...(progress !== undefined ? { "--progress": progress } : {}),
  } as CSSProperties;

  return (
    <div ref={ref} className={`${s.ring} ${className ?? ""}`} style={style}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className={s.track} cx="50" cy="50" r={R} />
        <circle className={s.bar} cx="50" cy="50" r={R} />
      </svg>
      {children && <div className={s.content}>{children}</div>}
    </div>
  );
});
