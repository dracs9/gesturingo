import s from "./HintBanner.module.css";

interface HintBannerProps {
  /** Hint text («что сделать»), or null to hide. */
  text: string | null;
  className?: string;
}

/** The single current error-mode hint: icon + large text, announced to screen readers. */
export function HintBanner({ text, className }: HintBannerProps) {
  return (
    <div className={`${s.slot} ${className ?? ""}`} role="status" aria-live="polite">
      {text && (
        <p key={text} className={s.banner}>
          <span className={s.icon} aria-hidden="true">
            !
          </span>
          {text}
        </p>
      )}
    </div>
  );
}
