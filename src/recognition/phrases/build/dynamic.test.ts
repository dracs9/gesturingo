import { describe, expect, it } from "vitest";
import { buildModel, classThreshold, decide, distanceMatrix, evaluateMatcher, pickTemplates, type DynSample } from "./dynamic";

/** 1-dim "sequences": a constant level per clip, so distances are |a − b|. */
const clip = (label: string, signer: string, level: number, durationMs = 1000): DynSample => ({
  label,
  signer,
  seq: Array.from({ length: 6 }, () => [level]),
  durationMs,
});

// Two well separated phrases, 3 signers each, plus a "negative" sign far from both.
const samples: DynSample[] = [
  clip("#a", "s1", 0),
  clip("#a", "s2", 0.1),
  clip("#a", "s3", 0.05),
  clip("#b", "s1", 5),
  clip("#b", "s2", 5.1),
  clip("#b", "s3", 4.95),
  clip("#neg", "s4", 10),
];
const d = distanceMatrix(samples, 2);
const members = (label: string) => samples.flatMap((s, i) => (s.label === label ? [i] : []));

describe("dynamic phrase build", () => {
  it("picks the most typical clip of each signer, most typical signers first", () => {
    const t = pickTemplates(members("#a"), samples, d);
    expect(t).toHaveLength(3);
    expect(samples[t[0] ?? -1]?.seq[0]?.[0]).toBe(0.05);
  });

  it("sets the threshold from the class, capped by other signs", () => {
    const tpl = pickTemplates(members("#a"), samples, d);
    const own = classThreshold(members("#a"), tpl, samples, d);
    expect(own).toBeGreaterThan(0);
    expect(own).toBeLessThan(0.2);
    // A foreign clip right next to the class pulls the threshold under its distance.
    const near = [...samples, clip("#x", "s5", 0.08)];
    const dn = distanceMatrix(near, 2);
    const capped = classThreshold(members("#a"), tpl, near, dn, [near.length - 1], 0);
    expect(capped).toBeLessThan(own);
  });

  it("decides like the app: within the threshold, clear margin, usual duration", () => {
    const models = ["#a", "#b"].map((l) => buildModel(l, members(l), samples, d));
    const near = (level: number) => (t: number) => Math.abs((samples[t]?.seq[0]?.[0] ?? 0) - level);
    expect(decide(models, near(0.02), 1000)).toBe("#a");
    expect(decide(models, near(5.02), 1000)).toBe("#b");
    expect(decide(models, near(2.5), 1000)).toBeNull();
    expect(decide(models, near(0.02), 50)).toBeNull();
  });

  it("simulates the matcher leave-one-signer-out and counts false accepts of other signs", () => {
    const ev = evaluateMatcher(["#a", "#b"], samples, d, members("#neg"));
    expect(ev.perLabel.get("#a")?.clips).toBe(3);
    expect(ev.perLabel.get("#b")?.fromPhrases).toBe(0);
    expect(ev.negatives).toBe(1);
    expect(ev.falseFromNegatives).toBe(0);
  });
});
