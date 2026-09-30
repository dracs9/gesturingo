/**
 * Builds static phrase gestures from the Slovo landmarks (docs/TRANSLATOR_SPEC.md §4.2, §9):
 *   src/data/phraseSamples/<id>.json   kNN samples (the stillest frames of every video)
 *   src/data/phrases.generated.ts      PhraseSpec drafts (verified: false) + build info + rejected labels
 *   src/data/phrases.overrides.ts      the team's decisions (created empty once, never overwritten)
 * Only labels that `find-phrases` selects (one hand, hand in ≥ 80% of frames, static) are built, then
 * checked against the letters: a phrase that looks like the open palm (the cancel / exit command) or
 * that the letters' samples fall into is rejected, so phrases never break fingerspelling.
 *
 * Run: npm run fetch:slovo && npm run build:phrases
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FINGERS } from "../src/recognition/features";
import { capPerSigner, mirrorVector } from "../src/recognition/letters/build/dataset";
import { draftSpec } from "../src/recognition/letters/build/draft";
import { confusedWith, crossValidate } from "../src/recognition/letters/build/evaluate";
import { resolveOrientation } from "../src/recognition/letters/build/orientation";
import { letterStats } from "../src/recognition/letters/build/stats";
import { analyzeVideo, middlePart, stillestFrames } from "../src/recognition/phrases/build/slovo";
import { PHRASE_PREFIX, type PhraseBuildInfo, type PhraseSpec } from "../src/recognition/phrases/spec";
import { pickMedoid, roundFrame, serializeSampleFile, type SampleFile } from "../src/recognition/samples";
import { loadVideos, readCandidates, reportLabels } from "./find-phrases";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const SAMPLES_DIR = path.join(DATA_DIR, "phraseSamples");

/** The stillest frames taken from the middle of each video. */
const FRAMES_PER_VIDEO = 8;
/** One person must not outweigh the others (like the letters). */
const MAX_PER_SIGNER = 20;
const EVAL_K = 3;
/** Rejected below this leave-one-signer-out accuracy: the camera would not tell it apart. */
const MIN_ACCURACY = 0.6;
/** Rejected when more than this share of any letter's samples is taken for the phrase. */
const MAX_LETTER_LOSS = 0.05;
/** Rejected when this share of samples has all five fingers straight: that is the open-palm command. */
const OPEN_PALM_SHARE = 0.5;

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh",
  щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const phraseId = (label: string) =>
  Array.from(label.toLocaleLowerCase("ru-RU"))
    .map((c) => TRANSLIT[c] ?? (/[a-z0-9]/.test(c) ? c : c === " " ? "-" : ""))
    .join("");
/** «привет!» → «Привет»: the text added to the message and spoken. */
const phraseText = (label: string) => {
  const t = label.replace(/[!?.]+$/, "").trim();
  return t.charAt(0).toLocaleUpperCase("ru-RU") + t.slice(1);
};

interface PhraseSample {
  letter: string;
  signer: string;
  file: string;
  vector: number[];
}

