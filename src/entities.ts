/* ============================================================
   ENTITIES — player + NPCs with ambient behavior.
   Position model: (x,y) = feet point = center-bottom of the
   32x64 sprite. Collision box is a small rect at the feet.
   ============================================================ */
import { canStand } from "./world";
import { TS } from "./core/constants";
import type { Behavior, Dir, GameObject, NPC, Pet, Player, Region, Room, RoomKey, ActivityKind } from "./core/types";

// Collision footprint = a small box at the character's FEET (the bottom of
// the sprite). (x,y) is the feet point; the box sits just above it.
export const FEET_W = 16;
export const FEET_H = 8;

export function makePlayer(): Player {
  return { char: "char_Player", x: 15 * TS + 16, y: 9 * TS + 30, dir: "down", moving: false, frame: 0, animT: 0, speed: 1.7 };
}

/** Collision check for a feet point. */
export function freeAt(room: RoomKey, x: number, y: number): boolean {
  return canStand(room, x - FEET_W / 2, y - FEET_H, FEET_W, FEET_H);
}

interface NpcSpec {
  char: string;
  name?: string;
  tx: number;
  ty: number;
  dir?: Dir;
  behavior?: Behavior;
  speed?: number;
  region?: Region;
  interact?: ActivityKind;
  hint?: string;
}

function makeNPC(spec: NpcSpec): NPC {
  return {
    char: "char_" + spec.char,
    key: spec.char,
    name: spec.name || spec.char,
    x: spec.tx * TS + 16,
    y: spec.ty * TS + TS - 2,
    homeX: spec.tx * TS + 16,
    homeY: spec.ty * TS + TS - 2,
    dir: spec.dir || "down",
    moving: false,
    frame: 0,
    animT: 0,
    behavior: spec.behavior || "idle",
    speed: spec.speed || 0.9,
    region: spec.region,
    interact: spec.interact,
    hint: spec.hint,
    state: "pause",
    timer: 1 + Math.random() * 2,
    tx: 0,
    ty: 0,
    watchDir: spec.dir || "down",
    bob: Math.random() * 6.28,
  };
}

// NPC placement per room. Every NPC wanders within a region (tile bounds);
// interactive NPCs keep a tighter region so they linger near their station.
const NPCS: Record<RoomKey, NpcSpec[]> = {
  lounge: [
    { char: "Bob", name: "Bob", tx: 15, ty: 11, dir: "up", behavior: "wander", speed: 0.8, region: { x0: 14, y0: 10, x1: 17, y1: 12 } },
    { char: "Dino", name: "Dino", tx: 13, ty: 8, dir: "left", behavior: "wander", speed: 0.85, region: { x0: 12, y0: 7, x1: 14, y1: 9 } },
  ],
  gym: [
    { char: "Girl", name: "Amelia", tx: 12, ty: 9, dir: "down", behavior: "wander", speed: 0.85, region: { x0: 8, y0: 6, x1: 13, y1: 9 }, interact: "rack" },
    { char: "Gojo", name: "Gojo", tx: 20, ty: 8, dir: "left", behavior: "wander", speed: 0.85, region: { x0: 17, y0: 6, x1: 21, y1: 9 }, interact: "workout" },
  ],
  // Drod's region starts a row lower so he never out-nears the chess-table anchor
  game: [{ char: "Drod", name: "Drod", tx: 16, ty: 10, dir: "down", behavior: "wander", speed: 0.8, region: { x0: 13, y0: 10, x1: 17, y1: 11 }, interact: "chess" }],
  music: [
    { char: "Alex", name: "Alex", tx: 9, ty: 7, dir: "down", behavior: "wander", speed: 0.85, region: { x0: 8, y0: 6, x1: 11, y1: 8 }, interact: "music" },
    // DJ hangs out mid-room, between the piano and the big rug — far enough
    // from the piano anchor (522,408) that he never steals its interaction
    { char: "DJ", name: "DJ", tx: 15, ty: 10, dir: "left", behavior: "wander", speed: 0.85, region: { x0: 14, y0: 9, x1: 15, y1: 10 }, interact: "music" },
  ],
};

interface ObjSpec {
  type: string;
  name: string;
  tx?: number;
  ty?: number;
  px?: number;
  py?: number;
  hint: string;
  sprite?: string;
  markerY?: number;
}
// Interactable objects (non-NPC). The speaker is the jukebox trigger (animated
// sprite, see game.ts render). TV and pool table use a world-px anchor (px/py)
// on the floor in front of them, with markerY floating the prompt up.
const OBJECTS: Partial<Record<RoomKey, ObjSpec[]>> = {
  gym: [
    // the dumbbell rack at the top-left wall hosts the re-racking puzzle
    { type: "rack", name: "Weight rack", px: 225, py: 170, hint: "Re-rack the weights", markerY: 88 },
  ],
  lounge: [
    { type: "tv", name: "TV", px: 544, py: 372, hint: "Turn on TV", markerY: 100 },
    // the book pile by the shelf (trigger sits up-left of it, per taste)
    { type: "guestbook", name: "Guestbook", px: 513, py: 203, hint: "Sign the guestbook", markerY: 46 },
  ],
  music: [
    { type: "music", name: "Speaker", tx: 13, ty: 12, hint: "Open jukebox", sprite: "speaker" },
    // anchored at the keyboard end of the painted grand piano — far enough
    // left that DJ's wander region (x>=17 tiles) can never out-near it
    { type: "piano", name: "Grand piano", px: 522, py: 408, hint: "Play the piano", markerY: 110 },
  ],
  game: [
    { type: "pool", name: "Pool table", px: 354, py: 430, hint: "Play pool", markerY: 104 },
    // the plain wooden table beside the chess table hosts the card game
    { type: "poker", name: "Card table", px: 350, py: 300, hint: "Play poker", markerY: 100 },
    // the chess board itself is playable too (Drod still offers it in dialogue)
    { type: "chess", name: "Chess table", px: 510, py: 297, hint: "Play chess", markerY: 96 },
    // a small, subtle button at the foot of the south wall, near the corner
    { type: "redbutton", name: "Red button", px: 523, py: 482, hint: "Do not press", markerY: 40 },
  ],
};

