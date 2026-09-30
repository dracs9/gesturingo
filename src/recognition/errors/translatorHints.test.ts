import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame } from "../__fixtures__/syntheticHand";
import { palmCenter, type Calibration } from "../control/calibration";
import { hintVisual, positionErrors } from "./translatorHints";
import { palmSize } from "./frameChecks";

const frameAt = (x: number, y: number, scale = 0.12) => toFrame(canonicalHand(), { wrist: { x, y }, scale });
const home = frameAt(0.5, 0.6);
const CAL: Calibration = { center: palmCenter(home), palm: palmSize(home), aspect: 640 / 480 };
const code = (x: number, y: number, scale?: number) => positionErrors(frameAt(x, y, scale), CAL)[0]?.hintCode ?? null;

describe("position hints (talk mode, after calibration)", () => {
  it("stay quiet near the calibrated place", () => {
    expect(code(0.5, 0.6)).toBeNull();
    expect(code(0.55, 0.65)).toBeNull();
  });

  it("say where to move, as the user sees the mirrored video", () => {
    // Raw x grows to the LEFT of the mirrored picture: a hand at raw 0.95 is far left on screen.
    expect(code(0.95, 0.6)).toBe("position.right");
    expect(code(0.05, 0.6)).toBe("position.left");
    expect(code(0.5, 0.95)).toBe("position.up");
    expect(code(0.5, 0.25)).toBe("position.down");
  });

  it("notice the hand coming too close or going too far", () => {
    expect(code(0.5, 0.6, 0.25)).toBe("position.farther");
    expect(code(0.5, 0.6, 0.06)).toBe("position.closer");
  });

  it("tell which hints get an arrow", () => {
    expect(hintVisual("position.up")).toBe("move");
    expect(hintVisual("palm.faceCamera")).toBe("rotate");
    expect(hintVisual("finger.bend.ring")).toBeNull();
    expect(hintVisual(null)).toBeNull();
  });
});
