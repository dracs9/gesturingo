import { describe, expect, it } from "vitest";
import { createDwell } from "./dwell";

const P = { x: 100, y: 100 };

describe("createDwell", () => {
  it("fills progress and fires after the dwell time", () => {
    const d = createDwell<string>({ dwellMs: 1000, rearmPx: 48 });
    expect(d.update("a", P, 0)).toEqual({ progress: 0, fired: null });
    expect(d.update("a", P, 500).progress).toBeCloseTo(0.5);
    expect(d.update("a", P, 1000)).toEqual({ progress: 1, fired: "a" });
  });

  it("does not re-fire until the cursor moves or leaves", () => {
    const d = createDwell<string>({ dwellMs: 1000, rearmPx: 48 });
    d.update("a", P, 0);
    d.update("a", P, 1000);
    // Next screen: a new button appears under the resting cursor.
    expect(d.update("b", P, 1100).progress).toBe(0);
    expect(d.update("b", { x: 120, y: 110 }, 3000).fired).toBeNull();
    // Moving away re-arms.
    d.update("b", { x: 200, y: 100 }, 3100);
    expect(d.update("b", { x: 200, y: 100 }, 4100).fired).toBe("b");
  });

  it("re-arms when the cursor rests on empty space", () => {
    const d = createDwell<string>({ dwellMs: 1000, rearmPx: 48 });
    d.update("a", P, 0);
    d.update("a", P, 1000);
    d.update(null, P, 1100);
    d.update("a", P, 1200);
    expect(d.update("a", P, 2200).fired).toBe("a");
  });

  it("restarts when the target changes", () => {
    const d = createDwell<string>({ dwellMs: 1000, rearmPx: 48 });
    d.update("a", P, 0);
    d.update("b", P, 800);
    expect(d.update("b", P, 1000).progress).toBeCloseTo(0.2);
  });

  it("stays silent after an external disarm", () => {
    const d = createDwell<string>({ dwellMs: 1000, rearmPx: 48 });
    d.update("a", P, 0);
    d.disarm(P);
    expect(d.update("a", P, 2000).fired).toBeNull();
  });
});
