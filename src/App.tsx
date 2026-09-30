import { useEffect, useMemo } from "react";
import s from "./App.module.css";
import { CameraView } from "./components/CameraView";
import { DebugPanel } from "./components/DebugPanel";
import { GestureLayer } from "./components/GestureLayer";
import { GestureLegend } from "./components/GestureLegend";
import { HandStatus } from "./components/HandStatus";
import { isDebug } from "./config";
import { strings } from "./data/strings.ru";
import { getGestureContext } from "./recognition/gestureContext";
import { useRoute, type Route } from "./router";
import { Bridge } from "./screens/Bridge";
import { ControlTutorial } from "./screens/ControlTutorial";
import { LevelMap } from "./screens/LevelMap";
import { Lesson } from "./screens/Lesson";
import { Letters } from "./screens/Letters";
import { Record } from "./screens/Record";
import { Results } from "./screens/Results";
import { Talk } from "./screens/Talk";
import { TalkSummary } from "./screens/TalkSummary";
import { Welcome } from "./screens/Welcome";
import { useSession } from "./store/session";
import { useUi } from "./store/ui";

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
    case "talk":
      return <Talk />;
    case "talkSummary":
      return <TalkSummary />;
    case "record":
      return <Record />;
    case "letters":
      return <Letters />;
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

  useEffect(() => {
    document.title = strings.titles[route.name];
  }, [route.name]);
  const cameraStatus = useSession((st) => st.cameraStatus);
  const startCamera = useSession((st) => st.startCamera);

  // /letters shows its grid without a camera; its live check starts the camera on a click.
  const needsCamera = route.name !== "welcome" && route.name !== "letters";
  const ready = cameraStatus === "ready";
  const gestureOverride = useUi((st) => st.gestureOverride);
  const dockHidden = useUi((st) => st.dockHidden);
  const gestureContext = useMemo(
    () => ({ ...getGestureContext(route.name), ...gestureOverride }),
    [route.name, gestureOverride],
  );

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
          {!dockHidden && (
            <div className={s.dock}>
              <CameraView variant="mini" />
            </div>
          )}
          {/* Talk shows its own legend: command zones instead of the cursor. */}
          {route.name !== "talk" && <GestureLegend context={gestureContext} compact={dockHidden} />}
          <GestureLayer context={gestureContext} />
        </>
      )}
      {debug && ready && <DebugPanel />}
    </>
  );
}
