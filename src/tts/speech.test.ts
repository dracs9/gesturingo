import { afterEach, describe, expect, it, vi } from "vitest";
import { isSpeaking, pickRussianVoice, speak, speakableWord, splitSentences } from "./speech";

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

  it("prefers Microsoft Pavel by default, but not over the voice chosen before", () => {
    const voices = [
      { lang: "ru-RU", localService: true, voiceURI: "irina", name: "Microsoft Irina - Russian (Russia)" },
      { lang: "ru-RU", localService: false, voiceURI: "pavel-online", name: "Microsoft Pavel Online (Natural) - Russian (Russia)" },
      { lang: "ru-RU", localService: true, voiceURI: "pavel", name: "Microsoft Pavel - Russian (Russia)" },
    ];
    expect(pickRussianVoice(voices)?.voiceURI).toBe("pavel");
    expect(pickRussianVoice(voices.slice(0, 2))?.voiceURI).toBe("pavel-online");
    expect(pickRussianVoice(voices, "irina")?.voiceURI).toBe("irina");
  });

  it("turns a word into something engines read as a word", () => {
    expect(speakableWord("ВОВА")).toBe("Вова");
    expect(speakableWord("ёж")).toBe("Ёж");
  });

  it("reports unavailable without the Speech API instead of throwing", async () => {
    await expect(speak("Вова")).resolves.toBe("unavailable");
  });

  it("keeps the voice chosen before if it is still there", () => {
    const voices = [
      { lang: "ru-RU", localService: true, voiceURI: "a" },
      { lang: "ru-RU", localService: false, voiceURI: "b" },
    ];
    expect(pickRussianVoice(voices, "b")?.voiceURI).toBe("b");
    expect(pickRussianVoice(voices, "gone")?.voiceURI).toBe("a");
  });

  it("splits long text into sentences and short chunks", () => {
    expect(splitSentences("Привет. Как дела? Хорошо!")).toEqual(["Привет.", "Как дела?", "Хорошо!"]);
    const long = Array.from({ length: 40 }, () => "слово").join(" ");
    const chunks = splitSentences(long, 50);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
    expect(splitSentences("  ")).toEqual([]);
  });
});

describe("speech queue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("speaks phrases one after another, never cutting the current one", async () => {
    const spoken: string[] = [];
    const log: string[] = [];
    class Utterance {
      text: string;
      voice: unknown = null;
      lang = "";
      rate = 1;
      volume = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const synth = {
      getVoices: () => [{ lang: "ru-RU", localService: true, voiceURI: "ru" }],
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      cancel: () => log.push("cancel"),
      speak: (u: Utterance) => {
        log.push(`start ${u.text}`);
        setTimeout(() => {
          spoken.push(u.text);
          log.push(`end ${u.text}`);
          u.onend?.();
        }, 5);
      },
    };
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("window", { speechSynthesis: synth, setTimeout, clearTimeout, localStorage: undefined });

    const speaking: boolean[] = [];
    const first = speak("Привет");
    const second = speak("Как дела");
    await Promise.resolve();
    speaking.push(isSpeaking());
    await expect(first).resolves.toBe("spoken");
    await expect(second).resolves.toBe("spoken");
    expect(spoken).toEqual(["Привет", "Как дела"]);
    // The second phrase starts only after the first one ended.
    expect(log.indexOf("start Как дела")).toBeGreaterThan(log.indexOf("end Привет"));
    expect(isSpeaking()).toBe(false);
  });
});
