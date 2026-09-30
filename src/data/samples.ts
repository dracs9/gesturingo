import { augmentFrame, seededRandom } from "../recognition/letters/augment";
import { createKnn, type Knn } from "../recognition/letters/knn";
import { pickMedoid, type SampleFile } from "../recognition/samples";

const AUGMENT_SEED = 20260930;

/**
 * kNN samples in data/samples/ (built by `npm run build:letters`, or recorded on /record). Loaded lazily (they can be large),
 * so the first screen stays fast; lessons start with the rules alone until this resolves.
 */
const files = import.meta.glob<SampleFile>("./samples/*.json", { import: "default" });

export interface LetterModels {
  /** null when there are no samples yet — the rules decide alone (CLAUDE.md §8.2). */
  knn: Knn | null;
  /** Most typical recorded frame per letter: ghost-hand fallback when there is no reference file. */
  medoids: ReadonlyMap<string, number[]>;
}

const MEDOID_POOL = 150;

let models: Promise<LetterModels> | null = null;

export function loadLetterModels(): Promise<LetterModels> {
  models ??= Promise.all(Object.values(files).map((load) => load())).then(
    (sampleFiles) => {
      const vectors = sampleFiles.flatMap((f) => f.frames.map((vector) => ({ label: f.letter, vector })));
      // kNN sees every sample mirrored, rotated and noisy too; the medoid stays a real frame.
      const random = seededRandom(AUGMENT_SEED);
      const augmented = vectors.flatMap((v) => augmentFrame(v.vector, random).map((vector) => ({ label: v.label, vector })));
      const byLetter = new Map<string, number[][]>();
      for (const v of vectors) {
        const list = byLetter.get(v.label);
        if (list) list.push(v.vector);
        else byLetter.set(v.label, [v.vector]);
      }
      const medoids = new Map<string, number[]>();
      for (const [letter, frames] of byLetter) {
        // The medoid is O(n²): an evenly spaced subset is plenty to find a typical frame.
        const step = Math.ceil(frames.length / MEDOID_POOL);
        const pool = frames.filter((_, i) => i % step === 0);
        const frame = pool[pickMedoid(pool)];
        if (frame) medoids.set(letter, frame);
      }
      return { knn: augmented.length > 0 ? createKnn(augmented) : null, medoids };
    },
    // Broken sample files must never break a lesson: fall back to rules only.
    () => ({ knn: null, medoids: new Map() }),
  );
  return models;
}

/** Phrase gesture samples (built from Slovo by `npm run build:phrases`), for talk mode only. */
const phraseFiles = import.meta.glob<SampleFile>("./phraseSamples/*.json", { import: "default" });

let talkModels: Promise<Knn | null> | null = null;

/**
 * kNN for talk mode: every letter AND every phrase gesture, with the same augmentation as the letters.
 * Lessons keep `loadLetterModels` — phrases never enter a lesson.
 */
export function loadTalkModels(): Promise<Knn | null> {
  talkModels ??= Promise.all([...Object.values(files), ...Object.values(phraseFiles)].map((load) => load())).then(
    (sampleFiles) => {
      const random = seededRandom(AUGMENT_SEED);
      const augmented = sampleFiles.flatMap((f) =>
        f.frames.flatMap((frame) => augmentFrame(frame, random).map((vector) => ({ label: f.letter, vector }))),
      );
      return augmented.length > 0 ? createKnn(augmented) : null;
    },
    // Broken files: talk falls back to the rules alone, like a lesson.
    () => null,
  );
  return talkModels;
}
