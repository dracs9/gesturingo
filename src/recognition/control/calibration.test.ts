import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type ProjectionOptions, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { buildObservation } from "../observation";
import { createCalibrator, palmCenter } from "./calibration";

const obs = (hand: SyntheticHandOptions = {}, proj: ProjectionOptions = {}) =>
  buildObservation(toFrame(canonicalHand(hand), proj));

function run(calibrator: ReturnType<typeof createCalibrator>, o: ReturnType<typeof obs> | null, from: number, ms: number) {
  let u = calibrator.update(o, from);
  for (let t = from + 33; t < from + ms; t += 33) u = calibrator.update(o, t);
  return u;
}

describe("talk calibration", () => {
  it("remembers where the open palm was held and how big it was", () => {
    const c = createCalibrator({ holdMs: 1000, timeoutMs: 5000 });
    const palm = obs({}, { wrist: { x: 0.45, y: 0.75 }, scale: 0.2 });
    const u = run(c, palm, 0, 1200);
    expect(u.status).toBe("done");
    const center = palmCenter(palm.frame);
    expect(u.result?.center.x).toBeCloseTo(center.x);
    expect(u.result?.center.y).toBeCloseTo(center.y);
    expect(u.result?.palm).toBeCloseTo(0.2, 1);
    expect(u.result?.aspect).toBeCloseTo(640 / 480);
  });

  it("needs an open palm: a fist does not calibrate", () => {
    const c = createCalibrator({ holdMs: 1000, timeoutMs: 5000 });
    const fist = obs({ fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } });
    expect(run(c, fist, 0, 2000).status).toBe("waiting");
  });

  it("starts over when the hand moves, and gives up after the timeout", () => {
    const c = createCalibrator({ holdMs: 1000, timeoutMs: 3000 });
    // The palm jumps from side to side every 0.5 s: never steady for a whole second.
    for (let t = 0; t < 3000; t += 33) {
      const x = Math.floor(t / 500) % 2 === 0 ? 0.3 : 0.7;
      expect(c.update(obs({}, { wrist: { x, y: 0.75 } }), t).status).not.toBe("done");
    }
    const u = c.update(null, 3100);
    expect(u.status).toBe("failed");
    expect(u.result).toBeNull();
  });
});
