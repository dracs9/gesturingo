import { describe, expect, it } from "vitest";
import { canonicalHand, toFrame, type SyntheticHandOptions } from "../__fixtures__/syntheticHand";
import { createKnn, type LabeledVector } from "../letters/knn";
import type { LetterSpec } from "../letters/spec";
import { flattenPoints } from "../normalize";
import { buildObservation, type HandObservation } from "../observation";
import { createOpenReader, type ReaderUpdate } from "./openReader";

const samples = (label: string, hand: SyntheticHandOptions, n = 6): LabeledVector[] =>
  Array.from({ length: n }, () => ({ label, vector: flattenPoints(canonicalHand(hand)) }));

const ONE_HAND = { fingers: { index: "straight", middle: "bent", ring: "bent", pinky: "bent" } } as const;
const FIST_HAND = { fingers: { index: "bent", middle: "bent", ring: "bent", pinky: "bent" } } as const;
const PALM_HAND = {} as const;

const bent = (hintCode: string) => ({ state: "bent" as const, hintCode });
const straight = (hintCode: string) => ({ state: "straight" as const, hintCode });

const SPECS: LetterSpec[] = [
  {
    letter: "1",
    verified: false,
    fingers: {
      index: straight("finger.straighten.index"),
      middle: bent("finger.bend.middle"),
      ring: bent("finger.bend.ring"),
      pinky: bent("finger.bend.pinky"),
    },
    reference: "",
  },
  {
    letter: "0",
    verified: false,
    fingers: {
      index: bent("finger.bend.index"),
      middle: bent("finger.bend.middle"),
      ring: bent("finger.bend.ring"),
      pinky: bent("finger.bend.pinky"),
    },
    reference: "",
  },
  // A letter shaped like the open palm: the palm is a command and must never type it.
  {
    letter: "5",
    verified: false,
    fingers: { index: straight("finger.straighten.index"), middle: straight("finger.straighten.middle") },
    reference: "",
  },
];

const knn = createKnn([...samples("1", ONE_HAND), ...samples("0", FIST_HAND), ...samples("5", PALM_HAND)]);
const newReader = () =>
  createOpenReader({ specs: SPECS, getSpec: (l) => SPECS.find((s) => s.letter === l), knn });

const FRAME_MS = 33;
const obs = (hand: SyntheticHandOptions): HandObservation => buildObservation(toFrame(canonicalHand(hand)));

/** Feeds the same observation for `ms`; returns every update. */
function run(
  reader: ReturnType<typeof newReader>,
  o: HandObservation | null,
  from: number,
  ms: number,
  opts: { suppressed?: boolean } = {},
): { updates: ReaderUpdate[]; end: number } {
  const updates: ReaderUpdate[] = [];
  let t = from;
  for (; t < from + ms; t += FRAME_MS) updates.push(reader.update(o, t, opts));
  return { updates, end: t };
}
const typed = (updates: ReaderUpdate[]) => updates.flatMap((u) => (u.accepted ? [u.accepted] : []));

describe("open reader (talk mode)", () => {
  it("types a letter once after the hold, with a green skeleton", () => {
    const reader = newReader();
    const { updates } = run(reader, obs(ONE_HAND), 0, 1500);
    expect(typed(updates)).toEqual(["1"]);
    const at = updates.findIndex((u) => u.accepted);
    expect(at * FRAME_MS).toBeGreaterThanOrEqual(600);
    expect(at * FRAME_MS).toBeLessThan(1000);
    expect(updates.at(-1)?.tone).toBe("accept");
  });

  it("repeats a letter («НН») only after it was released", () => {
    const reader = newReader();
    let r = run(reader, obs(ONE_HAND), 0, 3000);
    expect(typed(r.updates)).toEqual(["1"]);
    expect(r.updates.at(-1)?.blocked).toBe("1");
    // Hand lowered briefly, then the same letter again.
    r = run(reader, null, r.end, 400);
    r = run(reader, obs(ONE_HAND), r.end, 1500);
    expect(typed(r.updates)).toEqual(["1"]);
  });

  it("types a different letter right away", () => {
    const reader = newReader();
    const a = run(reader, obs(ONE_HAND), 0, 1500);
    const b = run(reader, obs(FIST_HAND), a.end, 1500);
    expect([...typed(a.updates), ...typed(b.updates)]).toEqual(["1", "0"]);
  });

  it("types nothing while suppressed (command zone, candidate)", () => {
    const reader = newReader();
    const { updates } = run(reader, obs(ONE_HAND), 0, 2000, { suppressed: true });
    expect(typed(updates)).toEqual([]);
    expect(updates.at(-1)?.state).toBe("suppressed");
  });

  it("never types the open palm (it is the cancel / exit command)", () => {
    const reader = newReader();
    const { updates } = run(reader, obs(PALM_HAND), 0, 3000);
    expect(typed(updates)).toEqual([]);
  });

  it("gives a hint and a red skeleton for an «almost» letter, typing nothing", () => {
    const reader = newReader();
    const { updates } = run(reader, obs({ fingers: { ...ONE_HAND.fingers, ring: "half" } }), 0, 2000);
    expect(typed(updates)).toEqual([]);
    const last = updates.at(-1);
    expect(last?.hint?.hintCode).toBe("finger.bend.ring");
    expect(last?.hintLetter).toBe("1");
    expect(last?.tone).toBe("almost");
    expect(reader.hintLog.map((h) => h.hintCode)).toEqual(["finger.bend.ring"]);
    // The hint waits 0.7 s: no blinking.
    const first = updates.findIndex((u) => u.hint);
    expect(first * FRAME_MS).toBeGreaterThanOrEqual(700);
  });

  it("does not hint «raise your hand» when there is simply no hand", () => {
    const reader = newReader();
    const { updates } = run(reader, null, 0, 2000);
    expect(updates.every((u) => u.hint === null && u.tone === null)).toBe(true);
  });
});
