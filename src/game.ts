/* ============================================================
   GAME — main loop, rendering, input, transitions, interactions.
   ============================================================ */
import { TS } from "./core/constants";
import type { Camera, GameApi, GameObject, NPC, Pet, Point, ReactionCtx, Room, RoomKey } from "./core/types";
import { ROOMS } from "./world";
import * as A from "./assets";
import * as S from "./sprites";
import * as EN from "./entities";
import { CONTENT as C } from "./content";
import * as HITBOXES from "./hitboxes";
import * as DIALOGUE from "./dialogue";
import * as HEADER from "./header";
import * as EDITOR from "./editor";
import * as P from "./progress";
import * as CHESS from "./activities/chess";
import * as POOL from "./activities/pool";
import * as MUSIC from "./activities/music";
import * as WORKOUT from "./activities/workout";
import * as PIANO from "./activities/piano";
import * as POKER from "./activities/poker";
import * as GUESTBOOK from "./activities/guestbook";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
ctx.imageSmoothingEnabled = false;
const stage = document.getElementById("stage") as HTMLElement;
const veil = document.getElementById("veil") as HTMLElement;
const roomLabel = document.getElementById("roomLabel") as HTMLElement;
const hintEl = document.getElementById("hint") as HTMLElement;

const ROOM_IMG: Record<RoomKey, string> = { lounge: "room_lounge", gym: "room_gym", game: "room_game", music: "room_music" };
const TOP_IMG: Record<RoomKey, string> = { lounge: "room_lounge_top", gym: "room_gym_top", game: "room_game_top", music: "room_music_top" };
const PROPS_IMG: Record<RoomKey, string> = { lounge: "room_lounge_props", gym: "room_gym_props", game: "room_game_props", music: "room_music_props" };
const SPK_SCALE = 1.2; // on-screen size of the animated jukebox speaker
// Lounge TV — the flatscreen on the central media console. Body rect in world px.
const TV_RECT = { x: 517, y: 283, w: 52, h: 25, baseY: 349 };
const TV_CHANNELS = [
  { key: "tv_ch0", label: "RYAN NEWS 24" },
  { key: "tv_ch1", label: "GENERAL HOSPITAL" },
  { key: "tv_ch2", label: "ER · AFTER DARK" },
];

let player = EN.makePlayer();
let curRoom: RoomKey = "lounge";
const rooms: Partial<Record<RoomKey, Room>> = {}; // built lazily per room
const keys: Record<string, boolean> = {};
const joy = { x: 0, y: 0, active: false }; // analog touch joystick (-1..1 per axis)
let paused = false, transitioning = false, running = false;
let nearTarget: NearTarget | null = null;
let doorGuard = false; // ignore the current door until stepped off
let lastTs = 0;
let soundOn = true;
let musicAnimT = 0; // clock for the animated speaker (advances while music is audible)
let tvCh = -1; // lounge TV: -1 = off, else index into TV_CHANNELS
let tvAnimT = 0; // channel playback clock
let tvLabelT = 0; // seconds left to flash the channel name after a switch
let showHitboxes = /[?&]dev=1\b/.test(location.search); // DEV overlay (?dev=1)
let intro: Intro | null = null; // opening cinematic
const consumedReactions = new Set<string>(); // session-memory openers shown this page load
// DO NOT PRESS button — camera shake + press feedback timers (seconds left)
const shake = { t: 0, dur: 0, amp: 0 };
let btnCooldown = 0;
let btnPressT = 0;
let worldT = 0; // ambient clock for in-world object animation (button glow)

interface Intro {
  sx: number;
  sy: number;
  ty: number;
  dur: number;
  t: number;
  motes: { x: number; y: number; vx: number; vy: number; r: number; ph: number }[];
}
type NearTarget =
  | { kind: "npc"; ref: NPC; x: number; y: number }
  | { kind: "obj"; ref: GameObject; x: number; y: number }
  | { kind: "pet"; ref: Pet; x: number; y: number };

function ensureRoom(k: RoomKey): Room {
  let r = rooms[k];
  if (!r) {
    r = EN.buildRoom(k);
    rooms[k] = r;
  }
  return r;
}

// ---------- scaling ----------
function resize(): void {
  const availW = stage.clientWidth, availH = stage.clientHeight;
  const scale = Math.min(availW / canvas.width, availH / canvas.height);
  canvas.style.width = canvas.width * scale + "px";
  canvas.style.height = canvas.height * scale + "px";
}
window.addEventListener("resize", resize);

