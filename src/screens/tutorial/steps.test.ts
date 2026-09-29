import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../../recognition/__fixtures__/syntheticHand";
import { buildObservation } from "../../recognition/observation";
import { nextStep, stepContext, stepErrors, type StepInput } from "./steps";

const obs = (hand: SyntheticHandOptions, scale = 0.2) => buildObservation(toFrame(canonicalHand(hand), { scale }));
const POINT = obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" }, thumb: "across" });

const input = (over: Partial<StepInput> = {}): StepInput => ({
  observation: POINT,
  pinchRatio: 1,
  wristSpeed: 0,
  elapsedMs: 0,
  now: 10_000,
  offTargetUntil: 0,
  ...over,
});
const codes = (errors: { hintCode: string }[]) => errors.map((e) => e.hintCode);

describe("tutorial steps", () => {
  it("walks the four steps in order", () => {
    expect(nextStep("cursor")).toBe("pinch");
    expect(nextStep("pinch")).toBe("thumbsUp");
    expect(nextStep("thumbsUp")).toBe("openPalm");
    expect(nextStep("openPalm")).toBe("done");
    expect(nextStep("done")).toBe("done");
  });

  it("enables only the trained gesture", () => {
    expect(stepContext("cursor", 0)).toMatchObject({ cursor: true, ok: false, back: false });
    expect(stepContext("thumbsUp", 0)).toMatchObject({ ok: true, back: false });
    expect(stepContext("openPalm", 0)).toMatchObject({ ok: false, back: true });
  });

  it("turns dwell on as a fallback in the pinch step", () => {
    expect(stepContext("pinch", 5_000).dwell).toBe(false);
    expect(stepContext("pinch", 12_000).dwell).toBe(true);
  });

  it("shows frame problems instead of gesture hints", () => {
    expect(codes(stepErrors("openPalm", input({ observation: null })))).toEqual(["frame.noHand"]);
    const far = obs({ fingers: { ring: "bent" } }, 0.03);
    expect(codes(stepErrors("openPalm", input({ observation: far })))).toEqual(["frame.tooFar"]);
  });

  it("adds time and event hints", () => {
    expect(codes(stepErrors("cursor", input({ elapsedMs: 1000 })))).toEqual([]);
    expect(codes(stepErrors("cursor", input({ elapsedMs: 6000 })))).toEqual(["cursor.moveToTarget"]);
    expect(codes(stepErrors("pinch", input({ offTargetUntil: 11_000 })))).toEqual(["pinch.aim"]);
    expect(codes(stepErrors("pinch", input({ pinchRatio: 0.4 })))).toEqual(["pinch.closer"]);
    expect(codes(stepErrors("pinch", input({ elapsedMs: 13_000 })))).toEqual(["pinch.useDwell"]);
  });

  it("uses the gesture checks for poses", () => {
    expect(codes(stepErrors("openPalm", input({ observation: obs({ fingers: { ring: "bent" } }) })))).toEqual([
      "finger.straighten.ring",
    ]);
    expect(stepErrors("done", input())).toEqual([]);
  });
});
