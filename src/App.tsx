import { useRoute } from "./router";
import { Bridge } from "./screens/Bridge";
import { ControlTutorial } from "./screens/ControlTutorial";
import { LevelMap } from "./screens/LevelMap";
import { Lesson } from "./screens/Lesson";
import { Record } from "./screens/Record";
import { Results } from "./screens/Results";
import { Welcome } from "./screens/Welcome";

export function App() {
  const route = useRoute();

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
