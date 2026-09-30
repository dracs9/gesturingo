import c from "./Letters.module.css";

/** Motion is off for people who asked the system for less of it. */
function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The wrist path of a dynamic phrase's main template, as the user sees it (mirrored), with a dot
 * running along it — «анимация шаблона траектории» for the team's check (docs/TRANSLATOR_SPEC.md §9).
 */
export function PathPreview({ path, label }: { path: readonly { x: number; y: number }[]; label: string }) {
  if (path.length < 2) return null;
  const pts = path.map((p) => ({ x: -p.x, y: p.y }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const span = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const scaled = pts.map((p) => ({ x: 50 + ((p.x - cx) / span) * 70, y: 50 + ((p.y - cy) / span) * 70 }));
  const d = scaled.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const start = scaled[0];
  return (
    <svg className={c.skeleton} viewBox="0 0 100 100" role="img" aria-label={label}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {start && <circle cx={start.x} cy={start.y} r="3" fill="var(--text-muted)" />}
      <circle r="4.5" fill="var(--mark)" stroke="var(--text)" strokeWidth="1">
        {!reducedMotion() && <animateMotion dur="1.8s" repeatCount="indefinite" path={d} />}
      </circle>
    </svg>
  );
}
