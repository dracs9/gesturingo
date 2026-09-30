import { describe, expect, it } from "vitest";
import { matchRoute, paths } from "./router";

describe("matchRoute", () => {
  it("maps static routes", () => {
    expect(matchRoute("/")).toEqual({ name: "welcome" });
    expect(matchRoute("/tutorial")).toEqual({ name: "tutorial" });
    expect(matchRoute("/map")).toEqual({ name: "map" });
    expect(matchRoute("/bridge")).toEqual({ name: "bridge" });
    expect(matchRoute("/talk")).toEqual({ name: "talk" });
    expect(matchRoute("/record")).toEqual({ name: "record" });
    expect(matchRoute("/letters")).toEqual({ name: "letters" });
  });

  it("extracts lesson id", () => {
    expect(matchRoute("/lesson/1")).toEqual({ name: "lesson", lessonId: "1" });
    expect(matchRoute("/results/abc")).toEqual({ name: "results", lessonId: "abc" });
  });

  it("ignores trailing slash", () => {
    expect(matchRoute("/map/")).toEqual({ name: "map" });
    expect(matchRoute("/lesson/2/")).toEqual({ name: "lesson", lessonId: "2" });
  });

  it("falls back to welcome for unknown paths", () => {
    expect(matchRoute("/garbage")).toEqual({ name: "welcome" });
    expect(matchRoute("/map/extra")).toEqual({ name: "welcome" });
    expect(matchRoute("/lesson/1/extra")).toEqual({ name: "welcome" });
    expect(matchRoute("/lesson")).toEqual({ name: "welcome" });
  });

  it("round-trips paths helpers", () => {
    expect(matchRoute(paths.lesson("урок 1"))).toEqual({ name: "lesson", lessonId: "урок 1" });
    expect(matchRoute(paths.results("7"))).toEqual({ name: "results", lessonId: "7" });
    expect(matchRoute(paths.record())).toEqual({ name: "record" });
    expect(matchRoute(paths.letters())).toEqual({ name: "letters" });
  });
});
