import { forwardRef } from "react";
import s from "./Correction.module.css";

/**
 * Visual part of a talk-mode hint over the video (docs/TRANSLATOR_SPEC.md §7.2): a straight arrow from
 * the hand to the target zone («чуть выше»), or a rotation arrow at the hand («поверните ладонь»).
 * Painted per frame by `paintCorrection` — no React re-render.
 */
export const CorrectionArrow = forwardRef<HTMLDivElement>(function CorrectionArrow(_props, ref) {
  return (
    <div ref={ref} className={s.correction} aria-hidden="true">
      <svg className={s.arrowSvg}>
        <defs>
          <marker id="talk-arrow-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" className={s.arrowHead} />
          </marker>
        </defs>
        <line data-move="" className={s.arrowLine} markerEnd="url(#talk-arrow-head)" x1="0" y1="0" x2="0" y2="0" />
      </svg>
      <svg data-rotate="" className={s.rotate} viewBox="0 0 48 48">
        <path d="M38 24a14 14 0 1 1-4.1-9.9" className={s.rotatePath} />
        <path d="M36 6 L36 16 L26 16" className={s.rotatePath} />
      </svg>
    </div>
  );
});
