/* ============================================================
   HITBOXES — free-form (pixel) collision + depth layer data.
   Data lives in world pixels (the 960x640 room space).
   Editable live via the editor (press 'H', then Edit).

   Shape per room:
     { solids: [ {x,y,w,h}, ... ],                  // collision blockers
       depth:  [ {x,y,w,h, baseY, src, label}, ...] } // Y-sorted art

   A depth box re-draws a patch of the room art, sorted against the
   player by its baseY (the object's "feet" line). The player passes
   BEHIND it when standing above baseY, IN FRONT when below. Each box
   samples BOTH <Room>_props.png and <Room>_top.png, so 'src' is
   informational only.

   Every room ships hand-traced `solids`, so the old tile-grid fallback
   (and the js/collision.js bitstrings it parsed) is gone.
   ============================================================ */
import type { Dir, RoomKey } from "./core/types";

const TS = 32;
// v4: the baked-in default config. Reading only v4 means older cached edits
// (v2/v3) no longer shadow these defaults.
const LS_KEY = "ryanworld_hitboxes_v4";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DepthBox extends Rect {
  baseY: number;
  src?: string;
  label?: string;
}
export interface Door extends Rect {
  to: string;
}
export interface Spawn {
  x: number;
  y: number;
  face: Dir;
}
export interface RoomData {
  solids: Rect[];
  depth: DepthBox[];
  doors: Door[];
  spawn: Spawn;
}

const ROOM_KEYS: RoomKey[] = ["lounge", "gym", "game", "music"];

// Entrance hitboxes (world px rects) that send the player to another room,
// + one spawn point per room. Seeded from the in-editor export; fully editable.
const SEED_DOORS: Record<RoomKey, Door[]> = {
  lounge: [
    { x: 416, y: 128, w: 96, h: 22, to: "gym" },
    { x: 224, y: 256, w: 13, h: 128, to: "game" },
    { x: 691, y: 256, w: 13, h: 128, to: "music" },
  ],
  gym: [{ x: 513, y: 367, w: 95, h: 34, to: "lounge" }],
  game: [{ x: 630, y: 255, w: 43, h: 130, to: "lounge" }],
  music: [{ x: 224, y: 223, w: 42, h: 129, to: "lounge" }],
};
const SEED_SPAWN: Record<RoomKey, Spawn> = {
  lounge: { x: 467, y: 220, face: "down" },
  gym: { x: 560, y: 343, face: "up" },
  game: { x: 605, y: 319, face: "left" },
  music: { x: 289, y: 288, face: "right" },
};

