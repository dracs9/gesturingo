import { beforeEach, describe, expect, it, vi } from "vitest";

const tts = vi.hoisted(() => ({ speaking: false, listeners: new Set<(speaking: boolean) => void>() }));
vi.mock("../tts/speech", () => ({
  isSpeaking: () => tts.speaking,
  onSpeakingChange: (listener: (speaking: boolean) => void) => {
    tts.listeners.add(listener);
    return () => tts.listeners.delete(listener);
  },
}));

import {
  collectText,
  createSpeechListener,
  isSpeechRecognitionSupported,
  sttErrorKind,
  type RecognitionLike,
  type ResultListLike,
} from "./stt";

const result = (transcript: string, isFinal: boolean) => ({ isFinal, length: 1, 0: { transcript } });
const list = (...results: ReturnType<typeof result>[]): ResultListLike => Object.assign([...results], { length: results.length });

/** Recognitions created by the listener; the newest is the one in use. */
const created: FakeRecognition[] = [];
let last: FakeRecognition | null = null;

class FakeRecognition implements RecognitionLike {
  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 5;
  onresult: RecognitionLike["onresult"] = null;
  onerror: RecognitionLike["onerror"] = null;
  onend: RecognitionLike["onend"] = null;
  started = false;
  aborted = false;
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.aborted = true;
    this.onerror?.({ error: "aborted" });
    this.onend?.();
  }
}

const setSpeaking = (speaking: boolean) => {
  tts.speaking = speaking;
  for (const l of tts.listeners) l(speaking);
};

/** Records every instance, so the tests can drive the one the listener created. */
class TrackedRecognition extends FakeRecognition {
  constructor() {
    super();
    created.push(this);
    last = created.at(-1) ?? null;
  }
}

function listen() {
  const texts: Array<{ interim: string; final: string }> = [];
  const ends: string[] = [];
  const errors: string[] = [];
  const listener = createSpeechListener({
    ctor: TrackedRecognition,
    onText: (t) => texts.push(t),
    onEnd: (t) => ends.push(t),
    onError: (e) => errors.push(e),
  });
  return { listener, texts, ends, errors };
}

beforeEach(() => {
  created.length = 0;
  last = null;
  tts.speaking = false;
  tts.listeners.clear();
});

describe("speech recognition (talk mode)", () => {
  it("splits final and interim text", () => {
    expect(collectText(list(result("привет", true), result(" как де", false)))).toEqual({
      final: "привет",
      interim: "как де",
    });
    expect(collectText(list(result("да", true), result("конечно", true)))).toEqual({ final: "да конечно", interim: "" });
  });

  it("maps browser errors to messages, ignoring our own abort", () => {
    expect(sttErrorKind("not-allowed")).toBe("denied");
    expect(sttErrorKind("service-not-allowed")).toBe("denied");
    expect(sttErrorKind("audio-capture")).toBe("noMic");
    expect(sttErrorKind("network")).toBe("network");
    expect(sttErrorKind("no-speech")).toBe("silence");
    expect(sttErrorKind("aborted")).toBeNull();
    expect(sttErrorKind("bad-grammar")).toBe("other");
  });

  it("listens once in Russian with interim results, then ends with the final text", () => {
    const { listener, texts, ends } = listen();
    expect(listener.start()).toBe(true);
    expect(last).toMatchObject({ lang: "ru-RU", interimResults: true, continuous: false, started: true });
    expect(listener.listening).toBe(true);

    last?.onresult?.({ results: list(result("добрый", false)) });
    last?.onresult?.({ results: list(result("добрый день", true)) });
    last?.stop();

    expect(texts).toEqual([
      { interim: "добрый", final: "" },
      { interim: "", final: "добрый день" },
    ]);
    expect(ends).toEqual(["добрый день"]);
    expect(listener.listening).toBe(false);
  });

  it("does not start while our own voice speaks", () => {
    setSpeaking(true);
    const { listener } = listen();
    expect(listener.start()).toBe(false);
    expect(last).toBeNull();
  });

  it("drops what it heard when our voice starts (no echo in the feed)", () => {
    const { listener, ends, errors } = listen();
    listener.start();
    last?.onresult?.({ results: list(result("спасибо", true)) });
    setSpeaking(true);
    expect(last?.aborted).toBe(true);
    expect(ends).toEqual([""]);
    expect(errors).toEqual([]);
  });

  it("reports errors", () => {
    const { listener, errors } = listen();
    listener.start();
    last?.onerror?.({ error: "not-allowed" });
    expect(errors).toEqual(["denied"]);
  });

  it("does nothing without the API", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
    const listener = createSpeechListener({ ctor: null, onText: () => {}, onEnd: () => {}, onError: () => {} });
    expect(listener.supported).toBe(false);
    expect(listener.start()).toBe(false);
    expect(() => listener.dispose()).not.toThrow();
  });
});
