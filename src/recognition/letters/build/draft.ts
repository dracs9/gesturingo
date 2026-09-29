import { FINGERS, type Finger, type FingerState } from "../../features";
import { fingerHintCode, touchHintCode } from "../hintCodes";
import type { LetterExtra, LetterSpec } from "../spec";
import { FINGER_PAIRS, type LetterStats } from "./stats";

/** A rule is only drafted when at least this share of samples agree (otherwise people differ). */
export const RULE_MIN_SHARE = 0.8;

export interface SpecDraft {
  spec: LetterSpec;
  /** Fingers without a rule: no state reaches RULE_MIN_SHARE. */
  freeFingers: Finger[];
  /** Touching pairs left out because both fingers are bent anyway (tips of a fist always meet). */
  impliedTouches: string[];
}

/**
 * Rules straight from the data: a finger gets its dominant state if ≥ `minShare` of the samples
 * show it; a fingertip contact becomes `tipsTouch` under the same condition. Never verified —
 * the team checks every draft against the official table (CLAUDE.md §8.1).
 */
export function draftSpec(letter: string, stats: LetterStats, minShare = RULE_MIN_SHARE): SpecDraft {
  const fingers: LetterSpec["fingers"] = {};
  const typical: Partial<Record<Finger, FingerState>> = {};
  const freeFingers: Finger[] = [];
  for (const f of FINGERS) {
    const states = stats.fingers[f].states;
    const [state, share] = (Object.entries(states) as [FingerState, number][]).reduce((best, cur) =>
      cur[1] > best[1] ? cur : best,
    );
    typical[f] = state;
    if (share >= minShare) fingers[f] = { state, hintCode: fingerHintCode(f, state) };
    else freeFingers.push(f);
  }

  const extra: LetterExtra[] = [];
  const impliedTouches: string[] = [];
  for (const [a, b] of FINGER_PAIRS) {
    if ((stats.tipsTouch[`${a}-${b}`] ?? 0) < minShare) continue;
    if (fingers[a]?.state === "bent" && fingers[b]?.state === "bent") {
      impliedTouches.push(`${a}-${b}`);
      continue;
    }
    extra.push({ type: "tipsTouch", a, b, hintCode: touchHintCode(a, b) });
  }

  const spec: LetterSpec = {
    letter,
    verified: false,
    fingers,
    ...(extra.length > 0 ? { extra } : {}),
    typical,
    reference: `references/${letter}.json`,
  };
  return { spec, freeFingers, impliedTouches };
}
