/**
 * Builds letter data from raw landmarks (scripts/landmarks/*.json, see extract_landmarks.py):
 *   src/data/references/<б>.json   medoid → ghost-hand reference
 *   src/data/samples/<б>.json      normalized kNN samples (no augmentation)
 *   src/data/letters.generated.ts  rule drafts (verified: false) + build info for /letters
 * Uses the app's own normalize/features code, so the data lives in exactly the app's frame.
 *
 * Run: npm run build:letters
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALPHABET } from "../src/data/alphabet";
import { DYNAMIC_LETTERS, isDynamicLetter } from "../src/data/dynamicLetters";
import { FINGERS } from "../src/recognition/features";
import type { Handedness } from "../src/recognition/landmarks";
import {
  capPerSigner,
  mirrorVector,
  normalizeRaw,
  type RawSample,
  type Sample,
} from "../src/recognition/letters/build/dataset";
import { draftSpec, RULE_MIN_SHARE, type SpecDraft } from "../src/recognition/letters/build/draft";
import { confusedWith, crossValidate } from "../src/recognition/letters/build/evaluate";
import type { LetterBuildInfo } from "../src/recognition/letters/build/info";
import { resolveOrientation } from "../src/recognition/letters/build/orientation";
import { FINGER_PAIRS, letterStats, type LetterStats } from "../src/recognition/letters/build/stats";
import {
  pickMedoid,
  roundFrame,
  serializeReferenceFile,
  serializeSampleFile,
} from "../src/recognition/samples";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANDMARKS_DIR = path.join(ROOT, "scripts", "landmarks");
const DATA_DIR = path.join(ROOT, "src", "data");

/** One person must not outweigh the others (a video gives 60+ near-identical frames). */
const MAX_PER_SIGNER = 20;
/** k of the cross-validation (the app's kNN uses the same k in Phase 5). */
const EVAL_K = 3;
/** Letters below this cross-validated accuracy are flagged in the report. */
const LOW_ACCURACY = 0.7;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const byAlphabet = (a: string, b: string) => ALPHABET.indexOf(a) - ALPHABET.indexOf(b);

function loadRaw(): RawSample[] {
  const files = readdirSync(LANDMARKS_DIR).filter((f) => f.endsWith(".json"));
  return files.flatMap((f) => JSON.parse(readFileSync(path.join(LANDMARKS_DIR, f), "utf8")) as RawSample[]);
}

/**
 * Front-view signers with a known hand. rsl-1 is a webcam video (the app's view) of one right hand:
 * 13 of its 21 letters are labelled Right in 100% of frames, so its Left labels are MediaPipe errors.
 * These samples anchor the orientation of everybody else's photos of the same letter.
 */
const KNOWN_HAND: Readonly<Record<string, Handedness>> = { "rsl-1": "Right" };

/** Normalizes every photo and fixes mirrored ones (Left/Right mislabels, back-of-hand shots) letter by letter. */
function toSamples(raw: readonly RawSample[]): Sample[] {
  const byLetter = new Map<string, RawSample[]>();
  for (const r of raw) {
    // Letters with movement: a photo shows no movement, so no rules and no kNN samples.
    if (!ALPHABET.includes(r.letter) || isDynamicLetter(r.letter)) continue;
    byLetter.set(r.letter, [...(byLetter.get(r.letter) ?? []), r]);
  }
  return [...byLetter.values()].flatMap((list) => {
    const known = list.map((r) => KNOWN_HAND[r.signer]);
    const vectors = list.map((r, i) => normalizeRaw({ ...r, handedness: known[i] ?? r.handedness }));
    const flips = resolveOrientation(
      vectors,
      known.map((h) => h !== undefined),
    );
    return list.map((r, i) => {
      const v = vectors[i] ?? [];
      const flip = flips[i] ?? false;
      return {
        letter: r.letter,
        source: r.source,
        signer: r.signer,
        file: r.file,
        vector: roundFrame(flip ? mirrorVector(v) : v),
        flipped: flip || (known[i] !== undefined && known[i] !== r.handedness),
      };
    });
  });
}

function countBy<T>(items: readonly T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of items) out[key(t)] = (out[key(t)] ?? 0) + 1;
  return out;
}

const MAX_LINE = 110;