function letterSamples(): { label: string; group: string; vector: number[] }[] {
  const dir = path.join(DATA_DIR, "samples");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      const file = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as SampleFile;
      return file.frames.map((vector) => ({ label: file.letter, group: `letters:${file.letter}`, vector }));
    });
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function main(): void {
  const videos = loadVideos();
  const reports = reportLabels(videos, readCandidates());
  const selected = reports.filter((r) => r.selected);
  const rejected: { label: string; reason: string }[] = reports
    .filter((r) => !r.selected)
    .map((r) => ({
      label: r.label,
      reason: !r.oneHand ? "две руки" : !r.visibleOk ? "рука видна реже 80% кадров" : "жест с движением (T6)",
    }));

  // Samples: the stillest frames in the middle of every video, as the app would normalize them.
  const byPhrase = new Map<string, PhraseSample[]>();
  for (const r of selected) {
    const label = `${PHRASE_PREFIX}${phraseId(r.label)}`;
    const list: PhraseSample[] = [];
    for (const v of videos.filter((x) => x.text.toLocaleLowerCase("ru-RU") === r.label)) {
      const a = analyzeVideo(v);
      const cut = Math.floor((a.vectors.length - middlePart(a.vectors).length) / 2);
      const middle = middlePart(a.vectors);
      const idx = stillestFrames(middle, middlePart(a.wrists), a.palm, FRAMES_PER_VIDEO);
      for (const i of idx) {
        const vector = a.vectors[cut + i];
        if (vector) list.push({ letter: label, signer: v.signer, file: `${v.id}#${String(cut + i).padStart(3, "0")}`, vector });
      }
    }
    // No Left/Right labels in Slovo: pick each sample's mirror side by the phrase's typical shape.
    const flips = resolveOrientation(list.map((s) => s.vector));
    byPhrase.set(
      label,
      capPerSigner(
        list.map((s, i) => ({ ...s, vector: roundFrame(flips[i] ? mirrorVector(s.vector) : s.vector) })),
        MAX_PER_SIGNER,
      ),
    );
  }

  const letters = letterSamples();
  const phraseEval = [...byPhrase.values()].flat().map((s) => ({ label: s.letter, group: s.signer, vector: s.vector }));
  const cv = crossValidate([...letters, ...phraseEval], EVAL_K);

  const accepted: { spec: PhraseSpec; info: PhraseBuildInfo; samples: PhraseSample[] }[] = [];
  for (const r of selected) {
    const label = `${PHRASE_PREFIX}${phraseId(r.label)}`;
    const samples = byPhrase.get(label) ?? [];
    const vectors = samples.map((s) => s.vector);
    const stats = letterStats(vectors);
    const draft = draftSpec(label, stats);
    const ev = cv.perLetter.get(label) ?? { total: 0, correct: 0, mode: "signer" as const };
    const accuracy = ev.total ? ev.correct / ev.total : 0;
    const openPalm = Math.min(...FINGERS.map((f) => stats.fingers[f].states.straight));
    const letterLoss = [...new Set(letters.map((l) => l.label))]
      .map((l) => ({ l, rate: (cv.confusion.get(l)?.get(label) ?? 0) / (cv.perLetter.get(l)?.total ?? 1) }))
      .filter((x) => x.rate > MAX_LETTER_LOSS);

    const reason =
      openPalm >= OPEN_PALM_SHARE
        ? `похоже на открытую ладонь (${pct(openPalm)}) — это команда «отмена/выход»`
        : accuracy < MIN_ACCURACY
          ? `камера не отличает: точность ${pct(accuracy)}`
          : letterLoss.length
            ? `отнимает буквы: ${letterLoss.map((x) => `${x.l} ${pct(x.rate)}`).join(", ")}`
            : null;
    if (reason) {
      rejected.push({ label: r.label, reason });
      continue;
    }

    const similar = confusedWith(cv, label);
    const reference = vectors[pickMedoid(vectors)] ?? [];
    const spec: PhraseSpec = {
      id: phraseId(r.label),
      text: phraseText(r.label),
      kind: "static",
      verified: false,
      source: { dataset: "slovo", label: r.label, samples: samples.length },
      // No ghost-hand reference file: the /letters tab draws `info.reference` instead.
      handshape: { ...draft.spec, reference: "", ...(similar.length ? { confusedWith: similar } : {}) },
      ...(similar.length ? { confusedWith: similar } : {}),
    };
    const info: PhraseBuildInfo = {
      videos: r.videos,
      signers: r.signers,
      samples: samples.length,
      visible: Math.round(r.visible * 1000) / 1000,
      wristSpread: Math.round(r.wristSpread * 1000) / 1000,
      shapeSpread: Math.round(r.shapeSpread * 1000) / 1000,
      accuracy: Math.round(accuracy * 1000) / 1000,
      mode: ev.mode,
      freeFingers: draft.freeFingers,
      stats,
      reference,
    };
    accepted.push({ spec, info, samples });
  }

  // A rejected phrase is not in the app: it cannot be "similar" to anything there.
  const inApp = new Set([...letters.map((l) => l.label), ...accepted.map((a) => `${PHRASE_PREFIX}${a.spec.id}`)]);
  for (const { spec } of accepted) {
    const keep = spec.confusedWith?.filter((l) => inApp.has(l)) ?? [];
    spec.confusedWith = keep.length ? keep : undefined;
    if (spec.handshape) spec.handshape.confusedWith = spec.confusedWith;
  }

  // Write: samples of accepted phrases only (old files of rejected ones are removed).
  rmSync(SAMPLES_DIR, { recursive: true, force: true });
  mkdirSync(SAMPLES_DIR, { recursive: true });
  writeFileSync(path.join(SAMPLES_DIR, ".gitkeep"), "");
  for (const { spec, samples } of accepted) {
    writeFileSync(
      path.join(SAMPLES_DIR, `${spec.id}.json`),
      serializeSampleFile({
        letter: `${PHRASE_PREFIX}${spec.id}`,
        signer: "slovo",
        handedness: "Right",
        frames: samples.map((s) => s.vector),
      }),
    );
  }
  writeFileSync(path.join(DATA_DIR, "phrases.generated.ts"), render(accepted, rejected));
  const overrides = path.join(DATA_DIR, "phrases.overrides.ts");
  if (!existsSync(overrides)) writeFileSync(overrides, OVERRIDES_TEMPLATE);

  console.log(`\nВ приложение: ${accepted.length}`);
  for (const { spec, info } of accepted) {
    const rules = FINGERS.map((f) => `${f}:${spec.handshape?.fingers[f]?.state ?? "—"}`).join(" ");
    console.log(
      `  ${spec.text.padEnd(10)} образцов ${String(info.samples).padStart(4)}, авторов ${info.signers}, точность ${pct(info.accuracy)}, ` +
        `похожие: ${spec.confusedWith?.join(" ") || "—"}\n    ${rules}`,
    );
  }
  console.log(`Не вошли: ${rejected.length}`);
  for (const r of rejected) console.log(`  ${r.label.padEnd(14)} ${r.reason}`);
}

