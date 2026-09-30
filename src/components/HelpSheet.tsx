import { useCallback, useEffect, useRef } from "react";
import { strings } from "../data/strings.ru";
import type { GestureContext } from "../recognition/gestureContext";
import { navigate, paths, type Route } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { useUi } from "../store/ui";
import { GestureButton } from "./GestureButton";
import s from "./Help.module.css";

interface HelpSheetProps {
  screen: Route["name"];
  context: GestureContext;
}

const CONTROLS = [
  { id: "cursor", icon: "☝️" },
  { id: "pinch", icon: "🤏" },
  { id: "thumbUp", icon: "👍" },
  { id: "openPalm", icon: "✋" },
] as const;

type ControlId = (typeof CONTROLS)[number]["id"];

const isActive = (id: ControlId, c: GestureContext) =>
  id === "cursor" || id === "pinch" ? c.cursor : id === "thumbUp" ? c.ok : c.back;

/**
 * «Как пользоваться»: what each control gesture does and how to show it, what matters on this screen,
 * and the way to the gesture tutorial. Thumbs up or an open palm closes it (not the screen underneath).
 */
export function HelpSheet({ screen, context }: HelpSheetProps) {
  const t = strings.help;
  const setHelpOpen = useUi((st) => st.setHelpOpen);
  const close = useCallback(() => setHelpOpen(false), [setHelpOpen]);
  const sheetRef = useRef<HTMLElement>(null);

  // Registered last, so the poses close the sheet instead of acting on the screen below.
  useGestureCommands({ ok: close, back: close });

  useEffect(() => {
    // The dialog itself takes focus: focusing a button at the bottom would scroll the title away.
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const section = screen === "lesson" ? t.lesson : screen === "bridge" ? t.bridge : screen === "talk" ? t.talk : null;
  // Talk has no cursor or poses: its own commands say it all.
  const showControls = screen !== "talk";

  const toTutorial = () => {
    close();
    navigate(paths.tutorial());
  };

  return (
    <div className={s.backdrop} onClick={close}>
      <section
        ref={sheetRef}
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="help-title" className={s.title}>
          {section?.title ?? t.title}
        </h2>

        {section && (
          <ol className={s.steps}>
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        )}
        {section && "note" in section && <p className={s.note}>{section.note}</p>}

        {showControls && (
          <>
            <h3 className={s.subtitle}>{t.controlsTitle}</h3>
            <ul className={s.controls}>
              {CONTROLS.map(({ id, icon }) => {
                const active = isActive(id, context);
                return (
                  <li key={id} className={active ? s.control : `${s.control} ${s.off}`}>
                    <span className={s.icon} aria-hidden="true">
                      {icon}
                    </span>
                    <span>
                      <strong className={s.name}>
                        {t.controls[id].name}
                        {!active && <span className={s.offLabel}> — {t.off}</span>}
                      </strong>
                      <span className={s.how}>{t.controls[id].how}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className={s.note}>{t.mouse}</p>

        <div className={s.actions}>
          <GestureButton onClick={close}>{t.close}</GestureButton>
          {screen !== "tutorial" && (
            <GestureButton variant="primary" onClick={toTutorial}>
              {t.tutorial}
            </GestureButton>
          )}
        </div>
      </section>
    </div>
  );
}
