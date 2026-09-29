import { describe, expect, it } from "vitest";
import { exportOverrides, overridesText } from "./overridesExport";

describe("exportOverrides", () => {
  it("marks checked letters and keeps the team's other fields", () => {
    const out = exportOverrides(["Б", "А", "В"], { А: true, В: true }, { В: { confusedWith: ["Т"] } });
    expect(out).toEqual({ А: { verified: true }, В: { confusedWith: ["Т"], verified: true } });
    expect(Object.keys(out)).toEqual(["А", "В"]);
  });

  it("drops a stale verified flag but keeps other overrides", () => {
    const out = exportOverrides(["А", "Б"], { А: false }, { А: { verified: true }, Б: { verified: true, confusedWith: [] } });
    expect(out).toEqual({ Б: { confusedWith: [] } });
  });

  it("produces JSON that parses back", () => {
    const out = exportOverrides(["Я", "А"], { Я: true, А: true }, {});
    expect(JSON.parse(overridesText(out))).toEqual(out);
    expect(Object.keys(out)).toEqual(["А", "Я"]);
  });
});
