import { useEffect } from "react";
import { strings } from "../data/strings.ru";
import s from "./FacingOverlay.module.css";

/** Closes by itself: the phone goes back to the signer. */
const FACING_MS = 12000;

/**
 * «Повернуть к собеседнику» (docs/TRANSLATOR_SPEC.md §3.1): the signer's last phrase full screen in huge
 * letters, to show the phone to the hearing person. Tap / click anywhere to close.
 */
export function FacingOverlay({ text, onClose }: { text: string; onClose(): void }) {
  useEffect(() => {
    const id = window.setTimeout(onClose, FACING_MS);
    return () => window.clearTimeout(id);
  }, [onClose]);

  return (
    <button type="button" className={s.overlay} onClick={onClose} aria-label={strings.talk.facing.close}>
      <span className={s.who}>{strings.talk.facing.says}</span>
      <span className={s.text}>{text}</span>
      <span className={s.close}>{strings.talk.facing.close}</span>
    </button>
  );
}
