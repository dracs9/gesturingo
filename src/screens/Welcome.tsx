import { useEffect } from "react";
import { strings } from "../data/strings.ru";
import { preloadTracker } from "../recognition/pipeline";
import { navigate, paths } from "../router";
import { useSession } from "../store/session";
import s from "./Screen.module.css";
import w from "./Welcome.module.css";

interface WelcomeProps {
  /** Rendered in place of another screen that needs the camera: stay on that route once it starts. */
  gate?: boolean;
}

export function Welcome({ gate = false }: WelcomeProps) {
  const cameraStatus = useSession((st) => st.cameraStatus);
  const cameraError = useSession((st) => st.cameraError);
  const startCamera = useSession((st) => st.startCamera);

  useEffect(() => {
    // Start downloading the model right away so it is ready by the time the camera is allowed.
    preloadTracker().catch(() => {});
  }, []);

  const busy = cameraStatus === "requesting" || cameraStatus === "loadingModel";

  const onStart = async () => {
    await startCamera();
    if (!gate && useSession.getState().cameraStatus === "ready") navigate(paths.tutorial());
  };

  const label =
    cameraStatus === "ready"
      ? strings.welcome.start
      : cameraStatus === "error"
        ? strings.welcome.tryAgain
        : strings.welcome.enableCamera;

  return (
    <main className={s.screen}>
      <h1 className={s.title}>{strings.welcome.title}</h1>
      <p className={s.text}>{gate ? strings.welcome.gateText : strings.welcome.description}</p>

      <div className={s.actions}>
        <button className={`${s.button} ${s.primary}`} onClick={onStart} disabled={busy}>
          {label}
        </button>
      </div>

      {busy && (
        <p className={w.status} role="status">
          <span className={w.spinner} aria-hidden="true" />
          {cameraStatus === "requesting" ? strings.welcome.requesting : strings.welcome.loadingModel}
        </p>
      )}

      {cameraStatus === "error" && cameraError && (
        <p className={w.error} role="alert">
          <span aria-hidden="true">⚠️</span> {strings.cameraErrors[cameraError]}
        </p>
      )}

      <p className={s.text}>{strings.welcome.privacy}</p>
    </main>
  );
}
