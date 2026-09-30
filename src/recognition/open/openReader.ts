import { frameErrors } from "../errors/frameChecks";
import { createHintEngine, type HintError } from "../errors/hintEngine";
import type { Knn } from "../letters/knn";
import type { HintLogEntry } from "../letters/practice";
import type { LetterSpec } from "../letters/spec";
import { isOpenPalm } from "../control/poses";
import type { HandObservation } from "../observation";
import { createHold, createMajorityVote } from "../smoothing";
import {
  LETTER_HOLD_GRACE_MS,
  TALK_AMBIGUOUS_LATCH_MS,
  TALK_LETTER_HOLD_MS,
  TALK_RELEASE_MS,
  TALK_VOTE_SHARE,
  TALK_VOTE_WINDOW,
} from "../thresholds";
import { AMBIGUOUS_HINT_CODE, decideFrame, type OpenDecision } from "./decision";
import { rankLetters, type RankedClass } from "./openClassifier";

/** Skeleton colour: green = typed / being typed, red = "almost" with a hint, grey = nothing sure. */
export type SkeletonTone = "accept" | "almost" | "neutral";

export type ReaderState = "noHand" | "neutral" | "accept" | "almost" | "ambiguous" | "suppressed";

export interface Ambiguity {
  labels: [string, string];
  hint: HintError;
}

export interface ReaderUpdate {
  /** Stable (voted) state of the last frames. */
  state: ReaderState;
  /** Stable letter of an accept / almost state. */
  label: string | null;
  /** 0..1 progress of holding the accepted letter. */
  holdProgress: number;
  /** The letter typed on this frame, if any. */
  accepted: string | null;
  /** The one hint to show (stable over time) and the letter it is about. */
  hint: HintError | null;
  hintLetter: string | null;
  /** «А или Б?» card, kept for a while so a command zone can pick one. */
  ambiguity: Ambiguity | null;
  tone: SkeletonTone | null;
  /** A just-typed letter that must be released before it can be typed again («НН»). */
  blocked: string | null;
  /** This frame's decision and top-3 ranking (debug panel). */
  decision: OpenDecision | null;
  top: RankedClass[];
}

export interface OpenReaderOptions {
  specs: readonly LetterSpec[];
  getSpec(letter: string): LetterSpec | undefined;
  knn?: Knn | null;
}

export interface OpenReader {
  /** `suppressed`: the hand is busy with a command (zone, candidate) — nothing is typed. */
  update(observation: HandObservation | null, timestamp: number, opts?: { suppressed?: boolean }): ReaderUpdate;
  setKnn(knn: Knn | null): void;
  /** A letter was picked from the «А или Б?» card: it counts as typed (needs a release to repeat). */
  resolve(letter: string): void;
  reset(): void;
  /** Letter hints shown so far (for the talk summary). */
  readonly hintLog: readonly HintLogEntry[];
}

export const RELEASE_HINT_CODE = "talk.release";

/**
 * Talk mode fingerspelling without an expected letter (docs/TRANSLATOR_SPEC.md §4.1, §7):
 * per-frame decision → majority vote → 0.6 s hold → letter typed. Never types while unsure:
 * "almost" and "ambiguous" only produce hints.
 */
