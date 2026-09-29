import { describe, expect, it } from "vitest";
import {
  majorityHandedness,
  pickMedoid,
  referenceFileName,
  roundFrame,
  sampleFileName,
  serializeReferenceFile,
  serializeSampleFile,
} from "./samples";

describe("samples", () => {
  it("rounds frames to 4 decimals", () => {
    expect(roundFrame([0.123456, -1.00004, 2])).toEqual([0.1235, -1, 2]);
  });

  it("picks the most central frame as medoid", () => {
    expect(pickMedoid([[0], [1], [1.1], [0.9], [5]])).toBe(1);
    expect(pickMedoid([])).toBe(-1);
  });

  it("takes the majority handedness", () => {
    expect(majorityHandedness(["Left", "Left", "Right"])).toBe("Left");
    expect(majorityHandedness(["Left", "Right"])).toBe("Right");
  });

  it("builds file names", () => {
    expect(sampleFileName("А", "S01", new Date(2026, 8, 29, 7, 5, 3))).toBe("А_S01_20260929-070503.json");
    expect(sampleFileName("Б", "", new Date(2026, 0, 1))).toMatch(/^Б_anon_/);
    expect(referenceFileName("В")).toBe("В.json");
  });

  it("serializes valid JSON in the spec format", () => {
    const sample = { letter: "А", signer: "S01", handedness: "Right" as const, frames: [[1, 2, 3], [4, 5, 6]] };
    const text = serializeSampleFile(sample);
    expect(JSON.parse(text)).toEqual(sample);
    expect(text.split("\n").filter((l) => l.trim().startsWith("["))).toHaveLength(2);
    expect(JSON.parse(serializeSampleFile({ ...sample, frames: [] }))).toEqual({ ...sample, frames: [] });

    const ref = { letter: "А", signer: "S01", handedness: "Left" as const, frame: [0.1, 0.2] };
    expect(JSON.parse(serializeReferenceFile(ref))).toEqual(ref);
  });
});
