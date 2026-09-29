import { useSettings } from "../store/settings";

/**
 * Short UI sounds synthesized with Web Audio — no audio files, nothing to license or download.
 * Browsers only allow audio after a real user gesture: `unlockAudio()` is called from the
 * «Включить камеру» click; until then (and when sound is off) every call is silently ignored.
 */

export type SoundName = "click" | "success" | "hint" | "fanfare";

let ctx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor: AudioContextCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

/** One note with a soft attack/decay envelope. */
function note(audio: AudioContext, freq: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const SOUNDS: Record<SoundName, (audio: AudioContext) => void> = {
  // Short tick for a hand click / pose command.
  click: (a) => note(a, 880, 0, 0.07, 0.12, "triangle"),
  // Rising major third: letter or step accepted.
  success: (a) => {
    note(a, 660, 0, 0.14, 0.14, "sine");
    note(a, 880, 0.1, 0.22, 0.14, "sine");
  },
  // Soft low tone: a hint appeared (informative, not a buzzer).
  hint: (a) => note(a, 392, 0, 0.18, 0.07, "sine"),
  // Arpeggio: lesson finished.
  fanfare: (a) => {
    [523, 659, 784, 1047].forEach((f, i) => note(a, f, i * 0.11, 0.3, 0.13, "triangle"));
  },
};

export function playSound(name: SoundName): void {
  if (!ctx || ctx.state !== "running" || !useSettings.getState().soundOn) return;
  try {
    SOUNDS[name](ctx);
  } catch {
    // Audio is decoration: never let it break the flow.
  }
}
