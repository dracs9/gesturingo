import { useEffect, useState } from "react";
import { SkeletonPreview } from "../../components/SkeletonPreview";
import { labelText, PHRASES } from "../../data/phrases";
import { PHRASE_BUILD_INFO, PHRASE_REJECTED } from "../../data/phrases.generated";
import { PHRASE_OVERRIDES, type PhraseOverride } from "../../data/phrases.overrides";
import { strings } from "../../data/strings.ru";
import { FINGERS } from "../../recognition/features";
import c from "./Letters.module.css";

const MARKS_KEY = "gesturingo.phraseMarks";
const pct = (v: number) => Math.round(v * 100);

type Marks = Record<string, boolean>;

function loadMarks(): Marks {
  const initial: Marks = Object.fromEntries(PHRASES.map((p) => [p.id, p.verified]));
  try {
    return { ...initial, ...(JSON.parse(localStorage.getItem(MARKS_KEY) ?? "{}") as Marks) };
  } catch {
    return initial;
  }
}

/** The team's marks as the new value of PHRASE_OVERRIDES (other decisions kept). */
function exportText(marks: Marks): string {
  const out: Record<string, PhraseOverride> = {};
  for (const id of new Set([...PHRASES.map((p) => p.id), ...Object.keys(PHRASE_OVERRIDES)])) {
    const next: PhraseOverride = { ...PHRASE_OVERRIDES[id], verified: marks[id] === true };
    if (!next.verified) delete next.verified;
    if (Object.keys(next).length > 0) out[id] = next;
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

/**
 * «Фразы» on /letters (docs/TRANSLATOR_SPEC.md §9): every phrase built from Slovo with its
 * typical frame, finger shares and accuracy, a "checked" mark for the team, and the candidates
 * that did not make it with the reason.
 */
export function PhrasesTab() {
  const t = strings.lettersPage.phrases;
  const tl = strings.lettersPage;
  const [marks, setMarks] = useState<Marks>(loadMarks);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(MARKS_KEY, JSON.stringify(marks));
    } catch {
      // Storage unavailable: the export still works.
    }
  }, [marks]);

  return (
    <>
      <p className={c.intro}>{t.intro}</p>
      <div className={c.headActions}>
        <strong>{tl.progress(PHRASES.filter((p) => marks[p.id]).length, PHRASES.length)}</strong>
        <button type="button" className={c.small} onClick={() => setShowExport((v) => !v)}>
          {tl.export}
        </button>
      </div>
      {showExport && (
        <section className={c.export} aria-label={t.exportTitle}>
          <p>{t.exportTitle}</p>
          <textarea readOnly value={exportText(marks)} rows={8} />
        </section>
      )}

      {PHRASES.length === 0 && <p className={c.muted}>{t.none}</p>}
      <div className={c.grid}>
        {PHRASES.map((p) => {
          const info = PHRASE_BUILD_INFO[p.id];
          const verified = marks[p.id] === true;
          return (
            <article key={p.id} className={`${c.card} ${verified ? c.cardVerified : ""}`} aria-label={p.text}>
              <header className={c.cardHead}>
                <span className={c.letter}>{p.text}</span>
                <span className={verified ? c.badgeOk : c.badgeTodo}>{verified ? tl.verified : tl.notVerified}</span>
              </header>
              <div className={c.visuals}>
                {info?.reference.length ? (
                  <SkeletonPreview frame={info.reference} className={c.skeleton} />
                ) : (
                  <p className={c.muted}>{tl.noReference}</p>
                )}
              </div>
              <p className={c.meta}>
                {t.source(p.source.label)}
                {info && (
                  <>
                    <br />
                    {tl.accuracy(pct(info.accuracy), info.mode === "signer")}
                    <br />
                    {t.data(info.videos, info.signers, info.samples, pct(info.visible))}
                  </>
                )}
              </p>
              <table className={c.table}>
                <thead>
                  <tr>
                    <th scope="col">{tl.finger}</th>
                    <th scope="col">{tl.rule}</th>
                    <th scope="col">{tl.shares}</th>
                  </tr>
                </thead>
                <tbody>
                  {FINGERS.map((f) => {
                    const rule = p.handshape?.fingers[f];
                    const s = info?.stats.fingers[f].states;
                    return (
                      <tr key={f} className={rule ? undefined : c.freeRow}>
                        <th scope="row">{strings.fingers[f]}</th>
                        <td>{rule ? strings.fingerStates[rule.state] : tl.free}</td>
                        <td className={c.shares}>{s ? `${pct(s.straight)} / ${pct(s.half)} / ${pct(s.bent)}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className={c.meta}>
                {p.confusedWith?.length ? tl.similar(p.confusedWith.map(labelText).join(" · ")) : tl.noSimilar}
              </p>
              <div className={c.cardActions}>
                <label className={c.check}>
                  <input type="checkbox" checked={verified} onChange={() => setMarks((m) => ({ ...m, [p.id]: !verified }))} />
                  {t.markVerified}
                </label>
              </div>
            </article>
          );
        })}
      </div>

      <section className={c.unavailable}>
        <h2>{t.rejectedTitle(PHRASE_REJECTED.length)}</h2>
        <ul>
          {PHRASE_REJECTED.map((r) => (
            <li key={r.label}>
              <strong>{r.label}</strong> — {r.reason}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
