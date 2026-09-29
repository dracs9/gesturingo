import type { Finger, FingerState } from "../features";

const STATE_HINT: Record<FingerState, string> = {
  straight: "finger.straighten",
  half: "finger.round",
  bent: "finger.bend",
};

/** "Согни безымянный палец" & co.: what to do with `finger` to reach `state` (texts in strings.ru.ts). */
export function fingerHintCode(finger: Finger, state: FingerState): string {
  return `${STATE_HINT[state]}.${finger}`;
}

export function touchHintCode(a: Finger, b: Finger): string {
  return `tips.touch.${a}-${b}`;
}
