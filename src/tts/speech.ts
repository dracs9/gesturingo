import { useSettings } from "../store/settings";

/**
 * Wrapper over Web Speech `speechSynthesis` for the Bridge (CLAUDE.md §10.5).
 * Without the API or without a Russian voice it reports "unavailable" — the word is then only shown
 * as text; nothing throws.
 */

export type SpeakResult = "spoken" | "unavailable" | "muted";

type VoiceInfo = Pick<SpeechSynthesisVoice, "lang" | "localService">;

/** Best Russian voice: ru-RU first, then any ru-*, preferring on-device voices (work offline, start faster). */
export function pickRussianVoice<V extends VoiceInfo>(voices: readonly V[]): V | null {
  const lang = (v: V) => v.lang.replace("_", "-").toLowerCase();
  const rank = (v: V) => (lang(v) === "ru-ru" ? 0 : 2) + (v.localService ? 0 : 1);
  const russian = voices.filter((v) => lang(v).startsWith("ru"));
  return [...russian].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/** «ВОВА» → «Вова»: engines read all-caps words letter by letter, as abbreviations. */
export function speakableWord(word: string): string {
  const lower = word.toLocaleLowerCase("ru-RU");
  return lower.charAt(0).toLocaleUpperCase("ru-RU") + lower.slice(1);
}

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  } catch {
    return null;
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

export async function speak(text: string): Promise<SpeakResult> {
  if (!useSettings.getState().soundOn) return "muted";
  const s = synth();
  if (!s) return "unavailable";
  try {
    const voice = pickRussianVoice(await loadVoices(s));
    if (!voice) return "unavailable";
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;
    s.cancel();
    return await new Promise<SpeakResult>((resolve) => {
      const finish = () => {
        window.clearTimeout(timer);
        resolve("spoken");
      };
      // Some engines never fire `end`: don't wait forever.
      const timer = window.setTimeout(finish, 6000);
      u.onend = finish;
      u.onerror = finish;
      s.speak(u);
    });
  } catch {
    return "unavailable";
  }
}
