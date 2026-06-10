/* ============================================================
   SPRITES — character + portrait drawing.
   Character sheet: 32x64 frames. Row 1 = idle, Row 2 = walk.
   Direction columns: right@0, up@6, left@12, down@18 (6 frames each).
   ============================================================ */
import type { Dir } from "./core/types";
import {
  getImage,
  CHAR_FW as FW,
  CHAR_FH as FH,
  ROW_IDLE,
  ROW_WALK,
  DIR_COL,
  DIR_FRAMES,
  PORT_FW,
  PORT_FH,
  PORT_FRAMES,
  PORT_COLS,
  SPK_FW,
  SPK_FH,
  SPK_FRAMES,
  SPK_CONTENT_BOTTOM,
} from "./assets";

type Ctx = CanvasRenderingContext2D;
type PetState = "idle" | "petted";

/**
 * Draw a character sprite.
 *  key   : ASSETS key, e.g. "char_Player"
 *  cx,cy : center-bottom anchor in canvas px (feet point)
 *  dir   : facing direction
 *  moving: walk row vs idle row
 *  frame : animation frame counter (int, mod'd internally)
 *  scale : draw scale (default 1; sprites are 32x64 source)
 */
export function drawChar(
  ctx: Ctx,
  key: string,
  cx: number,
  cy: number,
  dir: Dir,
  moving: boolean,
  frame: number,
  scale = 1,
): void {
  const img = getImage(key);
  if (!img || !img.complete || !img.naturalWidth) return;
  const row = moving ? ROW_WALK : ROW_IDLE;
  const col0 = DIR_COL[dir] != null ? DIR_COL[dir] : DIR_COL.down;
  const f = ((frame % DIR_FRAMES) + DIR_FRAMES) % DIR_FRAMES;
  const sx = (col0 + f) * FW;
  const sy = row * FH;
  const dw = FW * scale, dh = FH * scale;
  const dx = Math.round(cx - dw / 2);
  const dy = Math.round(cy - dh);
  ctx.drawImage(img, sx, sy, FW, FH, dx, dy, dw, dh);
}

/** Soft shadow ellipse under the feet. */
export function drawShadow(ctx: Ctx, cx: number, cy: number, w: number, scale = 1): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 2, w * 0.42 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- pets (cat/dog) -------------------------------------------------------
// Each pet has its own spritesheet (NOT the 32x64 char layout): row 0 = idle,
// row 1 = being petted. The cat's petting frames span two sheet rows, so its
// frame->source mapping is listed explicitly (cross-row).
interface PetAnim {
  frames: number;
  y?: number;
  cross?: [number, number][];
}
interface PetCfg {
  img: string;
  fw: number;
  fh: number;
  idle: PetAnim;
  petted: PetAnim;
}
const PET: Record<string, PetCfg> = {
  dog: {
    img: "pet_dog", fw: 230, fh: 340,
    idle: { frames: 4, y: 0 },
    petted: { frames: 4, y: 340 },
  },
  cat: {
    img: "pet_cat", fw: 425, fh: 325,
    idle: { frames: 2, y: 0 },
    // frames 0-1 on the row at y=325, frames 2-3 on the row at y=650
    petted: { frames: 4, cross: [[0, 325], [1, 325], [0, 650], [1, 650]] },
  },
};

/** Draw a pet centered on (cx) with feet at (cy), filling w x h canvas px. */
export function drawPet(
  ctx: Ctx,
  kind: string,
  cx: number,
  cy: number,
  state: PetState,
  frame: number,
  w: number,
  h: number,
): void {
  const cfg = PET[kind];
  if (!cfg) return;
  const img = getImage(cfg.img);
  if (!img || !img.complete || !img.naturalWidth) return;
  const a = cfg[state] || cfg.idle;
  const f = ((frame % a.frames) + a.frames) % a.frames;
  let sx: number, sy: number;
  if (a.cross) {
    const c = a.cross[f];
    sx = c[0] * cfg.fw;
    sy = c[1];
  } else {
    sx = f * cfg.fw;
    sy = a.y ?? 0;
  }
  const dx = Math.round(cx - w / 2), dy = Math.round(cy - h);
  ctx.drawImage(img, sx, sy, cfg.fw, cfg.fh, dx, dy, w, h);
}

/**
 * Draw the animated speaker/amp prop. (cx, baseY) = center-bottom of the
 * VISIBLE speaker (its art sits in the top of each cell, so we anchor on the
 * content bottom, not the cell bottom). frame cycles 0..2 while music plays.
 */
export function drawSpeaker(ctx: Ctx, cx: number, baseY: number, frame: number, scale = 1): void {
  const img = getImage("prop_speaker");
  if (!img || !img.complete || !img.naturalWidth) return;
  const f = ((frame % SPK_FRAMES) + SPK_FRAMES) % SPK_FRAMES;
  const dw = SPK_FW * scale, dh = SPK_FH * scale;
  const dx = Math.round(cx - dw / 2);
  const dy = Math.round(baseY - SPK_CONTENT_BOTTOM * scale);
  ctx.drawImage(img, f * SPK_FW, 0, SPK_FW, SPK_FH, dx, dy, dw, dh);
}

/** Draw one talking-portrait frame into a 64x64 (or scaled) canvas ctx. */
export function drawPortraitFrame(ctx: Ctx, key: string, frame: number, dw: number, dh: number): void {
  const img = getImage(key);
  if (!img || !img.complete || !img.naturalWidth) return;
  const cols = PORT_COLS, total = PORT_FRAMES;
  const f = ((frame % total) + total) % total;
  const sx = (f % cols) * PORT_FW;
  const sy = Math.floor(f / cols) * PORT_FH;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, dw, dh);
  ctx.drawImage(img, sx, sy, PORT_FW, PORT_FH, 0, 0, dw, dh);
}
