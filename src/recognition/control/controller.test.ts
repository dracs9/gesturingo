import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type ProjectionOptions, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { buildObservation, type HandObservation } from "../observation";
import { createControlLayer, type ControlContext, type ControlOutput } from "./controller";

const VIEW = { width: 1000, height: 1000 };
const ALL: ControlContext = { cursor: true, ok: true, back: true };
const STEP = 33;

const obs = (hand: SyntheticHandOptions, proj: ProjectionOptions = {}) =>
  buildObservation(toFrame(canonicalHand(hand), proj));

// Pointing hand: index straight, the rest folded — neither open palm nor thumbs up.
const POINT = obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" }, thumb: "across" });
const POINT_PINCH = obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" }, thumb: "pinch" });
const OPEN_PALM = obs({});
const THUMBS_UP = obs({ fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" }, thumb: "up" });

type Layer = ReturnType<typeof createControlLayer<string>>;

function run(
  layer: Layer,
  frames: (t: number) => HandObservation | null,
  from: number,
  to: number,
  ctx: ControlContext = ALL,
): Array<ControlOutput<string> & { t: number }> {
  const out: Array<ControlOutput<string> & { t: number }> = [];
  for (let t = from; t < to; t += STEP) out.push({ ...layer.update(frames(t), t, ctx, VIEW), t });
  return out;
}

const clicks = (outs: ReturnType<typeof run>) => outs.filter((o) => o.click);
const commands = (outs: ReturnType<typeof run>) => outs.map((o) => o.command).filter(Boolean);

describe("control layer", () => {
  it("pinch clicks the target where the cursor was just before closing", () => {
    const seen: Array<{ x: number; y: number }> = [];
    const layer = createControlLayer<string>({
      hitTest: (x, y) => {
        seen.push({ x, y });
        return x < 500 ? "left" : "right";
      },
    });
    // Point on the right half of the screen (hand on the left of the unmirrored image)…
    const right = { wrist: { x: 0.35, y: 0.7 } };
    run(layer, () => obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" }, thumb: "across" }, right), 0, 400);
    // …then pinch while the hand jumps far left in one frame.
    const out = layer.update(
      obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" }, thumb: "pinch" }, { wrist: { x: 0.8, y: 0.7 } }),
      400,
      ALL,
      VIEW,
    );
    expect(out.click?.source).toBe("pinch");
    expect(out.click?.target).toBe("right");
  });

  it("clicks once per pinch", () => {
    const layer = createControlLayer<string>({ hitTest: () => null });
    const outs = [
      ...run(layer, () => POINT, 0, 300),
      ...run(layer, () => POINT_PINCH, 300, 900),
      ...run(layer, () => POINT, 900, 1200),
      ...run(layer, () => POINT_PINCH, 1200, 1500),
    ];
    expect(clicks(outs).map((o) => o.click?.source)).toEqual(["pinch", "pinch"]);
  });

  it("does nothing with the cursor disabled", () => {
    const layer = createControlLayer<string>({ hitTest: () => "btn" });
    const ctx = { cursor: false, ok: false, back: true };
    const outs = [...run(layer, () => POINT, 0, 2000, ctx), ...run(layer, () => POINT_PINCH, 2000, 2500, ctx)];
    expect(clicks(outs)).toHaveLength(0);
    expect(outs.every((o) => !o.cursor.visible)).toBe(true);
  });

  it("dwell clicks after 1 s and does not chain onto the next screen's button", () => {
    let target = "start";
    const layer = createControlLayer<string>({ hitTest: () => target });
    const first = run(layer, () => POINT, 0, 1200);
    expect(clicks(first).map((o) => o.click?.target)).toEqual(["start"]);

    target = "next"; // navigation put another button under the resting cursor
    expect(clicks(run(layer, () => POINT, 1200, 4000))).toHaveLength(0);

    // Moving the hand re-arms dwell.
    const moved = obs({ fingers: { middle: "bent", ring: "bent", pinky: "bent" }, thumb: "across" }, { wrist: { x: 0.3, y: 0.7 } });
    expect(clicks(run(layer, () => moved, 4000, 6000)).map((o) => o.click?.target)).toEqual(["next"]);
  });

  it("a still open palm held 1.5 s means back — once", () => {
    const layer = createControlLayer<string>({ hitTest: () => null });
    const outs = run(layer, () => OPEN_PALM, 0, 3000);
    expect(commands(outs)).toEqual(["back"]);
    const firedAt = outs.find((o) => o.command)?.t ?? 0;
    expect(firedAt).toBeGreaterThanOrEqual(1500);
    expect(outs.some((o) => o.pose?.kind === "back" && o.pose.progress > 0.5)).toBe(true);
  });

  it("a moving open palm (steering the cursor) never means back", () => {
    const layer = createControlLayer<string>({ hitTest: () => null });
    const moving = (t: number) => obs({}, { wrist: { x: 0.5 + 0.15 * Math.sin(t / 150), y: 0.7 } });
    expect(commands(run(layer, moving, 0, 4000))).toHaveLength(0);
  });

  it("thumbs up held 0.8 s means OK only where OK is enabled", () => {
    const on = createControlLayer<string>({ hitTest: () => null });
    expect(commands(run(on, () => THUMBS_UP, 0, 1500))).toEqual(["ok"]);

    const off = createControlLayer<string>({ hitTest: () => null });
    expect(commands(run(off, () => THUMBS_UP, 0, 1500, { cursor: true, ok: false, back: true }))).toEqual([]);
  });

  it("does not dwell-click while a pose is being held", () => {
    const layer = createControlLayer<string>({ hitTest: () => "btn" });
    const outs = run(layer, () => THUMBS_UP, 0, 2000);
    expect(clicks(outs)).toHaveLength(0);
  });

  it("hides the cursor after the hand is lost", () => {
    const layer = createControlLayer<string>({ hitTest: () => null });
    run(layer, () => POINT, 0, 300);
    const outs = run(layer, () => null, 300, 1000);
    expect(outs[0]?.cursor.visible).toBe(true);
    expect(outs.at(-1)?.cursor.visible).toBe(false);
  });
});
