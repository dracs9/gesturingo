import { forwardRef } from "react";
import { strings } from "../data/strings.ru";
import type { ReaderState } from "../recognition/open/openReader";
import type { Candidate } from "../talk/composer";
import s from "./CandidateCard.module.css";
import { HintBanner } from "./HintBanner";
import { HoldRing } from "./HoldRing";

export interface ReadingView {
  state: ReaderState;
  label: string | null;
  hint: string | null;
  /** «А или Б?» choice: the two letters and the key difference. */
  ambiguity: { a: string; b: string; advice: string | null } | null;
}

interface CandidateCardProps {
  candidate: Candidate | null;
  reading: ReadingView;
  cancelled: boolean;
}

const STATE_ICONS: Record<ReaderState, string> = {
  noHand: "·",
  suppressed: "⬆",
  neutral: "…",
  accept: "✓",
  almost: "!",
  ambiguous: "?",
};

/**
 * What the camera reads now (docs/TRANSLATOR_SPEC.md §7.1), or the phrase about to be spoken with its
 * confirmation ring (§4.3). The ring is driven imperatively through the ref (`--progress`).
 */
export const CandidateCard = forwardRef<HTMLDivElement, CandidateCardProps>(function CandidateCard(
  { candidate, reading, cancelled },
  ringRef,
) {
  const t = strings.talk;

  if (candidate) {
    return (
      <div className={`${s.card} ${s.candidate}`} role="status">
        <p className={s.title}>{t.candidateTitle}</p>
        <div className={s.row}>
          <HoldRing ref={ringRef} className={s.ring}>
            <span className={s.icon} aria-hidden="true">
              🔊
            </span>
          </HoldRing>
          <p className={s.phrase}>{candidate.text}</p>
        </div>
        <p className={s.note}>✋ {t.candidateCancel}</p>
      </div>
    );
  }

  if (reading.ambiguity) {
    const { a, b, advice } = reading.ambiguity;
    return (
      <div className={`${s.card} ${s.almost}`} role="status">
        <p className={s.title}>
          <span aria-hidden="true">? </span>
          {t.ambiguousTitle(a, b)}
        </p>
        {advice && <p className={s.advice}>{advice}</p>}
        <p className={s.note}>{t.ambiguousPick}</p>
      </div>
    );
  }

  const { state, label } = reading;
  const stateText =
    state === "accept" || state === "almost" ? (label ? t.state[state](label) : t.state.neutral) : t.state[state];
  const tone = state === "accept" ? s.accept : state === "almost" || state === "ambiguous" ? s.almost : "";

  return (
    <div className={`${s.card} ${tone}`}>
      {cancelled && <p className={s.note}>{t.cancelled}</p>}
      <div className={s.row}>
        <HoldRing ref={ringRef} className={s.ring}>
          <span className={s.letter}>{label ?? "?"}</span>
        </HoldRing>
        <p className={s.state} role="status">
          <span className={s.stateIcon} aria-hidden="true">
            {STATE_ICONS[state]}
          </span>
          {stateText}
        </p>
      </div>
      <HintBanner text={reading.hint} />
    </div>
  );
});
