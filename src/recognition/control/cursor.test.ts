import { describe, expect, it } from "vitest";
import { createCursor, edgeScrollVelocity, mapToScreen } from "./cursor";

const VIEW = { width: 1000, height: 800 };

describe("mapToScreen", () => {
  it("mirrors X so moving the hand right moves the cursor right on the mirrored view", () => {
    expect(mapToScreen(0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 });
    expect(mapToScreen(0.3, 0.5).x).toBeGreaterThan(0.5);
    expect(mapToScreen(0.7, 0.5).x).toBeLessThan(0.5);
  });

  it("stretches the central zone to the whole screen and clamps", () => {
    expect(mapToScreen(0.85, 0.15, 0.7).x).toBeCloseTo(0);
    expect(mapToScreen(0.85, 0.15, 0.7).y).toBeCloseTo(0);
    expect(mapToScreen(0.15, 0.85, 0.7).x).toBeCloseTo(1);
    expect(mapToScreen(0.15, 0.85, 0.7).y).toBeCloseTo(1);
    expect(mapToScreen(0.99, 0.01, 0.7)).toEqual({ x: 0, y: 0 });
    expect(mapToScreen(0.01, 0.99, 0.7)).toEqual({ x: 1, y: 1 });
  });
});

describe("createCursor", () => {
  it("settles on a still fingertip", () => {
    const c = createCursor();
    let s = c.update({ x: 0.5, y: 0.5 }, 0, VIEW);
    for (let t = 33; t < 1000; t += 33) s = c.update({ x: 0.5, y: 0.5 }, t, VIEW);
    expect(s.visible).toBe(true);
    expect(s.x).toBeCloseTo(500);
    expect(s.y).toBeCloseTo(400);
  });

  it("remembers recent positions for the pinch lookback", () => {
    const c = createCursor({ minCutoff: 1000, beta: 0 }); // effectively unfiltered
    c.update({ x: 0.5, y: 0.5 }, 0, VIEW);
    c.update({ x: 0.5, y: 0.5 }, 100, VIEW);
    c.update({ x: 0.2, y: 0.5 }, 200, VIEW);
    expect(c.positionAt(150)?.x).toBeCloseTo(500, 0);
    expect(c.positionAt(250)?.x).toBeGreaterThan(800);
    expect(c.positionAt(-50)?.x).toBeCloseTo(500, 0);
  });

  it("stays briefly after the hand is lost, then hides and forgets", () => {
    const c = createCursor({ hideMs: 500 });
    c.update({ x: 0.5, y: 0.5 }, 0, VIEW);
    expect(c.update(null, 300, VIEW).visible).toBe(true);
    expect(c.update(null, 600, VIEW).visible).toBe(false);
    expect(c.positionAt(600)).toBeNull();
  });
});

describe("edgeScrollVelocity", () => {
  it("is zero in the middle and grows toward the edges", () => {
    expect(edgeScrollVelocity(400, 800, 0.12)).toBe(0);
    expect(edgeScrollVelocity(800 - 96, 800, 0.12)).toBeCloseTo(0);
    expect(edgeScrollVelocity(800 - 48, 800, 0.12)).toBeCloseTo(0.5);
    expect(edgeScrollVelocity(800, 800, 0.12)).toBe(1);
    expect(edgeScrollVelocity(0, 800, 0.12)).toBe(-1);
    expect(edgeScrollVelocity(48, 800, 0.12)).toBeCloseTo(-0.5);
  });

  it("stays within -1..1 and handles an empty screen", () => {
    expect(edgeScrollVelocity(2000, 800, 0.12)).toBe(1);
    expect(edgeScrollVelocity(-50, 800, 0.12)).toBe(-1);
    expect(edgeScrollVelocity(10, 0, 0.12)).toBe(0);
  });
});
