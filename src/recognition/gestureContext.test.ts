import { describe, expect, it } from "vitest";
import { getGestureContext } from "./gestureContext";

describe("gestureContext (CLAUDE.md §7.5)", () => {
  it("allows full navigation on menu screens", () => {
    for (const s of ["welcome", "map", "results"] as const) {
      expect(getGestureContext(s)).toEqual({ cursor: true, dwell: true, ok: true, back: true, letters: "none" });
    }
  });

  it("keeps only back + letters in lesson and bridge", () => {
    expect(getGestureContext("lesson")).toEqual({ cursor: false, dwell: false, ok: false, back: true, letters: "current" });
    expect(getGestureContext("bridge")).toEqual({ cursor: false, dwell: false, ok: false, back: true, letters: "learned" });
  });

  it("leaves talk to its own command zones: no cursor, no control poses", () => {
    expect(getGestureContext("talk")).toEqual({ cursor: false, dwell: false, ok: false, back: false, letters: "all" });
  });

  it("uses buttons and back on /record", () => {
    expect(getGestureContext("record")).toEqual({ cursor: true, dwell: true, ok: false, back: true, letters: "none" });
  });

  it("uses buttons and back on /letters", () => {
    expect(getGestureContext("letters")).toEqual({ cursor: true, dwell: true, ok: false, back: true, letters: "none" });
  });
});
