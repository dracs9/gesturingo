import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame } from "./__fixtures__/syntheticHand";
import { LM, type Point3 } from "./landmarks";
import { denormalizePoints, flattenPoints, handTransform, normalizeHand, unflattenPoints } from "./normalize";

function expectPointsClose(actual: readonly Point3[], expected: readonly Point3[], digits = 6) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((p, i) => {
    const q = expected[i] as Point3;
    expect(p.x).toBeCloseTo(q.x, digits);
    expect(p.y).toBeCloseTo(q.y, digits);
    expect(p.z).toBeCloseTo(q.z, digits);
  });
}

describe("normalizeHand", () => {
  const hand = canonicalHand({ fingers: { ring: "bent" }, thumb: "across" });

  it("puts the wrist at the origin, middle MCP at (0, 1)", () => {
    const { points } = normalizeHand(toFrame(hand, { roll: 30 }));
    expect(points[LM.WRIST]).toEqual({ x: 0, y: 0, z: 0 });
    const mid = points[LM.MIDDLE_MCP] as Point3;
    expect(mid.x).toBeCloseTo(0);
    expect(mid.y).toBeCloseTo(1);
    expect(Math.hypot(mid.x, mid.y, mid.z)).toBeCloseTo(1);
  });

  it("recovers the canonical hand regardless of position, size, roll and aspect", () => {
    const variants = [
      { scale: 0.1, roll: 0, wrist: { x: 0.2, y: 0.8 } },
      { scale: 0.3, roll: -45, wrist: { x: 0.7, y: 0.5 } },
      { scale: 0.18, roll: 120, width: 480, height: 640 },
      { scale: 0.25, roll: 10, width: 1280, height: 720 },
    ];
    for (const v of variants) {
      expectPointsClose(normalizeHand(toFrame(hand, v)).points, hand);
    }
  });

  it("mirrors a left hand onto the right-hand canonical frame", () => {
    const left = normalizeHand(toFrame(hand, { handedness: "Left", roll: 25 }));
    expect(left.handedness).toBe("Left");
    expectPointsClose(left.points, hand);
  });
});

describe("flatten / unflatten", () => {
  it("round-trips 21 points through 63 numbers", () => {
    const pts = canonicalHand();
    const flat = flattenPoints(pts);
    expect(flat).toHaveLength(63);
    expect(flat.slice(3, 6)).toEqual([pts[1]?.x, pts[1]?.y, pts[1]?.z]);
    expect(unflattenPoints(flat)).toEqual(pts);
  });
});

describe("denormalizePoints", () => {
  it("maps the normalized hand back onto the camera frame (right and left hands)", () => {
    const hand = canonicalHand({ fingers: { index: "half" }, thumb: "across" });
    for (const handedness of ["Right", "Left"] as const) {
      const frame = toFrame(hand, { handedness, roll: 40, scale: 0.25, wrist: { x: 0.3, y: 0.6 }, width: 1280, height: 720 });
      const back = denormalizePoints(normalizeHand(frame).points, handTransform(frame));
      expectPointsClose(back, frame.landmarks);
    }
  });
});