/** TS object literal: unquoted identifier keys, short objects and arrays on one line. */
function literal(value: unknown, indent: number): string {
  const key = (k: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : JSON.stringify(k));
  const inline = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
    if (v && typeof v === "object") {
      const parts = Object.entries(v).map(([k, x]) => `${key(k)}: ${inline(x)}`);
      return parts.length ? `{ ${parts.join(", ")} }` : "{}";
    }
    return JSON.stringify(v);
  };
  const one = inline(value);
  if (indent + one.length <= MAX_LINE || value === null || typeof value !== "object") return one;
  const pad = " ".repeat(indent + 2);
  const items = Array.isArray(value)
    ? value.map((x) => `${pad}${literal(x, indent + 2)}`)
    : Object.entries(value).map(([k, x]) => `${pad}${key(k)}: ${literal(x, indent + 2)}`);
  const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return `${open}\n${items.join(",\n")},\n${" ".repeat(indent)}${close}`;
}

function statsComment(stats: LetterStats, draft: SpecDraft, info: LetterBuildInfo): string[] {
  const lines = [
    `${draft.spec.letter}: ${info.samples} samples (${Object.entries(info.sources)
      .map(([s, n]) => `${s} ${n}`)
      .join(", ")}), ${info.signers} signers, ${info.flipped} Left/Right fixed, ` +
      `kNN accuracy ${pct(info.accuracy)} (${info.mode === "signer" ? "leave-one-signer-out" : "leave-one-out, 1 signer"})`,
  ];
  for (const f of FINGERS) {
    const s = stats.fingers[f];
    const shares = `straight ${pct(s.states.straight)} / half ${pct(s.states.half)} / bent ${pct(s.states.bent)}`;
    const rule = draft.spec.fingers[f];
    lines.push(
      `  ${f.padEnd(6)} ${shares}, median ${s.medianAngle}° → ${rule ? `rule: ${rule.state}` : "free"}`,
    );
  }
  const touches = FINGER_PAIRS.map(([a, b]) => `${a}-${b}`)
    .filter((p) => (stats.tipsTouch[p] ?? 0) >= 0.5)
    .map((p) => `${p} ${pct(stats.tipsTouch[p] ?? 0)}`);
  if (touches.length) lines.push(`  tips touch: ${touches.join(", ")}`);
  if (draft.impliedTouches.length) lines.push(`  not a rule (both fingers bent): ${draft.impliedTouches.join(", ")}`);
  const p = stats.palmFacing;
  const t = stats.thumbPosition;
  lines.push(`  palm: camera ${pct(p.camera)} / side ${pct(p.side)} / away ${pct(p.away)} (no rule — photos are shot from any side)`);
  lines.push(`  thumb: acrossPalm ${pct(t.acrossPalm)} / side ${pct(t.side)} / up ${pct(t.up)} (no rule)`);
  return lines.map((l) => `  // ${l}`);
}

function renderGenerated(entries: { draft: SpecDraft; info: LetterBuildInfo }[]): string {
  const specs = entries
    .map(({ draft, info }) => [...statsComment(info.stats, draft, info), `  ${literal(draft.spec, 2)},`].join("\n"))
    .join("\n");
  const infos = entries.map(({ draft, info }) => `  "${draft.spec.letter}": ${literal(info, 2)},`).join("\n");
  return `// AUTO-GENERATED by scripts/build-letters.ts (npm run build:letters) — do not edit by hand.
// Team decisions go to letters.overrides.ts: they survive a rebuild.
// Rules come from data statistics only (a rule needs ≥ ${pct(RULE_MIN_SHARE)} of the samples) and are NOT verified
// against the official table yet (CLAUDE.md §8.1).
import type { LetterBuildInfo } from "../recognition/letters/build/info";
import type { LetterSpec } from "../recognition/letters/spec";

export const GENERATED_LETTERS: readonly LetterSpec[] = [
${specs}
];

export const LETTER_BUILD_INFO: Readonly<Record<string, LetterBuildInfo>> = {
${infos}
};
`;
}

