import { describe, expect, it } from "vitest";
import { TALK_DTW_LENGTH } from "../thresholds";
import { dtw, resample } from "./dtw";
import { FRAME_DIM, mirrorSequence, toSequence, travelPath } from "./frameFeatures";
import { createPhraseMatcher, type DynamicTemplates } from "./phraseMatcher";
import { createSequenceTracker, type MotionSegment } from "./sequenceBuffer";

/** A frame: finger angles (0..1), palm normal, roll, wrist position and palm size. */
function frame({ bend = 0.9, roll = 0, x = 0.5, y = 0.5 }: { bend?: number; roll?: number; x?: number; y?: number }): number[] {
  const f = new Array<number>(FRAME_DIM).fill(0);
  for (let i = 0; i < 5; i++) f[i] = bend;
  f[7] = 1;
  f[8] = Math.cos(roll);
  f[9] = Math.sin(roll);
  f[10] = x;
  f[11] = y;
  f[12] = 0.2;
  return f;
}

/** A wave: the hand rolls left and right `times` times over `n` frames. */
const wave = (n: number, times = 2, amp = 0.6) =>
  Array.from({ length: n }, (_, i) => frame({ roll: amp * Math.sin((2 * Math.PI * times * i) / (n - 1)) }));
/** A slide: the wrist moves from (0.3, y) to (0.7, y) with a fist. */
const slide = (n: number, dir = 1) => Array.from({ length: n }, (_, i) => frame({ bend: 0.4, x: 0.5 + dir * (i / (n - 1) - 0.5) * 0.4 }));

describe("dtw", () => {
  it("is zero for the same sequence and grows with the difference", () => {
    const a = resample(toSequence(wave(30)), TALK_DTW_LENGTH);
    const b = resample(toSequence(slide(30)), TALK_DTW_LENGTH);
    expect(dtw(a, a, 6)).toBeCloseTo(0);
    expect(dtw(a, b, 6)).toBeGreaterThan(0.3);
    expect(dtw(a, b, 6)).toBeCloseTo(dtw(b, a, 6));
  });

  it("forgives a different tempo (the point of time warping)", () => {
    const slow = resample(toSequence(wave(40, 2)), TALK_DTW_LENGTH);
    const fast = resample(toSequence(wave(20, 2)), TALK_DTW_LENGTH);
    const other = resample(toSequence(slide(30)), TALK_DTW_LENGTH);
    expect(dtw(slow, fast, 6)).toBeLessThan(dtw(slow, other, 6));
  });

  it("resamples keeping the ends", () => {
    const r = resample([[0], [10]], 5);
    expect(r.map((v) => v[0])).toEqual([0, 2.5, 5, 7.5, 10]);
    expect(resample([], 5)).toEqual([]);
  });
});

describe("motion features", () => {
  it("turn the wrist into its travel from the start, in palm sizes", () => {
    const path = travelPath(toSequence(slide(20)));
    expect(path[0]?.x).toBeCloseTo(0);
    // 0.4 of the frame with a palm of 0.2 = 2 palm sizes (smoothing trims the ends a little).
    expect(path.at(-1)?.x).toBeGreaterThan(1.5);
  });

  it("mirror a motion for the other hand", () => {
    const seq = toSequence(slide(20));
    const m = mirrorSequence(seq);
    expect(travelPath(m).at(-1)?.x).toBeCloseTo(-(travelPath(seq).at(-1)?.x ?? 0));
    expect(mirrorSequence(m)).toEqual(seq);
  });
});

function feed(frames: readonly number[][], fromT = 0, dt = 33) {
  const tracker = createSequenceTracker({ start: 1, end: 0.5, endMs: 200, minMs: 300, maxMs: 3000 });
  const segments: MotionSegment[] = [];
  let t = fromT;
  for (const f of frames) {
    const u = tracker.push(f, t);
    if (u.segment) segments.push(u.segment);
    t += dt;
  }
  return { tracker, segments, t };
}

describe("motion segmentation", () => {
  const still = (n: number) => Array.from({ length: n }, () => frame({}));

  it("cuts a motion between two still periods", () => {
    const { segments } = feed([...still(15), ...wave(30), ...still(15)]);
    expect(segments).toHaveLength(1);
    const s = segments[0];
    expect(s?.durationMs).toBeGreaterThan(600);
    expect(s?.durationMs).toBeLessThan(1400);
  });

  it("ignores a still hand and a twitch", () => {
    expect(feed(still(60)).segments).toHaveLength(0);
    expect(feed([...still(15), ...wave(3, 1, 0.3), ...still(15)]).segments).toHaveLength(0);
  });

  it("ends a motion when the hand leaves", () => {
    const { tracker, segments, t } = feed([...still(10), ...wave(30)]);
    expect(segments).toHaveLength(0);
    expect(tracker.push(null, t).segment).not.toBeNull();
  });
});

describe("phrase matcher", () => {
  const set = (label: string, frames: number[][], threshold = 0.3): DynamicTemplates => ({
    label,
    templates: [resample(toSequence(frames), TALK_DTW_LENGTH)],
    threshold,
    durationMin: 500,
    durationMax: 2000,
  });
  const matcher = () => createPhraseMatcher([set("#wave", wave(30)), set("#slide", slide(30))]);
  const segment = (frames: number[][], startT = 0, durationMs = 1000): MotionSegment => ({
    frames,
    startT,
    endT: startT + durationMs,
    durationMs,
  });

  it("accepts the right phrase, also shown by the other hand", () => {
    const m = matcher();
    expect(m.match(segment(wave(28))).result).toMatchObject({ kind: "accept", label: "#wave" });
    expect(m.match(segment(slide(26, -1), 5000)).result).toMatchObject({ kind: "accept", label: "#slide" });
  });

  it("does not add the same sign twice within the cooldown", () => {
    const m = matcher();
    expect(m.match(segment(wave(28), 0)).result.kind).toBe("accept");
    expect(m.match(segment(wave(28), 1200)).result.kind).toBe("none");
  });

  it("asks to slow down or speed up when the motion is right but the tempo is not", () => {
    expect(matcher().match(segment(wave(28), 0, 300)).result).toMatchObject({ kind: "almost", reason: "slower" });
    expect(matcher().match(segment(wave(28), 0, 2500)).result).toMatchObject({ kind: "almost", reason: "faster" });
  });

  it("rejects a motion unlike any phrase", () => {
    const circle = Array.from({ length: 30 }, (_, i) =>
      frame({ bend: 0.1, x: 0.5 + 0.2 * Math.cos(i / 4), y: 0.5 + 0.2 * Math.sin(i / 4), roll: 1.2 }),
    );
    expect(matcher().match(segment(circle)).result.kind).toBe("none");
  });
});