// Depth boxes — baseY is each object's feet line for Y-sorting.
const SEED_DEPTH: Record<RoomKey, DepthBox[]> = {
  lounge: [
    { x: 292, y: 144, w: 28, h: 78, baseY: 222, src: "props", label: "dining set" },
    { x: 614, y: 302, w: 20, h: 69, baseY: 368, src: "props", label: "clothing stand" },
    { x: 322, y: 352, w: 94, h: 50, baseY: 402, src: "props", label: "flower vases" },
    { x: 310, y: 225, w: 87, h: 54, baseY: 279, src: "top" },
    { x: 476, y: 272, w: 141, h: 93, baseY: 349, src: "top" },
    { x: 470, y: 366, w: 141, h: 51, baseY: 383, src: "top" },
    { x: 609, y: 202, w: 31, h: 41, baseY: 238, src: "top" },
    { x: 516, y: 170, w: 50, h: 55, baseY: 216, src: "top" },
    { x: 384, y: 144, w: 31, h: 79, baseY: 223, src: "top" },
    { x: 319, y: 140, w: 65, h: 70, baseY: 206, src: "top" },
    { x: 610, y: 297, w: 24, h: 47, baseY: 367, src: "top" },
  ],
  gym: [
    { x: 672, y: 64, w: 32, h: 96, baseY: 160, src: "props", label: "punch bag" },
    { x: 192, y: 192, w: 32, h: 32, baseY: 224, src: "props", label: "ball" },
    { x: 704, y: 172, w: 32, h: 72, baseY: 244, src: "props", label: "co2 tank" },
    { x: 672, y: 256, w: 64, h: 64, baseY: 320, src: "props", label: "machine" },
    { x: 362, y: 108, w: 38, h: 37, baseY: 145, src: "top" },
    { x: 316, y: 287, w: 38, h: 35, baseY: 322, src: "top" },
    { x: 353, y: 257, w: 29, h: 25, baseY: 282, src: "top" },
    { x: 255, y: 290, w: 34, h: 28, baseY: 318, src: "top" },
    { x: 319, y: 129, w: 32, h: 26, baseY: 155, src: "top" },
    { x: 260, y: 125, w: 53, h: 22, baseY: 147, src: "top" },
    { x: 356, y: 152, w: 57, h: 20, baseY: 169, src: "top" },
    { x: 191, y: 289, w: 35, h: 17, baseY: 306, src: "top" },
  ],
  music: [
    { x: 388, y: 118, w: 56, h: 26, baseY: 144, src: "props", label: "stool" },
    { x: 224, y: 182, w: 32, h: 32, baseY: 214, src: "props", label: "wall hook" },
    { x: 453, y: 152, w: 90, h: 72, baseY: 224, src: "props", label: "drums / amps" },
    { x: 550, y: 234, w: 18, h: 54, baseY: 288, src: "props", label: "mic stand" },
    { x: 320, y: 356, w: 64, h: 55, baseY: 411, src: "props", label: "keyboard" },
    { x: 578, y: 366, w: 30, h: 50, baseY: 416, src: "props", label: "mic stand" },
    { x: 314, y: 190, w: 39, h: 37, baseY: 222, src: "top" },
    { x: 315, y: 123, w: 68, h: 64, baseY: 185, src: "top" },
    { x: 570, y: 203, w: 42, h: 87, baseY: 290, src: "top" },
    { x: 454, y: 344, w: 54, h: 67, baseY: 411, src: "top" },
    { x: 512, y: 307, w: 57, h: 78, baseY: 385, src: "top" },
    { x: 512, y: 385, w: 56, h: 28, baseY: 413, src: "top" },
    { x: 383, y: 158, w: 30, h: 28, baseY: 186, src: "top" },
  ],
  game: [
    { x: 288, y: 140, w: 32, h: 36, baseY: 176, src: "props", label: "hanging plant" },
    { x: 352, y: 140, w: 32, h: 36, baseY: 176, src: "props", label: "hanging plant" },
    { x: 416, y: 140, w: 32, h: 36, baseY: 176, src: "props", label: "hanging plant" },
    { x: 480, y: 140, w: 32, h: 36, baseY: 176, src: "props", label: "hanging plant" },
    { x: 544, y: 140, w: 32, h: 36, baseY: 176, src: "props", label: "hanging plant" },
    { x: 289, y: 419, w: 29, h: 31, baseY: 439, src: "top" },
    { x: 281, y: 190, w: 149, h: 105, baseY: 295, src: "top" },
    { x: 435, y: 204, w: 151, h: 86, baseY: 290, src: "top" },
    { x: 460, y: 322, w: 101, h: 108, baseY: 388, src: "top" },
    { x: 296, y: 381, w: 18, h: 37, baseY: 439, src: "top" },
  ],
};

