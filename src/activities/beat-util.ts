/* ============================================================
   BEAT-UTIL — pure (de)serialization for the beat pad's auto-save.
   Kept DOM-free so vitest covers it without a browser.
   Format v1: { v: 1, bpm, rows: ["01010101", ...] } — one string of
   "0"/"1" per instrument row, top row first.
   ============================================================ */

export const BPM_MIN = 70;
export const BPM_MAX = 160;

export function serializePattern(pattern: boolean[][], bpm: number): string {
  return JSON.stringify({ v: 1, bpm, rows: pattern.map((row) => row.map((c) => (c ? "1" : "0")).join("")) });
}

/** Parse a saved pattern; null on ANY malformed/legacy input (caller starts fresh). */
export function parsePattern(raw: string | null, rows: number, cols: number): { bpm: number; pattern: boolean[][] } | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { v?: number; bpm?: number; rows?: unknown };
    if (!d || d.v !== 1 || !Array.isArray(d.rows) || d.rows.length !== rows) return null;
    const pattern: boolean[][] = [];
    for (const r of d.rows) {
      if (typeof r !== "string" || r.length !== cols || /[^01]/.test(r)) return null;
      pattern.push([...r].map((ch) => ch === "1"));
    }
    const bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(Number(d.bpm) || 110)));
    return { bpm, pattern };
  } catch {
    return null;
  }
}
