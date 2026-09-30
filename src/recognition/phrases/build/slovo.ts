import { flattenPoints, normalizeHand } from "../../normalize";
import { frameDistance, pickMedoid } from "../../samples";

/**
 * Offline helpers for the Slovo dataset (ai-forever / hukenovs/slovo, docs/TRANSLATOR_SPEC.md §9).
 * We never download the videos: `annotations.csv` is read out of slovo.zip through its central
 * directory, and only the needed videos' landmarks are cut out of slovo_mediapipe.json (1.26 GB)
 * with HTTP range requests. Pure functions — the network lives in scripts/fetch-slovo.ts.
 */

// --- annotations.csv ---

export interface SlovoAnnotation {
  /** Video id = key in slovo_mediapipe.json. */
  id: string;
  /** Gesture class in Russian, e.g. «привет!». */
  text: string;
  signer: string;
  width: number;
  height: number;
  /** Frames in the trimmed video. */
  length: number;
  train: boolean;
  /** Row number: the landmarks file keeps the same order. */
  row: number;
}

/** Tab-separated: attachment_id, text, user_id, height, width, length, train. */
export function parseAnnotations(tsv: string): SlovoAnnotation[] {
  const [head = "", ...lines] = tsv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const cols = head.split("\t");
  const at = (name: string) => cols.indexOf(name);
  const [id, text, signer, height, width, length, train] = [
    "attachment_id",
    "text",
    "user_id",
    "height",
    "width",
    "length",
    "train",
  ].map(at);
  return lines.map((line, row) => {
    const c = line.split("\t");
    const get = (i: number | undefined) => (i === undefined || i < 0 ? "" : (c[i] ?? ""));
    return {
      id: get(id),
      text: get(text).trim(),
      signer: get(signer),
      width: Number(get(width)),
      height: Number(get(height)),
      length: Number(get(length)),
      train: get(train) === "True",
      row,
    };
  });
}

// --- ZIP (ZIP64) central directory ---

export interface ZipEntry {
  name: string;
  /** Offset of the local file header. */
  offset: number;
  compressedSize: number;
  uncompressedSize: number;
  /** 0 = stored, 8 = deflate. */
  method: number;
}

const u16 = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, i: number) => (u16(b, i) + u16(b, i + 2) * 0x10000) >>> 0;
const u64 = (b: Uint8Array, i: number) => u32(b, i) + u32(b, i + 4) * 0x1_0000_0000;

function lastIndexOfSignature(b: Uint8Array, sig: number): number {
  for (let i = b.length - 4; i >= 0; i--) if (u32(b, i) === sig) return i;
  return -1;
}

export type EndOfDirectory = { cdSize: number; cdOffset: number } | { zip64RecordOffset: number };

/** Reads the end of the archive: the directory location, or where the ZIP64 record is (archives > 4 GB). */
export function parseEndOfDirectory(tail: Uint8Array): EndOfDirectory {
  const locator = lastIndexOfSignature(tail, 0x07064b50);
  if (locator >= 0) return { zip64RecordOffset: u64(tail, locator + 8) };
  const eocd = lastIndexOfSignature(tail, 0x06054b50);
  if (eocd < 0) throw new Error("not a zip archive: no end of central directory");
  return { cdSize: u32(tail, eocd + 12), cdOffset: u32(tail, eocd + 16) };
}

export function parseZip64Record(bytes: Uint8Array): { cdSize: number; cdOffset: number } {
  if (u32(bytes, 0) !== 0x06064b50) throw new Error("bad ZIP64 end of central directory record");
  return { cdSize: u64(bytes, 40), cdOffset: u64(bytes, 48) };
}

export function parseCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  let p = 0;
  while (p + 46 <= bytes.length && u32(bytes, p) === 0x02014b50) {
    const method = u16(bytes, p + 10);
    let compressedSize = u32(bytes, p + 20);
    let uncompressedSize = u32(bytes, p + 24);
    const nameLength = u16(bytes, p + 28);
    const extraLength = u16(bytes, p + 30);
    const commentLength = u16(bytes, p + 32);
    let offset = u32(bytes, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    // ZIP64 extra field: 64-bit values replace the 0xFFFFFFFF placeholders, in this order.
    let q = p + 46 + nameLength;
    const extraEnd = q + extraLength;
    while (q + 4 <= extraEnd) {
      const id = u16(bytes, q);
      const size = u16(bytes, q + 2);
      if (id === 0x0001) {
        let v = q + 4;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = u64(bytes, v);
          v += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(bytes, v);
          v += 8;
        }
        if (offset === 0xffffffff) offset = u64(bytes, v);
      }
      q += 4 + size;
    }
    entries.push({ name, offset, compressedSize, uncompressedSize, method });
    p = extraEnd + commentLength;
  }
  return entries;
}

