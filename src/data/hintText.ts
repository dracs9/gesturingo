import type { HintError } from "../recognition/errors/hintEngine";
import { strings } from "./strings.ru";

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** User-facing text of a hint, filling templated ones (e.g. «Похоже на «О» — соедини кончики…»). */
export function hintText(hint: Pick<HintError, "hintCode" | "params"> | null): string | null {
  if (!hint) return null;
  if (hint.hintCode === "bridge.release") return strings.bridge.release(hint.params?.letter ?? "?");
  if (hint.hintCode === "confusion.looksLike") {
    const letter = hint.params?.letter ?? "?";
    const adviceCode = hint.params?.advice;
    const advice = adviceCode ? strings.hints[adviceCode] : undefined;
    return strings.confusion.looksLike(letter, advice ? lowerFirst(advice) : null);
  }
  return strings.hints[hint.hintCode] ?? null;
}
