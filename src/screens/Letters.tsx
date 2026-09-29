import { useEffect, useRef, useState } from "react";
import { GestureButton } from "../components/GestureButton";
import { DYNAMIC_LETTERS } from "../data/dynamicLetters";
import { EXCLUDED_LETTERS } from "../data/excludedLetters";
import { LETTER_BUILD_INFO } from "../data/letters.generated";
import { LETTER_OVERRIDES } from "../data/letters.overrides";
import { LETTERS } from "../data/letters";
import { exportOverrides, overridesText } from "../data/overridesExport";
import { strings } from "../data/strings.ru";
import { navigate, paths } from "../router";
import { useGestureCommands } from "../store/gestureCommands";
import { LetterCard } from "./letters/LetterCard";
import { LetterLive } from "./letters/LetterLive";
import c from "./letters/Letters.module.css";

const MARKS_KEY = "gesturingo.letterMarks";

type Marks = Record<string, boolean>;

/** Marks start from the specs (overrides may already say verified) and survive a reload. */
function loadMarks(): Marks {
  const initial: Marks = Object.fromEntries(LETTERS.map((l) => [l.letter, l.verified]));
  try {
    const saved = JSON.parse(localStorage.getItem(MARKS_KEY) ?? "{}") as Marks;
    return { ...initial, ...saved };
  } catch {
    return initial;
  }
}

function saveMarks(marks: Marks): void {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify(marks));
  } catch {
    // Storage unavailable (private mode): marks live until the tab closes — the export still works.
  }
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Service page: the team checks every generated letter against the official table. Reachable only by URL `/letters`.
export function Letters() {
  const t = strings.lettersPage;
  const [marks, setMarks] = useState<Marks>(loadMarks);
  const [live, setLive] = useState<string | null>(null);
  const [exportText, setExportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => saveMarks(marks), [marks]);
  useGestureCommands({ back: live ? undefined : () => navigate(paths.map()) });

  const toggle = (letter: string) => setMarks((m) => ({ ...m, [letter]: !m[letter] }));

  if (live) {
    return (
      <LetterLive
        letter={live}
        verified={marks[live] ?? false}
        onLetter={setLive}
        onToggleVerified={() => toggle(live)}
        onExit={() => setLive(null)}
      />
    );
  }

  const done = LETTERS.filter((l) => marks[l.letter]).length;

  const openExport = () => {
    setCopied(false);
    setExportText(
      overridesText(
        exportOverrides(
          LETTERS.map((l) => l.letter),
          marks,
          LETTER_OVERRIDES,
        ),
      ),
    );
  };

  const copy = async () => {
    if (!exportText) return;
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
    } catch {
      // Clipboard blocked (http, old Safari): select the text so Ctrl+C works.
      textRef.current?.select();
    }
  };

  return (
    <main className={c.page}>
      <header className={c.head}>
        <div>
          <h1 className={c.title}>{t.title}</h1>
          <p className={c.intro}>{t.intro}</p>
        </div>
        <div className={c.headActions}>
          <strong>{t.progress(done, LETTERS.length)}</strong>
          <GestureButton variant="primary" className={c.small} onClick={openExport}>
            {t.export}
          </GestureButton>
        </div>
      </header>

      {exportText !== null && (
        <section className={c.export} aria-label={t.exportTitle}>
          <p>{t.exportTitle}</p>
          <textarea ref={textRef} readOnly value={exportText} rows={Math.min(16, exportText.split("\n").length)} />
          <div className={c.cardActions}>
            <GestureButton className={c.small} onClick={() => void copy()}>
              {copied ? t.copied : t.copy}
            </GestureButton>
            <GestureButton className={c.small} onClick={() => download("letters.overrides.json", exportText)}>
              {t.download}
            </GestureButton>
            <GestureButton className={c.small} onClick={() => setExportText(null)}>
              {t.close}
            </GestureButton>
          </div>
        </section>
      )}

      <div className={c.grid}>
        {LETTERS.map((spec) => (
          <LetterCard
            key={spec.letter}
            spec={spec}
            info={LETTER_BUILD_INFO[spec.letter]}
            verified={marks[spec.letter] ?? false}
            onToggleVerified={() => toggle(spec.letter)}
            onTryLive={() => setLive(spec.letter)}
          />
        ))}
      </div>

      <section className={c.unavailable}>
        <h2>{t.unavailableTitle}</h2>
        <p>{t.dynamic(DYNAMIC_LETTERS.join(" · "))}</p>
        <p>{t.excluded(EXCLUDED_LETTERS.join(" · "))}</p>
      </section>
    </main>
  );
}
