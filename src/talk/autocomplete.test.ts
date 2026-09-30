import { describe, expect, it } from "vitest";
import { DICTIONARY } from "../data/dictionary.ru";
import { WORDS } from "../data/words";
import { createAutocomplete } from "./autocomplete";

describe("autocomplete", () => {
  const ac = createAutocomplete(["ПРИВЕТ", "ПРИВЕЛ", "ПРИ", "ПРИВЕСТИ", "ПРИВЫЧКА", "ЕЩЁ", "ЕЩЕ", "ЕЛКА"]);

  it("suggests up to 3 longer words by frequency", () => {
    expect(ac.suggest("ПРИВ")).toEqual(["ПРИВЕТ", "ПРИВЕЛ", "ПРИВЕСТИ"]);
    expect(ac.suggest("ПРИ", 10)).not.toContain("ПРИ");
    expect(ac.suggest("")).toEqual([]);
    expect(ac.suggest("ЩЩ")).toEqual([]);
  });

  it("treats Ё as Е and does not repeat a word spelled both ways", () => {
    expect(ac.suggest("Е", 5)).toEqual(["ЕЩЁ", "ЕЛКА"]);
    expect(ac.suggest("привет".slice(0, 3))).toContain("ПРИВЕТ");
  });
});

describe("dictionary.ru", () => {
  it("is a few thousand upper-case Cyrillic words, frequent first, with the Тренажёр words", () => {
    expect(DICTIONARY.length).toBeGreaterThanOrEqual(2000);
    expect(DICTIONARY.length).toBeLessThanOrEqual(5000);
    expect(DICTIONARY.every((w) => /^[А-ЯЁ]{2,}$/.test(w))).toBe(true);
    expect(new Set(DICTIONARY).size).toBe(DICTIONARY.length);
    for (const w of WORDS) expect(DICTIONARY).toContain(w);
    expect(DICTIONARY.indexOf("ПРИВЕТ")).toBeLessThan(200);
  });

  it("completes everyday words from a typed prefix", () => {
    const ac = createAutocomplete(DICTIONARY);
    expect(ac.suggest("ПРИВ")[0]).toBe("ПРИВЕТ");
    expect(ac.suggest("ХОР")[0]).toBe("ХОРОШО");
    expect(ac.suggest("С", 3)).toHaveLength(3);
  });
});
