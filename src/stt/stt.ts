import { isSpeaking, onSpeakingChange } from "../tts/speech";

/**
 * Speech → subtitles for the hearing person (docs/TRANSLATOR_SPEC.md §6): Web Speech `SpeechRecognition`,
 * push-to-talk. No server of ours — the browser recognizes speech (Chrome may use its own service).
 * While our TTS speaks, recognition is off, so the app never subtitles its own voice.
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

export interface SpeechListenerOptions {
  lang?: string;
  /** Every result: interim (still changing) and final text so far. */
  onText(text: { interim: string; final: string }): void;
  /** Recognition ended; the final text ("" if nothing was heard or it was dropped because of our TTS). */
  onEnd(finalText: string): void;
  onError(kind: SttErrorKind): void;
  ctor?: RecognitionCtor | null;
}

export interface SpeechListener {
  readonly supported: boolean;
  readonly listening: boolean;
  /** Starts one push-to-talk session; false if unsupported, already listening or our TTS is speaking. */
  start(): boolean;
  /** Stops listening; the text heard so far still arrives through `onEnd`. */
  stop(): void;
  dispose(): void;
}

export function createSpeechListener({
  lang = "ru-RU",
  onText,
  onEnd,
  onError,
  ctor = getRecognitionCtor(),
}: SpeechListenerOptions): SpeechListener {
  let rec: RecognitionLike | null = null;
  let final = "";
  let dropped = false;

  // Echo guard: our own phrase starts → drop whatever is being recognized.
  const unsubscribe = onSpeakingChange((speaking) => {
    if (speaking && rec) {
      dropped = true;
      rec.abort();
    }
  });

  return {
    get supported() {
      return ctor !== null;
    },
    get listening() {
      return rec !== null;
    },
    start() {
      if (!ctor || rec || isSpeaking()) return false;
      let r: RecognitionLike;
      try {
        r = new ctor();
      } catch {
        onError("other");
        return false;
      }
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      final = "";
      dropped = false;
      r.onresult = (event) => {
        if (dropped) return;
        const text = collectText(event.results);
        final = text.final;
        onText(text);
      };
      r.onerror = (event) => {
        const kind = sttErrorKind(event.error);
        if (kind && !dropped) onError(kind);
      };
      r.onend = () => {
        if (rec !== r) return;
        rec = null;
        onEnd(dropped ? "" : final.trim());
      };
      rec = r;
      try {
        r.start();
      } catch {
        rec = null;
        onError("other");
        return false;
      }
      return true;
    },
    stop() {
      try {
        rec?.stop();
      } catch {
        // Already stopped.
      }
    },
    dispose() {
      unsubscribe();
      const r = rec;
      rec = null;
      if (r) {
        dropped = true;
        try {
          r.abort();
        } catch {
          // Already stopped.
        }
      }
    },
  };
}
