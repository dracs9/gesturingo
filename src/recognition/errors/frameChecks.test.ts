import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, LM, type HandFrame, type Point3 } from "../landmarks";
import { getHandStatus, palmSize } from "./frameChecks";

/** Synthetic hand: wrist at (0.5, 0.7), middle MCP `palm` above it (in video-height units). */
function hand(palm: number, { score = 0.95, width = 640, height = 480 } = {}): HandFrame {
  const landmarks: Point3[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.7, z: 0 }));
  landmarks[LM.MIDDLE_MCP] = { x: 0.5, y: 0.7 - palm, z: 0 };
  return { landmarks, handedness: "Right", score, timestamp: 0, videoWidth: width, videoHeight: height };
}

describe("palmSize", () => {
  it("is measured in video-height units", () => {
    expect(palmSize(hand(0.2))).toBeCloseTo(0.2);
  });

  it("corrects horizontal distance for aspect ratio", () => {
    const f = hand(0);
    f.landmarks[LM.MIDDLE_MCP] = { x: 0.5 + 0.15, y: 0.7, z: 0 };
    // 0.15 * 640px / 480px = 0.2
    expect(palmSize(f)).toBeCloseTo(0.2);
  });
});

describe("getHandStatus", () => {
  it("reports no hand", () => {
    expect(getHandStatus(null)).toBe("noHand");
    expect(getHandStatus(hand(0.2, { score: 0.2 }))).toBe("noHand");
  });

  it("reports distance problems", () => {
    expect(getHandStatus(hand(0.03))).toBe("tooFar");
    expect(getHandStatus(hand(0.6))).toBe("tooClose");
  });

  it("accepts a normal hand", () => {
    expect(getHandStatus(hand(0.2))).toBe("ok");
  });
});
