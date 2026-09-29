import { describe, expect, it } from "vitest";
import { pickRussianVoice, speak, speakableWord } from "./speech";

const voice = (lang: string, localService = true, name = lang) => ({ lang, localService, name });

describe("speech", () => {
  it("picks a Russian voice, ru-RU and on-device first", () => {
    expect(pickRussianVoice([voice("en-US"), voice("ru-RU", false, "net"), voice("ru-RU", true, "local")])?.name).toBe(
      "local",
    );
    expect(pickRussianVoice([voice("en-US"), voice("ru_UA")])?.lang).toBe("ru_UA");
    expect(pickRussianVoice([voice("en-US"), voice("kk-KZ")])).toBeNull();
    expect(pickRussianVoice([])).toBeNull();
  });

  it("turns a word into something engines read as a word", () => {
    expect(speakableWord("ВОВА")).toBe("Вова");
    expect(speakableWord("ёж")).toBe("Ёж");
  });

  it("reports unavailable without the Speech API instead of throwing", async () => {
    await expect(speak("Вова")).resolves.toBe("unavailable");
  });
});
