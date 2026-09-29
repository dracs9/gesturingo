import { strings } from "../data/strings.ru";
import type { HandStatus as Status } from "../recognition/errors/frameChecks";
import { useSession } from "../store/session";
import s from "./HandStatus.module.css";

const ICONS: Record<Status, string> = {
  noHand: "✋",
  tooFar: "↔",
  tooClose: "↔",
  ok: "👍",
};

/** Always-visible indicator of whether the camera sees the hand (icon + text, not color only). */
export function HandStatus() {
  const status = useSession((st) => st.handStatus);
  return (
    <div className={`${s.pill} ${status === "ok" ? s.ok : s.warn}`} role="status" aria-live="polite">
      <span className={s.icon} aria-hidden="true">
        {ICONS[status]}
      </span>
      {strings.handStatus[status]}
    </div>
  );
}
