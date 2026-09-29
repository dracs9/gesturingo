import { describe, expect, it } from "vitest";
import { DYNAMIC_LETTERS } from "./dynamicLetters";
import { getLetterSpec } from "./letters";
import { availableWords, pickWord, WORDS } from "./words";

describe("words", () => {
  it("are upper-case Russian letters only", () => {
    for (const w of WORDS) expect(w, w).toMatch(/^[А-ЯЁ]+$/);
  });

  it("use only letters the app teaches", () => {
    for (const w of WORDS) for (const l of w) expect(getLetterSpec(l), `${w}: ${l}`).toBeDefined();
  });

  it("offers only words made of learned letters that have a spec", () => {
    const learned = new Set(["В", "О", "А", "Н"]);
    expect(availableWords(["ВОВА", "АННА", "НОС"], learned, () => true)).toEqual(["ВОВА", "АННА"]);
    expect(availableWords(["ВОВА", "АННА"], learned, (l) => l !== "Н")).toEqual(["ВОВА"]);
    expect(availableWords(WORDS, new Set(), () => true)).toEqual([]);
  });

  it("never offers words with letters that need movement", () => {
    const all = new Set(Array.from("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ"));
    const words = availableWords(WORDS, all, () => true);
    expect(words).not.toContain("ВОДА");
    for (const w of words) for (const l of DYNAMIC_LETTERS) expect(w, w).not.toContain(l);
  });

  it("avoids repeating the previous word", () => {
    expect(pickWord(["А", "Б"], "А", () => 0)).toBe("Б");
    expect(pickWord(["А"], "А", () => 0)).toBe("А");
    expect(pickWord([], null)).toBeNull();
  });
});