function main(): void {
  const overrides = path.join(DATA_DIR, "letters.overrides.ts");
  if (!existsSync(overrides)) throw new Error(`${overrides} is missing — it holds the team's decisions`);

  const raw = loadRaw();
  const all = toSamples(raw);
  const samples = capPerSigner(all, MAX_PER_SIGNER);
  const letters = [...new Set(samples.map((s) => s.letter))].sort(byAlphabet);

  const cv = crossValidate(
    samples.map((s) => ({ label: s.letter, group: s.signer, vector: s.vector })),
    EVAL_K,
  );

  mkdirSync(path.join(DATA_DIR, "references"), { recursive: true });
  mkdirSync(path.join(DATA_DIR, "samples"), { recursive: true });
  // Letters that became dynamic must not keep an old reference or kNN samples.
  for (const letter of DYNAMIC_LETTERS) {
    for (const dir of ["references", "samples"]) rmSync(path.join(DATA_DIR, dir, `${letter}.json`), { force: true });
  }

  const entries = letters.map((letter) => {
    const mine = samples.filter((s) => s.letter === letter);
    const vectors = mine.map((s) => s.vector);
    const stats = letterStats(vectors);
    const draft = draftSpec(letter, stats);
    const similar = confusedWith(cv, letter);
    if (similar.length) draft.spec.confusedWith = similar;

    const medoid = mine[pickMedoid(vectors)];
    if (medoid) {
      writeFileSync(
        path.join(DATA_DIR, "references", `${letter}.json`),
        serializeReferenceFile({ letter, signer: medoid.signer, handedness: "Right", frame: medoid.vector }),
      );
    }
    const sources = countBy(mine, (s) => s.source);
    writeFileSync(
      path.join(DATA_DIR, "samples", `${letter}.json`),
      serializeSampleFile({ letter, signer: Object.keys(sources).join("+"), handedness: "Right", frames: vectors }),
    );

    const ev = cv.perLetter.get(letter) ?? { total: 0, correct: 0, mode: "sample" as const };
    const info: LetterBuildInfo = {
      samples: mine.length,
      sources,
      signers: new Set(mine.map((s) => s.signer)).size,
      flipped: all.filter((s) => s.letter === letter && s.flipped).length,
      accuracy: Math.round((ev.total ? ev.correct / ev.total : 0) * 1000) / 1000,
      mode: ev.mode,
      freeFingers: draft.freeFingers,
      impliedTouches: draft.impliedTouches,
      stats,
    };
    return { draft, info };
  });

  writeFileSync(path.join(DATA_DIR, "letters.generated.ts"), renderGenerated(entries));
  report(entries, raw.length, all);
}

function report(entries: { draft: SpecDraft; info: LetterBuildInfo }[], rawCount: number, all: Sample[]): void {
  const short: Record<string, string> = { thumb: "Б", index: "У", middle: "С", ring: "Бз", pinky: "М" };
  const stateMark: Record<string, string> = { straight: "↑", half: "◠", bent: "✊" };
  console.log(`\nФото с точками: ${rawCount}, после ограничения ${MAX_PER_SIGNER}/автор/буква: ${entries.reduce((n, e) => n + e.info.samples, 0)}`);
  console.log(`Динамические буквы (пропущены): ${DYNAMIC_LETTERS.join(" ")}`);
  console.log(`Left/Right исправлено: ${all.filter((s) => s.flipped).length} из ${all.length}`);
  console.log("Пальцы: Б большой, У указательный, С средний, Бз безымянный, М мизинец; ↑ прямой, ◠ полусогнут, ✊ согнут\n");
  console.log("буква образцы  авторы  испр.  точность        правила                        свободные  касания        confusedWith");
  for (const { draft, info } of entries) {
    const rules = FINGERS.filter((f) => draft.spec.fingers[f])
      .map((f) => `${short[f]}${stateMark[draft.spec.fingers[f]?.state ?? ""]}`)
      .join(" ");
    const free = info.freeFingers.map((f) => short[f]).join(" ") || "—";
    const touches =
      (draft.spec.extra ?? []).flatMap((e) => (e.type === "tipsTouch" ? [`${short[e.a]}+${short[e.b]}`] : [])).join(" ") ||
      "—";
    const acc = `${pct(info.accuracy)}${info.mode === "sample" ? " (LOO,1 автор)" : ""}`;
    const flag = info.accuracy < LOW_ACCURACY ? " ⚠" : "";
    console.log(
      `${draft.spec.letter.padEnd(5)} ${String(info.samples).padStart(7)} ${String(info.signers).padStart(7)} ${String(info.flipped).padStart(6)}  ${(acc + flag).padEnd(16)} ${rules.padEnd(30)} ${free.padEnd(10)} ${touches.padEnd(14)} ${(draft.spec.confusedWith ?? []).join(" ") || "—"}`,
    );
  }
}

main();
