/* ============================================================
   World + input constants shared across modules. Centralised here
   so the tile size and direction maps live in exactly one place
   (previously duplicated across world.js, hitboxes.js, game.js,
   and workout.js).
   ============================================================ */
import type { Dir } from "./types";

/** Tile size in px, and the room grid dimensions. Canvas is 960x640. */
export const TS = 32;
export const COLS = 30;
export const ROWS = 20;

/** Lowercased arrow/WASD key -> facing direction. */
export const KEY_DIR: Record<string, Dir> = {
  arrowleft: "left",
  a: "left",
  arrowup: "up",
  w: "up",
  arrowright: "right",
  d: "right",
  arrowdown: "down",
  s: "down",
};

/** Glyph per direction (touch d-pad + workout combo arrows). */
export const DIR_GLYPH: Record<Dir, string> = {
  left: "◀",
  up: "▲",
  right: "▶",
  down: "▼",
};
