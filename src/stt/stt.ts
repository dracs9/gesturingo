import {
  STT_FAILURE_LIMIT,
  STT_FAILURE_WINDOW_MS,
  STT_QUICK_END_MS,
  STT_RESTART_MS,
  STT_RESUME_MS,
} from "../recognition/thresholds";
import { isSpeaking, onSpeakingChange } from "../tts/speech";

/**
 * Speech → subtitles for the hearing person (docs/TRANSLATOR_SPEC.md §6): Web Speech `SpeechRecognition`
 * that listens by itself while the talk screen is open. No server of ours — the browser recognizes speech
 * (Chrome may use its own service). While our TTS speaks, recognition is off, so the app never subtitles
 * its own voice.
 */

// lib.dom has the event types but not the recognition class: the minimal shape we use.
interface AlternativeLike {
  readonly transcript: string;
}
interface ResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: AlternativeLike | undefined;
}
export interface ResultListLike {
  readonly length: number;
  readonly [index: number]: ResultLike | undefined;
}

export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ResultListLike }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type RecognitionCtor = new () => RecognitionLike;

export type SttErrorKind = "denied" | "noMic" | "network" | "silence" | "other";

export function getRecognitionCtor(): RecognitionCtor | null {
  try {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  } catch {
    return null;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Final and interim text of one recognition session (grey interim, solid final in the UI). */
export function collectText(results: ResultListLike): { interim: string; final: string } {
  const final: string[] = [];
  const interim: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const text = r?.[0]?.transcript.trim();
    if (!r || !text) continue;
    (r.isFinal ? final : interim).push(text);
  }
  return { interim: interim.join(" "), final: final.join(" ") };
}

/** Browser error codes → what we tell the user. `aborted` is our own stop, not an error. */
export function sttErrorKind(code: string): SttErrorKind | null {
  switch (code) {
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "denied";
    case "audio-capture":
      return "noMic";
    case "network":
      return "network";
    case "no-speech":
      return "silence";
    default:
      return "other";
  }
}

export type ListenStatus = "listening" | "paused" | "error" | "off";

export interface AutoListenerOptions {
  lang?: string;
  /** Words still being spoken ("" when there are none). */
  onInterim(text: string): void;
  /** One finished phrase, once. */
  onFinal(text: string): void;
  /** `paused` — our TTS speaks; `error` comes with its kind and stops listening until `start()`. */
  onStatus(status: ListenStatus, error: SttErrorKind | null): void;
  ctor?: RecognitionCtor | null;
}

export interface AutoListener {
  readonly supported: boolean;
  /** Starts (or, after an error, restarts) listening; later sessions open by themselves. */
  start(): void;
  stop(): void;
  dispose(): void;
}

/**
 * Continuous listening without a button: phrases come out one by one as the browser finalizes them,
 * a session the browser ends is reopened, and our own voice pauses it. Errors that need the user
 * (no permission, no microphone, no network) or repeated failures stop it with an `error` status.
 */
export function createAutoListener({
  lang = "ru-RU",
  onInterim,
  onFinal,
  onStatus,
  ctor = getRecognitionCtor(),
}: AutoListenerOptions): AutoListener {
  let rec: RecognitionLike | null = null;
  let wanted = false;
  let status: ListenStatus = "off";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures: number[] = [];

  const setStatus = (next: ListenStatus, error: SttErrorKind | null = null) => {
    if (next === status && error === null) return;
    status = next;
    onStatus(next, error);
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  /** Drops the current session; its late events are ignored (`rec !== r`). */
  const close = () => {
    const r = rec;
    rec = null;
    if (!r) return;
    try {
      r.abort();
    } catch {
      // Already stopped.
    }
  };

  const fail = (kind: SttErrorKind) => {
    wanted = false;
    clearTimer();
    close();
    onInterim("");
    setStatus("error", kind);
  };

  /** True when there were too many failures lately: the caller then stops. */
  const countFailure = (now: number) => {
    failures = failures.filter((t) => now - t < STT_FAILURE_WINDOW_MS);
    failures.push(now);
    return failures.length >= STT_FAILURE_LIMIT;
  };

  const schedule = (ms: number) => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      open();
    }, ms);
  };

  const open = () => {
    if (!ctor || !wanted || rec) return;
    if (isSpeaking()) {
      setStatus("paused");
      return;
    }
    let r: RecognitionLike;
    try {
      r = new ctor();
    } catch {
      fail("other");
      return;
    }
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    const startedAt = Date.now();
    let emitted = 0;
    let heard = false;
    r.onresult = (event) => {
      if (rec !== r) return;
      heard = true;
      const interim: string[] = [];
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res?.[0]?.transcript.trim() ?? "";
        if (!res) continue;
        if (!res.isFinal) {
          if (text) interim.push(text);
        } else if (i >= emitted) {
          emitted = i + 1;
          if (text) onFinal(text);
        }
      }
      onInterim(interim.join(" "));
    };
    r.onerror = (event) => {
      if (rec !== r) return;
      const kind = sttErrorKind(event.error);
      // Silence and our own abort: the session simply ends and is reopened.
      if (kind === null || kind === "silence") return;
      if (kind === "other" && !countFailure(Date.now())) return;
      fail(kind);
    };
    r.onend = () => {
      if (rec !== r) return;
      rec = null;
      onInterim("");
      const now = Date.now();
      if (!heard && now - startedAt < STT_QUICK_END_MS && countFailure(now)) {
        fail("other");
        return;
      }
      if (wanted) schedule(STT_RESTART_MS);
    };
    rec = r;
    try {
      r.start();
    } catch {
      rec = null;
      fail("other");
      return;
    }
    setStatus("listening");
  };

  // Echo guard: our own phrase starts → drop what is being recognized; it ends → listen again.
  const unsubscribe = onSpeakingChange((speaking) => {
    if (!wanted) return;
    if (speaking) {
      clearTimer();
      close();
      onInterim("");
      setStatus("paused");
    } else {
      schedule(STT_RESUME_MS);
    }
  });

  return {
    get supported() {
      return ctor !== null;
    },
    start() {
      if (!ctor) return;
      wanted = true;
      failures = [];
      clearTimer();
      open();
    },
    stop() {
      wanted = false;
      clearTimer();
      close();
      setStatus("off");
    },
    dispose() {
      unsubscribe();
      wanted = false;
      clearTimer();
      close();
    },
  };
}
