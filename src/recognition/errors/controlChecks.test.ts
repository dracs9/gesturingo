import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type ProjectionOptions, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { LM } from "../landmarks";
import { buildObservation } from "../observation";
import { cursorErrors, openPalmErrors, pinchErrors, thumbsUpErrors } from "./controlChecks";

const obs = (hand: SyntheticHandOptions, proj: ProjectionOptions = {}) =>
  buildObservation(toFrame(canonicalHand(hand), proj));
const codes = (errors: { hintCode: string }[]) => errors.map((e) => e.hintCode);

const FIST = { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } as const;
const STILL = 0;
const MOVING = 5;

describe("cursorErrors", () => {
  it("asks to straighten the index finger", () => {
    expect(codes(cursorErrors(obs({ fingers: { index: "bent" } })))).toEqual(["finger.straighten.index"]);
    expect(cursorErrors(obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" } }))).toEqual([]);
  });
});

describe("pinchErrors", () => {
  it("asks to close the pinch when fingertips hover close but apart", () => {
    expect(codes(pinchErrors(0.42))).toEqual(["pinch.closer"]);
    expect(pinchErrors(0.2)).toEqual([]);
    expect(pinchErrors(0.9)).toEqual([]);
    expect(pinchErrors(null)).toEqual([]);
  });
});

describe("thumbsUpErrors", () => {
  it("is silent for a correct, still thumbs up", () => {
    expect(thumbsUpErrors(obs({ fingers: FIST, thumb: "up" }), STILL)).toEqual([]);
  });

  it("asks to hold still when the pose is right but moving", () => {
    expect(codes(thumbsUpErrors(obs({ fingers: FIST, thumb: "up" }), MOVING))).toEqual(["pose.holdStill"]);
  });

  it("asks to turn the hand when the thumb points sideways", () => {
    expect(codes(thumbsUpErrors(obs({ fingers: FIST, thumb: "up" }, { roll: -90 }), STILL))).toEqual(["thumb.pointUp"]);
  });

  it("asks to fold the other fingers", () => {
    const errors = thumbsUpErrors(obs({ fingers: { ...FIST, index: "straight" }, thumb: "up" }), STILL);
    expect(codes(errors)).toEqual(["thumb.foldOthers"]);
    expect(errors[0]?.landmarkIds).toContain(LM.INDEX_TIP);
  });

  it("asks to straighten a folded thumb", () => {
    expect(codes(thumbsUpErrors(obs({ fingers: FIST, thumb: "across" }), STILL))).toEqual(["finger.straighten.thumb"]);
  });
});

describe("openPalmErrors", () => {
  it("is silent for a still open palm", () => {
    expect(openPalmErrors(obs({}), STILL)).toEqual([]);
  });

  it("asks to turn the palm to the camera", () => {
    expect(codes(openPalmErrors(obs({ yaw: 180 }), STILL))).toEqual(["palm.faceCamera"]);
  });

  it("names the bent finger and highlights it", () => {
    const [error] = openPalmErrors(obs({ fingers: { ring: "bent" } }), STILL);
    expect(error?.hintCode).toBe("finger.straighten.ring");
    expect(error?.finger).toBe("ring");
    expect(error?.landmarkIds).toEqual([LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP]);
  });

  it("names the most bent finger first", () => {
    const [error] = openPalmErrors(obs({ fingers: { index: "half", pinky: "bent" } }), STILL);
    expect(error?.hintCode).toBe("finger.straighten.pinky");
  });

  it("asks to hold still", () => {
    expect(codes(openPalmErrors(obs({}), MOVING))).toEqual(["pose.holdStill"]);
  });
});
