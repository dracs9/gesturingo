import { describe, expect, it } from "vitest";
import type { Message } from "./conversationStore";
import { practiceLessonId, practiceLetters, summarizeConversation } from "./summary";

const msg = (side: Message["side"], text: string): Message => ({
  id: 0,
  side,
  text,
  source: side === "signer" ? "dactyl" : "voice",
  timestamp: 0,
  speech: null,
});
const hint = (letter: string) => ({ letter, hintCode: "finger.bend.ring", timestamp: 0 });

describe("talk summary", () => {
  it("counts messages both ways, hints and corrections", () => {
    const s = summarizeConversation(
      {
        messages: [msg("signer", "ДА"), msg("listener", "Привет"), msg("signer", "НЕТ")],
        hintLog: [hint("А"), hint("#ya"), hint("А"), hint("Б")],
        cancels: 1,
        deletes: 3,
      },
      (l) => (l === "#ya" ? "Я" : l),
      (l) => !l.startsWith("#"),
    );
    expect(s).toMatchObject({ signed: 2, heard: 1, hints: 4, cancels: 1, deletes: 3 });
    expect(s.needHelp).toEqual([
      { gesture: "А", hints: 2 },
      { gesture: "Я", hints: 1 },
      { gesture: "Б", hints: 1 },
    ]);
    // Phrases are not taught in lessons: only letters go to practice.
    expect(s.practice).toEqual(["А", "Б"]);
  });

  it("round-trips a practice lesson id", () => {
    expect(practiceLetters(practiceLessonId(["А", "Б"]))).toEqual(["А", "Б"]);
    expect(practiceLetters("1")).toBeNull();
  });
});