export function createOpenReader({ specs, getSpec, knn: initialKnn = null }: OpenReaderOptions): OpenReader {
  let knn = initialKnn;
  const vote = createMajorityVote<string>(TALK_VOTE_WINDOW, TALK_VOTE_SHARE);
  const hold = createHold(TALK_LETTER_HOLD_MS, LETTER_HOLD_GRACE_MS);
  let hints = createHintEngine();
  const hintLog: HintLogEntry[] = [];
  /** Which letter a hint code was last about (shape hints do not name their letter). */
  const hintLetters = new Map<string, string>();
  let holdLabel: string | null = null;
  let blocked: string | null = null;
  let releaseSince: number | null = null;
  let latch: (Ambiguity & { left: number }) | null = null;
  let shownCode: string | null = null;
  let lastT: number | null = null;

  /** The blocked letter is released once it has not been seen for TALK_RELEASE_MS. */
  function trackRelease(seen: string | null, t: number) {
    if (blocked === null) return;
    if (seen === blocked) {
      releaseSince = null;
      return;
    }
    releaseSince ??= t;
    if (t - releaseSince >= TALK_RELEASE_MS) {
      blocked = null;
      releaseSince = null;
    }
  }

  function showHint(errors: readonly HintError[], t: number) {
    const hint = hints.update(errors, t);
    const code = hint?.hintCode ?? null;
    const letter = hint ? (hint.params?.a ?? hintLetters.get(hint.hintCode) ?? hint.params?.letter ?? null) : null;
    if (code !== shownCode) {
      shownCode = code;
      if (hint && hint.level !== "frame") hintLog.push({ letter: letter ?? "", hintCode: hint.hintCode, timestamp: t });
    }
    return { hint, letter };
  }

  const base = {
    label: null,
    holdProgress: 0,
    accepted: null,
    blocked: null,
    decision: null,
    top: [],
  };

  return {
    update(obs, t, { suppressed = false } = {}) {
      const dt = lastT === null ? 0 : Math.max(0, t - lastT);
      lastT = t;

      // An open palm is a command (cancel / exit), never a letter.
      if (suppressed || (obs !== null && isOpenPalm(obs))) {
        vote.reset();
        hold.reset();
        holdLabel = null;
        trackRelease(null, t);
        const { hint, letter } = showHint([], t);
        return { ...base, state: "suppressed", hint, hintLetter: letter, ambiguity: latch, tone: obs ? "neutral" : null, blocked };
      }

      const usable = obs !== null && frameErrors(obs.frame).length === 0;
      const ranked = usable && obs ? rankLetters(obs, knn, specs) : null;
      const d = decideFrame(obs, ranked, getSpec);

      const key =
        d.kind === "accept" || d.kind === "almost"
          ? `${d.kind}:${d.label}`
          : d.kind === "ambiguous"
            ? `ambiguous:${d.labels.join("")}`
            : obs
              ? "neutral"
              : "noHand";
      const stable = vote.push(key);
      const acceptLabel = stable?.startsWith("accept:") ? stable.slice("accept:".length) : null;

      trackRelease(acceptLabel, t);
      if (acceptLabel !== holdLabel) {
        hold.reset();
        holdLabel = acceptLabel;
      }
      const { progress, fired } = hold.update(acceptLabel !== null && acceptLabel !== blocked, t);
      const accepted = fired ? acceptLabel : null;
      if (accepted) {
        blocked = accepted;
        releaseSince = null;
        latch = null;
      }

      // Hints: nothing while the letter is right; the hint engine keeps them from blinking.
      let errors: readonly HintError[];
      if (d.kind === "accept") {
        errors =
          d.label === blocked
            ? [{ level: "control", hintCode: RELEASE_HINT_CODE, severity: 0.5, params: { letter: d.label } }]
            : [];
      } else if (d.kind === "almost") {
        for (const e of d.errors) hintLetters.set(e.hintCode, d.label);
        errors = d.errors;
      } else if (d.kind === "ambiguous") {
        errors = [d.hint];
      } else {
        // No hand is normal between words: not a hint.
        errors = d.errors.filter((e) => e.hintCode !== "frame.noHand");
      }
      const { hint, letter } = showHint(errors, t);

      if (hint?.hintCode === AMBIGUOUS_HINT_CODE && hint.params?.a && hint.params.b) {
        latch = { labels: [hint.params.a, hint.params.b], hint, left: TALK_AMBIGUOUS_LATCH_MS };
      } else if (latch) {
        latch.left -= dt;
        if (latch.left <= 0) latch = null;
      }

      const kind = stable?.split(":")[0];
      const state: ReaderState =
        kind === "accept" || kind === "almost" || kind === "ambiguous" || kind === "noHand" ? kind : "neutral";
      const label = stable && (kind === "accept" || kind === "almost") ? stable.slice(kind.length + 1) : null;
      const tone: SkeletonTone | null = !obs
        ? null
        : acceptLabel !== null
          ? "accept"
          : hint && (hint.level === "shape" || hint.level === "confusion")
            ? "almost"
            : "neutral";

      return {
        state,
        label,
        holdProgress: progress,
        accepted,
        hint,
        hintLetter: letter,
        ambiguity: latch,
        tone,
        blocked,
        decision: d,
        top: ranked?.ranking.slice(0, 3) ?? [],
      };
    },
    setKnn(next) {
      knn = next;
    },
    resolve(letter) {
      blocked = letter;
      releaseSince = null;
      latch = null;
      vote.reset();
      hold.reset();
      holdLabel = null;
    },
    reset() {
      vote.reset();
      hold.reset();
      hints = createHintEngine();
      hintLetters.clear();
      holdLabel = null;
      blocked = null;
      releaseSince = null;
      latch = null;
      shownCode = null;
      lastT = null;
    },
    get hintLog() {
      return hintLog;
    },
  };
}
