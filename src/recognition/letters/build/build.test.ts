import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../../__fixtures__/syntheticHand";
import { flattenPoints, normalizeHand } from "../../normalize";
import { pickMedoid } from "../../samples";
import {
  capPerSigner,
  fromHandFrame,
  mirrorVector,
  normalizeRaw,
  serializeRawSamples,
  type RawSample,
} from "./dataset";
import { draftSpec, RULE_MIN_SHARE } from "./draft";
import { confusedWith, crossValidate, type EvalSample } from "./evaluate";
import { resolveOrientation } from "./orientation";
import { letterStats } from "./stats";

const vector = (opts: SyntheticHandOptions) => flattenPoints(canonicalHand(opts));

/** Deterministic jitter so samples of one letter are similar but not identical. */
function jitter(v: readonly number[], seed: number, amount = 0.02): number[] {
  return v.map((x, i) => x + amount * Math.sin(seed * 12.9898 + i * 78.233));
}

const FIST: SyntheticHandOptions = { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } };
const OPEN: SyntheticHandOptions = { fingers: { index: "straight", middle: "straight", ring: "straight", pinky: "straight" } };
const V_SIGN: SyntheticHandOptions = { fingers: { index: "straight", middle: "straight", ring: "bent", pinky: "bent" } };

describe("normalizeRaw", () => {
  it("normalizes a photo record exactly like a camera frame", () => {
    const frame = toFrame(canonicalHand(V_SIGN), { handedness: "Left", width: 300, height: 500 });
    const raw: RawSample = {
      letter: "В",
      source: "test",
      file: "x.jpg",
      signer: "s1",
      handedness: "Left",
      score: 0.9,
      width: 300,
      height: 500,
      landmarks: frame.landmarks.map((p) => [p.x, p.y, p.z]),
    };
    const expected = vector(V_SIGN);
    normalizeRaw(raw).forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 6));
  });

  it("a /record frame exported as a raw record normalizes like the live frame", () => {
    const frame = toFrame(canonicalHand(V_SIGN), { handedness: "Left", width: 640, height: 480, roll: 12 });
    const raw = fromHandFrame(frame, { letter: "В", source: "record", signer: "S01", file: "record/S01/В/0" });
    const parsed = JSON.parse(serializeRawSamples([raw])) as RawSample[];
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ letter: "В", source: "record", signer: "S01", handedness: "Left", width: 640 });
    const live = flattenPoints(normalizeHand(frame).points);
    normalizeRaw(parsed[0]!).forEach((v, i) => expect(v).toBeCloseTo(live[i] ?? 0, 3));
  });

  it("mirrorVector gives the same hand with the other Left/Right label", () => {
    const frame = toFrame(canonicalHand(V_SIGN));
    const asRight = normalizeRaw({
      letter: "В", source: "t", file: "f", signer: "s", handedness: "Right", score: 1, width: 640, height: 480,
      landmarks: frame.landmarks.map((p) => [p.x, p.y, p.z]),
    });
    const asLeft = normalizeRaw({
      letter: "В", source: "t", file: "f", signer: "s", handedness: "Left", score: 1, width: 640, height: 480,
      landmarks: frame.landmarks.map((p) => [p.x, p.y, p.z]),
    });
    mirrorVector(asRight).forEach((v, i) => expect(v).toBeCloseTo(asLeft[i] ?? 0, 9));
  });
});

describe("medoid", () => {
  it("picks the most typical sample, not an outlier", () => {
    const frames = [jitter(vector(FIST), 1), jitter(vector(FIST), 2), vector(OPEN), jitter(vector(FIST), 3)];
    const i = pickMedoid(frames);
    expect(i).not.toBe(2);
    expect(i).toBeGreaterThanOrEqual(0);
  });
});

describe("capPerSigner", () => {
  it("keeps at most N evenly spaced samples per letter and signer", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ letter: "А", signer: "video", file: `f${String(i).padStart(3, "0")}` }));
    const few = Array.from({ length: 5 }, (_, i) => ({ letter: "А", signer: `p${i}`, file: `g${i}` }));
    const kept = capPerSigner([...many, ...few], 20);
    expect(kept.filter((s) => s.signer === "video")).toHaveLength(20);
    expect(kept.filter((s) => s.signer !== "video")).toHaveLength(5);
    expect(kept.map((s) => s.file)).toContain("f057");
  });
});

