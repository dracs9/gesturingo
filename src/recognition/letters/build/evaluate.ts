export interface EvalSample {
  label: string;
  /** Signer: in the "signer" mode every sample of the same person is hidden from the vote. */
  group: string;
  vector: readonly number[];
}

export type EvalMode = "signer" | "sample";

export interface LetterEval {
  total: number;
  correct: number;
  /** "signer" = leave-one-signer-out; "sample" = leave-one-out (letter has a single signer). */
  mode: EvalMode;
}

export interface CrossValidation {
  perLetter: Map<string, LetterEval>;
  /** confusion[true][predicted] = count. */
  confusion: Map<string, Map<string, number>>;
}

function squaredDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return sum;
}

function vote(neighbors: readonly { label: string; d2: number }[]): string {
  const votes = new Map<string, number>();
  for (const n of neighbors) votes.set(n.label, (votes.get(n.label) ?? 0) + 1);
  // Ties → the label of the closest neighbour (same rule as createKnn).
  let best = neighbors[0]?.label ?? "";
  for (const n of neighbors) if ((votes.get(n.label) ?? 0) > (votes.get(best) ?? 0)) best = n.label;
  return best;
}

/**
 * kNN cross-validation over all letters. A letter shown by several people is tested
 * leave-one-signer-out — the honest estimate for a new user (the jury); a letter from a single
 * person falls back to leave-one-out, which is optimistic and flagged as such.
 */
export function crossValidate(samples: readonly EvalSample[], k: number): CrossValidation {
  const groupsPerLetter = new Map<string, Set<string>>();
  for (const s of samples) {
    const set = groupsPerLetter.get(s.label) ?? new Set<string>();
    set.add(s.group);
    groupsPerLetter.set(s.label, set);
  }

  const perLetter = new Map<string, LetterEval>();
  const confusion = new Map<string, Map<string, number>>();

  samples.forEach((s, i) => {
    const mode: EvalMode = (groupsPerLetter.get(s.label)?.size ?? 0) > 1 ? "signer" : "sample";
    const best: { label: string; d2: number }[] = [];
    samples.forEach((o, j) => {
      if (j === i || (mode === "signer" && o.group === s.group)) return;
      const d2 = squaredDistance(s.vector, o.vector);
      if (best.length === k && d2 >= (best[k - 1]?.d2 ?? Infinity)) return;
      let p = best.length;
      while (p > 0 && (best[p - 1]?.d2 ?? 0) > d2) p--;
      best.splice(p, 0, { label: o.label, d2 });
      if (best.length > k) best.pop();
    });
    const predicted = vote(best);

    const ev = perLetter.get(s.label) ?? { total: 0, correct: 0, mode };
    ev.total += 1;
    if (predicted === s.label) ev.correct += 1;
    perLetter.set(s.label, ev);

    const row = confusion.get(s.label) ?? new Map<string, number>();
    row.set(predicted, (row.get(predicted) ?? 0) + 1);
    confusion.set(s.label, row);
  });

  return { perLetter, confusion };
}

/**
 * Letters most often mixed up with `letter`, in both directions (A shown → B predicted and B → A),
 * as a share of each letter's samples. Only pairs above `minRate` count.
 */
export function confusedWith(cv: CrossValidation, letter: string, max = 3, minRate = 0.05): string[] {
  const total = (l: string) => cv.perLetter.get(l)?.total ?? 0;
  const rate = (from: string, to: string) => {
    const n = total(from);
    return n > 0 ? (cv.confusion.get(from)?.get(to) ?? 0) / n : 0;
  };
  return [...cv.perLetter.keys()]
    .filter((other) => other !== letter)
    .map((other) => ({ other, r: rate(letter, other) + rate(other, letter) }))
    .filter((x) => x.r >= minRate)
    .sort((a, b) => b.r - a.r || (a.other < b.other ? -1 : 1))
    .slice(0, max)
    .map((x) => x.other);
}
