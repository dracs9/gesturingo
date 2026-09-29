import { useEffect, useState } from "react";
import { GestureButton } from "../../components/GestureButton";
import { LETTERS } from "../../data/letters";
import { loadLetterModels, type LetterModels } from "../../data/samples";
import { strings } from "../../data/strings.ru";
import { useGestureCommands } from "../../store/gestureCommands";
import { useSession } from "../../store/session";
import { useUi } from "../../store/ui";
import { LetterStep } from "../lesson/LetterStep";
import c from "./Letters.module.css";

interface LetterLiveProps {
  letter: string;
  verified: boolean;
  onLetter(letter: string): void;
  onToggleVerified(): void;
  onExit(): void;
}

/** Live check of one letter, exactly as in a lesson (rules + kNN + hints); a success starts it over. */
export function LetterLive({ letter, verified, onLetter, onToggleVerified, onExit }: LetterLiveProps) {
  const t = strings.lettersPage;
  const cameraStatus = useSession((st) => st.cameraStatus);
  const cameraError = useSession((st) => st.cameraError);
  const startCamera = useSession((st) => st.startCamera);
  const setGestureOverride = useUi((st) => st.setGestureOverride);
  const setDockHidden = useUi((st) => st.setDockHidden);
  const [attempt, setAttempt] = useState(0);
  const [models, setModels] = useState<LetterModels | null>(null);

  useEffect(() => {
    void startCamera();
  }, [startCamera]);

  // Like a lesson: no cursor, the letter is being shown; the open palm (3 s) goes back to the grid.
  useEffect(() => {
    setGestureOverride({ cursor: false, dwell: false, ok: false, letters: "current" });
    setDockHidden(true);
    return () => {
      setGestureOverride(null);
      setDockHidden(false);
    };
  }, [setGestureOverride, setDockHidden]);
  useGestureCommands({ back: onExit });

  useEffect(() => {
    let cancelled = false;
    void loadLetterModels().then((m) => {
      if (!cancelled) setModels(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const index = LETTERS.findIndex((l) => l.letter === letter);
  const spec = LETTERS[index];
  const go = (step: number) => {
    const next = LETTERS[(index + step + LETTERS.length) % LETTERS.length];
    if (next) {
      setAttempt(0);
      onLetter(next.letter);
    }
  };

  return (
    <main>
      <nav className={c.liveBar}>
        {/* Mouse only: the hand is busy showing the letter. */}
        <GestureButton noGesture className={c.small} onClick={onExit}>
          {t.back}
        </GestureButton>
        <GestureButton noGesture className={c.small} onClick={() => go(-1)}>
          {t.prev}
        </GestureButton>
        <GestureButton noGesture className={c.small} onClick={() => go(1)}>
          {t.next}
        </GestureButton>
        <label className={c.check}>
          <input type="checkbox" checked={verified} onChange={onToggleVerified} />
          {t.markVerified}
        </label>
        <span className={c.muted}>{t.liveHint}</span>
      </nav>

      {cameraStatus === "ready" && spec ? (
        <LetterStep
          key={`${letter}-${attempt}`}
          spec={spec}
          index={index}
          total={LETTERS.length}
          models={models}
          onDone={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <p className={c.status} role={cameraStatus === "error" ? "alert" : "status"}>
          {cameraStatus === "error" && cameraError ? `⚠️ ${strings.cameraErrors[cameraError]}` : t.cameraStarting}
        </p>
      )}
    </main>
  );
}
