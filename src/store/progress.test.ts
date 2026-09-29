import { afterEach, describe, expect, it, vi } from "vitest";
import { progressSnapshot, useProgress } from "./progress";
import { EMPTY_PROGRESS } from "./progressLogic";
import { safeStorage } from "./storage";

describe("progress store", () => {
  afterEach(() => useProgress.getState().reset());

  it("records a lesson and resets", () => {
    useProgress.getState().recordLesson({
      lessonId: "1",
      letters: [{ letter: "В", stars: 2, hints: 1, timeMs: 1000 }],
      hintLog: [{ letter: "В", hintCode: "thumb.pressToPalm", timestamp: 0 }],
    });
    expect(progressSnapshot()).toMatchObject({ xp: 20, hintCounts: { "thumb.pressToPalm": 1 } });
    useProgress.getState().markTutorialDone();
    expect(useProgress.getState().tutorialDone).toBe(true);
    useProgress.getState().reset();
    expect(progressSnapshot()).toEqual(EMPTY_PROGRESS);
  });
});

describe("safeStorage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never throws when storage is unavailable", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("window", { localStorage: broken });
    expect(safeStorage.getItem("x")).toBeNull();
    expect(() => safeStorage.setItem("x", "1")).not.toThrow();
    expect(() => safeStorage.removeItem("x")).not.toThrow();
  });

  it("works without a window at all", () => {
    expect(safeStorage.getItem("x")).toBeNull();
  });
});
