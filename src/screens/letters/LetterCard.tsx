import { GestureButton } from "../../components/GestureButton";
import { SkeletonPreview } from "../../components/SkeletonPreview";
import { getReference } from "../../data/references";
import { strings } from "../../data/strings.ru";
import { FINGERS } from "../../recognition/features";
import type { LetterBuildInfo } from "../../recognition/letters/build/info";
import type { LetterSpec } from "../../recognition/letters/spec";
import c from "./Letters.module.css";

const LOW_ACCURACY = 0.7;
const pct = (v: number) => Math.round(v * 100);

interface LetterCardProps {
  spec: LetterSpec;
  info: LetterBuildInfo | undefined;
  verified: boolean;
  onToggleVerified(): void;
  onTryLive(): void;
}

/** One letter for the team to check against the official table: sample, rules and the data behind them. */
export function LetterCard({ spec, info, verified, onToggleVerified, onTryLive }: LetterCardProps) {
  const t = strings.lettersPage;
  const reference = getReference(spec.letter)?.frame ?? null;
  const touches = (spec.extra ?? []).flatMap((e) =>
    e.type === "tipsTouch" ? [`${strings.fingers[e.a].toLowerCase()} + ${strings.fingers[e.b].toLowerCase()}`] : [],
  );
  const low = info !== undefined && info.accuracy < LOW_ACCURACY;

  return (
    <article className={`${c.card} ${verified ? c.cardVerified : ""}`} aria-label={spec.letter}>
      <header className={c.cardHead}>
        <span className={c.letter}>{spec.letter}</span>
        <span className={verified ? c.badgeOk : c.badgeTodo}>{verified ? t.verified : t.notVerified}</span>
      </header>

      {reference ? (
        <SkeletonPreview frame={reference} className={c.skeleton} />
      ) : (
        <p className={c.muted}>{t.noReference}</p>
      )}

      {info && (
        <p className={c.meta}>
          <span className={low ? c.warn : undefined}>
            {t.accuracy(pct(info.accuracy), info.mode === "signer")} {low && t.lowAccuracy}
          </span>
          <br />
          {t.samples(
            info.samples,
            info.signers,
            Object.entries(info.sources)
              .map(([source, n]) => `${source} ${n}`)
              .join(", "),
          )}
        </p>
      )}

      <table className={c.table}>
        <thead>
          <tr>
            <th scope="col">{t.finger}</th>
            <th scope="col">{t.rule}</th>
            <th scope="col">{t.shares}</th>
          </tr>
        </thead>
        <tbody>
          {FINGERS.map((f) => {
            const rule = spec.fingers[f];
            const s = info?.stats.fingers[f].states;
            return (
              <tr key={f} className={rule ? undefined : c.freeRow}>
                <th scope="row">{strings.fingers[f]}</th>
                <td>{rule ? strings.fingerStates[rule.state] : t.free}</td>
                <td className={c.shares}>{s ? `${pct(s.straight)} / ${pct(s.half)} / ${pct(s.bent)}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {touches.length > 0 && <p className={c.meta}>{t.touches(touches.join("; "))}</p>}
      <p className={c.meta}>{spec.confusedWith?.length ? t.similar(spec.confusedWith.join(" · ")) : t.noSimilar}</p>

      <div className={c.cardActions}>
        <label className={c.check}>
          <input type="checkbox" checked={verified} onChange={onToggleVerified} />
          {t.markVerified}
        </label>
        <GestureButton className={c.small} onClick={onTryLive}>
          {t.tryLive}
        </GestureButton>
      </div>
    </article>
  );
}
