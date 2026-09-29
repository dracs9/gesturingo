import { describe, expect, it } from "vitest";
import { ALPHABET } from "./alphabet";
import { getLetterPhoto } from "./letterPhotos";
import { LETTERS } from "./letters";

describe("letter photos", () => {
  it("has a drawing for every letter the app teaches", () => {
    for (const spec of LETTERS) expect(getLetterPhoto(spec.letter), spec.letter).toBeTruthy();
  });

  it("covers the whole chart (all letters but Ё)", () => {
    const missing = ALPHABET.filter((l) => !getLetterPhoto(l));
    expect(missing).toEqual(["Ё"]);
  });
});
