import { describe, expect, it } from "vitest";
import { canonicalHand } from "../__fixtures__/syntheticHand";
import { createPinch, pinchRatio } from "./pinch";

const opts = { closeBelow: 0.35, openAbove: 0.5, minIntervalMs: 400 };

describe("pinchRatio", () => {
  it("is small for a pinch and large for an open hand", () => {
    expect(pinchRatio(canonicalHand({ thumb: "pinch" }))).toBeLessThan(0.1);
    expect(pinchRatio(canonicalHand({ thumb: "side" }))).toBeGreaterThan(0.5);
  });
});

describe("createPinch", () => {
  it("clicks once on open → closed", () => {
    const p = createPinch(opts);
    expect(p.update(0.8, 0).clicked).toBe(false);
    const closing = p.update(0.2, 33);
    expect(closing.clicked).toBe(true);
    expect(closing.closedFrom).toBe(0);
    expect(p.update(0.2, 66).clicked).toBe(false);
    expect(p.update(0.1, 500).clicked).toBe(false);
  });

  it("uses hysteresis: the band between thresholds keeps the state", () => {
    const p = createPinch(opts);
    p.update(0.8, 0);
    expect(p.update(0.4, 33).state).toBe("open");
    p.update(0.2, 66);
    expect(p.update(0.4, 99).state).toBe("closed");
    expect(p.update(0.45, 132).clicked).toBe(false);
  });

  it("does not click when the hand appears already pinched", () => {
    const p = createPinch(opts);
    expect(p.update(0.1, 0).clicked).toBe(false);
    expect(p.update(0.1, 33).state).toBe("closed");
    p.update(null, 66);
    expect(p.update(0.1, 99).clicked).toBe(false);
  });

  it("requires reopening and the minimum interval between clicks", () => {
    const p = createPinch(opts);
    p.update(0.8, 0);
    expect(p.update(0.2, 33).clicked).toBe(true);
    p.update(0.8, 100);
    expect(p.update(0.2, 200).clicked).toBe(false); // 167 ms after the last click
    p.update(0.8, 300);
    expect(p.update(0.2, 500).clicked).toBe(true);
  });
});
