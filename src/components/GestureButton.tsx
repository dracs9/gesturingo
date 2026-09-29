import type { ButtonHTMLAttributes } from "react";
import s from "./GestureButton.module.css";

interface GestureButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  /** Mouse/keyboard only — for buttons that must not be hit by a hand busy with something else. */
  noGesture?: boolean;
}

/**
 * Button that the hand cursor can press (pinch or dwell). GestureLayer finds it by
 * `data-gesture-target`, marks hover with `data-gesture-hover` and fills `--dwell` (0..1).
 * Mouse and keyboard keep working as a fallback.
 */
export function GestureButton({
  variant = "secondary",
  noGesture = false,
  className,
  type = "button",
  ...rest
}: GestureButtonProps) {
  return (
    <button
      type={type}
      data-gesture-target={noGesture ? undefined : ""}
      className={`${s.button} ${variant === "primary" ? s.primary : ""} ${className ?? ""}`}
      {...rest}
    />
  );
}
