import { useEffect } from "react";
import s from "./App.module.css";
import { CameraView } from "./components/CameraView";
import { DebugPanel } from "./components/DebugPanel";
import { HandStatus } from "./components/HandStatus";
import { isDebug } from "./config";
import { useRoute, type Route } from "./router";
import { Bridge } from "./screens/Bridge";
import { ControlTutorial } from "./screens/ControlTutorial";
import { LevelMap } from "./screens/LevelMap";
import { Lesson } from "./screens/Lesson";
import { Record } from "./screens/Record";
import { Results } from "./screens/Results";
import { Welcome } from "./screens/Welcome";
import { useSession } from "./store/session";

const debug = isDebug();

function renderScreen(route: Route) {
  switch (route.name) {
    case "welcome":
      return <Welcome />;
    case "tutorial":
      return <ControlTutorial />;
    case "map":
      return <LevelMap />;
    case "lesson":
      return <Lesson key={route.lessonId} lessonId={route.lessonId} />;
    case "results":
      return <Results lessonId={route.lessonId} />;
    case "bridge":
      return <Bridge />;
    case "record":
      return <Record />;
  }
}

async function isCameraPermissionGranted(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: "camera" as PermissionName });
    return status.state === "granted";
  } catch {
    return false; // Permissions API or the "camera" name is unsupported (older Safari/Firefox).
  }
}

export function App() {
  const route = useRoute();
  const cameraStatus = useSession((st) => st.cameraStatus);
  const startCamera = useSession((st) => st.startCamera);

  const needsCamera = route.name !== "welcome";
  const ready = cameraStatus === "ready";

  // After a reload on an inner screen, restart the camera silently if permission was already given.
  useEffect(() => {
    if (!needsCamera || cameraStatus !== "idle") return;
    let cancelled = false;
    void isCameraPermissionGranted().then((granted) => {
      if (granted && !cancelled) void startCamera();
    });
    return () => {
      cancelled = true;
    };
  }, [needsCamera, cameraStatus, startCamera]);

  return (
    <>
      {needsCamera && !ready ? <Welcome gate /> : renderScreen(route)}
      {ready && (
        <>
          <div className={s.status}>
            <HandStatus />
          </div>
          {route.name !== "record" && (
            <div className={s.dock}>
              <CameraView variant="mini" />
            </div>
          )}
        </>
      )}
      {debug && ready && <DebugPanel />}
    </>
  );
}