// Free-form solid blockers (world px), hand-traced against the room art.
const SEED_SOLIDS: Record<RoomKey, Rect[]> = {
  lounge: [
    { x: 0, y: 0, w: 960, h: 128 },
    { x: 0, y: 128, w: 287, h: 129 },
    { x: 512, y: 128, w: 448, h: 64 },
    { x: 640, y: 192, w: 320, h: 63 },
    { x: 0, y: 256, w: 224, h: 384 },
    { x: 704, y: 256, w: 256, h: 384 },
    { x: 224, y: 384, w: 86, h: 256 },
    { x: 619, y: 385, w: 85, h: 255 },
    { x: 264, y: 123, w: 150, h: 68 },
    { x: 387, y: 194, w: 24, h: 26 },
    { x: 294, y: 195, w: 23, h: 25 },
    { x: 325, y: 190, w: 20, h: 15 },
    { x: 354, y: 191, w: 28, h: 14 },
    { x: 529, y: 180, w: 43, h: 29 },
    { x: 612, y: 219, w: 24, h: 19 },
    { x: 579, y: 185, w: 55, h: 24 },
    { x: 486, y: 309, w: 116, h: 37 },
    { x: 612, y: 354, w: 23, h: 13 },
    { x: 512, y: 357, w: 64, h: 46 },
    { x: 289, y: 417, w: 350, h: 55 },
    { x: 314, y: 231, w: 77, h: 43 },
    { x: 344, y: 391, w: 16, h: 8 },
    { x: 330, y: 386, w: 13, h: 9 },
    { x: 361, y: 388, w: 13, h: 6 },
    { x: 608, y: 190, w: 33, h: 49 },
  ],
  gym: [
    { x: 18, y: -1, w: 960, h: 128 },
    { x: 0, y: 128, w: 192, h: 512 },
    { x: 736, y: 128, w: 224, h: 512 },
    { x: 192, y: 320, w: 320, h: 320 },
    { x: 608, y: 320, w: 128, h: 320 },
    { x: 512, y: 384, w: 96, h: 256 },
    { x: 686, y: 283, w: 35, h: 36 },
    { x: 705, y: 222, w: 30, h: 20 },
    { x: 224, y: 237, w: 32, h: 62 },
    { x: 426, y: 96, w: 44, h: 83 },
    { x: 193, y: 95, w: 62, h: 47 },
    { x: 606, y: 119, w: 34, h: 39 },
    { x: 667, y: 118, w: 39, h: 42 },
    { x: 190, y: 215, w: 33, h: 8 },
    { x: 320, y: 311, w: 31, h: 8 },
    { x: 260, y: 309, w: 22, h: 5 },
    { x: 193, y: 299, w: 28, h: 6 },
    { x: 355, y: 274, w: 23, h: 8 },
    { x: 359, y: 163, w: 51, h: 7 },
    { x: 365, y: 132, w: 32, h: 11 },
    { x: 321, y: 146, w: 26, h: 6 },
    { x: 263, y: 138, w: 47, h: 6 },
  ],
  game: [
    { x: 0, y: 0, w: 960, h: 192 },
    { x: 0, y: 192, w: 288, h: 448 },
    { x: 288, y: 449, w: 320, h: 191 },
    { x: 578, y: 385, w: 200, h: 72 },
    { x: 292, y: 223, w: 117, h: 64 },
    { x: 452, y: 223, w: 119, h: 63 },
    { x: 306, y: 339, w: 97, h: 79 },
    { x: 497, y: 350, w: 34, h: 80 },
    { x: 467, y: 370, w: 88, h: 43 },
    { x: 577, y: 191, w: 130, h: 65 },
    { x: 294, y: 432, w: 22, h: 10 },
  ],
  music: [
    { x: 0, y: 0, w: 960, h: 158 },
    { x: 610, y: 128, w: 350, h: 512 },
    { x: 288, y: 417, w: 352, h: 223 },
    { x: 135, y: 128, w: 183, h: 95 },
    { x: 133, y: 352, w: 184, h: 84 },
    { x: 546, y: 161, w: 62, h: 28 },
    { x: 509, y: 340, w: 58, h: 45 },
    { x: 463, y: 394, w: 29, h: 14 },
    { x: 321, y: 362, w: 62, h: 47 },
    { x: 578, y: 212, w: 27, h: 76 },
    { x: 459, y: 193, w: 78, h: 31 },
    { x: 321, y: 158, w: 92, h: 29 },
    { x: 549, y: 271, w: 20, h: 17 },
    { x: 322, y: 211, w: 21, h: 11 },
    { x: 580, y: 403, w: 26, h: 10 },
    { x: 514, y: 311, w: 25, h: 30 },
    { x: 528, y: 334, w: 28, h: 5 },
    { x: 523, y: 313, w: 20, h: 21 },
    { x: 527, y: 394, w: 28, h: 13 },
    { x: 413, y: 396, w: 37, h: 16 },
  ],
};

