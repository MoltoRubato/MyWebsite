/* ============================================================
   WORLD — room registry + collision query.
   Tile grid 30x20, tile = 32px, canvas 960x640. Collision rectangles
   live in js→src/hitboxes.ts; this module just exposes the room
   metadata the renderer/camera needs and the feet-box stand test.
   ============================================================ */
import { TS, COLS, ROWS } from "./core/constants";
import { solids } from "./hitboxes";
import type { RoomKey } from "./core/types";

export interface RoomView {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RoomDef {
  label: string;
  /** Camera framing within the 960x640 room canvas. */
  view: RoomView;
  /** Fallback spawn tile [tx, ty] when no hitbox spawn resolves. */
  home: [number, number];
}

export const ROOMS: Record<RoomKey, RoomDef> = {
  lounge: { label: "The Lounge", view: { x: 198, y: 100, w: 534, h: 352 }, home: [14, 9] },
  gym: { label: "The Gym", view: { x: 134, y: 38, w: 660, h: 372 }, home: [14, 7] },
  game: { label: "The Game Room", view: { x: 230, y: 102, w: 468, h: 384 }, home: [13, 10] },
  music: { label: "The Music Studio", view: { x: 198, y: 70, w: 468, h: 384 }, home: [13, 9] },
};

/** TRUE if the feet box (w x h at px,py) fits inside the room with no solid hit. */
export function canStand(roomKey: RoomKey, px: number, py: number, w: number, h: number): boolean {
  // out of the room canvas = cannot stand
  if (px < 0 || py < 0 || px + w > COLS * TS || py + h > ROWS * TS) return false;
  for (const r of solids(roomKey)) {
    if (px < r.x + r.w && px + w > r.x && py < r.y + r.h && py + h > r.y) return false;
  }
  return true;
}