interface PetSpec {
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hint: string;
}
// Pets — critters you can walk up to and pet. Placed in world px (like the
// hand-traced lounge hitboxes) so they dodge the furniture. (x,y) = feet/base.
const PETS: Partial<Record<RoomKey, PetSpec[]>> = {
  lounge: [
    { kind: "dog", name: "Mimi", x: 405, y: 270, w: 30, h: 44, hint: "Pet Mimi" },
    { kind: "cat", name: "Batman", x: 625, y: 260, w: 44, h: 34, hint: "Pet Batman" },
  ],
};

export function makePet(spec: PetSpec): Pet {
  return { ...spec, state: "idle", frame: 0, animT: 0, petTimer: 0, petDur: 2.0, idleFps: 5, petFps: 6 };
}
/** Begin the petting animation (only from idle, matching the original). */
export function petStart(p: Pet): void {
  if (!p || p.state !== "idle") return;
  p.state = "petted";
  p.petTimer = p.petDur;
  p.animT = 0;
  p.frame = 0;
}
/** Advance a pet's animation + petting timer for one tick. */
export function stepPet(p: Pet, dt: number): void {
  p.animT += dt;
  if (p.state === "petted") {
    p.petTimer -= dt;
    if (p.petTimer <= 0) {
      p.state = "idle";
      p.animT = 0;
      p.frame = 0;
    }
  }
  const fps = p.state === "petted" ? p.petFps : p.idleFps;
  p.frame = Math.floor(p.animT * fps);
}

export function buildRoom(roomKey: RoomKey): Room {
  const npcs = (NPCS[roomKey] || []).map(makeNPC);
  const objs: GameObject[] = (OBJECTS[roomKey] || []).map((o) => ({
    ...o,
    x: o.px != null ? o.px : o.tx! * TS + 16,
    y: o.py != null ? o.py : o.ty! * TS + TS - 2,
  }));
  const pets = (PETS[roomKey] || []).map(makePet);
  return { npcs, objs, pets };
}

/** Advance ambient AI for one NPC. */
export function stepNPC(n: NPC, room: RoomKey, dt: number): void {
  n.animT += dt;
  n.bob += dt * 4;
  switch (n.behavior) {
    case "wander": {
      if (!n.region) {
        n.moving = false;
        break;
      }
      n.timer -= dt;
      if (n.state === "pause") {
        n.moving = false;
        if (n.timer <= 0) {
          const r = n.region;
          // pick a WALKABLE target tile inside the region (retry a few times),
          // so NPCs never march into furniture; idle again if none is free.
          let tx = 0,
            ty = 0,
            ok = false;
          for (let i = 0; i < 8 && !ok; i++) {
            tx = r.x0 + Math.floor(Math.random() * (r.x1 - r.x0 + 1));
            ty = r.y0 + Math.floor(Math.random() * (r.y1 - r.y0 + 1));
            ok = freeAt(room, tx * TS + 16, ty * TS + TS - 2);
          }
          if (ok) {
            n.tgtX = tx * TS + 16;
            n.tgtY = ty * TS + TS - 2;
            n.state = "walk";
            n.timer = 4;
          } else {
            n.timer = 0.6 + Math.random() * 1.2;
          }
        }
      } else {
        const dx = n.tgtX! - n.x,
          dy = n.tgtY! - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 2 || n.timer <= 0) {
          n.state = "pause";
          n.moving = false;
          n.timer = 1.2 + Math.random() * 2.5;
        } else {
          const stepLen = n.speed * dt * 60;
          const vx = (dx / d) * stepLen,
            vy = (dy / d) * stepLen;
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
          if (freeAt(room, n.x + vx, n.y)) n.x += vx;
          else n.state = "pause";
          if (freeAt(room, n.x, n.y + vy)) n.y += vy;
          else n.state = "pause";
          n.moving = true;
        }
      }
      break;
    }
    case "watch": {
      // watch TV: stand, slow idle frames
      n.moving = false;
      n.dir = n.watchDir;
      break;
    }
    case "work": {
      // gym: alternate idle/active to fake reps
      n.timer -= dt;
      n.moving = Math.sin(n.bob) > 0.2;
      break;
    }
    case "box": {
      // punch the bag — animate in place
      n.moving = true;
      n.dir = n.watchDir;
      break;
    }
    case "groove": {
      // music: bob in place
      n.moving = Math.sin(n.bob * 0.7) > 0;
      n.dir = n.watchDir;
      break;
    }
    default: {
      n.moving = false;
    }
  }
  // frame animation
  const fps = n.moving ? 8 : 3.5;
  n.frame = Math.floor(n.animT * fps);
}
