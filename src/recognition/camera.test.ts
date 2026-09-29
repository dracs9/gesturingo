import { describe, expect, it } from "vitest";
import { CameraError, classifyCameraError } from "./camera";

const named = (name: string) => ({ name, message: "" });

describe("classifyCameraError", () => {
  it("detects denied permission", () => {
    expect(classifyCameraError(named("NotAllowedError"))).toBe("denied");
    expect(classifyCameraError(named("SecurityError"))).toBe("denied");
  });

  it("detects missing camera", () => {
    expect(classifyCameraError(named("NotFoundError"))).toBe("notFound");
    expect(classifyCameraError(named("OverconstrainedError"))).toBe("notFound");
  });

  it("detects busy camera", () => {
    expect(classifyCameraError(named("NotReadableError"))).toBe("busy");
    expect(classifyCameraError(named("AbortError"))).toBe("busy");
  });

  it("passes through CameraError codes", () => {
    expect(classifyCameraError(new CameraError("insecure"))).toBe("insecure");
  });

  it("falls back to unknown", () => {
    expect(classifyCameraError(named("WeirdError"))).toBe("unknown");
    expect(classifyCameraError("boom")).toBe("unknown");
    expect(classifyCameraError(null)).toBe("unknown");
  });
});
