import { useEffect, useRef } from "react";
import { strings } from "../data/strings.ru";
import { palmSize } from "../recognition/errors/frameChecks";
import { getStats } from "../recognition/pipeline";
import s from "./DebugPanel.module.css";

const REFRESH_MS = 250;

/** `?debug=1` overlay. Writes textContent directly to avoid React re-renders every frame. */
export function DebugPanel() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const t = strings.debug;
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const { fps, delegate, frame } = getStats();
      el.textContent = [
        `${t.fps}: ${fps.toFixed(1)}`,
        `${t.delegate}: ${delegate ?? t.none}`,
        `${t.hand}: ${frame ? frame.handedness : t.none}`,
        `${t.score}: ${frame ? frame.score.toFixed(2) : t.none}`,
        `${t.palm}: ${frame ? palmSize(frame).toFixed(3) : t.none}`,
      ].join("\n");
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  return <pre ref={ref} className={s.panel} />;
}
