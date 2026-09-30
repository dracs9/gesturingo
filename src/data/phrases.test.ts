import { describe, expect, it } from "vitest";
import type { PhraseSpec } from "../recognition/phrases/spec";
import { DYNAMIC_PHRASES, getPhraseByLabel, isPhraseLabel, labelText, mergePhrases, PHRASES } from "./phrases";

const phrase = (id: string, kind: PhraseSpec["kind"] = "static"): PhraseSpec => ({
  id,
  text: id.toUpperCase(),
  kind,
  verified: false,
  source: { dataset: "slovo", label: id, samples: 10 },
  handshape: { letter: `#${id}`, verified: false, fingers: {}, reference: "" },
});

describe("phrases", () => {
  it("merges the team's overrides and leaves out excluded and incomplete phrases", () => {
    const merged = mergePhrases([phrase("ya"), phrase("chto"), phrase("poka", "dynamic")], {
      ya: { text: "Я", verified: true },
      chto: { excluded: true },
    });
    expect(merged.map((p) => [p.id, p.text, p.verified])).toEqual([["ya", "Я", true]]);
  });

  it("tells phrase labels from letters and names them for the UI", () => {
    expect(isPhraseLabel("#ya")).toBe(true);
    expect(isPhraseLabel("А")).toBe(false);
    expect(labelText("Б")).toBe("Б");
    for (const p of PHRASES) {
      expect(getPhraseByLabel(`#${p.id}`)).toBe(p);
      expect(labelText(`#${p.id}`)).toBe(p.text);
    }
  });

  it("ships only data-built phrases: from Slovo, static with a handshape or dynamic with a DTW tolerance", () => {
    for (const p of PHRASES) {
      expect(p.source.dataset).toBe("slovo");
      if (p.kind === "static") expect(p.handshape?.letter).toBe(`#${p.id}`);
      else expect(p.tolerance?.dtw).toBeGreaterThan(0);
    }
    for (const p of DYNAMIC_PHRASES) expect(p.kind).toBe("dynamic");
  });
});