const json = (v: unknown) => JSON.stringify(v);

function render(
  accepted: { spec: PhraseSpec; info: PhraseBuildInfo }[],
  rejected: { label: string; reason: string }[],
): string {
  return `// AUTO-GENERATED by scripts/build-phrases.ts (npm run build:phrases) — do not edit by hand.
// Team decisions go to phrases.overrides.ts. Source: Slovo (ai-forever), MediaPipe landmarks only,
// variant of CC BY-SA 4.0. Rules come from data statistics and are NOT verified (docs/TRANSLATOR_SPEC.md §2).
import type { PhraseBuildInfo, PhraseSpec } from "../recognition/phrases/spec";

export const GENERATED_PHRASES: readonly PhraseSpec[] = [
${accepted.map(({ spec }) => `  ${json(spec)},`).join("\n")}
];

export const PHRASE_BUILD_INFO: Readonly<Record<string, PhraseBuildInfo>> = {
${accepted.map(({ spec, info }) => `  ${json(spec.id)}: ${json(info)},`).join("\n")}
};

/** Candidate labels that did not make it, and why (shown on /letters). */
export const PHRASE_REJECTED: ReadonlyArray<{ label: string; reason: string }> = ${json(rejected)};
`;
}

const OVERRIDES_TEMPLATE = `import type { PhraseSpec } from "../recognition/phrases/spec";

/**
 * The team's decisions on generated phrases (they survive \`npm run build:phrases\`): mark a phrase
 * verified after checking it against an RSL dictionary, fix its text, or leave it out.
 */
export type PhraseOverride = Partial<Pick<PhraseSpec, "text" | "verified">> & { excluded?: boolean };

export const PHRASE_OVERRIDES: Readonly<Record<string, PhraseOverride>> = {};
`;

main();
