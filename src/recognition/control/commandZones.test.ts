import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame } from "../__fixtures__/syntheticHand";
import { LM } from "../landmarks";
import { buildObservation } from "../observation";
import { createCommandZones, zoneAt } from "./commandZones";

const handAt = (x: number, y: number) => buildObservation(toFrame(canonicalHand(), { wrist: { x, y } }));

describe("command zones", () => {
  it("are placed as the user sees the mirrored video", () => {
    // Raw x = 0.9 is on the LEFT of the mirrored picture.
    expect(zoneAt({ x: 0.9, y: 0.1 })).toBe("delete");
    expect(zoneAt({ x: 0.1, y: 0.1 })).toBe("say");
    expect(zoneAt({ x: 0.5, y: 0.1 })).toBe("space");
    expect(zoneAt({ x: 0.5, y: 0.7 })).toBeNull();
  });

  it("fire once after the wrist stays 0.8 s in a zone", () => {
    const zones = createCommandZones();
    const inSay = handAt(0.12, 0.35);
    const fired: string[] = [];
    let t = 0;
    for (; t < 2000; t += 33) {
      const u = zones.update(inSay, t);
      expect(u.active).toBe("say");
      if (u.fired) fired.push(`${u.fired}@${t}`);
    }
    expect(fired).toHaveLength(1);
    expect(Number(fired[0]?.split("@")[1])).toBeGreaterThanOrEqual(800);

    // Leave, come back: fires again.
    for (const end = t + 500; t < end; t += 33) zones.update(handAt(0.5, 0.7), t);
    let again = 0;
    for (const end = t + 1000; t < end; t += 33) if (zones.update(inSay, t).fired === "say") again++;
    expect(again).toBe(1);
  });

  it("ignore a fingertip in a zone while the wrist stays in the middle", () => {
    const o = handAt(0.12, 0.62);
    const tip = o.frame.landmarks[LM.MIDDLE_TIP];
    expect(tip && zoneAt(tip)).toBe("say");
    const zones = createCommandZones();
    for (let t = 0; t < 1500; t += 33) expect(zones.update(o, t)).toMatchObject({ active: null, fired: null });
  });
});
