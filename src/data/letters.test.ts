import { describe, expect, it } from "vitest";
import { getLetterSpec, LETTERS } from "./letters";
import { LESSONS } from "./lessons";
import { strings } from "./strings.ru";

// Guards the data the team edits: a typo in a hintCode would show an empty hint to the jury.
describe("letter data", () => {
  it("has a hint text for every hintCode", () => {
    for (const spec of LETTERS) {
      const codes = [
        ...Object.values(spec.fingers).map((f) => f.hintCode),
        ...(spec.extra ?? []).map((e) => e.hintCode),
      ];
      for (const code of codes) expect(strings.hints[code], `${spec.letter}: ${code}`).toBeTruthy();
    }
  });

  it("describes every lesson letter", () => {
    for (const lesson of LESSONS) {
      for (const letter of lesson.letters) expect(getLetterSpec(letter), letter).toBeDefined();
    }
  });

  it("has unique letters with at least one condition", () => {
    const letters = LETTERS.map((l) => l.letter);
    expect(new Set(letters).size).toBe(letters.length);
    for (const spec of LETTERS) {
      expect(Object.keys(spec.fingers).length + (spec.extra?.length ?? 0), spec.letter).toBeGreaterThan(0);
    }
  });
});
