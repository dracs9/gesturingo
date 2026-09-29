import { describe, expect, it } from "vitest";
import pkg from "../package.json";
import { MEDIAPIPE_VERSION } from "./config";

describe("config", () => {
  it("loads MediaPipe wasm from the CDN with the same version as the installed JS", () => {
    // The JS API and the wasm binary must match exactly; package.json pins an exact version.
    expect(pkg.dependencies["@mediapipe/tasks-vision"]).toBe(MEDIAPIPE_VERSION);
  });
});