// ---------- input ----------
function bindInput(): void {
  window.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (intro) return; // opening cinematic owns input until it finishes
    if (DIALOGUE.isOpen()) {
      if (k === "enter" || k === " ") DIALOGUE.advance();
      return;
    }
    if (anyOverlayOpen()) return;
    keys[k] = true;
    if (k === "enter" || k === "e") interact();
    if (k === "m") HEADER.openMap();
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  // touch joystick — analog drag-to-move.
  const zone = document.getElementById("joyZone");
  const stick = document.getElementById("joystick");
  const knob = document.getElementById("joyKnob");
  if (zone && stick && knob) {
    const Rr = 52; // max knob travel (px) = full deflection
    let pid: number | null = null, ox = 0, oy = 0;
    const setKnob = (dx: number, dy: number): void => {
      knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    };
    const update = (cx: number, cy: number): void => {
      let dx = cx - ox, dy = cy - oy;
      const d = Math.hypot(dx, dy);
      if (d > Rr) {
        dx = (dx / d) * Rr;
        dy = (dy / d) * Rr;
      }
      setKnob(dx, dy);
      joy.x = dx / Rr;
      joy.y = dy / Rr;
      joy.active = true;
    };
    const startJoy = (e: PointerEvent): void => {
      if (anyOverlayOpen() || paused || transitioning || DIALOGUE.isOpen()) return;
      pid = e.pointerId;
      ox = e.clientX;
      oy = e.clientY;
      const zr = zone.getBoundingClientRect();
      stick.style.left = ox - zr.left + "px";
      stick.style.top = oy - zr.top + "px";
      setKnob(0, 0);
      zone.classList.add("on");
      joy.x = 0;
      joy.y = 0;
      joy.active = true;
      try {
        zone.setPointerCapture(pid);
      } catch {
        /* not capturable */
      }
      e.preventDefault();
    };
    const moveJoy = (e: PointerEvent): void => {
      if (pid === null || e.pointerId !== pid) return;
      update(e.clientX, e.clientY);
      e.preventDefault();
    };
    const endJoy = (e: PointerEvent): void => {
      if (pid !== null && e.pointerId !== pid) return;
      pid = null;
      zone.classList.remove("on");
      setKnob(0, 0);
      joy.x = 0;
      joy.y = 0;
      joy.active = false;
    };
    zone.addEventListener("pointerdown", startJoy);
    zone.addEventListener("pointermove", moveJoy, { passive: false });
    zone.addEventListener("pointerup", endJoy);
    zone.addEventListener("pointercancel", endJoy);
  }
  const act = document.getElementById("actBtn") as HTMLElement;
  act.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (DIALOGUE.isOpen()) DIALOGUE.advance();
    else interact();
  });
  act.addEventListener("click", () => {
    if (DIALOGUE.isOpen()) DIALOGUE.advance();
    else interact();
  });
  if ("ontouchstart" in window || navigator.maxTouchPoints > 0 || ("matchMedia" in window && matchMedia("(pointer:coarse)").matches)) document.body.classList.add("touch");
}
function anyOverlayOpen(): boolean {
  return (
    CHESS.isOpen() ||
    MUSIC.isOpen() ||
    POOL.isOpen() ||
    WORKOUT.isOpen() ||
    PIANO.isOpen() ||
    POKER.isOpen() ||
    GUESTBOOK.isOpen() ||
    !document.getElementById("panel")!.classList.contains("hidden") ||
    !document.getElementById("mapModal")!.classList.contains("hidden")
  );
}

