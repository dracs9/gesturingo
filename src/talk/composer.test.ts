import { describe, expect, it } from "vitest";
import { createComposer, createConfirmation, speakableText } from "./composer";

describe("composer", () => {
  it("types letters into words and deletes them", () => {
    const c = createComposer();
    for (const l of "МАМА") c.addLetter(l);
    c.space();
    c.addLetter("Д");
    expect(c.text()).toBe("МАМА Д");
    c.deleteLast();
    expect(c.text()).toBe("МАМА");
    // Right after a word end, delete removes the space: back into the last word.
    c.deleteLast();
    expect(c.current).toBe("МАМА");
    expect(c.words).toEqual([]);
    c.deleteLast();
    expect(c.text()).toBe("МАМ");
  });

  it("ends the word after a 1.2 s pause and the phrase after 2 s, once", () => {
    const c = createComposer();
    c.tick(0, true);
    c.addLetter("Д");
    c.addLetter("А");
    expect(c.tick(1000, false)).toEqual({ changed: false, phraseReady: false });
    expect(c.tick(1300, false)).toEqual({ changed: true, phraseReady: false });
    expect(c.words).toEqual(["ДА"]);
    expect(c.tick(2100, false).phraseReady).toBe(true);
    expect(c.tick(2500, false).phraseReady).toBe(false);
  });

  it("does nothing on a pause with an empty draft", () => {
    const c = createComposer();
    c.tick(0, true);
    expect(c.tick(5000, false)).toEqual({ changed: false, phraseReady: false });
  });

  it("hands the draft over and takes it back", () => {
    const c = createComposer();
    for (const l of "ДА") c.addLetter(l);
    expect(c.take()).toEqual(["ДА"]);
    expect(c.isEmpty()).toBe(true);
    c.restore(["ДА"]);
    expect(c.text()).toBe("ДА");
  });

  it("makes a phrase engines read as words", () => {
    expect(speakableText(["ПРИВЕТ", "МАМА"])).toBe("Привет мама");
  });
});

describe("confirmation", () => {
  it("confirms a candidate after the ring is full", () => {
    const c = createConfirmation(1500);
    c.propose(["ДА"], 0);
    expect(c.update(750)).toMatchObject({ progress: 0.5, confirmed: null });
    const done = c.update(1500);
    expect(done.confirmed?.speakable).toBe("Да");
    expect(c.candidate).toBeNull();
  });

  it("cancels: nothing is confirmed", () => {
    const c = createConfirmation(1500);
    c.propose(["НЕТ"], 0);
    expect(c.cancel()?.words).toEqual(["НЕТ"]);
    expect(c.update(2000).confirmed).toBeNull();
  });
});
