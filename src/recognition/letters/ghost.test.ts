import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame } from "../__fixtures__/syntheticHand";
import { LM } from "../landmarks";
import { flattenPoints, normalizeHand } from "../normalize";
import { buildObservation } from "../observation";
import { compareFingers, fingerOfLandmark, fitReference, referenceFeatures } from "./ghost";

const REF_HAND = canonicalHand({ thumb: "across" });
const REF = flattenPoints(REF_HAND);

describe("ghost hand", () => {
  it("lands exactly on the user's hand when the shapes are the same", () => {
    for (const handedness of ["Right", "Left"] as const) {
      const frame = toFrame(REF_HAND, { handedness, roll: 30, scale: 0.22, wrist: { x: 0.4, y: 0.65 } });
      const ghost = fitReference(flattenPoints(normalizeHand(frame).points), frame);
      ghost.forEach((p, i) => {
        expect(p.x).toBeCloseTo(frame.landmarks[i]?.x ?? NaN, 6);
        expect(p.y).toBeCloseTo(frame.landmarks[i]?.y ?? NaN, 6);
      });
    }
  });

  it("follows the user's wrist, size and rotation", () => {
    const user = toFrame(canonicalHand({ fingers: { ring: "bent" } }), { roll: -25, scale: 0.3, wrist: { x: 0.6, y: 0.8 } });
    const ghost = fitReference(REF, user);
    expect(ghost[LM.WRIST]?.x).toBeCloseTo(user.landmarks[LM.WRIST]?.x ?? NaN, 6);
    expect(ghost[LM.MIDDLE_MCP]?.x).toBeCloseTo(user.landmarks[LM.MIDDLE_MCP]?.x ?? NaN, 6);
    expect(ghost[LM.MIDDLE_MCP]?.y).toBeCloseTo(user.landmarks[LM.MIDDLE_MCP]?.y ?? NaN, 6);
  });

  it("marks which fingers differ from the reference", () => {
    const user = buildObservation(toFrame(canonicalHand({ thumb: "across", fingers: { ring: "bent" } }))).features;
    expect(compareFingers(user, referenceFeatures(REF))).toEqual({
      thumb: true,
      index: true,
      middle: true,
      ring: false,
      pinky: true,
    });
  });

  it("maps landmarks to fingers", () => {
    expect(fingerOfLandmark(LM.WRIST)).toBeNull();
    expect(fingerOfLandmark(LM.THUMB_TIP)).toBe("thumb");
    expect(fingerOfLandmark(LM.INDEX_MCP)).toBe("index");
    expect(fingerOfLandmark(LM.RING_DIP)).toBe("ring");
    expect(fingerOfLandmark(LM.PINKY_TIP)).toBe("pinky");
  });
});
