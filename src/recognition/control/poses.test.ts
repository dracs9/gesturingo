import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions, type ProjectionOptions } from "../__fixtures__/syntheticHand";
import { buildObservation } from "../observation";
import { createHold, isOpenPalm, isThumbsUp } from "./poses";

const obs = (hand: SyntheticHandOptions, proj: ProjectionOptions = {}) =>
  buildObservation(toFrame(canonicalHand(hand), proj));

const FIST = { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } as const;

describe("isThumbsUp", () => {
  it("accepts a fist with the thumb pointing up", () => {
    expect(isThumbsUp(obs({ fingers: FIST, thumb: "up" }))).toBe(true);
    expect(isThumbsUp(obs({ fingers: FIST, thumb: "up" }, { handedness: "Left" }))).toBe(true);
  });

  it("rejects a thumb pointing sideways", () => {
    expect(isThumbsUp(obs({ fingers: FIST, thumb: "up" }, { roll: -90 }))).toBe(false);
    expect(isThumbsUp(obs({ fingers: FIST, thumb: "up" }, { roll: 180 }))).toBe(false);
  });

  it("rejects when another finger is straight or the thumb is folded", () => {
    expect(isThumbsUp(obs({ fingers: { ...FIST, index: "straight" }, thumb: "up" }))).toBe(false);
    expect(isThumbsUp(obs({ fingers: FIST, thumb: "across" }))).toBe(false);
  });
});

describe("isOpenPalm", () => {
  it("accepts an open hand facing the camera", () => {
    expect(isOpenPalm(obs({}))).toBe(true);
    expect(isOpenPalm(obs({}, { handedness: "Left", roll: 20 }))).toBe(true);
  });

  it("rejects the back of the hand and bent fingers", () => {
    expect(isOpenPalm(obs({ yaw: 180 }))).toBe(false);
    expect(isOpenPalm(obs({ fingers: { ring: "bent" } }))).toBe(false);
    expect(isOpenPalm(obs({ thumb: "across" }))).toBe(false);
  });
});

describe("createHold", () => {
  it("fills progress and fires once", () => {
    const h = createHold(800, 150);
    expect(h.update(true, 0)).toEqual({ progress: 0, fired: false });
    expect(h.update(true, 400).progress).toBeCloseTo(0.5);
    expect(h.update(true, 800)).toEqual({ progress: 1, fired: true });
    expect(h.update(true, 1600)).toEqual({ progress: 0, fired: false });
  });

  it("tolerates short dropouts but resets after the grace period", () => {
    const h = createHold(800, 150);
    h.update(true, 0);
    h.update(false, 100);
    expect(h.update(true, 200).progress).toBeCloseTo(0.25);
    h.update(false, 300);
    expect(h.update(false, 500).progress).toBe(0);
    expect(h.update(true, 600).progress).toBe(0);
  });

  it("re-arms only after the pose is released", () => {
    const h = createHold(800, 150);
    h.update(true, 0);
    h.update(true, 800);
    h.update(false, 900);
    h.update(false, 1100);
    h.update(true, 1200);
    expect(h.update(true, 2000).fired).toBe(true);
  });
});
