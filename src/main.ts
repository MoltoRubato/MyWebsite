/* ============================================================
   MAIN — entry point. Imports styles, boots the animated loading
   screen, then wires the header/editor to GAME and starts the world.
   (Replaces the old boot.js + the script-tag soup in index.html.)
   ============================================================ */
import "../css/style.css";
import "../css/ui.css";
import "../css/activity.css";

import type { Dir } from "./core/types";
import * as A from "./assets";
import * as S from "./sprites";
import { GAME } from "./game";
import * as HEADER from "./header";
import * as EDITOR from "./editor";

// expose GAME for debugging / preview tooling (matches the old window.GAME)
(window as unknown as { GAME: typeof GAME }).GAME = GAME;

const loader = document.getElementById("loader") as HTMLElement;
const lc = document.getElementById("loadCanvas") as HTMLCanvasElement;
const lctx = lc.getContext("2d")!;
lctx.imageSmoothingEnabled = false;
const fill = document.getElementById("loadFill") as HTMLElement;
const statusEl = document.getElementById("loadStatus") as HTMLElement;
const enterBtn = document.getElementById("loadEnter") as HTMLElement;

// fit loader canvas to viewport
function sizeLoader(): void {
  lc.width = Math.floor(window.innerWidth);
  lc.height = Math.floor(window.innerHeight);
  lctx.imageSmoothingEnabled = false;
}
sizeLoader();
window.addEventListener("resize", sizeLoader);

let ready = false, entered = false;
const t0 = performance.now();

/* ---- Intro composition: "Lineup" with spotlight lighting ---- */
interface CastMember {
  char: string;
  dx: number;
  dir: Dir;
  scale: number;
  ph: number;
}
const INTRO: { gyf: number; baseDiv: number; cast: CastMember[] } = {
  gyf: 0.605,
  baseDiv: 168,
  cast: [
    { char: "char_Dino", dx: -0.165, dir: "right", scale: 0.82, ph: 1.7 },
    { char: "char_Alex", dx: 0.165, dir: "left", scale: 0.82, ph: 3.1 },
    { char: "char_Player", dx: 0.0, dir: "down", scale: 1.0, ph: 0.0 },
  ],
};

function drawScene(now: number): void {
  const W = lc.width, H = lc.height, P = INTRO;
  lctx.clearRect(0, 0, W, H);
  const room = A.getImage("room_lounge");
  if (room && room.complete) {
    const ar = room.width / room.height;
    let dw = W, dh = W / ar;
    if (dh < H) {
      dh = H;
      dw = H * ar;
    }
    const pan = Math.sin(now / 4000) * 20;
    const ox = (W - dw) / 2 + pan, oy = (H - dh) / 2;
    lctx.drawImage(room, ox, oy, dw, dh);
    // spotlight lighting — radial pool centered on the cast
    const g = lctx.createRadialGradient(W / 2, H * 0.46, H * 0.05, W / 2, H * 0.52, H * 0.66);
    g.addColorStop(0, "rgba(7,9,16,0)");
    g.addColorStop(1, "rgba(7,9,16,0.84)");
    lctx.fillStyle = g;
    lctx.fillRect(0, 0, W, H);
    const base = Math.max(2.4, H / P.baseDiv);
    const gy = H * P.gyf;
    P.cast.forEach((c) => {
      const s = base * c.scale;
      const cx = W / 2 + c.dx * W;
      const bob = Math.sin(now / 620 + c.ph) * 2.2 * c.scale;
      const cy = gy + bob;
      const frame = Math.floor(now / 170 + c.ph * 3);
      lctx.globalAlpha = c.scale < 1 ? 0.92 : 1;
      S.drawShadow(lctx, cx, gy, 28, s * 1.0);
      S.drawChar(lctx, c.char, cx, cy, c.dir, false, frame, s);
      lctx.globalAlpha = 1;
    });
  } else {
    lctx.fillStyle = "#0c1018";
    lctx.fillRect(0, 0, W, H);
  }
}

function loop(now: number): void {
  drawScene(now);
  const p = A.assetsProgress();
  fill.style.width = Math.floor(Math.max(p, ((now - t0) / 2500) * 0.6) * 100) + "%";
  if (!ready && p >= 1 && now - t0 > 900) {
    ready = true;
    fill.style.width = "100%";
    statusEl.textContent = "READY";
    enterBtn.classList.remove("hidden");
  }
  if (!entered) requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// status flavor text
const flavor = ["LOADING…", "WAKING THE NPCS…", "DUSTING THE CHESS BOARD…", "TUNING THE STUDIO…", "WARMING UP THE GYM…"];
let fi = 0;
const flavorTimer = setInterval(() => {
  if (ready) {
    clearInterval(flavorTimer);
    return;
  }
  fi = (fi + 1) % flavor.length;
  statusEl.textContent = flavor[fi];
}, 1100);

function enterWorld(): void {
  if (entered) return;
  entered = true;
  clearInterval(flavorTimer);
  loader.classList.add("out");
  HEADER.init(GAME);
  HEADER.reveal();
  EDITOR.init(GAME);
  GAME.start();
  setTimeout(() => loader.classList.add("hidden"), 650);
}
enterBtn.addEventListener("click", enterWorld);
window.addEventListener("keydown", (e) => {
  if (ready && !entered && (e.key === "Enter" || e.key === " ")) enterWorld();
});

// safety: if assets stall, allow entry after 6s
setTimeout(() => {
  if (!ready) {
    ready = true;
    fill.style.width = "100%";
    statusEl.textContent = "READY";
    enterBtn.classList.remove("hidden");
  }
}, 6000);
