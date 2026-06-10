import { describe, it, expect } from "vitest";
import { serializePattern, parsePattern } from "./beat-util";

const ROWS = 6, COLS = 8;
function pat(on: [number, number][]): boolean[][] {
  const p = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  for (const [r, c] of on) p[r][c] = true;
  return p;
}

describe("beat-util", () => {
  it("round-trips a pattern + bpm", () => {
    const p = pat([[0, 0], [5, 7], [3, 4]]);
    const parsed = parsePattern(serializePattern(p, 128), ROWS, COLS);
    expect(parsed).not.toBeNull();
    expect(parsed!.bpm).toBe(128);
    expect(parsed!.pattern).toEqual(p);
  });

  it("clamps bpm into range", () => {
    const raw = serializePattern(pat([]), 999);
    expect(parsePattern(raw, ROWS, COLS)!.bpm).toBe(160);
    const low = serializePattern(pat([]), 1);
    expect(parsePattern(low, ROWS, COLS)!.bpm).toBe(70);
  });

  it("rejects garbage, wrong shapes, and legacy data", () => {
    expect(parsePattern(null, ROWS, COLS)).toBeNull();
    expect(parsePattern("not json", ROWS, COLS)).toBeNull();
    expect(parsePattern('{"v":2,"rows":[]}', ROWS, COLS)).toBeNull();
    // legacy 4-row save must not hydrate a 6-row grid
    const legacy = JSON.stringify({ v: 1, bpm: 110, rows: ["00000000", "00000000", "00000000", "00000000"] });
    expect(parsePattern(legacy, ROWS, COLS)).toBeNull();
    // wrong row length / bad characters
    expect(parsePattern(JSON.stringify({ v: 1, bpm: 110, rows: Array(ROWS).fill("0000") }), ROWS, COLS)).toBeNull();
    expect(parsePattern(JSON.stringify({ v: 1, bpm: 110, rows: Array(ROWS).fill("0000000x") }), ROWS, COLS)).toBeNull();
  });

  it("defaults a missing bpm to 110", () => {
    const raw = JSON.stringify({ v: 1, rows: Array(ROWS).fill("10101010") });
    expect(parsePattern(raw, ROWS, COLS)!.bpm).toBe(110);
  });
});
