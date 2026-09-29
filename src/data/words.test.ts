import { describe, expect, it } from "vitest";
import { availableWords, pickWord, WORDS } from "./words";

describe("words", () => {
  it("are upper-case Russian letters only", () => {
    for (const w of WORDS) expect(w, w).toMatch(/^[А-ЯЁ]+$/);
  });

  it("offers only words made of learned letters that have a spec", () => {
    const learned = new Set(["В", "О", "А", "Д"]);
    expect(availableWords(["ВОВА", "ВОДА", "ДОМ"], learned, () => true)).toEqual(["ВОВА", "ВОДА"]);
    expect(availableWords(["ВОВА", "ВОДА"], learned, (l) => l !== "Д")).toEqual(["ВОВА"]);
    expect(availableWords(WORDS, new Set(), () => true)).toEqual([]);
  });

  it("avoids repeating the previous word", () => {
    expect(pickWord(["А", "Б"], "А", () => 0)).toBe("Б");
    expect(pickWord(["А"], "А", () => 0)).toBe("А");
    expect(pickWord([], null)).toBeNull();
  });
});
