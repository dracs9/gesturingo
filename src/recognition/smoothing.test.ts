import { describe, expect, it } from "vitest";
import { createMajorityVote, createOneEuroFilter, createPointsEma, createStableValue } from "./smoothing";

describe("createStableValue", () => {
  it("keeps the old value until the new one persists", () => {
    const s = createStableValue("a", 100);
    expect(s.update("b", 0)).toBe("a");
    expect(s.update("b", 50)).toBe("a");
    expect(s.update("b", 100)).toBe("b");
    expect(s.value).toBe("b");
  });

  it("suppresses flip-flopping", () => {
    const s = createStableValue("a", 100);
    s.update("b", 0);
    s.update("a", 60);
    expect(s.update("b", 120)).toBe("a");
    expect(s.update("b", 219)).toBe("a");
    expect(s.update("b", 220)).toBe("b");
  });

  it("restarts the timer when the candidate changes", () => {
    const s = createStableValue(1, 100);
    s.update(2, 0);
    s.update(3, 80);
    expect(s.update(3, 150)).toBe(1);
    expect(s.update(3, 180)).toBe(3);
  });
});

describe("createPointsEma", () => {
  it("starts from the first frame, converges and resets", () => {
    const ema = createPointsEma(0.5);
    expect(ema.update([{ x: 0, y: 0, z: 0 }])).toEqual([{ x: 0, y: 0, z: 0 }]);
    expect(ema.update([{ x: 1, y: 2, z: 4 }])).toEqual([{ x: 0.5, y: 1, z: 2 }]);
    let last = ema.update([{ x: 1, y: 2, z: 4 }]);
    for (let i = 0; i < 20; i++) last = ema.update([{ x: 1, y: 2, z: 4 }]);
    expect(last[0]?.x).toBeCloseTo(1);
    ema.reset();
    expect(ema.update([{ x: 9, y: 9, z: 9 }])).toEqual([{ x: 9, y: 9, z: 9 }]);
  });
});

describe("createOneEuroFilter", () => {
  it("passes a constant signal through", () => {
    const f = createOneEuroFilter({ minCutoff: 1, beta: 0.01 });
    let out = 0;
    for (let t = 0; t < 1000; t += 33) out = f.filter(5, t);
    expect(out).toBeCloseTo(5);
  });

  it("reduces jitter around a still point", () => {
    const f = createOneEuroFilter({ minCutoff: 1, beta: 0.01 });
    const outs: number[] = [];
    for (let i = 0; i < 60; i++) outs.push(f.filter(i % 2 === 0 ? 0.01 : -0.01, i * 33));
    const tail = outs.slice(30);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(0.01);
  });

  it("follows fast motion with little lag", () => {
    const f = createOneEuroFilter({ minCutoff: 1, beta: 5 });
    let out = 0;
    for (let i = 0; i <= 30; i++) out = f.filter(i * 0.1, i * 33);
    expect(out).toBeGreaterThan(2.5);
  });

  it("ignores non-increasing timestamps", () => {
    const f = createOneEuroFilter({ minCutoff: 1, beta: 0 });
    f.filter(1, 100);
    expect(f.filter(50, 100)).toBe(1);
  });
});

describe("createMajorityVote", () => {
  it("returns the majority once it reaches the quorum", () => {
    const vote = createMajorityVote<string | null>(5, 0.6);
    expect(vote.push("А")).toBeNull();
    expect(vote.push("А")).toBeNull();
    expect(vote.push("А")).toBe("А");
    expect(vote.push("Б")).toBe("А");
    expect(vote.push("Б")).toBe("А");
    expect(vote.push("Б")).toBe("Б"); // window: А А Б Б Б
  });

  it("returns null without a quorum", () => {
    const vote = createMajorityVote<string>(4, 0.75);
    for (const v of ["А", "Б", "А", "Б"]) expect(vote.push(v)).toBeNull();
  });

  it("slides the window", () => {
    const vote = createMajorityVote<string>(3, 0.6);
    vote.push("А");
    vote.push("А");
    vote.push("Б");
    expect(vote.push("Б")).toBe("Б");
    vote.reset();
    expect(vote.push("В")).toBeNull();
  });
});
