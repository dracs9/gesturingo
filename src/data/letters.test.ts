import { describe, expect, it } from "vitest";
import { fingerHintCode } from "../recognition/letters/hintCodes";
import type { LetterSpec } from "../recognition/letters/spec";
import { DYNAMIC_LETTERS } from "./dynamicLetters";
import { EXCLUDED_LETTERS } from "./excludedLetters";
import { GENERATED_LETTERS, LETTER_BUILD_INFO } from "./letters.generated";
import { getLetterSpec, LETTERS, mergeLetters, unavailableLetters } from "./letters";
import { getReference } from "./references";
import { LESSONS } from "./lessons";
import { strings } from "./strings.ru";

// Guards the data the team edits: a typo in a hintCode would show an empty hint to the jury.
describe("letter data", () => {
  it("has a hint text for every hintCode", () => {
    for (const spec of [...LETTERS, ...GENERATED_LETTERS]) {
      const codes = [
        ...Object.values(spec.fingers).map((f) => f.hintCode),
        ...(spec.extra ?? []).map((e) => e.hintCode),
        ...Object.entries(spec.typical ?? {}).map(([f, state]) => fingerHintCode(f as keyof LetterSpec["fingers"], state)),
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

  it("generates unverified drafts with build info and known similar letters", () => {
    const letters = GENERATED_LETTERS.map((l) => l.letter);
    expect(new Set(letters).size).toBe(letters.length);
    for (const spec of GENERATED_LETTERS) {
      expect(spec.verified, spec.letter).toBe(false);
      expect(LETTER_BUILD_INFO[spec.letter], spec.letter).toBeDefined();
      for (const other of spec.confusedWith ?? []) expect(letters, `${spec.letter} → ${other}`).toContain(other);
    }
  });

  it("teaches only letters the team checked against the official table", () => {
    for (const spec of LETTERS) expect(spec.verified, spec.letter).toBe(true);
  });

  it("teaches no letter with movement or excluded by the team", () => {
    for (const letter of [...DYNAMIC_LETTERS, ...EXCLUDED_LETTERS]) {
      expect(getLetterSpec(letter), letter).toBeUndefined();
      expect(unavailableLetters()).toContain(letter);
    }
  });

  it("has a sample drawing for every taught letter", () => {
    for (const spec of LETTERS) expect(getReference(spec.letter), spec.letter).toBeDefined();
  });

  it("lets team overrides replace generated fields one by one", () => {
    const generated: LetterSpec[] = [
      { letter: "Б", verified: false, fingers: {}, confusedWith: ["К"], reference: "references/Б.json" },
      { letter: "А", verified: false, fingers: { index: { state: "bent", hintCode: "finger.bend.index" } }, reference: "r" },
      { letter: "Й", verified: false, fingers: {}, reference: "r" },
    ];
    const merged = mergeLetters(generated, { Б: { verified: true, confusedWith: [] } });
    expect(merged.map((l) => l.letter)).toEqual(["А", "Б"]);
    expect(merged[1]).toMatchObject({ letter: "Б", verified: true, confusedWith: [], reference: "references/Б.json" });
    expect(merged[0]?.fingers.index?.state).toBe("bent");
  });
});