describe("resolveOrientation", () => {
  const base = vector(V_SIGN);
  const good = Array.from({ length: 7 }, (_, i) => jitter(base, i));
  const mislabelled = Array.from({ length: 3 }, (_, i) => mirrorVector(jitter(base, 10 + i)));

  it("flips the minority that MediaPipe mirrored", () => {
    const flips = resolveOrientation([...good, ...mislabelled]);
    expect(flips).toEqual([...good.map(() => false), ...mislabelled.map(() => true)]);
  });

  it("follows anchored front-view samples even when they are the minority", () => {
    const anchors = mislabelled.map(mirrorVector); // front view, same shape as `good`
    const backViews = good.map(mirrorVector);
    const flips = resolveOrientation([...anchors, ...backViews], [...anchors.map(() => true), ...backViews.map(() => false)]);
    expect(flips).toEqual([...anchors.map(() => false), ...backViews.map(() => true)]);
  });
});

describe("letterStats + draftSpec", () => {
  it("gives a finger a rule only when ≥ 80% of samples agree", () => {
    // ring: 8 of 10 bent → rule; pinky: 7 of 10 bent → free.
    const samples = Array.from({ length: 10 }, (_, i) =>
      vector({
        fingers: {
          index: "straight",
          middle: "straight",
          ring: i < 8 ? "bent" : "straight",
          pinky: i < 7 ? "bent" : "straight",
        },
      }),
    );
    const stats = letterStats(samples);
    expect(stats.fingers.ring.states.bent).toBeCloseTo(0.8);
    const { spec, freeFingers } = draftSpec("Т", stats);
    expect(RULE_MIN_SHARE).toBe(0.8);
    expect(spec.verified).toBe(false);
    expect(spec.fingers.ring).toEqual({ state: "bent", hintCode: "finger.bend.ring" });
    expect(spec.fingers.index).toEqual({ state: "straight", hintCode: "finger.straighten.index" });
    expect(spec.fingers.pinky).toBeUndefined();
    expect(freeFingers).toContain("pinky");
    expect(spec.reference).toBe("references/Т.json");
  });

  it("drafts tipsTouch from the data but not between two bent fingers", () => {
    const pinch = Array.from({ length: 5 }, () => vector({ thumb: "pinch", fingers: { index: "half" } }));
    const draft = draftSpec("О", letterStats(pinch));
    expect(draft.spec.extra).toContainEqual({ type: "tipsTouch", a: "thumb", b: "index", hintCode: "tips.touch.thumb-index" });

    const fist = Array.from({ length: 5 }, () => vector(FIST));
    const fistDraft = draftSpec("А", letterStats(fist));
    expect((fistDraft.spec.extra ?? []).some((e) => e.type === "tipsTouch" && e.a !== "thumb")).toBe(false);
  });
});

describe("crossValidate + confusedWith", () => {
  const letter = (label: string, opts: SyntheticHandOptions, signers: number): EvalSample[] =>
    Array.from({ length: signers * 3 }, (_, i) => ({ label, group: `s${i % signers}`, vector: jitter(vector(opts), i) }));

  it("tests leave-one-signer-out and falls back to leave-one-out for a single signer", () => {
    const cv = crossValidate([...letter("А", FIST, 3), ...letter("В", OPEN, 3), ...letter("Д", V_SIGN, 1)], 3);
    expect(cv.perLetter.get("А")).toMatchObject({ mode: "signer", correct: 9, total: 9 });
    expect(cv.perLetter.get("Д")?.mode).toBe("sample");
  });

  it("reports letters that get mixed up as similar", () => {
    // 1-D toy vectors: А and С overlap, В is far away.
    const at = (label: string, xs: number[]): EvalSample[] => xs.map((x, i) => ({ label, group: `s${i}`, vector: [x] }));
    const cv = crossValidate(
      [...at("А", [0, 0.1, 0.2, 0.3]), ...at("С", [0.15, 0.25, 0.35, 0.45]), ...at("В", [10, 10.1, 10.2, 10.3])],
      3,
    );
    expect(confusedWith(cv, "А")).toEqual(["С"]);
    expect(confusedWith(cv, "В")).toEqual([]);
  });
});