/** Where the file data starts, given the first 30 bytes of its local header. */
export function localDataStart(entry: ZipEntry, localHeader: Uint8Array): number {
  if (u32(localHeader, 0) !== 0x04034b50) throw new Error(`bad local header for ${entry.name}`);
  return entry.offset + 30 + u16(localHeader, 26) + u16(localHeader, 28);
}

// --- slovo_mediapipe.json: { "<video id>": [ { "hand 1": [21 × {x,y,z}], "hand 2"?: [...] }, ... ], ... } ---

export interface KeyPosition {
  id: string;
  /** Offset (in the searched text) of the `[` that opens this video's frames. */
  arrayStart: number;
}

const KEY_RE = /"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})":\s*\[/g;

/** Every video key in a chunk of the landmarks file. */
export function findKeys(text: string): KeyPosition[] {
  const out: KeyPosition[] = [];
  for (const m of text.matchAll(KEY_RE)) out.push({ id: m[1] ?? "", arrayStart: m.index + m[0].length - 1 });
  return out;
}

/** Index of the `]` closing the array that opens at `start`, or null if the chunk ends before it. */
export function matchArray(text: string, start: number): number | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return null;
}

/**
 * Interpolation estimate of a row's byte offset from known (row, byte) anchors: the file is in
 * annotation order, and videos have similar sizes.
 */
export function estimateOffset(
  row: number,
  anchors: ReadonlyArray<{ row: number; offset: number }>,
  totalRows: number,
  fileSize: number,
): number {
  const sorted = [...anchors].sort((a, b) => a.row - b.row);
  let lo = { row: 0, offset: 0 };
  let hi = { row: totalRows, offset: fileSize };
  for (const a of sorted) {
    if (a.row <= row && a.row >= lo.row) lo = a;
    if (a.row > row && a.row <= hi.row) hi = a;
  }
  if (hi.row === lo.row) return lo.offset;
  const est = lo.offset + ((row - lo.row) / (hi.row - lo.row)) * (hi.offset - lo.offset);
  return Math.max(0, Math.min(fileSize - 1, Math.round(est)));
}

// --- one video: which hand signs, how much it moves ---

export interface SlovoPoint {
  x: number;
  y: number;
  z: number;
}

/** One frame: "hand 1", "hand 2" (rarely "hand 3"), no Left/Right label. Frames without hands are absent. */
export type SlovoFrame = Readonly<Record<string, readonly SlovoPoint[]>>;

export interface SlovoVideo extends Omit<SlovoAnnotation, "row"> {
  frames: SlovoFrame[];
}

const WRIST = 0;
const MIDDLE_MCP = 9;

export function handsOf(frame: SlovoFrame): (readonly SlovoPoint[])[] {
  return Object.values(frame).filter((h) => Array.isArray(h) && h.length === 21);
}

/**
 * The signing hand in every frame. It starts as the raised hand (highest middle-finger base) and is
 * then tracked by the nearest wrist, so a resting second hand is never picked up mid-gesture.
 */
export function pickActiveHand(
  frames: readonly SlovoFrame[],
  width: number,
  height: number,
): { active: (readonly SlovoPoint[])[]; others: (readonly SlovoPoint[])[][] } {
  const active: (readonly SlovoPoint[])[] = [];
  const others: (readonly SlovoPoint[])[][] = [];
  let prev: SlovoPoint | null = null;
  const px = (p: SlovoPoint) => ({ x: p.x * width, y: p.y * height });
  for (const frame of frames) {
    const hands = handsOf(frame);
    if (hands.length === 0) continue;
    let best = hands[0] ?? [];
    for (const h of hands) {
      if (prev) {
        const a = px(h[WRIST] ?? prev);
        const b = px(best[WRIST] ?? prev);
        const p = px(prev);
        if (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y)) best = h;
      } else if ((h[MIDDLE_MCP]?.y ?? 1) < (best[MIDDLE_MCP]?.y ?? 1)) {
        best = h;
      }
    }
    prev = best[WRIST] ?? prev;
    active.push(best);
    others.push(hands.filter((h) => h !== best));
  }
  return { active, others };
}

/** Palm size in pixels: |wrist → middle MCP|. */
export function palmPx(hand: readonly SlovoPoint[], width: number, height: number): number {
  const w = hand[WRIST];
  const m = hand[MIDDLE_MCP];
  if (!w || !m) return 0;
  return Math.hypot((m.x - w.x) * width, (m.y - w.y) * height);
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.floor((s.length - 1) / 2)] ?? 0) : 0;
};

