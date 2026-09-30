/**
 * Builds phrase gestures from the Slovo landmarks (docs/TRANSLATOR_SPEC.md §4.2, §9):
 *   src/data/phraseSamples/<id>.json   static phrases: kNN samples (the stillest frames of every video)
 *   src/data/phraseTemplates/<id>.json dynamic phrases: DTW templates, threshold, usual duration
 *   src/data/phrases.generated.ts      PhraseSpec drafts (verified: false) + build info + rejected labels
 *   src/data/phrases.overrides.ts      the team's decisions (created empty once, never overwritten)
 * Only labels that `find-phrases` selects (one hand, hand in ≥ 80% of frames, static) are built, then
 * checked against the letters: a phrase that looks like the open palm (the cancel / exit command) or
 * that the letters' samples fall into is rejected, so phrases never break fingerspelling.
 * One-handed signs WITH movement (T6) get DTW templates; the matcher is simulated leave-one-signer-out
 * and phrases the camera does not recognize reliably are left out, with the numbers in the report.
 *
 * Run: npm run fetch:slovo && npm run build:phrases
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FINGERS } from "../src/recognition/features";
import { capPerSigner, mirrorVector } from "../src/recognition/letters/build/dataset";
import { draftSpec, palmFacingRule } from "../src/recognition/letters/build/draft";
import { confusedWith, crossValidate } from "../src/recognition/letters/build/evaluate";
import { resolveOrientation } from "../src/recognition/letters/build/orientation";
import { letterStats } from "../src/recognition/letters/build/stats";
import { buildModel, distanceMatrix, evaluateMatcher, type DynSample } from "../src/recognition/phrases/build/dynamic";
import { analyzeVideo, middlePart, SLOVO_FPS, stillestFrames, videoMotionFrames } from "../src/recognition/phrases/build/slovo";
import {
  PHRASE_PREFIX,
  type DynamicBuildInfo,
  type PhraseBuildInfo,
  type PhraseSpec,
} from "../src/recognition/phrases/spec";
import { resample } from "../src/recognition/sequence/dtw";
import { toSequence, travelPath } from "../src/recognition/sequence/frameFeatures";
import type { DynamicTemplates } from "../src/recognition/sequence/phraseMatcher";
import { TALK_DTW_LENGTH, TALK_DTW_WINDOW } from "../src/recognition/thresholds";
import { pickMedoid, roundFrame, serializeSampleFile, type SampleFile } from "../src/recognition/samples";
import { loadVideos, readCandidates, reportLabels } from "./find-phrases";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const SAMPLES_DIR = path.join(DATA_DIR, "phraseSamples");
const TEMPLATES_DIR = path.join(DATA_DIR, "phraseTemplates");

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
/** Dynamic phrases, simulated leave-one-signer-out: at least this share of an unseen person's clips is recognized … */
const DYN_MIN_RECALL = 0.3;
/** … of what is accepted among the selected phrases, at least this share is right … */
const DYN_MIN_PRECISION = 0.8;
/** … and at most this share of the clips of all OTHER signs (people still show them) comes out as the phrase. */
const DYN_MAX_FALSE_RATE = 0.02;

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
    // One-handed signs with movement go to the dynamic build below.
    .filter((r) => !r.oneHand || !r.visibleOk || r.isStatic)
    .map((r) => ({
      label: r.label,
      reason: !r.oneHand ? "две руки" : !r.visibleOk ? "рука видна реже 80% кадров" : "не прошёл отбор",
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
    // Slovo is filmed from the front like the app's camera: the palm orientation is part of the sign.
    const palm = palmFacingRule(stats);
    if (palm) draft.spec.extra = [...(draft.spec.extra ?? []), palm];
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

  const dynamic = buildDynamic(videos, reports);
  rejected.push(...dynamic.rejected);

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
  rmSync(TEMPLATES_DIR, { recursive: true, force: true });
  mkdirSync(TEMPLATES_DIR, { recursive: true });
  writeFileSync(path.join(TEMPLATES_DIR, ".gitkeep"), "");
  for (const { spec, templates } of dynamic.accepted) {
    writeFileSync(path.join(TEMPLATES_DIR, `${spec.id}.json`), `${JSON.stringify(templates)}\n`);
  }
  writeFileSync(path.join(DATA_DIR, "phrases.generated.ts"), render(accepted, dynamic.accepted, rejected));
  const overrides = path.join(DATA_DIR, "phrases.overrides.ts");
  if (!existsSync(overrides)) writeFileSync(overrides, OVERRIDES_TEMPLATE);

  console.log(`\nВ приложение: ${accepted.length}`);
  for (const { spec, info } of accepted) {
    const palmRule = spec.handshape?.extra?.find((e) => e.type === "palmFacing");
    const rules = [
      ...FINGERS.map((f) => `${f}:${spec.handshape?.fingers[f]?.state ?? "—"}`),
      `palm:${palmRule && "value" in palmRule ? palmRule.value : "—"}`,
    ].join(" ");
    console.log(
      `  ${spec.text.padEnd(10)} образцов ${String(info.samples).padStart(4)}, авторов ${info.signers}, точность ${pct(info.accuracy)}, ` +
        `похожие: ${spec.confusedWith?.join(" ") || "—"}\n    ${rules}`,
    );
  }
  console.log(`\nС движением в приложение: ${dynamic.accepted.length} (клипы других жестов, принятые за фразу: ${dynamic.falseFromNegatives} из ${dynamic.negatives})`);
  for (const { spec, info } of dynamic.accepted) {
    console.log(
      `  ${spec.text.padEnd(14)} шаблонов ${info.templates}, узнаёт ${pct(info.recall)} показов новых людей, ` +
        `путает с выбранными ${pct(1 - info.precision)}, 1-NN ${pct(info.accuracy)}, ${spec.tolerance?.durationMin}–${spec.tolerance?.durationMax} мс`,
    );
  }
  console.log(`Не вошли: ${rejected.length}`);
  for (const r of rejected) console.log(`  ${r.label.padEnd(14)} ${r.reason}`);
}

const json = (v: unknown) => JSON.stringify(v);

/**
 * One-handed signs with movement (T6): DTW templates from the most typical signers, a threshold from the
 * spread inside the class, and a leave-one-signer-out simulation of the app's matcher. Phrases whose
 * precision or recall is too low are dropped one by one (the rest are re-evaluated without them).
 */
function buildDynamic(
  videos: ReturnType<typeof loadVideos>,
  reports: ReturnType<typeof reportLabels>,
): {
  accepted: { spec: PhraseSpec; info: DynamicBuildInfo; templates: DynamicTemplates }[];
  rejected: { label: string; reason: string }[];
  falseFromNegatives: number;
  negatives: number;
} {
  const dynamicLabels = reports.filter((r) => r.oneHand && r.visibleOk && !r.isStatic).map((r) => r.label);
  // Clips of static signs must never be taken for a dynamic phrase: they are the negatives.
  const negativeLabels = reports.filter((r) => r.isStatic).map((r) => r.label);
  const samples: DynSample[] = [];
  for (const label of [...dynamicLabels, ...negativeLabels]) {
    for (const v of videos.filter((x) => x.text.toLocaleLowerCase("ru-RU") === label)) {
      const { frames } = videoMotionFrames(v);
      if (frames.length < 3) continue;
      samples.push({
        label: `${PHRASE_PREFIX}${phraseId(label)}`,
        signer: v.signer,
        seq: resample(toSequence(frames), TALK_DTW_LENGTH),
        durationMs: (frames.length * 1000) / SLOVO_FPS,
      });
    }
  }
  const window = Math.max(1, Math.round(TALK_DTW_LENGTH * TALK_DTW_WINDOW));
  const d = distanceMatrix(samples, window);

  // 1-NN accuracy among the dynamic signs, leave-one-signer-out (for the report).
  const dynIds = new Set(dynamicLabels.map((l) => `${PHRASE_PREFIX}${phraseId(l)}`));
  const nn = new Map<string, { total: number; right: number }>();
  samples.forEach((s, i) => {
    if (!dynIds.has(s.label)) return;
    let best = Infinity;
    let got = "";
    samples.forEach((o, j) => {
      if (!dynIds.has(o.label) || o.signer === s.signer) return;
      const dist = d[i]?.[j] ?? Infinity;
      if (dist < best) {
        best = dist;
        got = o.label;
      }
    });
    const e = nn.get(s.label) ?? { total: 0, right: 0 };
    e.total++;
    if (got === s.label) e.right++;
    nn.set(s.label, e);
  });

  const rejected: { label: string; reason: string }[] = [];
  const labelOf = new Map(dynamicLabels.map((l) => [`${PHRASE_PREFIX}${phraseId(l)}`, l]));
  // Forward selection: phrases are added best first and kept only if every phrase selected so far still
  // passes. Clips of everything NOT selected (other signs with movement, static signs) are negatives:
  // people will still show them, and they must not come out as a phrase.
  const inAll = (ids: readonly string[]) => samples.flatMap((s, i) => (ids.includes(s.label) ? [] : [i]));
  const scoresOf = (ev: ReturnType<typeof evaluateMatcher>, id: string) => {
    const e = ev.perLabel.get(id) ?? { clips: 0, right: 0, fromPhrases: 0, fromNegatives: 0 };
    return {
      recall: e.clips ? e.right / e.clips : 0,
      precision: e.right + e.fromPhrases ? e.right / (e.right + e.fromPhrases) : 0,
      falseRate: ev.negatives ? e.fromNegatives / ev.negatives : 0,
    };
  };
  const passes = (x: { recall: number; precision: number; falseRate: number }) =>
    x.recall >= DYN_MIN_RECALL && x.precision >= DYN_MIN_PRECISION && x.falseRate <= DYN_MAX_FALSE_RATE;
  const standalone = [...dynIds]
    .map((id) => {
      const x = scoresOf(evaluateMatcher([id], samples, d, inAll([id])), id);
      return { id, ...x, key: x.recall - 10 * x.falseRate };
    })
    .sort((a, b) => b.key - a.key);

  let labels: string[] = [];
  let ev = evaluateMatcher([], samples, d, []);
  for (const cand of standalone) {
    const trial = [...labels, cand.id];
    const trialEv = evaluateMatcher(trial, samples, d, inAll(trial));
    if (trial.every((id) => passes(scoresOf(trialEv, id)))) {
      labels = trial;
      ev = trialEv;
      continue;
    }
    const x = scoresOf(trialEv, cand.id);
    rejected.push({
      label: labelOf.get(cand.id) ?? cand.id,
      reason:
        `с движением: камера узнаёт ${pct(x.recall)} показов новых людей, ` +
        `путает с выбранными ${pct(1 - x.precision)}, чужих жестов принимает за неё ${(x.falseRate * 100).toFixed(1)}%`,
    });
  }
  const scores = (id: string) => scoresOf(ev, id);

  const round = (v: number) => Math.round(v * 1000) / 1000;
  const accepted = labels.map((id) => {
    const members = samples.flatMap((s, i) => (s.label === id ? [i] : []));
    // The final threshold also keeps away from every other gesture: the other phrases and the static signs.
    const others = samples.flatMap((s, i) => (s.label !== id ? [i] : []));
    const model = buildModel(id, members, samples, d, others);
    const seqs = model.templates.map((t) => (samples[t]?.seq ?? []).map((f) => f.map(round)));
    const templates: DynamicTemplates = {
      label: id,
      templates: seqs,
      threshold: round(model.threshold),
      durationMin: model.durationMin,
      durationMax: model.durationMax,
    };
    const label = labelOf.get(id) ?? id;
    const report = reports.find((r) => r.label === label);
    const { recall, precision } = scores(id);
    const e = nn.get(id) ?? { total: 0, right: 0 };
    const spec: PhraseSpec = {
      id: phraseId(label),
      text: phraseText(label),
      kind: "dynamic",
      verified: false,
      source: { dataset: "slovo", label, samples: members.length },
      tolerance: { dtw: templates.threshold, durationMin: model.durationMin, durationMax: model.durationMax },
    };
    const info: DynamicBuildInfo = {
      videos: report?.videos ?? members.length,
      signers: report?.signers ?? 0,
      templates: seqs.length,
      accuracy: round(e.total ? e.right / e.total : 0),
      recall: round(recall),
      precision: round(precision),
      path: travelPath(seqs[0] ?? []).map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 })),
    };
    return { spec, info, templates };
  });
  return { accepted, rejected, falseFromNegatives: ev.falseFromNegatives, negatives: ev.negatives };
  // (falseFromNegatives: clips of every non-selected sign, static or not, accepted as a selected phrase.)
}

