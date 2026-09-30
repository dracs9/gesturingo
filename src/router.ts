import { useSyncExternalStore } from "react";

export type Route =
  | { name: "welcome" }
  | { name: "tutorial" }
  | { name: "map" }
  | { name: "lesson"; lessonId: string }
  | { name: "results"; lessonId: string }
  | { name: "bridge" }
  | { name: "talk" }
  | { name: "talkSummary" }
  | { name: "record" }
  | { name: "letters" };

export const paths = {
  welcome: () => "/",
  tutorial: () => "/tutorial",
  map: () => "/map",
  lesson: (lessonId: string) => `/lesson/${encodeURIComponent(lessonId)}`,
  results: (lessonId: string) => `/results/${encodeURIComponent(lessonId)}`,
  bridge: () => "/bridge",
  talk: () => "/talk",
  talkSummary: () => "/talk/summary",
  record: () => "/record",
  letters: () => "/letters",
} as const;

/** Pure pathname → route mapping. Unknown paths fall back to Welcome. */
export function matchRoute(pathname: string): Route {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [head, param, ...rest] = parts;
  if (rest.length > 0) return { name: "welcome" };

  if (param === undefined) {
    switch (head) {
      case undefined:
        return { name: "welcome" };
      case "tutorial":
        return { name: "tutorial" };
      case "map":
        return { name: "map" };
      case "bridge":
        return { name: "bridge" };
      case "talk":
        return { name: "talk" };
      case "record":
        return { name: "record" };
      case "letters":
        return { name: "letters" };
    }
    return { name: "welcome" };
  }

  if (head === "talk" && param === "summary") return { name: "talkSummary" };
  if (head === "lesson") return { name: "lesson", lessonId: param };
  if (head === "results") return { name: "results", lessonId: param };
  return { name: "welcome" };
}

const NAVIGATE_EVENT = "gesturingo:navigate";

export function navigate(path: string, { replace = false } = {}): void {
  if (path === window.location.pathname) return;
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

const getPathname = () => window.location.pathname;

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, getPathname);
  return matchRoute(pathname);
}
