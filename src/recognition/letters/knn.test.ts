import { describe, expect, it } from "vitest";
import { createKnn, type LabeledVector } from "./knn";

const around = (label: string, center: number, n: number): LabeledVector[] =>
  Array.from({ length: n }, (_, i) => ({ label, vector: [center + i * 0.01, center, 0] }));

describe("knn", () => {
  const knn = createKnn([...around("А", 0, 6), ...around("Б", 5, 6)], 5);

  it("labels a vector by its nearest samples", () => {
    expect(knn.predict([0.02, 0, 0])?.label).toBe("А");
    expect(knn.predict([5.01, 5, 0])?.label).toBe("Б");
    expect(knn.predict([0, 0, 0])?.votes).toEqual({ А: 5 });
  });

  it("returns k neighbours sorted by distance", () => {
    const p = knn.predict([0.03, 0, 0]);
    expect(p?.neighbors).toHaveLength(5);
    const d = p?.neighbors.map((n) => n.distance) ?? [];
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(d[0]).toBeCloseTo(0);
  });

  it("votes by majority and ranks labels", () => {
    const mixed = createKnn([...around("А", 0, 3), ...around("Б", 1, 3)], 5);
    const p = mixed.predict([0.2, 0.2, 0]);
    expect(p?.label).toBe("А");
    expect(p?.ranking).toEqual([
      { label: "А", votes: 3 },
      { label: "Б", votes: 2 },
    ]);
  });

  it("ranks every label by its closest sample", () => {
    const p = knn.predict([0, 1, 0]);
    expect(p?.nearestByLabel.map((n) => n.label)).toEqual(["А", "Б"]);
    expect(p?.nearestByLabel[0]?.distance).toBeCloseTo(1);
    expect(p?.nearestByLabel[1]?.distance).toBeCloseTo(Math.hypot(5, 4));
  });

  it("knows its labels and handles no samples", () => {
    expect([...knn.labels].sort()).toEqual(["А", "Б"]);
    expect(knn.size).toBe(12);
    expect(createKnn([]).predict([0, 0, 0])).toBeNull();
  });
});
