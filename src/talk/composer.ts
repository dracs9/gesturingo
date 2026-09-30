import { TALK_CONFIRM_MS, TALK_PHRASE_END_MS, TALK_SPACE_PAUSE_MS } from "../recognition/thresholds";

/**
 * Typing a message letter by letter (docs/TRANSLATOR_SPEC.md §4.1): letters → words → phrase.
 * A pause without a hand ends the word; a longer pause ends the phrase. Pure logic, no React.
 */
export interface ComposerTick {
  /** The draft changed on this tick (a word was ended by the pause). */
  changed: boolean;
  /** The pause was long enough to end the phrase (fires once per pause). */
  phraseReady: boolean;
}

export interface Composer {
  addLetter(letter: string): void;
  /** Removes the last letter; right after a word end — the space, i.e. back into the last word. */
  deleteLast(): void;
  /** Ends the current word. */
  space(): void;
  tick(timestamp: number, handVisible: boolean): ComposerTick;
  /** Finished words. */
  readonly words: readonly string[];
  /** Word being typed. */
  readonly current: string;
  text(): string;
  isEmpty(): boolean;
  /** Takes the whole draft out (e.g. into the candidate) and empties the composer. */
  take(): string[];
  /** Puts words back (a cancelled candidate returns to editing). */
  restore(words: readonly string[]): void;
}

/** «ПРИВЕТ МАМА» → «Привет мама»: engines read all-caps words letter by letter. */
export function speakableText(words: readonly string[]): string {
  const lower = words.join(" ").toLocaleLowerCase("ru-RU");
  return lower.charAt(0).toLocaleUpperCase("ru-RU") + lower.slice(1);
}

export function createComposer(): Composer {
  let words: string[] = [];
  let current = "";
  let lastHandAt: number | null = null;
  let phraseFired = false;

  const endWord = () => {
    if (current === "") return false;
    words = [...words, current];
    current = "";
    return true;
  };

  return {
    addLetter(letter) {
      current += letter;
    },
    deleteLast() {
      if (current === "") {
        current = words.at(-1) ?? "";
        words = words.slice(0, -1);
        return;
      }
      current = Array.from(current).slice(0, -1).join("");
    },
    space() {
      endWord();
    },
    tick(t, handVisible) {
      if (handVisible || lastHandAt === null) {
        lastHandAt = t;
        phraseFired = false;
        return { changed: false, phraseReady: false };
      }
      const idle = t - lastHandAt;
      const changed = idle >= TALK_SPACE_PAUSE_MS && endWord();
      const phraseReady = !phraseFired && idle >= TALK_PHRASE_END_MS && words.length > 0;
      if (phraseReady) phraseFired = true;
      return { changed, phraseReady };
    },
    get words() {
      return words;
    },
    get current() {
      return current;
    },
    text() {
      return [...words, current].filter(Boolean).join(" ");
    },
    isEmpty() {
      return words.length === 0 && current === "";
    },
    take() {
      endWord();
      const out = words;
      words = [];
      return out;
    },
    restore(back) {
      words = [...back];
      current = "";
    },
  };
}

/** A phrase waiting to be spoken: the confirmation ring runs, an open palm cancels (§4.3). */
export interface Candidate {
  words: string[];
  text: string;
  speakable: string;
  since: number;
}

export interface Confirmation {
  propose(words: readonly string[], timestamp: number): Candidate;
  /** Progress of the ring; `confirmed` is the candidate on the frame its time is up. */
  update(timestamp: number): { candidate: Candidate | null; progress: number; confirmed: Candidate | null };
  /** Drops the candidate (nothing is spoken) and returns it. */
  cancel(): Candidate | null;
  readonly candidate: Candidate | null;
}

export function createConfirmation(confirmMs = TALK_CONFIRM_MS): Confirmation {
  let candidate: Candidate | null = null;
  return {
    propose(words, t) {
      candidate = { words: [...words], text: words.join(" "), speakable: speakableText(words), since: t };
      return candidate;
    },
    update(t) {
      if (!candidate) return { candidate: null, progress: 0, confirmed: null };
      const progress = Math.min(1, Math.max(0, (t - candidate.since) / confirmMs));
      if (progress < 1) return { candidate, progress, confirmed: null };
      const confirmed = candidate;
      candidate = null;
      return { candidate: null, progress: 1, confirmed };
    },
    cancel() {
      const dropped = candidate;
      candidate = null;
      return dropped;
    },
    get candidate() {
      return candidate;
    },
  };
}
