import { useSettings } from "../store/settings";

/**
 * Wrapper over Web Speech `speechSynthesis` for the Bridge (CLAUDE.md §10.5) and talk mode
 * (docs/TRANSLATOR_SPEC.md §4.4). Without the API or without a Russian voice it reports "unavailable" —
 * the text is then only shown; nothing throws. Phrases are queued: a new one never cuts off the current one.
 */

export type SpeakResult = "spoken" | "unavailable" | "muted";

type VoiceInfo = Pick<SpeechSynthesisVoice, "lang" | "localService"> & { voiceURI?: string };

/**
 * Best Russian voice: the one chosen before (if still there), then ru-RU before any ru-*,
 * preferring on-device voices (work offline, start faster).
 */
export function pickRussianVoice<V extends VoiceInfo>(voices: readonly V[], preferredUri?: string | null): V | null {
  const lang = (v: V) => v.lang.replace("_", "-").toLowerCase();
  const rank = (v: V) => (lang(v) === "ru-ru" ? 0 : 2) + (v.localService ? 0 : 1);
  const russian = voices.filter((v) => lang(v).startsWith("ru"));
  const preferred = preferredUri ? russian.find((v) => v.voiceURI === preferredUri) : undefined;
  return preferred ?? [...russian].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** «ВОВА» → «Вова»: engines read all-caps words letter by letter, as abbreviations. */
export function speakableWord(word: string): string {
  const lower = word.toLocaleLowerCase("ru-RU");
  return lower.charAt(0).toLocaleUpperCase("ru-RU") + lower.slice(1);
}

/** Chrome cuts long utterances off: speak sentence by sentence, long ones split at a comma or space. */
export function splitSentences(text: string, maxLength = 180): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
    let rest = sentence.trim();
    while (rest.length > maxLength) {
      const cut = Math.max(rest.lastIndexOf(",", maxLength), rest.lastIndexOf(" ", maxLength));
      const at = cut > 0 ? cut + 1 : maxLength;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

const VOICE_KEY = "gesturingo.voice";

function rememberedVoice(): string | null {
  try {
    return window.localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

function rememberVoice(uri: string | undefined): void {
  if (!uri) return;
  try {
    window.localStorage.setItem(VOICE_KEY, uri);
  } catch {
    // Not critical.
  }
}

/** Voices load asynchronously in Chrome: wait for `voiceschanged`, but never for long. */
function loadVoices(s: SpeechSynthesis, timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const now = s.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      s.removeEventListener("voiceschanged", done);
      window.clearTimeout(timer);
      resolve(s.getVoices());
    };
    const timer = window.setTimeout(done, timeoutMs);
    s.addEventListener("voiceschanged", done);
  });
}

/** Load the voices ahead of time, so the first phrase starts without waiting for them. */
export function warmVoices(): void {
  const s = synth();
  if (s) void loadVoices(s).catch(() => undefined);
}

/**
 * iOS Safari only lets speech start from a real user gesture. Called from the «Включить камеру» click:
 * an empty utterance unlocks later calls made from hand gestures.
 */
export function primeSpeech(): void {
  const s = synth();
  if (!s) return;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    s.speak(u);
  } catch {
    // Speech is optional.
  }
}

// --- "speaking" state: the bubble animation now, pausing speech recognition later (§6, echo) ---
let speaking = false;
const speakingListeners = new Set<(speaking: boolean) => void>();

function setSpeaking(next: boolean): void {
  if (next === speaking) return;
  speaking = next;
  for (const listener of speakingListeners) {
    try {
      listener(next);
    } catch {
      // One broken listener must not stop the others.
    }
  }
}

export function isSpeaking(): boolean {
  return speaking;
}

export function onSpeakingChange(listener: (speaking: boolean) => void): () => void {
  speakingListeners.add(listener);
  return () => speakingListeners.delete(listener);
}

function sayChunk(s: SpeechSynthesis, text: string, voice: SpeechSynthesisVoice): Promise<void> {
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  return new Promise<void>((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      resolve();
    };
    // Some engines never fire `end`: don't wait forever.
    const timer = window.setTimeout(finish, Math.max(6000, text.length * 150));
    u.onend = finish;
    u.onerror = finish;
    s.speak(u);
  });
}

async function speakNow(text: string): Promise<SpeakResult> {
  if (!useSettings.getState().soundOn) return "muted";
  const s = synth();
  if (!s) return "unavailable";
  try {
    const voice = pickRussianVoice(await loadVoices(s), rememberedVoice());
    if (!voice) return "unavailable";
    rememberVoice(voice.voiceURI);
    // Only our own queue speaks: clear anything stuck (e.g. the silent iOS unlock utterance).
    s.cancel();
    setSpeaking(true);
    try {
      for (const chunk of splitSentences(text)) await sayChunk(s, chunk, voice);
    } finally {
      setSpeaking(false);
    }
    return "spoken";
  } catch {
    return "unavailable";
  }
}

let queue: Promise<unknown> = Promise.resolve();

/** Speaks after everything queued before it; resolves when done (or right away if it cannot speak). */
export function speak(text: string): Promise<SpeakResult> {
  const job = queue.then(() => speakNow(text));
  queue = job.catch(() => undefined);
  return job;
}