/** RMS distance of the wrist from its mean position, in palm sizes: ~0 for a hand held still. */
export function wristSpread(hands: readonly (readonly SlovoPoint[])[], width: number, height: number): number {
  if (hands.length === 0) return 0;
  const palm = median(hands.map((h) => palmPx(h, width, height))) || 1;
  const pts = hands.map((h) => ({ x: (h[WRIST]?.x ?? 0) * width, y: (h[WRIST]?.y ?? 0) * height }));
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return Math.sqrt(pts.reduce((s, p) => s + (p.x - cx) ** 2 + (p.y - cy) ** 2, 0) / pts.length) / palm;
}

/** The middle part of a clip: the approach and the release at the ends are not the sign itself. */
export function middlePart<T>(items: readonly T[], keep = 0.6): T[] {
  const cut = Math.floor((items.length * (1 - keep)) / 2);
  return items.slice(cut, items.length - cut);
}

/**
 * Indices of the `count` stillest frames (smallest change of wrist and shape to the neighbours):
 * the held part of the sign, from which kNN samples are taken.
 */
export function stillestFrames(
  vectors: readonly (readonly number[])[],
  wrists: readonly { x: number; y: number }[],
  palm: number,
  count: number,
): number[] {
  const step = (i: number, j: number) => {
    const a = vectors[i] ?? [];
    const b = vectors[j] ?? [];
    let d = 0;
    for (let k = 0; k < a.length; k++) d += ((a[k] ?? 0) - (b[k] ?? 0)) ** 2;
    const wa = wrists[i] ?? { x: 0, y: 0 };
    const wb = wrists[j] ?? { x: 0, y: 0 };
    return Math.sqrt(d) + Math.hypot(wa.x - wb.x, wa.y - wb.y) / (palm || 1);
  };
  const scores = vectors.map((_, i) => {
    const around = [i - 1, i + 1].filter((j) => j >= 0 && j < vectors.length);
    return around.length ? around.reduce((s, j) => s + step(i, j), 0) / around.length : 0;
  });
  return scores
    .map((score, i) => ({ score, i }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((x) => x.i)
    .sort((a, b) => a - b);
}

/** A resting second hand sits low in the frame; one raised above this line takes part in the sign. */
export const RAISED_BELOW_Y = 0.75;

export interface VideoAnalysis {
  /** Share of the clip's frames with a hand found. */
  visible: number;
  /** Share of hand frames where another hand is raised too (two-handed sign). */
  otherRaised: number;
  /** Middle part of the clip: wrist spread (palm sizes) and shape spread (normalized distance to the medoid). */
  wristSpread: number;
  shapeSpread: number;
  /** Normalized signing hand (63 numbers, canonical right-hand frame) for every hand frame. */
  vectors: number[][];
  /** Wrist in pixels per hand frame, and the median palm size in pixels. */
  wrists: { x: number; y: number }[];
  palm: number;
}

/** The signing hand as the app sees it: normalized like every camera frame (as a right hand; mirror fixed later). */
export function normalizeSlovoHand(hand: readonly SlovoPoint[], width: number, height: number): number[] {
  const frame = {
    landmarks: hand.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    handedness: "Right" as const,
    score: 1,
    timestamp: 0,
    videoWidth: width,
    videoHeight: height,
  };
  return flattenPoints(normalizeHand(frame).points);
}

export function analyzeVideo(video: SlovoVideo): VideoAnalysis {
  const { width, height } = video;
  const { active, others } = pickActiveHand(video.frames, width, height);
  const vectors = active.map((h) => normalizeSlovoHand(h, width, height));
  const raised = others.filter((hs) => hs.some((h) => (h[MIDDLE_MCP]?.y ?? 1) < RAISED_BELOW_Y)).length;
  const middle = middlePart(vectors);
  const medoid = middle[pickMedoid(middle)] ?? [];
  const shapeSpread = middle.length ? middle.reduce((s, v) => s + frameDistance(v, medoid), 0) / middle.length : 0;
  return {
    visible: active.length / Math.max(1, video.length, video.frames.length),
    otherRaised: active.length ? raised / active.length : 0,
    wristSpread: wristSpread(middlePart(active), width, height),
    shapeSpread,
    vectors,
    wrists: active.map((h) => ({ x: (h[WRIST]?.x ?? 0) * width, y: (h[WRIST]?.y ?? 0) * height })),
    palm: median(active.map((h) => palmPx(h, width, height))),
  };
}

export { median };
