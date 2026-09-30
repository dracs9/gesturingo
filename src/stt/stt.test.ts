import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  createAutoListener,
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
  const interims: string[] = [];
  const finals: string[] = [];
  const statuses: string[] = [];
  const listener = createAutoListener({
    ctor: TrackedRecognition,
    onInterim: (t) => interims.push(t),
    onFinal: (t) => finals.push(t),
    onStatus: (st, error) => statuses.push(error ? `${st}:${error}` : st),
  });
  return { listener, interims, finals, statuses };
}

beforeEach(() => {
  created.length = 0;
  last = null;
  tts.speaking = false;
  tts.listeners.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
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

  it("listens continuously in Russian and gives out each finished phrase once", () => {
    const { listener, interims, finals, statuses } = listen();
    listener.start();
    expect(last).toMatchObject({ lang: "ru-RU", interimResults: true, continuous: true, started: true });
    expect(statuses).toEqual(["listening"]);

    last?.onresult?.({ results: list(result("добрый", false)) });
    last?.onresult?.({ results: list(result("добрый день", true)) });
    last?.onresult?.({ results: list(result("добрый день", true), result("как", false)) });
    last?.onresult?.({ results: list(result("добрый день", true), result("как дела", true)) });

    expect(finals).toEqual(["добрый день", "как дела"]);
    expect(interims).toEqual(["добрый", "", "как", ""]);
  });

  it("reopens a session the browser ended", () => {
    const { listener } = listen();
    listener.start();
    last?.onresult?.({ results: list(result("да", true)) });
    last?.stop();
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(created).toHaveLength(2);
    expect(last?.started).toBe(true);
    listener.dispose();
  });

  it("pauses while our own voice speaks and drops what it heard (no echo in the feed)", () => {
    const { listener, finals, statuses } = listen();
    listener.start();
    last?.onresult?.({ results: list(result("спаси", false)) });
    setSpeaking(true);
    expect(last?.aborted).toBe(true);
    expect(statuses).toEqual(["listening", "paused"]);
    vi.advanceTimersByTime(5000);
    expect(created).toHaveLength(1);

    setSpeaking(false);
    vi.advanceTimersByTime(1000);
    expect(created).toHaveLength(2);
    expect(statuses).toEqual(["listening", "paused", "listening"]);
    expect(finals).toEqual([]);
  });

  it("waits for our voice to finish before the first session", () => {
    setSpeaking(true);
    const { listener, statuses } = listen();
    listener.start();
    expect(last).toBeNull();
    expect(statuses).toEqual(["paused"]);
    setSpeaking(false);
    vi.advanceTimersByTime(1000);
    expect(last?.started).toBe(true);
  });

  it("keeps listening through silence", () => {
    const { listener, statuses } = listen();
    listener.start();
    vi.advanceTimersByTime(8000);
    last?.onerror?.({ error: "no-speech" });
    last?.onend?.();
    vi.advanceTimersByTime(1000);
    expect(created).toHaveLength(2);
    expect(statuses).toEqual(["listening"]);
  });

  it("stops on a missing permission until started again", () => {
    const { listener, statuses } = listen();
    listener.start();
    last?.onerror?.({ error: "not-allowed" });
    last?.onend?.();
    vi.advanceTimersByTime(5000);
    expect(created).toHaveLength(1);
    expect(statuses).toEqual(["listening", "error:denied"]);

    listener.start();
    expect(created).toHaveLength(2);
    expect(statuses.at(-1)).toBe("listening");
  });

  it("gives up after sessions keep ending at once (no endless restart loop)", () => {
    const { listener, statuses } = listen();
    listener.start();
    for (let i = 0; i < 10; i++) {
      last?.onend?.();
      vi.advanceTimersByTime(400);
    }
    expect(created.length).toBeLessThanOrEqual(5);
    expect(statuses.at(-1)).toBe("error:other");
  });

  it("does nothing without the API", () => {
    expect(isSpeechRecognitionSupported()).toBe(false);
    const listener = createAutoListener({ ctor: null, onInterim: () => {}, onFinal: () => {}, onStatus: () => {} });
    expect(listener.supported).toBe(false);
    expect(() => listener.start()).not.toThrow();
    expect(() => listener.dispose()).not.toThrow();
  });
});
