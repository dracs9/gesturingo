import s from "./SubtitleOverlay.module.css";

export interface Subtitle {
  text: string;
  /** false while the words may still change (shown dimmer). */
  final: boolean;
}

/** The hearing person's words over the bottom of the video, so the signer need not look at the feed. */
export function SubtitleOverlay({ subtitle }: { subtitle: Subtitle | null }) {
  if (!subtitle || subtitle.text === "") return null;
  return (
    <p className={`${s.subtitle} ${subtitle.final ? s.final : s.interim}`} aria-live="polite">
      <span aria-hidden="true">🎤 </span>
      {subtitle.text}
    </p>
  );
}
