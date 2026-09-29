import { describe, expect, it } from "vitest";
import { createHintEngine, type HintError } from "./hintEngine";

const frame = (code: string, severity = 1): HintError => ({ level: "frame", hintCode: code, severity });
const shape = (code: string, severity = 0.5): HintError => ({ level: "shape", hintCode: code, severity });
const opts = { appearMs: 700, minSwitchMs: 1000, graceMs: 250 };

/** Feeds the same errors every 33 ms over [from, to); returns the hint code at the end. */
function feed(engine: ReturnType<typeof createHintEngine>, errors: HintError[], from: number, to: number) {
  let hint: HintError | null = null;
  for (let t = from; t < to; t += 33) hint = engine.update(errors, t);
  return hint?.hintCode ?? null;
}

describe("hintEngine", () => {
  it("shows a hint only after the error lasts 0.7 s", () => {
    const e = createHintEngine(opts);
    expect(feed(e, [shape("a")], 0, 600)).toBeNull();
    expect(feed(e, [shape("a")], 600, 800)).toBe("a");
  });

  it("shows one hint: frame level beats shape, then higher severity", () => {
    const e = createHintEngine(opts);
    expect(feed(e, [shape("bend.ring", 0.9), frame("frame.tooFar")], 0, 1000)).toBe("frame.tooFar");
    const f = createHintEngine(opts);
    expect(feed(f, [shape("low", 0.2), shape("high", 0.8)], 0, 1000)).toBe("high");
  });

  it("switches to a more important hint at most once per second", () => {
    const e = createHintEngine(opts);
    feed(e, [shape("a")], 0, 800); // "a" shown at ~700
    // A frame error appears at 800: eligible at 1500, switch allowed from 1700.
    expect(feed(e, [shape("a"), frame("f")], 800, 1600)).toBe("a");
    expect(feed(e, [shape("a"), frame("f")], 1600, 1800)).toBe("f");
  });

  it("does not blink when an error drops out for a few frames", () => {
    const e = createHintEngine(opts);
    feed(e, [shape("a")], 0, 800);
    expect(e.update([], 820)).not.toBeNull();
    expect(e.update([], 950)).not.toBeNull();
    expect(feed(e, [shape("a")], 980, 1100)).toBe("a");
  });

  it("hides as soon as the error is fixed", () => {
    const e = createHintEngine(opts);
    feed(e, [shape("a")], 0, 800);
    expect(feed(e, [], 800, 1100)).toBeNull();
  });

  it("waits before showing the next hint after one was fixed", () => {
    const e = createHintEngine(opts);
    feed(e, [shape("a")], 0, 800);
    feed(e, [], 800, 1100); // "a" hidden at ~1060
    expect(feed(e, [shape("b")], 1100, 1900)).toBeNull(); // eligible at 1800, but switch only from ~2060
    expect(feed(e, [shape("b")], 1900, 2200)).toBe("b");
  });
});
