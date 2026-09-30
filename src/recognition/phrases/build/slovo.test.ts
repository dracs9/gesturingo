import { describe, expect, it } from "vitest";
import {
  estimateOffset,
  findKeys,
  localDataStart,
  matchArray,
  middlePart,
  parseAnnotations,
  parseCentralDirectory,
  parseEndOfDirectory,
  parseZip64Record,
  pickActiveHand,
  stillestFrames,
  wristSpread,
  type SlovoFrame,
  type SlovoPoint,
} from "./slovo";

/** Little-endian byte writer for hand-made zip structures. */
function bytes(parts: Array<[number, 2 | 4 | 8] | string>): Uint8Array {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") {
      out.push(...new TextEncoder().encode(p));
      continue;
    }
    const [value, size] = p;
    for (let i = 0; i < size; i++) out.push(Math.floor(value / 2 ** (8 * i)) % 256);
  }
  return new Uint8Array(out);
}

const ID_A = "44e8d2a0-7e01-450b-90b0-beb7400d2c1e";
const ID_B = "df5b08f0-41d1-4572-889c-8b893e71069b";

describe("slovo annotations", () => {
  it("parses the tab-separated file in row order", () => {
    const rows = parseAnnotations(
      "attachment_id\ttext\tuser_id\theight\twidth\tlength\ttrain\n" +
        `${ID_A}\tпривет!\tu1\t1920\t1080\t48.0\tTrue\n` +
        `${ID_B}\tда\tu2\t720\t1280\t38.0\tFalse\n`,
    );
    expect(rows).toEqual([
      { id: ID_A, text: "привет!", signer: "u1", width: 1080, height: 1920, length: 48, train: true, row: 0 },
      { id: ID_B, text: "да", signer: "u2", width: 1280, height: 720, length: 38, train: false, row: 1 },
    ]);
  });
});

describe("zip directory (ZIP64)", () => {
  it("finds the ZIP64 record through its locator", () => {
    const tail = bytes([[0, 4], [0x07064b50, 4], [0, 4], [15_856_884_000, 8], [1, 4]]);
    expect(parseEndOfDirectory(tail)).toEqual({ zip64RecordOffset: 15_856_884_000 });
  });

  it("reads a plain end of central directory", () => {
    const tail = bytes([[0x06054b50, 4], [0, 4], [1, 2], [1, 2], [120, 4], [5000, 4], [0, 2]]);
    expect(parseEndOfDirectory(tail)).toEqual({ cdSize: 120, cdOffset: 5000 });
  });

  it("reads the ZIP64 record and 64-bit entry fields", () => {
    const record = bytes([[0x06064b50, 4], [44, 8], [45, 2], [45, 2], [0, 4], [0, 4], [1, 8], [1, 8], [2_538_633, 8], [15_856_884_545, 8]]);
    expect(parseZip64Record(record)).toEqual({ cdSize: 2_538_633, cdOffset: 15_856_884_545 });

    const name = "annotations.csv";
    const entry = bytes([
      [0x02014b50, 4], [45, 2], [45, 2], [0, 2], [8, 2], [0, 2], [0, 2], [0, 4],
      [614_767, 4], [2_151_120, 4], [name.length, 2], [12, 2], [0, 2], [0, 2], [0, 2], [0, 4],
      [0xffffffff, 4], name, [0x0001, 2], [8, 2], [15_856_269_705, 8],
    ]);
    const [e] = parseCentralDirectory(entry);
    expect(e).toEqual({ name, offset: 15_856_269_705, compressedSize: 614_767, uncompressedSize: 2_151_120, method: 8 });

    const local = bytes([[0x04034b50, 4], [0, 8], [0, 8], [0, 4], [0, 2], [name.length, 2], [4, 2]]);
    expect(e && localDataStart(e, local)).toBe(15_856_269_705 + 30 + name.length + 4);
  });
});

describe("landmarks file chunks", () => {
  const frame = '{"hand 1": [{"x": 0.2, "y": 0.5, "z": 0.0}]}';
  const text = `{"${ID_A}": [${frame}, ${frame}], "${ID_B}": [${frame}]}`;

  it("finds video keys and the start of their arrays", () => {
    const keys = findKeys(text);
    expect(keys.map((k) => k.id)).toEqual([ID_A, ID_B]);
    expect(text[keys[0]?.arrayStart ?? -1]).toBe("[");
  });

  it("matches the closing bracket, or says the chunk is cut", () => {
    const [a] = findKeys(text);
    const end = matchArray(text, a?.arrayStart ?? 0);
    expect(JSON.parse(text.slice(a?.arrayStart, (end ?? 0) + 1))).toHaveLength(2);
    expect(matchArray(text.slice(0, 80), a?.arrayStart ?? 0)).toBeNull();
    expect(matchArray('["a]b", [1]]', 0)).toBe(11);
  });

  it("interpolates a row's offset between known anchors", () => {
    expect(estimateOffset(50, [], 100, 1000)).toBe(500);
    expect(estimateOffset(15, [{ row: 10, offset: 100 }, { row: 20, offset: 300 }], 100, 1000)).toBe(200);
    expect(estimateOffset(10, [{ row: 10, offset: 123 }], 100, 1000)).toBe(123);
  });
});

describe("one video", () => {
  const hand = (x: number, y: number, size = 0.1): SlovoPoint[] =>
    Array.from({ length: 21 }, (_, i) => ({ x: x + (i % 5) * 0.01, y: i === 0 ? y : y - size - (i % 4) * 0.01, z: 0 }));

  it("follows the raised hand and ignores the resting one", () => {
    const frames: SlovoFrame[] = [
      { "hand 1": hand(0.3, 0.95), "hand 2": hand(0.6, 0.5) },
      { "hand 1": hand(0.61, 0.52) },
      { "hand 1": hand(0.3, 0.95), "hand 2": hand(0.62, 0.53) },
    ];
    const { active, others } = pickActiveHand(frames, 1000, 1000);
    expect(active.map((h) => h[0]?.x)).toEqual([0.6, 0.61, 0.62]);
    expect(others.map((o) => o.length)).toEqual([1, 0, 1]);
  });

  it("measures how far the wrist wanders, in palm sizes", () => {
    const still = Array.from({ length: 10 }, () => hand(0.5, 0.5));
    const moving = Array.from({ length: 10 }, (_, i) => hand(0.3 + i * 0.05, 0.5));
    expect(wristSpread(still, 1000, 1000)).toBeCloseTo(0);
    expect(wristSpread(moving, 1000, 1000)).toBeGreaterThan(1);
  });

  it("keeps the middle of a clip and finds its stillest frames", () => {
    expect(middlePart([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([3, 4, 5, 6, 7, 8]);
    const vectors = [[0], [5], [5], [5], [9]];
    const wrists = vectors.map(() => ({ x: 0, y: 0 }));
    expect(stillestFrames(vectors, wrists, 1, 1)).toEqual([2]);
  });
});
