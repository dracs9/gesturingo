/**
 * Downloads ONLY what the phrase build needs from Slovo (docs/TRANSLATOR_SPEC.md §9) — no videos:
 *   1. annotations.csv, cut out of slovo.zip (16 GB) through the zip's central directory;
 *   2. the MediaPipe landmarks of the videos whose label is in scripts/phrase-candidates.txt, cut out
 *      of slovo_mediapipe.json (1.26 GB) with range requests. The file follows the annotation order,
 *      so an interpolation search finds each video in a couple of small requests.
 * Output (gitignored): scripts/data/raw/slovo/annotations.csv, scripts/data/raw/slovo/landmarks/<id>.json.
 * Resumable: videos already on disk are skipped.
 *
 * Run: npm run fetch:slovo
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import {
  estimateOffset,
  findKeys,
  localDataStart,
  matchArray,
  parseAnnotations,
  parseCentralDirectory,
  parseEndOfDirectory,
  parseZip64Record,
  type SlovoAnnotation,
} from "../src/recognition/phrases/build/slovo";
import { readCandidates } from "./find-phrases";

const BASE = "https://rndml-team-cv.obs.ru-moscow-1.hc.sbercloud.ru/datasets/slovo/";
const ZIP_URL = `${BASE}slovo.zip`;
const LANDMARKS_URL = `${BASE}slovo_mediapipe.json`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLOVO_DIR = path.join(ROOT, "scripts", "data", "raw", "slovo");
const ANNOTATIONS = path.join(SLOVO_DIR, "annotations.csv");
const LANDMARKS_DIR = path.join(SLOVO_DIR, "landmarks");

const PROBE_BYTES = 96 * 1024;
const MORE_BYTES = 128 * 1024;
const MAX_PROBES = 16;
const CONCURRENCY = 6;

let downloaded = 0;

async function contentLength(url: string): Promise<number> {
  const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HEAD ${url}: ${res.status}`);
  return Number(res.headers.get("content-length"));
}

/** Bytes [from, to] inclusive, with retries. */
async function range(url: string, from: number, to: number): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${from}-${to}` }, signal: AbortSignal.timeout(120_000) });
      if (res.status !== 206) throw new Error(`range ${from}-${to}: HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      downloaded += bytes.length;
      return bytes;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fetchAnnotations(): Promise<string> {
  if (existsSync(ANNOTATIONS)) return readFileSync(ANNOTATIONS, "utf8");
  console.log("annotations.csv: reading the directory of slovo.zip (no videos are downloaded)…");
  const size = await contentLength(ZIP_URL);
  const tail = await range(ZIP_URL, size - 65536, size - 1);
  let end = parseEndOfDirectory(tail);
  if ("zip64RecordOffset" in end) {
    end = parseZip64Record(await range(ZIP_URL, end.zip64RecordOffset, end.zip64RecordOffset + 55));
  }
  const entries = parseCentralDirectory(await range(ZIP_URL, end.cdOffset, end.cdOffset + end.cdSize - 1));
  const entry = entries.find((e) => e.name === "annotations.csv");
  if (!entry) throw new Error("annotations.csv is not in slovo.zip");
  const start = localDataStart(entry, await range(ZIP_URL, entry.offset, entry.offset + 29));
  const data = await range(ZIP_URL, start, start + entry.compressedSize - 1);
  const csv = (entry.method === 8 ? inflateRawSync(data) : Buffer.from(data)).toString("utf8");
  writeFileSync(ANNOTATIONS, csv, "utf8");
  return csv;
}

// Latin-1 keeps one character per byte: text offsets are byte offsets (the file is ASCII anyway).
const decode = (b: Uint8Array) => Buffer.from(b).toString("latin1");

async function main(): Promise<void> {
  mkdirSync(LANDMARKS_DIR, { recursive: true });
  const rows = parseAnnotations(await fetchAnnotations());
  const rowOf = new Map(rows.map((r) => [r.id, r.row]));
  const candidates = new Set(readCandidates());
  const missingLabels = [...candidates].filter((c) => !rows.some((r) => r.text.toLocaleLowerCase("ru-RU") === c));
  if (missingLabels.length) console.warn(`not in Slovo: ${missingLabels.join(", ")}`);

  const targets = rows
    .filter((r) => candidates.has(r.text.toLocaleLowerCase("ru-RU")))
    .filter((r) => !existsSync(path.join(LANDMARKS_DIR, `${r.id}.json`)));
  console.log(`${candidates.size} labels; videos to fetch: ${targets.length}`);
  if (targets.length === 0) return;

  const fileSize = await contentLength(LANDMARKS_URL);
  const anchors: { row: number; offset: number }[] = [];
  const known = new Set<number>();
  const addAnchors = (text: string, base: number) => {
    for (const k of findKeys(text)) {
      const row = rowOf.get(k.id);
      if (row === undefined || known.has(row)) continue;
      known.add(row);
      anchors.push({ row, offset: base + k.arrayStart });
    }
  };

  async function fetchVideo(target: SlovoAnnotation): Promise<unknown[]> {
    let window = PROBE_BYTES;
    for (let probe = 0; probe < MAX_PROBES; probe++) {
      const est = estimateOffset(target.row, anchors, rows.length, fileSize);
      const from = Math.max(0, est - Math.floor(window / 3));
      const to = Math.min(fileSize - 1, from + window - 1);
      let text = decode(await range(LANDMARKS_URL, from, to));
      addAnchors(text, from);
      const key = findKeys(text).find((k) => k.id === target.id);
      if (!key) {
        // Nothing new learned (a huge video in the way): look wider.
        window = Math.min(window * 2, 2 * 1024 * 1024);
        continue;
      }
      let end = matchArray(text, key.arrayStart);
      let loadedTo = to;
      while (end === null && loadedTo < fileSize - 1) {
        const next = Math.min(fileSize - 1, loadedTo + MORE_BYTES);
        text += decode(await range(LANDMARKS_URL, loadedTo + 1, next));
        loadedTo = next;
        end = matchArray(text, key.arrayStart);
      }
      if (end === null) throw new Error(`${target.id}: array never closes`);
      addAnchors(text, from);
      return JSON.parse(text.slice(key.arrayStart, end + 1)) as unknown[];
    }
    throw new Error(`${target.id}: not found after ${MAX_PROBES} probes`);
  }

  let done = 0;
  const queue = [...targets];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        const frames = await fetchVideo(t);
        const video = { id: t.id, text: t.text, signer: t.signer, width: t.width, height: t.height, length: t.length, train: t.train };
        writeFileSync(path.join(LANDMARKS_DIR, `${t.id}.json`), JSON.stringify({ ...video, frames }));
        done++;
        if (done % 20 === 0 || done === targets.length) {
          const s = (Date.now() - started) / 1000;
          console.log(`${done}/${targets.length} videos, ${(downloaded / 1e6).toFixed(1)} MB, ${s.toFixed(0)} s`);
        }
      }
    }),
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
