import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { buildObservation, type HandObservation } from "../observation";
import { createLetterPractice, starsForHints, type PracticeUpdate } from "./practice";
import type { LetterSpec } from "./spec";

const obs = (hand: SyntheticHandOptions) => buildObservation(toFrame(canonicalHand(hand)));

const SPEC: LetterSpec = {
  letter: "Т",
  verified: false,
  fingers: {
    index: { state: "straight", hintCode: "finger.straighten.index" },
    ring: { state: "straight", hintCode: "finger.straighten.ring" },
  },
  extra: [{ type: "thumbPosition", value: "acrossPalm", hintCode: "thumb.pressToPalm" }],
  reference: "",
};

const RIGHT = obs({ thumb: "across" });
const WRONG = obs({ thumb: "across", fingers: { ring: "bent" } });

function run(practice: ReturnType<typeof createLetterPractice>, o: HandObservation | null, from: number, to: number) {
  const out: Array<PracticeUpdate & { t: number }> = [];
  for (let t = from; t < to; t += 33) out.push({ ...practice.update(o, t), t });
  return out;
}

describe("letter practice", () => {
  it("accepts a correct letter once after holding it about 1 s", () => {
    const p = createLetterPractice(SPEC);
    const out = run(p, RIGHT, 0, 2500);
    const accepted = out.filter((o) => o.accepted);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.t).toBeGreaterThanOrEqual(1000);
    expect(accepted[0]?.t).toBeLessThan(1500);
    expect(out.every((o) => o.hint === null)).toBe(true);
    expect(p.hintLog).toEqual([]);
  });

  it("shows and logs a concrete hint for a wrong finger, then accepts after the fix", () => {
    const p = createLetterPractice(SPEC);
    const wrong = run(p, WRONG, 0, 1500);
    expect(wrong.some((o) => o.accepted)).toBe(false);
    expect(wrong.at(-1)?.hint?.hintCode).toBe("finger.straighten.ring");
    expect(wrong.at(-1)?.failing).toEqual(["finger.ring.state"]);
    expect(wrong.find((o) => o.hint)?.t).toBeGreaterThanOrEqual(700);
    expect(p.hintLog.map((h) => h.hintCode)).toEqual(["finger.straighten.ring"]);
    expect(p.hintLog[0]?.letter).toBe("Т");

    const fixed = run(p, RIGHT, 1500, 3500);
    expect(fixed.filter((o) => o.accepted)).toHaveLength(1);
    expect(fixed.at(-1)?.hint).toBeNull();
  });

  it("shows frame problems first and does not count them as mistakes", () => {
    const p = createLetterPractice(SPEC);
    const out = run(p, null, 0, 1500);
    expect(out.at(-1)?.hint?.hintCode).toBe("frame.noHand");
    expect(out.at(-1)?.frameOk).toBe(false);
    expect(p.hintLog).toEqual([]);
  });

  it("gives stars by the number of hints", () => {
    expect(starsForHints(0)).toBe(3);
    expect(starsForHints(1)).toBe(2);
    expect(starsForHints(4)).toBe(1);
  });
});
