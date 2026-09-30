import s from "./Correction.module.css";

/**
 * The template's path of a dynamic phrase over the video (docs/TRANSLATOR_SPEC.md §7.2, «призрачная
 * траектория»): where the hand should have gone, drawn from where the user's motion started.
 * Points are in display percent of the (mirrored) video.
 */
export function GhostPath({ points }: { points: readonly { x: number; y: number }[] }) {
  const last = points.at(-1);
  if (points.length < 2 || !last) return null;
  return (
    <svg className={s.ghost} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        className={s.ghostLine}
        points={points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}
        vectorEffect="non-scaling-stroke"
      />
      <circle className={s.ghostEnd} cx={last.x} cy={last.y} r="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