// ---------- interaction ----------
function findNear(): NearTarget | null {
  const R = ensureRoom(curRoom);
  let best: NearTarget | null = null, bestD = 44;
  const cands: NearTarget[] = [];
  R.npcs.forEach((n) => cands.push({ kind: "npc", ref: n, x: n.x, y: n.y }));
  R.objs.forEach((o) => cands.push({ kind: "obj", ref: o, x: o.x, y: o.y }));
  (R.pets || []).forEach((p) => cands.push({ kind: "pet", ref: p, x: p.x, y: p.y }));
  for (const c of cands) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
function interact(): void {
  if (intro || transitioning || paused) return;
  const near = findNear();
  if (!near) return;
  if (near.kind === "npc") talkTo(near.ref);
  else if (near.kind === "pet") {
    // count only pets that actually start (petStart ignores non-idle pets)
    if (near.ref.state === "idle") {
      P.flag(`pet_${near.ref.name}`);
      P.inc("petsGiven");
    }
    EN.petStart(near.ref);
  }
  else if (near.ref.type === "music") openJukebox();
  else if (near.ref.type === "pool") openPool();
  else if (near.ref.type === "poker") openPoker();
  else if (near.ref.type === "piano") openPiano();
  else if (near.ref.type === "guestbook") openGuestbook();
  else if (near.ref.type === "tv") cycleTV();
  else if (near.ref.type === "redbutton") pressRedButton();
}
// The big red button. It says not to. People press it. Shake, flicker,
// klaxon... and then, very deliberately, nothing. Drod remembers, though.
function pressRedButton(): void {
  if (btnCooldown > 0) return;
  btnCooldown = 3;
  btnPressT = 0.2;
  shake.t = 0;
  shake.dur = 0.9;
  shake.amp = 7;
  veil.classList.remove("flicker");
  void veil.offsetWidth; // restart the animation on repeat presses
  veil.classList.add("flicker");
  veil.addEventListener("animationend", () => veil.classList.remove("flicker"), { once: true });
  MUSIC.klaxon(); // respects the header mute
  P.flag("pressedButton");
  P.inc("buttonPresses");
}

// One-button remote: off -> ch1 -> ch2 -> ch3 -> off.
function cycleTV(): void {
  tvCh = tvCh >= TV_CHANNELS.length - 1 ? -1 : tvCh + 1;
  if (tvCh >= 0) {
    tvAnimT = 0;
    tvLabelT = 1.8;
  }
}
function talkTo(npc: NPC): void {
  const data = C.characters[npc.key];
  if (!data) return;
  // face the player
  const dx = player.x - npc.x, dy = player.y - npc.y;
  npc.watchDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
  const choices: { label: string; value: string }[] = [];
  const actions: Record<string, () => void> = {};
  const ACT: Record<string, { def: string; run: () => void }> = {
    chess: { def: "♟ Play a game", run: openChess },
    music: { def: "♫ Tap out a beat", run: openBeatpad },
    workout: { def: "◉ Hit the bag", run: openWorkout },
  };
  if (npc.interact && ACT[npc.interact]) {
    choices.push({ label: data.actLabel || ACT[npc.interact].def, value: "act" });
    actions.act = ACT[npc.interact].run;
  }
  if (data.opens) {
    choices.push({ label: data.openLabel || "Show me", value: "open" });
    actions.open = () => HEADER.openPanel(data.opens!);
  }
  const opts: Parameters<typeof DIALOGUE.start>[0] = { charKey: npc.key, name: data.name, color: data.color, lines: data.lines.slice() };
  // Session memory: the first matching unconsumed reaction replaces the
  // opening line, once per page load. Reactions read progress through ctx
  // only, so content.ts stays import-free (no ESM cycle with music.ts).
  const ctx: ReactionCtx = {
    num: (k) => P.num(k as Parameters<typeof P.num>[0]),
    has: (f) => P.hasFlag(f as Parameters<typeof P.hasFlag>[0]),
    trackName: MUSIC.nowPlaying(),
  };
  const fmt = (l: string): string =>
    l.replace(/\{(\w+)\}/g, (_, k: string) => (k === "track" ? (ctx.trackName ?? "the music") : String(ctx.num(k))));
  const reactions = data.reactions || [];
  for (let i = 0; i < reactions.length; i++) {
    const r = reactions[i], id = npc.key + ":" + i;
    if (consumedReactions.has(id)) continue;
    if (!(r.flag ? ctx.has(r.flag) : r.when ? r.when(ctx) : false)) continue;
    consumedReactions.add(id);
    opts.lines = [...r.lines.map(fmt), ...data.lines.slice(1)];
    break;
  }
  if (choices.length) {
    choices.push({ label: data.noLabel || "Maybe later", value: "no" });
    opts.choices = choices;
    opts.onChoice = (v: string) => {
      const fn = actions[v];
      if (fn) fn();
    };
  }
  DIALOGUE.start(opts);
}

function openChess(): void {
  paused = true;
  CHESS.open({ onClose: () => (paused = false) });
}
function openPool(): void {
  paused = true;
  POOL.open({ onClose: () => (paused = false) });
}
function openJukebox(): void {
  paused = true;
  MUSIC.openJukebox({ onClose: () => (paused = false) });
}
function openBeatpad(): void {
  paused = true;
  MUSIC.openBeatpad({ onClose: () => (paused = false) });
}
function openWorkout(): void {
  paused = true;
  WORKOUT.open({ onClose: () => (paused = false) });
}
function openPiano(): void {
  paused = true;
  PIANO.open({ onClose: () => (paused = false) });
}
function openPoker(): void {
  paused = true;
  POKER.open({ onClose: () => (paused = false) });
}
function openGuestbook(): void {
  paused = true;
  GUESTBOOK.open({ onClose: () => (paused = false) });
}

function setHitboxes(v: boolean): void {
  showHitboxes = !!v;
  EDITOR.setVisible(showHitboxes, curRoom);
}

// ---------- movement + doors ----------
function tryMove(dt: number): void {
  if (paused || transitioning || DIALOGUE.isOpen() || anyOverlayOpen()) {
    player.moving = false;
    return;
  }
  if (EDITOR.isEditing()) {
    player.moving = false;
    return;
  }
  let vx = 0, vy = 0;
  if (keys["w"] || keys["arrowup"]) vy -= 1;
  if (keys["s"] || keys["arrowdown"]) vy += 1;
  if (keys["a"] || keys["arrowleft"]) vx -= 1;
  if (keys["d"] || keys["arrowright"]) vx += 1;
  // analog joystick overrides keys; its magnitude scales speed (deadzone .06)
  let mag = vx || vy ? 1 : 0;
  if (joy.active && (joy.x || joy.y)) {
    vx = joy.x;
    vy = joy.y;
    mag = Math.min(1, Math.hypot(joy.x, joy.y));
  }
  player.moving = mag > 0.06;
  if (player.moving) {
    if (Math.abs(vx) > Math.abs(vy)) player.dir = vx < 0 ? "left" : "right";
    else player.dir = vy < 0 ? "up" : "down";
    const len = Math.hypot(vx, vy) || 1;
    const sp = player.speed * dt * 60 * mag;
    const nx = player.x + (vx / len) * sp, ny = player.y + (vy / len) * sp;
    if (EN.freeAt(curRoom, nx, player.y)) player.x = nx;
    if (EN.freeAt(curRoom, player.x, ny)) player.y = ny;
  }
  // door check — entrance hitboxes (world px) from the editable layer
  const fxp = player.x, fyp = player.y - 6;
  const ds = HITBOXES.doors(curRoom);
  let door: HITBOXES.Door | null = null;
  for (const d of ds) {
    if (fxp >= d.x && fxp < d.x + d.w && fyp >= d.y && fyp < d.y + d.h) {
      door = d;
      break;
    }
  }
  if (!door) doorGuard = false;
  else if (!doorGuard) enterRoom(door.to as RoomKey, curRoom);
}

// ---------- transitions ----------
function placeAtSpawn(roomKey: RoomKey, fromRoom?: RoomKey): void {
  let sp = fromRoom ? HITBOXES.spawnFrom(roomKey, fromRoom) : null;
  if (sp && !EN.freeAt(roomKey, sp.x, sp.y)) sp = null;
  if (!sp) sp = HITBOXES.spawn(roomKey);
  if (sp) {
    player.x = sp.x;
    player.y = sp.y;
    player.dir = sp.face || "down";
  } else {
    const h = ROOMS[roomKey].home || [15, 9];
    player.x = h[0] * TS + 16;
    player.y = h[1] * TS + TS - 2;
    player.dir = "down";
  }
  player.moving = false;
}
function enterRoom(to: RoomKey, fromRoom?: RoomKey): void {
  if (transitioning) return;
  if (intro) {
    intro = null;
    player.moving = false;
  } // never let the opening cinematic follow you into another room
  transitioning = true;
  paused = true;
  veil.classList.add("show");
  setTimeout(() => {
    curRoom = to;
    P.flag(`room_${to}`);
    ensureRoom(to);
    placeAtSpawn(to, fromRoom);
    doorGuard = true;
    showRoomLabel();
    EDITOR.setRoom(to);
    veil.classList.remove("show"); // phase IN
    setTimeout(() => {
      transitioning = false;
      paused = false;
    }, 440);
  }, 440);
}
function travelTo(to: RoomKey): void {
  if (to === curRoom) return;
  enterRoom(to);
}

let roomLabelTimer: ReturnType<typeof setTimeout> | null = null;
function showRoomLabel(): void {
  roomLabel.querySelector(".rl-inner")!.textContent = ROOMS[curRoom].label;
  roomLabel.classList.add("show");
  if (roomLabelTimer) clearTimeout(roomLabelTimer);
  roomLabelTimer = setTimeout(() => roomLabel.classList.remove("show"), 2200);
}

// ---------- sound ----------
function toggleSound(btn?: HTMLElement): void {
  soundOn = !soundOn;
  if (btn) btn.classList.toggle("muted", !soundOn);
  MUSIC.setMuted(!soundOn);
}

// ---------- render ----------
function camera(): Camera {
  const v = ROOMS[curRoom].view || { x: 0, y: 0, w: canvas.width, h: canvas.height };
  const s = Math.min(canvas.width / v.w, canvas.height / v.h);
  const ox = (canvas.width - v.w * s) / 2, oy = (canvas.height - v.h * s) / 2;
  return { s, ox, oy, vx: v.x, vy: v.y };
}
function worldToScreen(wx: number, wy: number): Point {
  const c = camera();
  return { x: (wx - c.vx) * c.s + c.ox, y: (wy - c.vy) * c.s + c.oy };
}

// ---------- opening cinematic ----------
function startIntro(): void {
  intro = { sx: player.x, sy: player.y, ty: player.y + 100, dur: 2.8, t: 0, motes: [] };
  for (let i = 0; i < 16; i++)
    intro.motes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 16,
      vy: -10 - Math.random() * 18,
      r: 1.1 + Math.random() * 2.6,
      ph: Math.random() * 6.283,
    });
  player.dir = "down";
  player.moving = true;
}
function stepIntro(dt: number): void {
  if (!intro) return;
  intro.t += dt;
  const p = Math.min(1, intro.t / intro.dur);
  const e = -(Math.cos(Math.PI * p) - 1) / 2; // easeInOutSine
  player.x = intro.sx;
  player.y = intro.sy + (intro.ty - intro.sy) * e;
  player.dir = "down";
  player.moving = p < 1;
  for (const m of intro.motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.y < -6) {
      m.y = canvas.height + 6;
      m.x = Math.random() * canvas.width;
    }
  }
  if (p >= 1) {
    player.moving = false;
    intro = null;
  }
}
function drawIntro(): void {
  if (!intro) return;
  const p = Math.min(1, intro.t / intro.dur);
  const eo = 1 - (1 - p) * (1 - p); // easeOutQuad
  const W2 = canvas.width, H2 = canvas.height;
  const ps = worldToScreen(player.x, player.y - 16);
  ctx.save();
  const Rr = Math.max(46, (0.14 + 0.92 * eo) * Math.hypot(W2, H2) * 0.6);
  const dA = 0.92 * (1 - eo);
  const g = ctx.createRadialGradient(ps.x, ps.y, Rr * 0.32, ps.x, ps.y, Rr);
  g.addColorStop(0, "rgba(7,9,16,0)");
  g.addColorStop(0.72, "rgba(7,9,16," + (dA * 0.55).toFixed(3) + ")");
  g.addColorStop(1, "rgba(7,9,16," + dA.toFixed(3) + ")");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W2, H2);
  const mA = Math.min(1, p / 0.18) * (1 - eo) * 0.85;
  if (mA > 0.01) {
    ctx.fillStyle = "#ffe7ad";
    for (const m of intro.motes) {
      const tw = 0.45 + 0.55 * Math.sin(intro.t * 3.3 + m.ph);
      ctx.globalAlpha = mA * tw;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const bm = H2 * 0.08;
  const bar = p < 0.12 ? bm * (p / 0.12) : p > 0.84 ? bm * Math.max(0, (1 - p) / 0.16) : bm;
  if (bar > 0.5) {
    ctx.fillStyle = "#06080e";
    ctx.fillRect(0, 0, W2, bar);
    ctx.fillRect(0, H2 - bar, W2, bar);
  }
  ctx.restore();
}

// Stamp the current channel frame over the painted lounge TV.
function drawTV(): void {
  const sheet = A.getImage(TV_CHANNELS[tvCh].key);
  if (!sheet || !sheet.complete || !sheet.naturalWidth) return;
  const f = Math.floor(tvAnimT * A.TV_FPS) % A.TV_FRAMES;
  ctx.drawImage(sheet, f * A.TV_FW + A.TV_SX, A.TV_SY, A.TV_SW, A.TV_SH, TV_RECT.x, TV_RECT.y, TV_RECT.w, TV_RECT.h);
}

interface Drawable {
  y: number;
  fn: () => void;
}
function render(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cam = camera();
  // red-button camera shake — random jitter that eases out over shake.dur
  let shx = 0, shy = 0;
  if (shake.dur > 0 && shake.t < shake.dur) {
    const k = 1 - shake.t / shake.dur;
    shx = (Math.random() * 2 - 1) * shake.amp * k * k;
    shy = (Math.random() * 2 - 1) * shake.amp * k * k;
  }
  ctx.save();
  ctx.translate(cam.ox + shx, cam.oy + shy);
  ctx.scale(cam.s, cam.s);
  ctx.translate(-cam.vx, -cam.vy);
  const img = A.getImage(ROOM_IMG[curRoom]);
  if (img && img.complete) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const R = ensureRoom(curRoom);
  const top = A.getImage(TOP_IMG[curRoom]);
  const propsImg = A.getImage(PROPS_IMG[curRoom]);
  const depth = HITBOXES.depth(curRoom);
  const draw: Drawable[] = [];
  R.npcs.forEach((n) =>
    draw.push({
      y: n.y,
      fn: () => {
        S.drawShadow(ctx, n.x, n.y, 28, 1);
        S.drawChar(ctx, n.char, n.x, n.y + 2, n.dir, n.moving, n.frame, 1);
      },
    }),
  );
  (R.pets || []).forEach((p) =>
    draw.push({
      y: p.y,
      fn: () => {
        S.drawShadow(ctx, p.x, p.y, p.w * 0.92, 1);
        S.drawPet(ctx, p.kind, p.x, p.y, p.state, p.frame, p.w, p.h);
      },
    }),
  );
  // The DO NOT PRESS button — wall plate + glowing dome, drawn procedurally.
  (R.objs || []).forEach((o) => {
    if (o.type !== "redbutton") return;
    draw.push({
      y: o.y + 8, // wall-mounted at the bottom edge: always in front of feet
      fn: () => {
        const bx = o.x, by = o.y + 2; // plate anchor on the south-wall baseboard
        const pressed = btnPressT > 0;
        // steel plate
        ctx.fillStyle = "#20202a";
        ctx.fillRect(bx - 12, by - 1, 24, 16);
        ctx.fillStyle = "#3a3a44";
        ctx.fillRect(bx - 11, by, 22, 14);
        // warning placard
        ctx.fillStyle = "#f4ead6";
        ctx.fillRect(bx - 8, by - 7, 16, 5);
        ctx.strokeStyle = "#d5392c";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx - 8, by - 2.5);
        ctx.lineTo(bx + 8, by - 6.5);
        ctx.stroke();
        // dome (sits 2px lower while pressed)
        const dy = pressed ? 2 : 0;
        const glow = 0.25 + 0.2 * Math.sin(worldT * 2.2);
        ctx.beginPath();
        ctx.arc(bx, by + 7 + dy, 8, 0, 7);
        ctx.fillStyle = "#7d1c12";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by + 6 + dy, 7, 0, 7);
        ctx.fillStyle = "#d5392c";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx - 2, by + 4 + dy, 2.5, 0, 7);
        ctx.fillStyle = "#ff8a70";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by + 6 + dy, 9.5, 0, 7);
        ctx.strokeStyle = `rgba(255,90,60,${(pressed ? 0.8 : glow).toFixed(3)})`;
        ctx.lineWidth = pressed ? 2.5 : 1.5;
        ctx.stroke();
      },
    });
  });

  // Animated jukebox speaker
  (R.objs || []).forEach((o) => {
    if (o.sprite !== "speaker") return;
    draw.push({
      y: o.y,
      fn: () => {
        const audible = MUSIC.isAudible();
        const fr = audible ? Math.floor(musicAnimT * 8) : 0;
        const lvl = audible ? MUSIC.level() : 0;
        const bob = audible ? Math.sin(performance.now() / 110) * (0.5 + lvl * 1.6) : 0;
        const spkW = A.SPK_FW * SPK_SCALE;
        S.drawShadow(ctx, o.x, o.y, spkW / 0.84, 1);
        S.drawSpeaker(ctx, o.x, o.y - bob, fr, SPK_SCALE);
      },
    });
  });
  draw.push({
    y: player.y,
    fn: () => {
      S.drawShadow(ctx, player.x, player.y, 28, 1);
      S.drawChar(ctx, player.char, player.x, player.y + 2, player.dir, player.moving, player.frame, 1);
    },
  });
  depth.forEach((o) =>
    draw.push({
      y: o.baseY,
      fn: () => {
        if (propsImg && propsImg.complete) ctx.drawImage(propsImg, o.x, o.y, o.w, o.h, o.x, o.y, o.w, o.h);
        if (top && top.complete) ctx.drawImage(top, o.x, o.y, o.w, o.h, o.x, o.y, o.w, o.h);
      },
    }),
  );
  // Lounge TV: the live channel y-sorts at the TV console's depth line.
  if (curRoom === "lounge" && tvCh >= 0) draw.push({ y: TV_RECT.baseY, fn: drawTV });
  draw.sort((a, b) => a.y - b.y);
  draw.forEach((d) => d.fn());

  // Foreground (top layer) above everything except where a depth box painted it.
  if (top && top.complete) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    depth.forEach((o) => ctx.rect(o.x, o.y, o.w, o.h));
    ctx.clip("evenodd");
    ctx.drawImage(top, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // ---- DEV hitbox + editor overlay ----
  if (showHitboxes) {
    const solids = HITBOXES.solids(curRoom);
    ctx.lineWidth = 1.5 / cam.s;
    solids.forEach((r) => {
      ctx.fillStyle = "rgba(255,45,45,0.24)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(255,80,80,0.85)";
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    });
    depth.forEach((o) => {
      ctx.fillStyle = "rgba(60,140,255,0.14)";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = "rgba(90,165,255,0.85)";
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = "rgba(255,215,40,0.95)";
      ctx.beginPath();
      ctx.moveTo(o.x, o.baseY);
      ctx.lineTo(o.x + o.w, o.baseY);
      ctx.stroke();
    });
    const fw = EN.FEET_W, fh = EN.FEET_H;
    ctx.lineWidth = 2 / cam.s;
    ctx.strokeStyle = "#39ff14";
    ctx.strokeRect(player.x - fw / 2, player.y - fh, fw, fh);
    ctx.strokeStyle = "#19d3ff";
    R.npcs.forEach((n) => ctx.strokeRect(n.x - fw / 2, n.y - fh, fw, fh));

    const ds = HITBOXES.doors(curRoom);
    const RL: Record<string, string> = { lounge: "LOUNGE", gym: "GYM", game: "GAME", music: "MUSIC" };
    ctx.lineWidth = 1.5 / cam.s;
    ds.forEach((d) => {
      ctx.fillStyle = "rgba(80,220,140,0.16)";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.strokeStyle = "rgba(95,235,150,0.9)";
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = "rgba(180,255,210,0.95)";
      ctx.font = "bold " + 10 / cam.s + "px monospace";
      ctx.textAlign = "center";
      ctx.fillText("→ " + (RL[d.to] || d.to), d.x + d.w / 2, d.y + d.h / 2 + 3.5 / cam.s);
    });
    ctx.textAlign = "left";

    const sp = HITBOXES.spawn(curRoom);
    if (sp) {
      ctx.fillStyle = "rgba(231,163,62,0.9)";
      ctx.strokeStyle = "#1c1206";
      ctx.lineWidth = 1.5 / cam.s;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 7 / cam.s, 0, 7);
      ctx.fill();
      ctx.stroke();
      const a = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[sp.face || "down"];
      const L0 = 8 / cam.s, L1 = 15 / cam.s;
      ctx.strokeStyle = "#e7a33e";
      ctx.lineWidth = 2.5 / cam.s;
      ctx.beginPath();
      ctx.moveTo(sp.x + a[0] * L0, sp.y + a[1] * L0);
      ctx.lineTo(sp.x + a[0] * L1, sp.y + a[1] * L1);
      ctx.stroke();
      ctx.fillStyle = "#e7a33e";
      ctx.font = "bold " + 8.5 / cam.s + "px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SPAWN", sp.x, sp.y - 11 / cam.s);
      ctx.textAlign = "left";
    }
    if (EDITOR.isEditing()) EDITOR.drawOverlay(ctx, cam);
  }

  // interaction marker above near target
  nearTarget = !intro && !paused && !transitioning && !DIALOGUE.isOpen() && !anyOverlayOpen() ? findNear() : null;
  if (nearTarget) {
    const t = nearTarget;
    const bob = Math.sin(performance.now() / 240) * 3;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#e7a33e";
    const mYoff =
      t.kind === "npc"
        ? 66
        : t.kind === "pet"
          ? (t.ref.h || 30) + 8
          : t.ref.markerY != null
            ? t.ref.markerY
            : t.ref.sprite === "speaker"
              ? 64
              : 30;
    const mx = t.x, my = t.y - mYoff + bob;
    ctx.beginPath();
    ctx.moveTo(mx - 7, my);
    ctx.lineTo(mx + 7, my);
    ctx.lineTo(mx, my + 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  if (showHitboxes) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(8, 8, 196, 24);
    ctx.fillStyle = "#39ff14";
    ctx.font = "12px monospace";
    ctx.fillText("DEV HITBOXES ON — press H", 14, 24);
    ctx.restore();
  }
  // Channel-name flash above the TV when a channel is selected (screen space).
  if (curRoom === "lounge" && tvCh >= 0 && tvLabelT > 0) {
    const p = worldToScreen(TV_RECT.x + TV_RECT.w / 2, TV_RECT.y - 5);
    const label = "CH " + (tvCh + 1) + "   " + TV_CHANNELS[tvCh].label;
    ctx.save();
    ctx.globalAlpha = Math.min(1, tvLabelT / 0.4);
    ctx.font = "14px 'Silkscreen', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const bw = ctx.measureText(label).width + 18, bh = 22, bx = p.x - bw / 2, by = p.y - bh;
    ctx.fillStyle = "rgba(16,19,28,0.88)";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#e7a33e";
    ctx.fillRect(bx, by, bw, 2);
    ctx.fillStyle = "#f4ead6";
    ctx.fillText(label, p.x, by + 15);
    ctx.restore();
    ctx.textAlign = "left";
  }
  drawIntro(); // opening cinematic overlay (no-op once finished)
  updateHint();
}
function updateHint(): void {
  if (nearTarget) {
    let txt = "Talk";
    if (nearTarget.kind === "obj") {
      const ref = nearTarget.ref;
      if (ref.type === "tv") txt = tvCh < 0 ? "Turn on TV" : tvCh >= TV_CHANNELS.length - 1 ? "Turn off TV" : "Change channel";
      else txt = ref.hint || "Use";
    } else if (nearTarget.kind === "pet") {
      txt = nearTarget.ref.hint || "Pet";
    } else {
      const ref = nearTarget.ref;
      if (ref.interact === "chess") txt = "Play chess";
      else if (ref.interact === "music") txt = "Make a beat";
      else if (ref.interact === "workout") txt = "Train with Gojo";
      else txt = "Talk to " + (C.characters[ref.key]?.name || ref.name);
    }
    hintEl.querySelector(".hint-text")!.textContent = txt;
    hintEl.classList.remove("hidden");
  } else hintEl.classList.add("hidden");
}

