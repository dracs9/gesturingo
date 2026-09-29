import { describe, expect, it } from "vitest";
import { createStableValue } from "./smoothing";

describe("createStableValue", () => {
  it("keeps the old value until the new one persists", () => {
    const s = createStableValue("a", 100);
    expect(s.update("b", 0)).toBe("a");
    expect(s.update("b", 50)).toBe("a");
    expect(s.update("b", 100)).toBe("b");
    expect(s.value).toBe("b");
  });

  it("suppresses flip-flopping", () => {
    const s = createStableValue("a", 100);
    s.update("b", 0);
    s.update("a", 60);
    expect(s.update("b", 120)).toBe("a");
    expect(s.update("b", 219)).toBe("a");
    expect(s.update("b", 220)).toBe("b");
  });

  it("restarts the timer when the candidate changes", () => {
    const s = createStableValue(1, 100);
    s.update(2, 0);
    s.update(3, 80);
    expect(s.update(3, 150)).toBe(1);
    expect(s.update(3, 180)).toBe(3);
  });
});
