import { strings } from "../data/strings.ru";
import { useUi } from "../store/ui";
import { GestureButton } from "./GestureButton";
import s from "./Help.module.css";
import { Icon } from "./Icon";

/** «?» — opens the detailed gesture help; a pinch, a dwell or a tap. */
export function HelpButton({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const setHelpOpen = useUi((st) => st.setHelpOpen);
  return (
    <GestureButton
      className={`${s.button} ${withLabel ? s.withLabel : ""} ${className ?? ""}`}
      onClick={() => setHelpOpen(true)}
      aria-label={strings.help.open}
      title={strings.help.open}
    >
      <Icon name="help" size={28} />
      {withLabel && <span className={s.buttonLabel}>{strings.help.open}</span>}
    </GestureButton>
  );
}
