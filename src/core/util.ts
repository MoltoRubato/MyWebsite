/* ============================================================
   Tiny shared helpers. `pick` was previously redefined in chess.js,
   workout.js, and inline in music.js — now there's one of each.
   ============================================================ */

/** A random element of a non-empty array. */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Clamp `v` into the inclusive range [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