// ---------- loop ----------
let lastFrameAt = 0;
function frame(ts: number): void {
  if (!running) return;
  lastFrameAt = performance.now();
  try {
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    if (dt > 0.05) dt = 0.05;
    lastTs = ts;
    if (!paused && !transitioning) {
      if (intro) stepIntro(dt);
      else tryMove(dt);
      const R = ensureRoom(curRoom);
      R.npcs.forEach((n) => EN.stepNPC(n, curRoom, dt));
      (R.pets || []).forEach((p) => EN.stepPet(p, dt));
    }
    player.animT += dt;
    player.frame = Math.floor(player.animT * (player.moving ? 9 : 3));
    musicAnimT += dt;
    tvAnimT += dt;
    worldT += dt;
    if (tvLabelT > 0) tvLabelT = Math.max(0, tvLabelT - dt);
    if (shake.dur > 0) shake.t += dt;
    if (btnCooldown > 0) btnCooldown = Math.max(0, btnCooldown - dt);
    if (btnPressT > 0) btnPressT = Math.max(0, btnPressT - dt);
    render();
    DIALOGUE.tick(ts);
  } catch (err) {
    console.error("frame error", err);
  }
  requestAnimationFrame(frame);
}

function start(): void {
  ensureRoom("lounge");
  P.flag("room_lounge");
  placeAtSpawn("lounge");
  startIntro();
  resize();
  bindInput();
  running = true;
  lastTs = 0;
  showRoomLabel();
  try {
    render();
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(frame);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && running && performance.now() - lastFrameAt > 250) {
      lastTs = 0;
      requestAnimationFrame(frame);
    }
  });
  // watchdog: keep the world updating if RAF was suspended (tab backgrounded)
  setInterval(() => {
    if (running && performance.now() - lastFrameAt > 200) frame(performance.now());
  }, 90);
}

