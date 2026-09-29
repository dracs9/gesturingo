import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "./__fixtures__/syntheticHand";
import { angleAt, computeFeatures, fingerState, tipDistance } from "./features";
import { normalizeHand } from "./normalize";

const featuresOf = (opts: SyntheticHandOptions, handedness: "Left" | "Right" = "Right") =>
  computeFeatures(normalizeHand(toFrame(canonicalHand(opts), { handedness, roll: 15 })));

describe("angleAt", () => {
  it("measures right and straight angles", () => {
    expect(angleAt({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(90);
    expect(angleAt({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBeCloseTo(180);
    expect(angleAt({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeCloseTo(0);
  });

  it("treats degenerate joints as straight", () => {
    const p = { x: 1, y: 1, z: 1 };
    expect(angleAt(p, p, p)).toBe(180);
  });
});

describe("fingerState", () => {
  it("uses the spec thresholds for fingers and own ones for the thumb", () => {
    expect(fingerState("index", 170)).toBe("straight");
    expect(fingerState("index", 130)).toBe("half");
    expect(fingerState("index", 90)).toBe("bent");
    expect(fingerState("thumb", 155)).toBe("straight");
    expect(fingerState("thumb", 115)).toBe("bent");
  });
});

describe("computeFeatures", () => {
  it("detects straight, half and bent fingers", () => {
    const f = featuresOf({ fingers: { index: "straight", middle: "half", ring: "bent", pinky: "bent" } });
    expect(f.fingers.index.state).toBe("straight");
    expect(f.fingers.middle.state).toBe("half");
    expect(f.fingers.ring.state).toBe("bent");
    expect(f.fingers.pinky.state).toBe("bent");
    expect(f.fingers.index.angles).toHaveLength(3);
  });

  it("detects the thumb state", () => {
    expect(featuresOf({ thumb: "side" }).fingers.thumb.state).toBe("straight");
    expect(featuresOf({ thumb: "across" }).fingers.thumb.state).toBe("bent");
  });

  it("measures fingertip distances in palm units", () => {
    const open = featuresOf({});
    const fist = featuresOf({ fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } });
    expect(tipDistance(open, "index", "pinky")).toBeGreaterThan(0.5);
    expect(tipDistance(open, "pinky", "index")).toBe(tipDistance(open, "index", "pinky"));
    expect(tipDistance(open, "index", "index")).toBe(0);
    expect(tipDistance(fist, "thumb", "index")).toBeLessThan(tipDistance(open, "thumb", "index"));
  });

  it("detects palm facing camera, away and side", () => {
    expect(featuresOf({ yaw: 0 }).palmFacing).toBe("camera");
    expect(featuresOf({ yaw: 180 }).palmFacing).toBe("away");
    expect(featuresOf({ yaw: 90 }).palmFacing).toBe("side");
    expect(featuresOf({ yaw: -90 }).palmFacing).toBe("side");
  });

  it("gives the same palm facing for a left hand", () => {
    expect(featuresOf({ yaw: 0 }, "Left").palmFacing).toBe("camera");
    expect(featuresOf({ yaw: 180 }, "Left").palmFacing).toBe("away");
  });

  it("detects the thumb position", () => {
    expect(featuresOf({ thumb: "across" }).thumbPosition).toBe("acrossPalm");
    expect(featuresOf({ thumb: "side" }).thumbPosition).toBe("side");
    expect(featuresOf({ thumb: "up" }).thumbPosition).toBe("up");
  });
});
