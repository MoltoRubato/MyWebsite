import { describe, it, expect } from "vitest";
import { serializePattern, parsePattern } from "./beat-util";

const DRUMS = 5, KEYS = 8, COLS = 8;
function grid(rows: number, on: [number, number][]): boolean[][] {
  const p = Array.from({ length: rows }, () => Array<boolean>(COLS).fill(false));
  for (const [r, c] of on) p[r][c] = true;
  return p;
}

describe("beat-util", () => {
  it("round-trips both grids + bpm", () => {
    const drums = grid(DRUMS, [[0, 0], [4, 7]]);
    const keys = grid(KEYS, [[2, 3], [7, 0]]);
    const parsed = parsePattern(serializePattern(drums, keys, 128), DRUMS, KEYS, COLS);
    expect(parsed).not.toBeNull();
    expect(parsed!.bpm).toBe(128);
    expect(parsed!.drums).toEqual(drums);
    expect(parsed!.keys).toEqual(keys);
  });

  it("clamps bpm into range", () => {
    const raw = serializePattern(grid(DRUMS, []), grid(KEYS, []), 999);
    expect(parsePattern(raw, DRUMS, KEYS, COLS)!.bpm).toBe(160);
    const low = serializePattern(grid(DRUMS, []), grid(KEYS, []), 1);
    expect(parsePattern(low, DRUMS, KEYS, COLS)!.bpm).toBe(70);
  });

  it("rejects garbage, wrong shapes, and v1 saves", () => {
    expect(parsePattern(null, DRUMS, KEYS, COLS)).toBeNull();
    expect(parsePattern("not json", DRUMS, KEYS, COLS)).toBeNull();
    // legacy v1 (single grid) must not hydrate
    const v1 = JSON.stringify({ v: 1, bpm: 110, rows: Array(6).fill("00000000") });
    expect(parsePattern(v1, DRUMS, KEYS, COLS)).toBeNull();
    // wrong row counts / lengths / characters
    expect(parsePattern(JSON.stringify({ v: 2, bpm: 110, drums: Array(4).fill("00000000"), keys: Array(KEYS).fill("00000000") }), DRUMS, KEYS, COLS)).toBeNull();
    expect(parsePattern(JSON.stringify({ v: 2, bpm: 110, drums: Array(DRUMS).fill("0000"), keys: Array(KEYS).fill("00000000") }), DRUMS, KEYS, COLS)).toBeNull();
    expect(parsePattern(JSON.stringify({ v: 2, bpm: 110, drums: Array(DRUMS).fill("0000000x"), keys: Array(KEYS).fill("00000000") }), DRUMS, KEYS, COLS)).toBeNull();
  });

  it("defaults a missing bpm to 110", () => {
    const raw = JSON.stringify({ v: 2, drums: Array(DRUMS).fill("10101010"), keys: Array(KEYS).fill("00000000") });
    expect(parsePattern(raw, DRUMS, KEYS, COLS)!.bpm).toBe(110);
  });
});
