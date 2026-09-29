import type { Handedness } from "./landmarks";

/** kNN training samples recorded on /record (CLAUDE.md §10.8). Each frame = 63 normalized numbers. */
export interface SampleFile {
  letter: string;
  signer: string;
  handedness: Handedness;
  frames: number[][];
}

/** One clean normalized frame used to draw the ghost hand. */
export interface ReferenceFile {
  letter: string;
  signer: string;
  handedness: Handedness;
  frame: number[];
}

export function roundFrame(frame: readonly number[], digits = 4): number[] {
  const k = 10 ** digits;
  return frame.map((v) => Math.round(v * k) / k);
}

export function frameDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Index of the frame with the smallest total distance to all others (the most typical one); -1 if empty. */
export function pickMedoid(frames: readonly (readonly number[])[]): number {
  let best = -1;
  let bestSum = Infinity;
  frames.forEach((a, i) => {
    let sum = 0;
    for (const b of frames) sum += frameDistance(a, b);
    if (sum < bestSum) {
      bestSum = sum;
      best = i;
    }
  });
  return best;
}

/** Most frequent handedness among recorded frames (ties → Right). */
export function majorityHandedness(labels: readonly Handedness[]): Handedness {
  const left = labels.filter((h) => h === "Left").length;
  return left > labels.length - left ? "Left" : "Right";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function sampleFileName(letter: string, signer: string, date = new Date()): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${letter}_${signer || "anon"}_${stamp}.json`;
}

export function referenceFileName(letter: string): string {
  return `${letter}.json`;
}

/** JSON with one frame per line: readable diffs, no number-per-line bloat. */
export function serializeSampleFile(file: SampleFile): string {
  const head = JSON.stringify({ letter: file.letter, signer: file.signer, handedness: file.handedness });
  const frames = file.frames.map((f) => `    ${JSON.stringify(f)}`).join(",\n");
  return `${head.slice(0, -1)},\n  "frames": [\n${frames}\n  ]\n}\n`;
}

export function serializeReferenceFile(file: ReferenceFile): string {
  return `${JSON.stringify(file)}\n`;
}