function render(
  accepted: { spec: PhraseSpec; info: PhraseBuildInfo }[],
  dynamic: { spec: PhraseSpec; info: DynamicBuildInfo }[],
  rejected: { label: string; reason: string }[],
): string {
  return `// AUTO-GENERATED by scripts/build-phrases.ts (npm run build:phrases) — do not edit by hand.
// Team decisions go to phrases.overrides.ts. Source: Slovo (ai-forever), MediaPipe landmarks only,
// variant of CC BY-SA 4.0. Rules come from data statistics and are NOT verified (docs/TRANSLATOR_SPEC.md §2).
import type { DynamicBuildInfo, PhraseBuildInfo, PhraseSpec } from "../recognition/phrases/spec";

export const GENERATED_PHRASES: readonly PhraseSpec[] = [
${[...accepted, ...dynamic].map(({ spec }) => `  ${json(spec)},`).join("\n")}
];

export const PHRASE_BUILD_INFO: Readonly<Record<string, PhraseBuildInfo>> = {
${accepted.map(({ spec, info }) => `  ${json(spec.id)}: ${json(info)},`).join("\n")}
};

export const DYNAMIC_BUILD_INFO: Readonly<Record<string, DynamicBuildInfo>> = {
${dynamic.map(({ spec, info }) => `  ${json(spec.id)}: ${json(info)},`).join("\n")}
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
