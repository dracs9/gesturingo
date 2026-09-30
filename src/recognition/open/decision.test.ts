import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type ProjectionOptions, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { createKnn, type LabeledVector } from "../letters/knn";
import type { LetterSpec } from "../letters/spec";
import { flattenPoints } from "../normalize";
import { buildObservation } from "../observation";
import { decideFrame } from "./decision";
import { rankLetters } from "./openClassifier";

const obs = (hand: SyntheticHandOptions, proj: ProjectionOptions = {}) =>
  buildObservation(toFrame(canonicalHand(hand), proj));
const samples = (label: string, hand: SyntheticHandOptions, n = 6): LabeledVector[] =>
  Array.from({ length: n }, () => ({ label, vector: flattenPoints(canonicalHand(hand)) }));

// Test letters (not real dactyl shapes): which fingers are up.
const spec = (letter: string, up: Array<"index" | "middle">): LetterSpec => ({
  letter,
  verified: false,
  fingers: {
    index: up.includes("index")
      ? { state: "straight", hintCode: "finger.straighten.index" }
      : { state: "bent", hintCode: "finger.bend.index" },
    middle: up.includes("middle")
      ? { state: "straight", hintCode: "finger.straighten.middle" }
      : { state: "bent", hintCode: "finger.bend.middle" },
    ring: { state: "bent", hintCode: "finger.bend.ring" },
    pinky: { state: "bent", hintCode: "finger.bend.pinky" },
  },
  reference: "",
});

const ONE = spec("1", ["index"]);
const TWO = spec("2", ["index", "middle"]);
const FIST = spec("0", []);
const SPECS = [ONE, TWO, FIST];
const getSpec = (l: string) => SPECS.find((s) => s.letter === l);

const HANDS = {
  "1": { fingers: { index: "straight", middle: "bent", ring: "bent", pinky: "bent" } },
  "2": { fingers: { index: "straight", middle: "straight", ring: "bent", pinky: "bent" } },
  "0": { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } },
} as const satisfies Record<string, SyntheticHandOptions>;

const knn = createKnn([...samples("1", HANDS["1"]), ...samples("2", HANDS["2"]), ...samples("0", HANDS["0"])]);
const decide = (hand: SyntheticHandOptions, proj: ProjectionOptions = {}, k = knn) => {
  const o = obs(hand, proj);
  return decideFrame(o, rankLetters(o, k, SPECS), getSpec);
};

describe("open-set decision (talk mode)", () => {
  it("ranks every letter by its closest sample", () => {
    const r = rankLetters(obs(HANDS["2"]), knn, SPECS);
    expect(r.source).toBe("knn");
    expect(r.ranking.map((c) => c.label)[0]).toBe("2");
    expect(r.ranking).toHaveLength(3);
  });

  it("accepts a clear letter that passes its rules", () => {
    expect(decide(HANDS["1"])).toMatchObject({ kind: "accept", label: "1" });
    expect(decide(HANDS["0"])).toMatchObject({ kind: "accept", label: "0" });
  });

  it("says «almost» with what to fix when the closest letter breaks a rule", () => {
    const d = decide({ fingers: { ...HANDS["1"].fingers, ring: "half" } });
    expect(d.kind).toBe("almost");
    if (d.kind !== "almost") return;
    expect(d.label).toBe("1");
    expect(d.errors.map((e) => e.hintCode)).toEqual(["finger.bend.ring"]);
    expect(d.errors[0]?.landmarkIds?.length).toBeGreaterThan(0);
  });

  it("asks «А или Б?» when two letters fit equally well", () => {
    const twin = { ...TWO, letter: "2б" };
    const specs = [ONE, TWO, twin];
    const k = createKnn([...samples("1", HANDS["1"]), ...samples("2", HANDS["2"]), ...samples("2б", HANDS["2"])]);
    const o = obs(HANDS["2"]);
    const d = decideFrame(o, rankLetters(o, k, specs), (l) => specs.find((s) => s.letter === l));
    expect(d.kind).toBe("ambiguous");
    if (d.kind !== "ambiguous") return;
    expect([...d.labels].sort()).toEqual(["2", "2б"]);
    expect(d.hint).toMatchObject({ level: "confusion", hintCode: "talk.ambiguous" });
  });

  it("stays neutral without a hand or with the hand cut off", () => {
    expect(decideFrame(null, null, getSpec)).toMatchObject({ kind: "neutral" });
    const cut = decide(HANDS["1"], { wrist: { x: 0.5, y: 0.99 } });
    expect(cut.kind).toBe("neutral");
    if (cut.kind === "neutral") expect(cut.errors[0]?.hintCode).toBe("frame.partlyOut");
  });

  it("falls back to the rules alone while samples load", () => {
    const o = obs(HANDS["1"]);
    const r = rankLetters(o, null, SPECS);
    expect(r.source).toBe("rules");
    expect(decideFrame(o, r, getSpec)).toMatchObject({ kind: "accept", label: "1" });
  });
});
