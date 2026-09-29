import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { flattenPoints } from "../normalize";
import { buildObservation } from "../observation";
import { classifyLetter } from "./classifier";
import { createKnn, type LabeledVector } from "./knn";
import type { LetterSpec } from "./spec";

const obs = (hand: SyntheticHandOptions) => buildObservation(toFrame(canonicalHand(hand)));
const samples = (label: string, hand: SyntheticHandOptions, n = 6): LabeledVector[] =>
  Array.from({ length: n }, () => ({ label, vector: flattenPoints(canonicalHand(hand)) }));

// Two test letters differing only in the thumb; the rules of "Ъ" deliberately say nothing about the thumb.
const LOOSE: LetterSpec = {
  letter: "Ъ",
  verified: false,
  fingers: { index: { state: "straight", hintCode: "finger.straighten.index" } },
  confusedWith: ["Ь"],
  reference: "",
};

const FLAT_THUMB_IN = { thumb: "across" } as const;
const FLAT_THUMB_OUT = { thumb: "side" } as const;

describe("classifyLetter", () => {
  it("uses the rules alone without samples", () => {
    const d = classifyLetter(LOOSE, obs(FLAT_THUMB_OUT), null);
    expect(d).toMatchObject({ rulesOk: true, correct: true, knn: null });
    expect(classifyLetter(LOOSE, obs({ fingers: { index: "bent" } }), null).correct).toBe(false);
  });

  it("accepts when kNN agrees", () => {
    const knn = createKnn([...samples("Ъ", FLAT_THUMB_IN), ...samples("Ь", FLAT_THUMB_OUT)]);
    const d = classifyLetter(LOOSE, obs(FLAT_THUMB_IN), knn);
    expect(d.correct).toBe(true);
    expect(d.knn?.agrees).toBe(true);
  });

  it("reports a confusable letter with advice", () => {
    const knn = createKnn([...samples("Ъ", FLAT_THUMB_IN), ...samples("Ь", FLAT_THUMB_OUT)]);
    const d = classifyLetter(LOOSE, obs(FLAT_THUMB_OUT), knn);
    expect(d.correct).toBe(false);
    expect(d.rulesOk).toBe(true);
    const confusion = d.errors.find((e) => e.level === "confusion");
    expect(confusion).toMatchObject({ hintCode: "confusion.looksLike", params: { letter: "Ь", advice: "ghost.match" } });
  });

  it("uses the worst rule violation as the advice for a confusion", () => {
    const knn = createKnn([...samples("Ъ", FLAT_THUMB_IN), ...samples("Ь", { thumb: "side", fingers: { index: "bent" } })]);
    const d = classifyLetter(LOOSE, obs({ thumb: "side", fingers: { index: "bent" } }), knn);
    expect(d.errors.find((e) => e.level === "confusion")?.params?.advice).toBe("finger.straighten.index");
  });

  it("abstains when the hand is unlike any sample", () => {
    const far = { label: "Ъ", vector: Array.from({ length: 63 }, () => 50) };
    const d = classifyLetter(LOOSE, obs(FLAT_THUMB_OUT), createKnn([far, far, far]));
    expect(d.knn).toBeNull();
    expect(d.correct).toBe(true);
  });

  it("ignores kNN without samples of this letter", () => {
    const d = classifyLetter(LOOSE, obs(FLAT_THUMB_OUT), createKnn(samples("Ь", FLAT_THUMB_OUT)));
    expect(d.knn).toBeNull();
  });
});
