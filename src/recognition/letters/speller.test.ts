import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { buildObservation, type HandObservation } from "../observation";
import type { LetterSpec } from "./spec";
import { createWordSpeller, type SpellUpdate } from "./speller";

const obs = (hand: SyntheticHandOptions) => buildObservation(toFrame(canonicalHand(hand)));

// Test-only letters: "Х" = all fingers straight, "Ф" = a fist.
const SPECS: Record<string, LetterSpec> = {
  Х: {
    letter: "Х",
    verified: false,
    fingers: {
      index: { state: "straight", hintCode: "finger.straighten.index" },
      middle: { state: "straight", hintCode: "finger.straighten.middle" },
    },
    reference: "",
  },
  Ф: {
    letter: "Ф",
    verified: false,
    fingers: {
      index: { state: "bent", hintCode: "finger.bend.index" },
      middle: { state: "bent", hintCode: "finger.bend.middle" },
    },
    reference: "",
  },
};
const getSpec = (l: string) => SPECS[l];

const OPEN = obs({});
const FIST = obs({ fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } });

function run(
  speller: ReturnType<typeof createWordSpeller>,
  o: HandObservation | null,
  from: number,
  to: number,
): Array<SpellUpdate & { t: number }> {
  const out: Array<SpellUpdate & { t: number }> = [];
  for (let t = from; t < to; t += 33) out.push({ ...speller.update(o, t), t });
  return out;
}

const accepted = (out: SpellUpdate[]) => out.flatMap((u) => (u.accepted ? [u.accepted] : []));

describe("word speller", () => {
  it("spells letters in order and finishes", () => {
    const s = createWordSpeller("ХФ", getSpec);
    const first = run(s, OPEN, 0, 1500);
    expect(accepted(first)).toEqual(["Х"]);
    expect(first.at(-1)?.index).toBe(1);
    const second = run(s, FIST, 1500, 3000);
    expect(accepted(second)).toEqual(["Ф"]);
    expect(second.at(-1)?.done).toBe(true);
  });

  it("gives hints for the expected letter", () => {
    const s = createWordSpeller("Ф", getSpec);
    expect(run(s, OPEN, 0, 1200).at(-1)?.hint?.hintCode).toMatch(/^finger\.bend\./);
  });

  it("needs the hand to change before a repeated letter counts again", () => {
    const s = createWordSpeller("ХХ", getSpec);
    run(s, OPEN, 0, 1500);
    const holding = run(s, OPEN, 1500, 4000);
    expect(accepted(holding)).toEqual([]);
    expect(holding.at(-1)?.awaitingRelease).toBe(true);
    expect(holding.at(-1)?.hint).toMatchObject({ hintCode: "bridge.release", params: { letter: "Х" } });

    run(s, null, 4000, 4200); // hand down
    const again = run(s, OPEN, 4200, 6000);
    expect(accepted(again)).toEqual(["Х"]);
    expect(again.at(-1)?.done).toBe(true);
  });

  it("is done at once for an empty word", () => {
    expect(createWordSpeller("", getSpec).update(OPEN, 0).done).toBe(true);
  });
});
