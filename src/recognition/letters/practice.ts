import { frameErrors } from "../errors/frameChecks";
import { createHintEngine, type HintError } from "../errors/hintEngine";
import type { HandObservation } from "../observation";
import { createHold, createMajorityVote } from "../smoothing";
import { LETTER_HOLD_GRACE_MS, LETTER_HOLD_MS, LETTER_VOTE_SHARE, LETTER_VOTE_WINDOW } from "../thresholds";
import { checkLetter } from "./rules";
import type { LetterSpec } from "./spec";

/** One shown hint, for the results screen and "repeat weak letters" (CLAUDE.md §9.2). */
export interface HintLogEntry {
  letter: string;
  hintCode: string;
  timestamp: number;
}

export interface PracticeUpdate {
  /** The one hint to show now (frame problems first), or null. */
  hint: HintError | null;
  /** Codes of violated letter conditions this frame (for the live checklist). */
  failing: string[];
  /** The hand is visible and well placed. */
  frameOk: boolean;
  /** 0..1 progress of holding the correct shape. */
  holdProgress: number;
  /** True on the frame the letter is accepted. */
  accepted: boolean;
}

export interface LetterPractice {
  update(observation: HandObservation | null, timestamp: number): PracticeUpdate;
  /** Letter-level hints shown so far (frame hints like «подойди ближе» are not the learner's mistake). */
  readonly hintLog: readonly HintLogEntry[];
}

/** 3 stars without hints, 2 with one, 1 with two or more (CLAUDE.md §10.4). */
export function starsForHints(hints: number): 1 | 2 | 3 {
  return hints === 0 ? 3 : hints === 1 ? 2 : 1;
}

/** Practising one letter: rules → voting → 1 s hold, with one stable hint at a time. */
export function createLetterPractice(spec: LetterSpec): LetterPractice {
  const vote = createMajorityVote<boolean>(LETTER_VOTE_WINDOW, LETTER_VOTE_SHARE);
  const hold = createHold(LETTER_HOLD_MS, LETTER_HOLD_GRACE_MS);
  const hints = createHintEngine();
  const hintLog: HintLogEntry[] = [];
  let shownCode: string | null = null;

  return {
    update(obs, t) {
      const frame = frameErrors(obs?.frame ?? null);
      const shape = frame.length === 0 && obs ? checkLetter(spec, obs.features) : [];
      const correct = obs !== null && frame.length === 0 && shape.length === 0;

      const stable = vote.push(correct) === true;
      const { progress, fired } = hold.update(stable, t);

      // Top-down: while the frame is wrong, letter errors are not shown.
      const hint = hints.update(correct ? [] : frame.length > 0 ? frame : shape, t);
      const code = hint?.hintCode ?? null;
      if (code !== shownCode) {
        shownCode = code;
        if (hint && hint.level !== "frame") hintLog.push({ letter: spec.letter, hintCode: hint.hintCode, timestamp: t });
      }

      return {
        hint,
        failing: shape.map((e) => e.code),
        frameOk: frame.length === 0 && obs !== null,
        holdProgress: progress,
        accepted: fired,
      };
    },
    get hintLog() {
      return hintLog;
    },
  };
}
