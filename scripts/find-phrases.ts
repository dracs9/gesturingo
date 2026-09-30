/**
 * Report on the candidate phrases (docs/TRANSLATOR_SPEC.md §9): for every Slovo label in
 * scripts/phrase-candidates.txt — videos, signers, share of frames with a hand, one or two hands,
 * static or dynamic — and whether it passes the MVP selection (one hand, hand in ≥ 80% of frames, static).
 * Reads what `npm run fetch:slovo` downloaded; writes scripts/data/raw/slovo/phrases-report.json.
 *
 * Run: npm run find:phrases
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeVideo, median, type SlovoVideo } from "../src/recognition/phrases/build/slovo";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLOVO_DIR = path.join(ROOT, "scripts", "data", "raw", "slovo");
const LANDMARKS_DIR = path.join(SLOVO_DIR, "landmarks");
const CANDIDATES = path.join(ROOT, "scripts", "phrase-candidates.txt");

// Selection thresholds (medians over a label's videos).
/** The hand must be found in at least this share of frames (spec §9). */
export const VISIBLE_MIN = 0.8;
/** A second hand raised in more than this share of frames → two-handed sign. */
export const ONE_HAND_MAX_OTHER = 0.3;
/** Static: in the middle of the clip the wrist stays within this many palm sizes … */
export const STATIC_WRIST_MAX = 0.35;
/** … and the hand shape changes less than this (mean normalized distance to the clip's medoid). */
export const STATIC_SHAPE_MAX = 0.35;

export interface LabelReport {
  label: string;
  videos: number;
  signers: number;
  visible: number;
  otherRaised: number;
  wristSpread: number;
  shapeSpread: number;
  oneHand: boolean;
  visibleOk: boolean;
  isStatic: boolean;
  selected: boolean;
}

export function loadVideos(): SlovoVideo[] {
  return readdirSync(LANDMARKS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(LANDMARKS_DIR, f), "utf8")) as SlovoVideo);
}

export function readCandidates(): string[] {
  return readFileSync(CANDIDATES, "utf8")
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, "").trim().toLocaleLowerCase("ru-RU"))
    .filter(Boolean);
}

export function reportLabels(videos: readonly SlovoVideo[], labels: readonly string[]): LabelReport[] {
  return labels.map((label) => {
    const mine = videos.filter((v) => v.text.toLocaleLowerCase("ru-RU") === label);
    const a = mine.map(analyzeVideo);
    const r = {
      label,
      videos: mine.length,
      signers: new Set(mine.map((v) => v.signer)).size,
      visible: median(a.map((x) => x.visible)),
      otherRaised: median(a.map((x) => x.otherRaised)),
      wristSpread: median(a.map((x) => x.wristSpread)),
      shapeSpread: median(a.map((x) => x.shapeSpread)),
    };
    const oneHand = r.otherRaised <= ONE_HAND_MAX_OTHER;
    const visibleOk = r.visible >= VISIBLE_MIN;
    const isStatic = r.wristSpread <= STATIC_WRIST_MAX && r.shapeSpread <= STATIC_SHAPE_MAX;
    return { ...r, oneHand, visibleOk, isStatic, selected: mine.length > 0 && oneHand && visibleOk && isStatic };
  });
}

function main(): void {
  const reports = reportLabels(loadVideos(), readCandidates());
  const pct = (v: number) => `${Math.round(v * 100)}%`.padStart(5);
  const num = (v: number) => v.toFixed(2).padStart(6);
  console.log(
    `Пороги: рука видна ≥ ${pct(VISIBLE_MIN)}, вторая рука поднята ≤ ${pct(ONE_HAND_MAX_OTHER)}, ` +
      `статичный: запястье ≤ ${STATIC_WRIST_MAX} ладони и форма ≤ ${STATIC_SHAPE_MAX} (медианы по видео)\n`,
  );
  console.log("метка            видео  авт.  рука  2-я рука  запястье  форма   руки   вид   тип         итог");
  for (const r of reports) {
    console.log(
      `${r.label.padEnd(16)} ${String(r.videos).padStart(5)} ${String(r.signers).padStart(5)} ${pct(r.visible)} ${pct(r.otherRaised).padStart(9)} ${num(r.wristSpread).padStart(9)} ${num(r.shapeSpread)}  ${(r.oneHand ? "одна" : "две").padEnd(5)} ${(r.visibleOk ? "✓" : "✗").padEnd(5)} ${(r.isStatic ? "статичный" : "динамич.").padEnd(11)} ${r.selected ? "✅ в MVP" : "—"}`,
    );
  }
  const selected = reports.filter((r) => r.selected).map((r) => r.label);
  console.log(`\nОтобрано: ${selected.length ? selected.join(", ") : "ничего"}`);
  writeFileSync(path.join(SLOVO_DIR, "phrases-report.json"), `${JSON.stringify(reports, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
