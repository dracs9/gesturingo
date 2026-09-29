import { frameErrors } from "../errors/frameChecks";
import type { HintError } from "../errors/hintEngine";
import type { HandObservation } from "../observation";
import { classifyLetter, type LetterDecision } from "./classifier";
import type { Knn } from "./knn";
import { createLetterPractice, type LetterPractice } from "./practice";
import type { LetterSpec } from "./spec";

export interface SpellUpdate {
  /** Index of the letter being shown now (= number of letters already spelled). */
  index: number;
  /** The letter accepted on this frame, if any. */
  accepted: string | null;
  done: boolean;
  hint: HintError | null;
  holdProgress: number;
  /** A repeated letter (e.g. «НН»): the hand must change before the second one counts. */
  awaitingRelease: boolean;
  decision: LetterDecision | null;
}

export interface WordSpeller {
  update(observation: HandObservation | null, timestamp: number): SpellUpdate;
  setKnn(knn: Knn | null): void;
  readonly letters: readonly string[];
}

/**
 * Spelling a word letter by letter (Bridge, CLAUDE.md §10.5): each letter is practised like in a lesson
 * (rules + kNN → 1 s hold, with error-mode hints); letters without a spec are not allowed in `word`.
 */
export function createWordSpeller(
  word: string,
  getSpec: (letter: string) => LetterSpec | undefined,
  initialKnn: Knn | null = null,
): WordSpeller {
  const letters = Array.from(word);
  let knn = initialKnn;
  let index = 0;
  let done = letters.length === 0;
  let awaitingRelease = false;

  const practiceFor = (i: number): LetterPractice | null => {
    const spec = getSpec(letters[i] ?? "");
    return spec ? createLetterPractice(spec, knn) : null;
  };
  let practice = practiceFor(0);

  const idle = (hint: HintError | null = null): SpellUpdate => ({
    index,
    accepted: null,
    done,
    hint,
    holdProgress: 0,
    awaitingRelease,
    decision: null,
  });

  return {
    letters,
    update(obs, t) {
      const letter = letters[index];
      const spec = letter ? getSpec(letter) : undefined;
      if (done || !practice || !letter || !spec) return idle();

      if (awaitingRelease) {
        const stillShown = obs !== null && frameErrors(obs.frame).length === 0 && classifyLetter(spec, obs, knn).correct;
        if (stillShown) {
          return idle({ level: "control", hintCode: "bridge.release", severity: 1, params: { letter } });
        }
        awaitingRelease = false;
      }

      const u = practice.update(obs, t);
      if (!u.accepted) {
        return { index, accepted: null, done, hint: u.hint, holdProgress: u.holdProgress, awaitingRelease, decision: u.decision };
      }

      index += 1;
      if (index >= letters.length) {
        done = true;
      } else {
        practice = practiceFor(index);
        awaitingRelease = letters[index] === letter;
      }
      return { index, accepted: letter, done, hint: null, holdProgress: 0, awaitingRelease, decision: u.decision };
    },
    setKnn(next) {
      knn = next;
      practice?.setKnn(next);
    },
  };
}
