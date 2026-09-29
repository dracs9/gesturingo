import { describe, expect, it } from "vitest";
import { hintText } from "./hintText";

describe("hintText", () => {
  it("returns plain hints", () => {
    expect(hintText({ hintCode: "finger.bend.ring" })).toBe("Согни безымянный палец");
    expect(hintText(null)).toBeNull();
    expect(hintText({ hintCode: "no.such.hint" })).toBeNull();
  });

  it("fills the confusion template with the letter and the advice", () => {
    expect(
      hintText({ hintCode: "confusion.looksLike", params: { letter: "О", advice: "tips.touch.thumb-index" } }),
    ).toBe("Похоже на «О» — соедини кончики большого и указательного пальцев");
    expect(hintText({ hintCode: "confusion.looksLike", params: { letter: "О" } })).toBe("Похоже на «О»");
  });

  it("fills the repeated-letter hint of the Bridge", () => {
    expect(hintText({ hintCode: "bridge.release", params: { letter: "Н" } })).toBe("Опусти руку и покажи «Н» ещё раз");
  });
});
