import { useEffect, useRef } from "react";
import { strings } from "../data/strings.ru";
import { createControlLayer } from "../recognition/control/controller";
import type { GestureContext } from "../recognition/gestureContext";
import { onFrame } from "../recognition/pipeline";
import { setControlStats } from "../store/controlStats";
import { runCommand } from "../store/gestureCommands";
import s from "./GestureLayer.module.css";
import { HoldRing } from "./HoldRing";

const TARGET_SELECTOR = "[data-gesture-target]";

function hitTest(x: number, y: number): HTMLElement | null {
  const target = document.elementFromPoint(x, y)?.closest<HTMLElement>(TARGET_SELECTOR) ?? null;
  if (!target || (target instanceof HTMLButtonElement && target.disabled)) return null;
  return target;
}

function setData(el: HTMLElement, key: string, value: string): void {
  if (el.dataset[key] !== value) el.dataset[key] = value;
}

interface GestureLayerProps {
  context: GestureContext;
}

/**
 * Hand-control overlay: cursor, dwell ring, click ripple and pose hold indicator.
 * Runs on every tracker frame and writes to the DOM directly — React only re-renders on context change.
 */
export function GestureLayer({ context }: GestureLayerProps) {
  const contextRef = useRef(context);
  const cursorRef = useRef<HTMLDivElement>(null);
  const rippleHostRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef<HTMLDivElement>(null);
  const poseRingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    const layer = createControlLayer<HTMLElement>({ hitTest });
    let hovered: HTMLElement | null = null;

    const setHovered = (el: HTMLElement | null, dwell: number) => {
      if (hovered !== el) {
        hovered?.removeAttribute("data-gesture-hover");
        hovered?.style.removeProperty("--dwell");
        el?.setAttribute("data-gesture-hover", "");
        hovered = el;
      }
      el?.style.setProperty("--dwell", dwell.toFixed(3));
    };

    const ripple = (x: number, y: number) => {
      const host = rippleHostRef.current;
      if (!host) return;
      const el = document.createElement("div");
      el.className = s.ripple ?? "";
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.addEventListener("animationend", () => el.remove());
      host.appendChild(el);
    };

    const unsubscribe = onFrame((observation) => {
      const out = layer.update(observation, performance.now(), contextRef.current, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setControlStats(out);

      const cursor = cursorRef.current;
      if (cursor) {
        cursor.style.transform = `translate(${out.cursor.x}px, ${out.cursor.y}px)`;
        cursor.style.setProperty("--dwell", out.cursor.dwell.toFixed(3));
        setData(cursor, "visible", String(out.cursor.visible));
        setData(cursor, "hover", String(out.cursor.hover !== null));
        setData(cursor, "pinched", String(out.cursor.pinched));
      }
      setHovered(out.cursor.visible ? out.cursor.hover : null, out.cursor.dwell);

      const pose = poseRef.current;
      if (pose) {
        setData(pose, "kind", out.pose?.kind ?? "none");
        poseRingRef.current?.style.setProperty("--progress", (out.pose?.progress ?? 0).toFixed(3));
      }

      if (out.click) {
        ripple(out.click.x, out.click.y);
        out.click.target?.click();
      }
      if (out.command) runCommand(out.command);
    });

    return () => {
      unsubscribe();
      setHovered(null, 0);
      setControlStats(null);
    };
  }, []);

  return (
    <>
      <div ref={poseRef} className={s.pose} data-kind="none" role="status" aria-live="polite">
        <HoldRing ref={poseRingRef} size={84}>
          <span className={s.poseOk}>👍</span>
          <span className={s.poseBack}>✋</span>
        </HoldRing>
        <span className={`${s.poseLabel} ${s.poseOk}`}>{strings.poses.ok}</span>
        <span className={`${s.poseLabel} ${s.poseBack}`}>{strings.poses.back}</span>
      </div>
      <div ref={rippleHostRef} className={s.layer} aria-hidden="true" />
      <div ref={cursorRef} className={s.cursor} data-visible="false" aria-hidden="true">
        <svg className={s.dwell} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" />
        </svg>
        <div className={s.dot} />
      </div>
    </>
  );
}