export const GAME: GameApi & { _dbg(): unknown; _tp(x: number, y: number): void } = {
  start,
  resize,
  pause: (v: boolean) => {
    paused = v;
  },
  currentRoom: () => curRoom,
  travelTo,
  toggleSound,
  isPaused: () => paused,
  isIntro: () => !!intro,
  toggleHitboxes: () => {
    setHitboxes(!showHitboxes);
    return showHitboxes;
  },
  setHitboxes,
  camera: () => camera(),
  canvasEl: () => canvas,
  screenToWorld: (clientX: number, clientY: number): Point => {
    const rect = canvas.getBoundingClientRect();
    const cx = (clientX - rect.left) * (canvas.width / rect.width);
    const cy = (clientY - rect.top) * (canvas.height / rect.height);
    const c = camera();
    return { x: (cx - c.ox) / c.s + c.vx, y: (cy - c.oy) / c.s + c.vy };
  },
  _dbg: () => ({
    x: Math.round(player.x),
    y: Math.round(player.y),
    dir: player.dir,
    transitioning,
    paused,
    keys: Object.keys(keys).filter((k) => keys[k]),
    npcs: rooms[curRoom] ? rooms[curRoom]!.npcs.map((n) => ({ k: n.key, x: Math.round(n.x), y: Math.round(n.y) })) : [],
    pets: rooms[curRoom] && rooms[curRoom]!.pets ? rooms[curRoom]!.pets.map((p) => ({ k: p.kind, state: p.state, frame: p.frame })) : [],
  }),
  _tp: (x: number, y: number) => {
    player.x = x * TS + 16;
    player.y = y * TS + 30;
  },
};
