/* ============================================================
   BEAT-UTIL — pure (de)serialization for the step sequencer's
   auto-save. Kept DOM-free so vitest covers it without a browser.
   Format v2: { v: 2, bpm, drums: ["01010101", ...], keys: [...] }
   — one "0"/"1" string per row, top row first. v1 saves (the old
   4-row blip pad) are deliberately not migrated.
   ============================================================ */

export const BPM_MIN = 70;
export const BPM_MAX = 160;

export function serializePattern(drums: boolean[][], keys: boolean[][], bpm: number): string {
  const rows = (p: boolean[][]): string[] => p.map((row) => row.map((c) => (c ? "1" : "0")).join(""));
  return JSON.stringify({ v: 2, bpm, drums: rows(drums), keys: rows(keys) });
}

function parseRows(raw: unknown, rows: number, cols: number): boolean[][] | null {
  if (!Array.isArray(raw) || raw.length !== rows) return null;
  const out: boolean[][] = [];
  for (const r of raw) {
    if (typeof r !== "string" || r.length !== cols || /[^01]/.test(r)) return null;
    out.push([...r].map((ch) => ch === "1"));
  }
  return out;
}

/** Parse a saved pattern; null on ANY malformed/legacy input (caller starts fresh). */
export function parsePattern(
  raw: string | null,
  drumRows: number,
  keyRows: number,
  cols: number,
): { bpm: number; drums: boolean[][]; keys: boolean[][] } | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { v?: number; bpm?: number; drums?: unknown; keys?: unknown };
    if (!d || d.v !== 2) return null;
    const drums = parseRows(d.drums, drumRows, cols);
    const keys = parseRows(d.keys, keyRows, cols);
    if (!drums || !keys) return null;
    const bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(d.bpm) || 110)));
    return { bpm, drums, keys };
  } catch {
    return null;
  }
}