function defaultRoom(): RoomData {
  return { solids: [], depth: [], doors: [], spawn: { x: 480, y: 320, face: "down" } };
}

function buildDefaults(): Record<string, RoomData> {
  const out: Record<string, RoomData> = {};
  for (const room of ROOM_KEYS) {
    out[room] = {
      solids: SEED_SOLIDS[room].map((o) => ({ ...o })),
      depth: SEED_DEPTH[room].map((o) => ({ ...o })),
      doors: SEED_DOORS[room].map((o) => ({ ...o })),
      spawn: { ...SEED_SPAWN[room] },
    };
  }
  return out;
}

const DATA: Record<string, RoomData> = buildDefaults();

// ---- load saved overrides ----
// Restore the user's saved level-editor config faithfully — never overwrite it.
// The only auto-fill is depth props for a room the user never configured.
try {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    const saved = JSON.parse(raw) as Record<string, Partial<RoomData> & { overlays?: DepthBox[] }>;
    for (const room in saved) {
      if (!DATA[room]) DATA[room] = defaultRoom();
      const s = saved[room];
      if (Array.isArray(s.solids)) DATA[room].solids = s.solids;
      // depth: keep the user's if they set any; otherwise keep the default seed
      if (Array.isArray(s.depth) && s.depth.length) DATA[room].depth = s.depth;
      else if (Array.isArray(s.overlays) && s.overlays.length) DATA[room].depth = s.overlays; // v2 name
      // doors: restore, but never let an empty array strand a room
      if (Array.isArray(s.doors) && s.doors.length) DATA[room].doors = s.doors;
      if (s.spawn) DATA[room].spawn = s.spawn;
    }
  }
} catch (e) {
  console.warn("hitbox load failed", e);
}

export function save(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(DATA));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
export function room(k: string): RoomData {
  if (!DATA[k]) DATA[k] = defaultRoom();
  return DATA[k];
}
export function solids(k: string): Rect[] {
  return room(k).solids;
}
export function depth(k: string): DepthBox[] {
  return room(k).depth;
}
export function doors(k: string): Door[] {
  return room(k).doors;
}
export function spawn(k: string): Spawn {
  return room(k).spawn;
}

// Per-source spawn: when the player walks into `roomKey` from `fromKey`, drop
// them just inside the carpet (door) that leads back to that room. Returns null
// if this room has no door back to fromKey (callers fall back to the spawn).
const CW = 30 * TS;
const CH = 20 * TS;
export function spawnFrom(roomKey: string, fromKey: string): Spawn | null {
  const back = doors(roomKey).find((d) => d.to === fromKey);
  if (!back) return null;
  const GAP = 22; // stand off the door trigger, on the floor
  const cx = back.x + back.w / 2, cy = back.y + back.h / 2;
  if (back.w >= back.h) {
    // wide carpet -> top/bottom wall
    return cy < CH / 2
      ? { x: cx, y: back.y + back.h + GAP, face: "down" } // top wall: step down in
      : { x: cx, y: back.y - GAP, face: "up" }; // bottom wall: step up in
  }
  // tall carpet -> left/right wall
  return cx < CW / 2
    ? { x: back.x + back.w + GAP, y: cy, face: "right" } // left wall: step right in
    : { x: back.x - GAP, y: cy, face: "left" }; // right wall: step left in
}
export function resetRoom(k: string): void {
  DATA[k] = buildDefaults()[k] ?? defaultRoom();
  save();
}
export function exportJSON(): string {
  return JSON.stringify(DATA, null, 2);
}
