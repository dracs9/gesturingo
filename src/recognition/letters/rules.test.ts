import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { LM } from "../landmarks";
import { buildObservation } from "../observation";
import { checkLetter } from "./rules";
import type { LetterSpec } from "./spec";

const features = (hand: SyntheticHandOptions) => buildObservation(toFrame(canonicalHand(hand), { roll: 10 })).features;

// Test-only specs (real shapes live in data/letters.ts and are filled by the team).
const FLAT: LetterSpec = {
  letter: "T1",
  verified: false,
  fingers: {
    index: { state: "straight", hintCode: "finger.straighten.index" },
    middle: { state: "straight", hintCode: "finger.straighten.middle" },
    ring: { state: "straight", hintCode: "finger.straighten.ring" },
    pinky: { state: "straight", hintCode: "finger.straighten.pinky" },
  },
  extra: [
    { type: "palmFacing", value: "camera", hintCode: "palm.faceCamera" },
    { type: "thumbPosition", value: "acrossPalm", hintCode: "thumb.pressToPalm" },
  ],
  reference: "",
};

const RING: LetterSpec = {
  letter: "T2",
  verified: false,
  fingers: {},
  extra: [{ type: "tipsTouch", a: "thumb", b: "index", hintCode: "tips.touch.thumb-index" }],
  reference: "",
};

const codes = (errors: { code: string }[]) => errors.map((e) => e.code);

describe("checkLetter", () => {
  it("passes a matching hand", () => {
    expect(checkLetter(FLAT, features({ thumb: "across" }))).toEqual([]);
  });

  it("reports a wrong finger with its hint and landmarks", () => {
    const [error] = checkLetter(FLAT, features({ thumb: "across", fingers: { ring: "bent" } }));
    expect(error).toMatchObject({ level: "shape", code: "finger.ring.state", hintCode: "finger.straighten.ring", finger: "ring" });
    expect(error?.landmarkIds).toEqual([LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP]);
  });

  it("rates a finger far from its state as more severe", () => {
    const half = checkLetter(FLAT, features({ thumb: "across", fingers: { ring: "half" } }))[0];
    const bent = checkLetter(FLAT, features({ thumb: "across", fingers: { ring: "bent" } }))[0];
    expect(bent?.severity).toBeGreaterThan(half?.severity ?? 1);
  });

  it("reports the thumb position", () => {
    expect(codes(checkLetter(FLAT, features({ thumb: "side" })))).toEqual(["thumbPosition"]);
  });

  it("reports palm orientation as the most severe error", () => {
    const errors = checkLetter(FLAT, features({ thumb: "across", yaw: 180 }));
    expect(codes(errors)).toContain("palmFacing");
    expect(errors.find((e) => e.code === "palmFacing")?.severity).toBe(1);
  });

  it("checks fingertips touching and apart", () => {
    expect(checkLetter(RING, features({ thumb: "pinch" }))).toEqual([]);
    expect(codes(checkLetter(RING, features({ thumb: "side" })))).toEqual(["tipsTouch.thumb-index"]);
    const apart: LetterSpec = {
      ...RING,
      extra: [{ type: "tipsApart", a: "thumb", b: "index", hintCode: "tips.apart.thumb-index" }],
    };
    expect(checkLetter(apart, features({ thumb: "side" }))).toEqual([]);
    expect(codes(checkLetter(apart, features({ thumb: "pinch" })))).toEqual(["tipsApart.thumb-index"]);
  });
});
