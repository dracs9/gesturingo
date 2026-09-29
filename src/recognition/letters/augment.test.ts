import { describe, expect, it } from "vitest";
import { canonicalHand } from "../__fixtures__/syntheticHand";
import { LM } from "../landmarks";
import { flattenPoints, unflattenPoints } from "../normalize";
import { augmentFrame, mirrorFrame, noisyFrame, rotateFrame, seededRandom } from "./augment";

const HAND = flattenPoints(canonicalHand({ fingers: { index: "straight", middle: "straight", ring: "bent", pinky: "bent" } }));
const palm = (v: readonly number[]) => {
  const p = unflattenPoints(v);
  const w = p[LM.WRIST]!;
  const m = p[LM.MIDDLE_MCP]!;
  return Math.hypot(m.x - w.x, m.y - w.y, m.z - w.z);
};

describe("augment", () => {
  it("rotates around the wrist and keeps the palm size", () => {
    for (const deg of [-15, -10, 10, 15]) {
      const r = rotateFrame(HAND, deg);
      expect(r.slice(0, 3)).toEqual(HAND.slice(0, 3));
      expect(palm(r)).toBeCloseTo(palm(HAND), 9);
      expect(r).not.toEqual(HAND);
    }
    rotateFrame(rotateFrame(HAND, 10), -10).forEach((v, i) => expect(v).toBeCloseTo(HAND[i] ?? 0, 9));
  });

  it("mirrors x only", () => {
    const m = mirrorFrame(HAND);
    m.forEach((v, i) => expect(v).toBeCloseTo(i % 3 === 0 ? -(HAND[i] ?? 0) : (HAND[i] ?? 0), 12));
  });

  it("adds deterministic noise and leaves the wrist at the origin", () => {
    const a = noisyFrame(HAND, 0.02, seededRandom(1));
    const b = noisyFrame(HAND, 0.02, seededRandom(1));
    expect(a).toEqual(b);
    expect(a.slice(0, 3)).toEqual(HAND.slice(0, 3));
    const maxDelta = Math.max(...a.map((v, i) => Math.abs(v - (HAND[i] ?? 0))));
    expect(maxDelta).toBeGreaterThan(0);
    expect(maxDelta).toBeLessThan(0.2);
  });

  it("gives the original + mirror, each rotated and noisy", () => {
    const out = augmentFrame(HAND, seededRandom(7), { mirror: true, rotationsDeg: [-10, 10], noiseSigma: 0.02, noiseCopies: 1 });
    expect(out).toHaveLength(2 * (1 + 2 + 1));
    expect(out[0]).toEqual(HAND);
    expect(out[4]).toEqual(mirrorFrame(HAND));
    expect(augmentFrame(HAND, seededRandom(7), { mirror: false, rotationsDeg: [], noiseSigma: 0, noiseCopies: 0 })).toEqual([HAND]);
  });
});
