/* ============================================================
   POOL — 8-ball vs. Drod. Full ball physics, ghost-ball AI,
   slingshot aiming with a trajectory guide, synth SFX + banter.
   Mirrors the chess overlay's shape (board canvas + Drod panel).
   ============================================================ */
import { drawPortraitFrame } from "../sprites";
import { pick } from "../core/util";
import * as P from "../progress";
import { openOverlay, closeOverlay, isOverlayOpen, overlayInner, startLoop, type LoopHandle } from "./base";

interface OpenOpts {
  onClose?: () => void;
}

/* ---------------- table geometry (canvas px) ---------------- */
const CW = 684, CH = 372; // canvas size
const railL = 44, railT = 44, railR = 640, railB = 328; // cushion faces
const midX = (railL + railR) / 2, midY = (railT + railB) / 2;
const PW = railR - railL, PH = railB - railT;
const R = 10, BALL = R * 2; // ball radius / diameter
const CAP = R + 7; // pocket capture radius
const MC = 24, MS = 20; // cushion mouth gaps (corner, side)

interface Vec2 {
  x: number;
  y: number;
}
const POCKETS: Vec2[] = [
  { x: railL, y: railT }, { x: midX, y: railT }, { x: railR, y: railT },
  { x: railL, y: railB }, { x: midX, y: railB }, { x: railR, y: railB },
];
// Pocket "jaws": the rounded cushion tips framing each pocket mouth.
const JAWR = R * 0.2; // rubber-tip radius (collide at R+JAWR)
const JAWS: Vec2[] = [
  { x: railL, y: railT + MC }, { x: railL + MC, y: railT }, // top-left corner
  { x: railR, y: railT + MC }, { x: railR - MC, y: railT }, // top-right corner
  { x: railL, y: railB - MC }, { x: railL + MC, y: railB }, // bottom-left corner
  { x: railR, y: railB - MC }, { x: railR - MC, y: railB }, // bottom-right corner
  { x: midX - MS, y: railT }, { x: midX + MS, y: railT }, // top side pocket
  { x: midX - MS, y: railB }, { x: midX + MS, y: railB }, // bottom side pocket
];

/* ---------------- physics tuning ---------------- */
const H = 1 / 120; // fixed physics step (s)
const DECAY = 0.992; // velocity multiplier / step
const ROLL = 0.55; // constant rolling resistance
const STOP = 7; // speed below which a ball halts (px/s)
const CUSH = 0.86; // cushion restitution
const BB = 0.96; // ball-ball restitution
const VMAX = 1020; // top cue speed at power 1 (px/s)
const VMIN = 150; // floor so a tap still moves

/* ---------------- ball palette (standard pool) ---------------- */
const COLORS: Record<number, string> = {
  1: "#f3c12b", 2: "#2f5ccf", 3: "#d5392c", 4: "#6f3fb0", 5: "#e67e22", 6: "#2e8f54", 7: "#9a3b2f",
  8: "#1b1b1f", 9: "#f3c12b", 10: "#2f5ccf", 11: "#d5392c", 12: "#6f3fb0", 13: "#e67e22", 14: "#2e8f54", 15: "#9a3b2f",
};
type BallType = "cue" | "eight" | "solid" | "stripe";
const typeOf = (id: number): BallType => (id === 0 ? "cue" : id === 8 ? "eight" : id < 8 ? "solid" : "stripe");

/* ---------------- difficulty ---------------- */
interface Level {
  name: string;
  err: number;
  power: number;
  label: string;
}
const LEVELS: Record<string, Level> = {
  chill: { name: "Chill", err: 0.08, power: 0.82, label: "happy to miss" },
  normal: { name: "Normal", err: 0.026, power: 0.9, label: "he's focused" },
  sweat: { name: "Sweat", err: 0.005, power: 0.97, label: "dead-eye Drod" },
};

/* ---------------- banter (Drod's voice) ---------------- */
const LINES = {
  intro: {
    chill: ["Pool, huh? Sure. I'll keep the cue chalked and the ego low.", "Chill rack. I'll pretend the pockets are smaller than they are."],
    normal: ["Eight-ball. I rack, you break, we both pretend we meant every shot.", "Alright. I actually watch the angles on this setting. Fair warning."],
    sweat: ["Oh, you want the real me. Geometry was the one thing Ryan got right.", "Sweat mode. I see every line on this table. Good luck finding one I don't."],
  } as Record<string, string[]>,
  breakYou: ["Send it. Let's see some chaos.", "Break hard. I dare you."],
  breakDrod: ["Watch the wrists.", "Rack's tight. This'll scatter nice."],
  potYou: ["Okay, that one was clean.", "Show-off.", "Hey, nice. Don't get cocky.", "Fine. Good pot."],
  potDrod: ["And that's how it's done.", "Mine. Obviously.", "Pocket's a magnet today.", "Too easy."],
  missYou: ["So close. The pocket flinched.", "Rattled it. Painful.", "Almost. I felt that one."],
  missDrod: ["Ugh. The cloth lied to me.", "I meant to do that. Strategy.", "Pretend you didn't see that."],
  scratchYou: ["Scratch. Ball's in my hand now. Thank you.", "Cue ball went swimming. My turn, my placement."],
  scratchDrod: ["...I scratched. Don't tell Ryan.", "Okay that's embarrassing. Cue ball's yours, go on."],
  foulYou: ["Foul. I get ball in hand. Generous of you.", "Tsk. That's a foul. I'll take the gift."],
  foulDrod: ["That's on me. Foul. Take the cue, place it wherever stings."],
  groupYou: ["You're {g} now. Wear it well.", "{g} it is for you. The rest are mine."],
  groupDrod: ["I'll take {g}. Suits me."],
  eight: ["Just the 8 left for you. No pressure. Tons of pressure.", "One black ball between you and bragging rights."],
  eightDrod: ["Last ball. Call the priest.", "Just the 8 for me. This was fun while it lasted for you."],
  win: ["GG. The table remembers who built it.", "Rematch? I'm magnanimous in victory.", "Don't feel bad. I'm literally made of angles."],
  lose: ["...okay. That was genuinely good. Respect.", "You beat me. I'm telling Ryan to nerf you.", "Fine! Take the win. I'll be over here recalculating."],
  idle: ["Take your time. The felt's not going anywhere.", "Line it up. I can wait all day, I don't blink.", "You good? The balls aren't moving on their own.", "Ryan watches these, you know. No pressure."],
  trickIntro: ["Trick shots? The owner set these up, then made me practice the failures.", "Eight shots. Three tries each. The felt remembers everything."],
  trickPass: ["Clean. Annoyingly clean.", "Okay, that worked. Don't let it go to your head.", "The pocket accepts your offering."],
  trickPerfect: ["Three stars. Fine. FINE.", "First try?! I'm checking the replay for wires."],
  trickFail: ["That's a zero. The balls reset, the shame lingers.", "Washout. Even the cue ball looked away."],
  trickDone: ["Gauntlet's done. The table will be talking about this either way.", "That's the lot. Want the owner's scores? No you don't. They're embarrassing."],
};

/* ---------------- state ---------------- */
interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  out: boolean;
  sink?: number;
  px?: number;
  py?: number;
  _drag?: boolean;
}
type Phase = "diff" | "aim" | "place" | "shooting" | "over";
type Side = "you" | "drod";
interface CueGlide {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t0: number;
  dur: number;
  then: (() => void) | null;
}
interface Plan {
  angle: number;
  power: number;
  dist: number;
  quality: number;
  score: number;
}

let balls: Ball[] = [];
let level: Level = LEVELS.normal;
let loop: LoopHandle | null = null;
let acc = 0;
let phase: Phase = "diff";
let turn: Side = "you";
let groups: { you: BallType | null; drod: BallType | null } = { you: null, drod: null };
let isBreak = true, openTable = true;
let ballInHand = false;
let aiming = false, aimAngle = 0, power = 0;
let dragId = 0;
let cueGlide: CueGlide | null = null;
let over = false, winner: Side | null = null;
let onClose: (() => void) | null = null;
let bctx: CanvasRenderingContext2D | null = null;
let cnv: HTMLCanvasElement | null = null;

// per-shot bookkeeping
let shotPotted: number[] = [], shotFirstHit: number | null = null, shotCueScratch = false, shotRail = false;
let groupClearedAtStart: { you: boolean; drod: boolean } = { you: false, drod: false };
// trick-shot extras: which balls touched a rail + cue-rail-after-contact
let ballRail: Record<number, boolean> = {};
let shotCueRailAfterContact = false;

/* ---------------- trick-shot gauntlet ---------------- */
type Mode = "8ball" | "trick";
let mode: Mode = "8ball";
const TRICK_LS_KEY = "rw_pool_trick";
interface TrickLayout {
  name: string;
  obj: string;
  cue: Vec2;
  balls: { id: number; x: number; y: number }[];
  targets: number[]; // potting anything else fails the attempt
  check(): boolean;
}
const potted = (id: number): boolean => shotPotted.includes(id);
const sunkAt = (id: number, px: number, py: number): boolean => {
  const b = balls.find((x) => x.id === id);
  return !!b && b.out && b.px === px && b.py === py;
};
const TRICKS: TrickLayout[] = [
  // layout geometry note: every pot line was checked against the pocket jaws
  // (tips at MC/MS with radius R+JAWR) — corner pockets need a diagonal
  // approach, so target balls sit off-rail with a clear lane to the hole.
  { name: "Tap-in", obj: "Sink the solid. Any pocket. Warm up.", cue: { x: 200, y: 200 }, balls: [{ id: 1, x: 540, y: 140 }], targets: [1], check: () => potted(1) },
  { name: "Cut shot", obj: "Cut the solid into the bottom-right corner pocket.", cue: { x: 200, y: 120 }, balls: [{ id: 2, x: 480, y: 240 }], targets: [2], check: () => sunkAt(2, railR, railB) },
  { name: "Bank it", obj: "Stripes guard the left pockets. Bounce the solid off a cushion, then sink it.", cue: { x: 380, y: 240 }, balls: [{ id: 3, x: 340, y: 200 }, { id: 11, x: 160, y: 150 }, { id: 12, x: 160, y: 186 }, { id: 13, x: 160, y: 222 }], targets: [3], check: () => potted(3) && !!ballRail[3] },
  { name: "Combo", obj: "Knock the solid into the stripe — only the stripe drops.", cue: { x: 170, y: 186 }, balls: [{ id: 4, x: 420, y: 210 }, { id: 9, x: 480, y: 180 }], targets: [9], check: () => shotFirstHit === 4 && potted(9) && !potted(4) },
  { name: "Thread the needle", obj: "Thread the stripe gap, then sink the solid.", cue: { x: 170, y: 186 }, balls: [{ id: 10, x: 340, y: 150 }, { id: 11, x: 340, y: 222 }, { id: 5, x: 540, y: 150 }], targets: [5], check: () => potted(5) },
  { name: "Soft touch", obj: "Sink the solid top-right — the cue ball must never touch a cushion after contact.", cue: { x: 509, y: 165 }, balls: [{ id: 6, x: 590, y: 90 }], targets: [6], check: () => potted(6) && !shotCueRailAfterContact },
  { name: "Two birds", obj: "Drive the cue ball dead between the two solids, full power — both must drop.", cue: { x: 180, y: 186 }, balls: [{ id: 4, x: 510, y: 172 }, { id: 7, x: 510, y: 200 }], targets: [4, 7], check: () => potted(4) && potted(7) },
  { name: "The Drod Special", obj: "Call it: the 8-ball, TOP side pocket. Nothing else counts.", cue: { x: 421, y: 263 }, balls: [{ id: 8, x: 380, y: 150 }], targets: [8], check: () => sunkAt(8, midX, railT) },
];
const trick = { li: 0, attempt: 1, stars: [0, 0, 0, 0, 0, 0, 0, 0] };
function loadTrickStars(): void {
  try {
    const raw = localStorage.getItem(TRICK_LS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      if (Array.isArray(arr) && arr.length === 8 && arr.every((n) => typeof n === "number")) for (let i = 0; i < 8; i++) trick.stars[i] = Math.max(0, Math.min(3, arr[i]));
    }
  } catch {
    /* corrupted */
  }
}
function saveTrickStars(): void {
  try {
    localStorage.setItem(TRICK_LS_KEY, JSON.stringify(trick.stars));
  } catch {
    /* private mode */
  }
  P.record("trickshotStars", trick.stars.reduce((a, b) => a + b, 0));
}

// portrait / bubble
let portT = 0, talkUntil = 0, bubble = "", thinking = false, lastIdle = 0;

// SFX
let ac: AudioContext | null = null;
let poolKey: ((e: KeyboardEvent) => void) | null = null;

/* ====================== helpers ====================== */
function say(t: string, dur?: number): void {
  bubble = t;
  talkUntil = performance.now() + (dur || 2600);
}
const cueBall = (): Ball | undefined => balls.find((b) => b.id === 0);
function setStatus(t: string): void {
  const s = document.getElementById("plStatus");
  if (s) s.textContent = t;
}

/* ====================== audio (synth SFX) ====================== */
const AudioCtor: typeof AudioContext =
  window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
function ensureAC(): AudioContext | null {
  if (!ac) {
    try {
      ac = new AudioCtor();
    } catch {
      ac = null;
    }
  }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}
function sfxClick(speed: number): void {
  const a = ensureAC();
  if (!a) return;
  const v = Math.min(1, speed / 700);
  const o = a.createOscillator(), g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(420 + v * 520, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(180, a.currentTime + 0.05);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.05 + v * 0.16, a.currentTime + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.09);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.1);
}
function sfxCushion(speed: number): void {
  const a = ensureAC();
  if (!a) return;
  const v = Math.min(1, speed / 700);
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(70, a.currentTime + 0.07);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.04 + v * 0.1, a.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.12);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.13);
}
function sfxPocket(): void {
  const a = ensureAC();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(300, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(90, a.currentTime + 0.22);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.16, a.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.32);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.34);
}

/* ====================== open / close ====================== */
export function open(opts?: OpenOpts): void {
  onClose = opts?.onClose ?? null;
  openOverlay(shell());
  cnv = document.getElementById("plTable") as HTMLCanvasElement;
  bctx = cnv.getContext("2d");
  if (bctx) bctx.imageSmoothingEnabled = true;
  buildBg();
  wire();
  phase = "diff";
  portT = 0;
  bubble = "";
  thinking = false;
  over = false;
  winner = null;
  balls = [];
  loadTrickStars();
  showScreen("mode");
  setStatus("Pick a game");
  acc = 0;
  loop = startLoop(step);
}

/** Read-only debug snapshot (matches the GAME._dbg convention). */
export function _dbg(): unknown {
  return {
    phase,
    turn,
    over,
    winner,
    groups: { ...groups },
    openTable,
    isBreak,
    ballInHand,
    onTable: balls.filter((b) => !b.out).map((b) => b.id).sort((a, b) => a - b),
    potted: balls.filter((b) => b.out).map((b) => b.id).sort((a, b) => a - b),
  };
}
export function close(): void {
  closeOverlay();
  loop?.stop();
  loop = null;
  if (poolKey) {
    window.removeEventListener("keydown", poolKey);
    poolKey = null;
  }
  const fn = onClose;
  if (fn) fn();
}
export function isOpen(): boolean {
  return isOverlayOpen();
}

/* ====================== DOM shell ====================== */
function shell(): string {
  return `<div class="pool-wrap">
      <div class="pool-left">
        <div class="pl-frame"><canvas id="plTable" width="${CW}" height="${CH}"></canvas>
          <div id="plOver" class="pl-over hidden"></div>
        </div>
        <div class="pl-status" id="plStatus">Choose a difficulty</div>
      </div>
      <div class="pool-right">
        <button class="chess-x" id="plClose">✕</button>
        <div class="drod-card">
          <div class="drod-port"><canvas id="plPort" width="96" height="96"></canvas></div>
          <div class="drod-meta"><div class="drod-name">DROD</div><div class="drod-sub" id="plLevel">rack &amp; ruin</div></div>
        </div>
        <div class="drod-bubble" id="plBubble"></div>
        <div class="chess-diff" id="plMode">
          <div class="diff-title">What's the game?</div>
          <button class="diff-btn" id="plMode8"><b>8-Ball vs Drod</b><small>the classic — solids, stripes, trash talk</small></button>
          <button class="diff-btn" id="plModeTrick"><b>Trick Shots</b><small>8 set-piece puzzles · 3 tries · ★★★</small></button>
        </div>
        <div class="chess-diff hidden" id="plDiff">
          <div class="diff-title">Pick your poison</div>
          ${Object.entries(LEVELS).map(([k, v]) => `<button class="diff-btn" data-lv="${k}"><b>${v.name}</b><small>${v.label}</small></button>`).join("")}
        </div>
        <div class="pool-play hidden" id="plPlay">
          <div class="pl-groups" id="plGroups">
            <div class="pl-side" id="plSideYou"><span class="pl-who">YOU</span><div class="pl-balls" id="plRackYou"></div></div>
            <div class="pl-turn" id="plTurn">●</div>
            <div class="pl-side" id="plSideDrod"><span class="pl-who">DROD</span><div class="pl-balls" id="plRackDrod"></div></div>
          </div>
          <div class="pl-trickrack hidden" id="plTrickRack"></div>
          <div class="pl-power"><span class="pl-power-lbl">POWER</span><div class="pl-power-bar"><div class="pl-power-fill" id="plPowerFill"></div></div></div>
          <div class="ctl-btns">
            <button class="ctl-btn" id="plNew">↺ Menu</button>
            <button class="ctl-btn ghost" id="plResign">Resign</button>
          </div>
        </div>
        <div class="pool-tip" id="plTip">Drag back from the cue ball to aim and load power · release to shoot · or ←/→ aim, ↑/↓ power, space shoots</div>
      </div>
    </div>`;
}

let kbPower = 0; // keyboard-aim power (0..1)
function wire(): void {
  (document.getElementById("plClose") as HTMLElement).onclick = close;
  (document.getElementById("plMode8") as HTMLElement).onclick = () => {
    mode = "8ball";
    showScreen("diff");
    setStatus("Choose a difficulty");
  };
  (document.getElementById("plModeTrick") as HTMLElement).onclick = () => startTrick();
  overlayInner().querySelectorAll<HTMLElement>("#plDiff .diff-btn").forEach((b) => {
    b.onclick = () => {
      level = LEVELS[b.getAttribute("data-lv")!];
      startGame();
    };
  });
  poolKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
      return;
    }
    // keyboard aiming — both modes, only while it's your shot
    if (phase !== "aim" || turn !== "you" || over || cueGlide) return;
    const k = e.key;
    const rot = e.shiftKey ? 0.05 : 0.012;
    if (k === "ArrowLeft" || k === "ArrowRight") {
      e.preventDefault();
      aimAngle += (k === "ArrowLeft" ? -1 : 1) * rot;
    } else if (k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      kbPower = Math.max(0, Math.min(1, kbPower + (k === "ArrowUp" ? 0.06 : -0.06)));
      power = kbPower;
      const pf = document.getElementById("plPowerFill");
      if (pf) pf.style.width = kbPower * 100 + "%";
    } else if (k === " " || e.code === "Space") {
      e.preventDefault();
      if (kbPower > 0.04) {
        const pw = kbPower;
        kbPower = 0;
        power = 0;
        const pf = document.getElementById("plPowerFill");
        if (pf) pf.style.width = "0%";
        shoot(aimAngle, pw);
      }
    }
  };
  window.addEventListener("keydown", poolKey);
  // pointer (aim + cue placement)
  cnv!.addEventListener("pointerdown", onDown);
  cnv!.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
/** Which right-panel screen is visible: mode select, difficulty, or play. */
function showScreen(which: "mode" | "diff" | "play"): void {
  document.getElementById("plMode")!.classList.toggle("hidden", which !== "mode");
  document.getElementById("plDiff")!.classList.toggle("hidden", which !== "diff");
  document.getElementById("plPlay")!.classList.toggle("hidden", which !== "play");
  const bub = document.getElementById("plBubble");
  if (bub) bub.classList.toggle("no-slot", which !== "play");
}
function showDiff(show: boolean): void {
  showScreen(show ? "diff" : "play");
  // 8-ball vs trick chrome inside the play panel
  document.getElementById("plGroups")!.classList.toggle("hidden", mode === "trick");
  document.getElementById("plTrickRack")!.classList.toggle("hidden", mode !== "trick");
  (document.getElementById("plResign") as HTMLElement).style.display = mode === "trick" ? "none" : "";
}

/* ====================== game setup ====================== */
function rack(): void {
  balls = [];
  // cue ball at the head spot
  balls.push({ id: 0, x: railL + PW * 0.24, y: midY, vx: 0, vy: 0, out: false });
  // standard-ish triangle: 8 in the centre, corners one of each type, rest filled
  const order = [1, 9, 2, 10, 8, 3, 11, 12, 4, 13, 5, 14, 6, 15, 7];
  const apexX = railL + PW * 0.66;
  const dx = R * Math.sqrt(3) * 1.02, dy = R * 1.02;
  let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      const id = order[k++];
      balls.push({ id, x: apexX + row * dx, y: midY + (j * 2 - row) * dy, vx: 0, vy: 0, out: false });
    }
  }
}
function startGame(): void {
  rack();
  document.getElementById("plLevel")!.textContent = level.name + " — " + level.label;
  groups = { you: null, drod: null };
  openTable = true;
  isBreak = true;
  turn = "you";
  over = false;
  winner = null;
  ballInHand = false;
  aiming = false;
  power = 0;
  cueGlide = null;
  phase = "aim";
  showDiff(false);
  hideOver();
  say(pick(LINES.intro[Object.keys(LEVELS).find((k) => LEVELS[k] === level)!]), 3600);
  setStatus("Your break. Drag back from the cue ball.");
  updateRacks();
  updateTurn();
  (document.getElementById("plNew") as HTMLElement).onclick = () => {
    phase = "diff";
    hideOver();
    showScreen("mode");
    setStatus("Pick a game");
    say(pick(LINES.intro.normal), 2600);
  };
  (document.getElementById("plResign") as HTMLElement).onclick = () => {
    if (!over) finish("drod", "You resigned. Drod gloats.");
  };
}

/* ====================== trick-shot mode ====================== */
function startTrick(): void {
  mode = "trick";
  level = LEVELS.normal;
  document.getElementById("plLevel")!.textContent = "Trick Shots — ★ hunting";
  groups = { you: null, drod: null };
  openTable = false;
  isBreak = false;
  turn = "you";
  over = false;
  winner = null;
  ballInHand = false;
  aiming = false;
  power = 0;
  kbPower = 0;
  cueGlide = null;
  trick.li = 0;
  trick.attempt = 1;
  showDiff(false);
  hideOver();
  say(pick(LINES.trickIntro), 3400);
  loadTrick(0);
  (document.getElementById("plNew") as HTMLElement).onclick = () => {
    phase = "diff";
    hideOver();
    showScreen("mode");
    setStatus("Pick a game");
  };
}

function loadTrick(i: number): void {
  const L = TRICKS[i];
  trick.li = i;
  balls = [{ id: 0, x: L.cue.x, y: L.cue.y, vx: 0, vy: 0, out: false }, ...L.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, out: false }))];
  phase = "aim";
  turn = "you";
  ballInHand = false;
  aiming = false;
  power = 0;
  kbPower = 0;
  // sensible default for keyboard aimers: point at the first layout ball
  aimAngle = Math.atan2(L.balls[0].y - L.cue.y, L.balls[0].x - L.cue.x);
  setStatus(`Shot ${i + 1}/8 · ${L.obj} · Attempt ${trick.attempt}/3`);
  trickRackUI();
}

function trickRackUI(): void {
  const rack = document.getElementById("plTrickRack");
  if (!rack) return;
  rack.innerHTML = "";
  TRICKS.forEach((t, i) => {
    const chip = document.createElement("button");
    chip.className = i === trick.li ? "pl-tk active" : "pl-tk";
    chip.title = t.name;
    chip.innerHTML = `${i + 1}<i>${"★".repeat(trick.stars[i])}${"☆".repeat(3 - trick.stars[i])}</i>`;
    // free level select — jump to any shot whenever balls aren't rolling
    chip.onclick = () => {
      if (phase === "shooting" || i === trick.li) return;
      hideOver();
      trick.attempt = 1;
      loadTrick(i);
    };
    rack.appendChild(chip);
  });
}

function trickResolve(): void {
  const L = TRICKS[trick.li];
  const strayPot = shotPotted.some((id) => !L.targets.includes(id));
  const ok = !shotCueScratch && !strayPot && L.check();
  phase = "aim";
  if (ok) {
    const earned = Math.max(1, 4 - trick.attempt);
    trick.stars[trick.li] = Math.max(trick.stars[trick.li], earned);
    saveTrickStars();
    say(pick(earned === 3 ? LINES.trickPerfect : LINES.trickPass), 2600);
    trickCard(true, earned);
  } else if (trick.attempt >= 3) {
    say(pick(LINES.trickFail), 2600);
    saveTrickStars();
    trickCard(false, 0);
  } else {
    trick.attempt++;
    // explain WHY — especially when the right ball dropped but broke the
    // shot's condition (no cushion first, wrong pocket, cue touched a rail...)
    const targetDropped = L.targets.some((id) => potted(id));
    const why = shotCueScratch
      ? "Scratch!"
      : strayPot
        ? "Wrong ball dropped!"
        : targetDropped
          ? "It dropped — but not the way the brief asks. Read it again."
          : "Missed.";
    say(why + " Reset. Again.", 2600);
    loadTrick(trick.li); // same layout, fresh balls
  }
  trickRackUI();
}

function trickCard(success: boolean, stars: number): void {
  phase = "over"; // input off while the card is up
  const last = trick.li >= TRICKS.length - 1;
  const o = document.getElementById("plOver");
  if (!o) return;
  o.className = "pl-over";
  const total = trick.stars.reduce((a, b) => a + b, 0);
  o.innerHTML = last
    ? `<div class="pl-over-card ${total >= 12 ? "win" : "lose"}">
        <div class="pl-over-title">${"★".repeat(Math.min(3, Math.round(total / 8)))} ${total}/24</div>
        <div class="pl-over-sub">${TRICKS.map((_, i) => `${i + 1}·${trick.stars[i]}★`).join("  ")}</div>
        <button class="ctl-btn" id="plTkNext">↺ Run it back</button>
        <button class="ctl-btn ghost" id="plTkMenu">Menu</button>
      </div>`
    : `<div class="pl-over-card ${success ? "win" : "lose"}">
        <div class="pl-over-title">${success ? "★".repeat(stars) + "☆".repeat(3 - stars) : "WASHOUT"}</div>
        <div class="pl-over-sub">${TRICKS[trick.li].name} — ${success ? `${stars} star${stars > 1 ? "s" : ""}` : "zero stars, full reset"}</div>
        <button class="ctl-btn" id="plTkNext">▶ ${last ? "Done" : "Next shot"}</button>
        ${success ? "" : `<button class="ctl-btn ghost" id="plTkRetry">↻ Retry shot</button>`}
      </div>`;
  requestAnimationFrame(() => o.classList.add("show"));
  const next = document.getElementById("plTkNext") as HTMLElement | null;
  if (next)
    next.onclick = () => {
      hideOver();
      if (last) {
        say(pick(LINES.trickDone), 3200);
        trick.li = 0;
        trick.attempt = 1;
        loadTrick(0);
      } else {
        trick.attempt = 1;
        loadTrick(trick.li + 1);
      }
    };
  const retry = document.getElementById("plTkRetry") as HTMLElement | null;
  if (retry)
    retry.onclick = () => {
      hideOver();
      trick.attempt = 1;
      loadTrick(trick.li);
    };
  const menu = document.getElementById("plTkMenu") as HTMLElement | null;
  if (menu)
    menu.onclick = () => {
      hideOver();
      phase = "diff";
      showScreen("mode");
      setStatus("Pick a game");
    };
}

/* ====================== input: aim + place ====================== */
function toCanvas(e: PointerEvent): Vec2 {
  const r = cnv!.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (CW / r.width), y: (e.clientY - r.top) * (CH / r.height) };
}
function confirmPlace(): void {
  ballInHand = false;
  phase = "aim";
  setStatus("Cue ball set. Take your shot.");
}
function onDown(e: PointerEvent): void {
  if (over || phase === "shooting" || turn !== "you") return;
  const p = toCanvas(e);
  if (phase === "place" || ballInHand) {
    const cb = cueBall();
    if (cb && Math.hypot(p.x - cb.x, p.y - cb.y) < 28) {
      dragId = 1;
      cb._drag = true;
    } else if (cb && legalCuePos(p.x, p.y)) {
      cb.x = p.x;
      cb.y = p.y;
      confirmPlace();
    }
    return;
  }
  if (phase === "aim") {
    aiming = true;
    const cb = cueBall()!;
    aimAngle = Math.atan2(p.y - cb.y, p.x - cb.x); // initial guess: point toward target
    power = 0;
    try {
      cnv!.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
  }
}
function onMove(e: PointerEvent): void {
  if (turn !== "you") return;
  const p = toCanvas(e);
  if ((phase === "place" || ballInHand) && dragId) {
    const cb = cueBall();
    if (cb && legalCuePos(p.x, p.y)) {
      cb.x = p.x;
      cb.y = p.y;
    }
    return;
  }
  if (aiming) {
    const cb = cueBall()!;
    const dxp = cb.x - p.x, dyp = cb.y - p.y; // slingshot: pull behind the ball
    const dist = Math.hypot(dxp, dyp);
    if (dist > 4) aimAngle = Math.atan2(dyp, dxp); // shoot away from the pull point
    power = Math.max(0, Math.min(1, (dist - 12) / 150));
    const pf = document.getElementById("plPowerFill");
    if (pf) pf.style.width = power * 100 + "%";
  }
}
function onUp(): void {
  if (dragId) {
    dragId = 0;
    const cb = cueBall();
    if (cb) {
      cb._drag = false;
      if (legalCuePos(cb.x, cb.y)) confirmPlace();
    }
    return;
  }
  if (aiming) {
    aiming = false;
    const pf = document.getElementById("plPowerFill");
    if (pf) pf.style.width = "0%";
    if (power > 0.05) shoot(aimAngle, power);
    power = 0;
  }
}

function legalCuePos(x: number, y: number): boolean {
  if (x < railL + R || x > railR - R || y < railT + R || y > railB - R) return false;
  for (const b of balls) {
    if (b.id === 0 || b.out) continue;
    if (Math.hypot(b.x - x, b.y - y) < BALL + 1) return false;
  }
  for (const p of POCKETS) {
    if (Math.hypot(p.x - x, p.y - y) < CAP + 2) return false;
  }
  return true;
}

/* ====================== shooting ====================== */
function shoot(angle: number, pw: number): void {
  const cb = cueBall();
  if (!cb) return;
  const sp = VMIN + pw * (VMAX - VMIN);
  cb.vx = Math.cos(angle) * sp;
  cb.vy = Math.sin(angle) * sp;
  shotPotted = [];
  shotFirstHit = null;
  shotCueScratch = false;
  shotRail = false;
  ballRail = {};
  shotCueRailAfterContact = false;
  groupClearedAtStart = { you: isGroupCleared("you"), drod: isGroupCleared("drod") };
  phase = "shooting";
  thinking = false;
  setStatus(turn === "you" ? "Rolling…" : "Drod takes the shot.");
  say(turn === "you" ? pick(isBreak ? LINES.breakYou : ["Nice."]) : pick(isBreak ? LINES.breakDrod : ["Watch."]), 1500);
  sfxClick(sp);
}

function isGroupCleared(who: Side): boolean {
  const g = groups[who];
  if (!g) return false;
  return !balls.some((b) => !b.out && typeOf(b.id) === g);
}

/* ====================== physics ====================== */
function physicsStep(): void {
  const live = balls.filter((b) => !b.out);
  let maxv = 0;
  for (const b of live) maxv = Math.max(maxv, Math.hypot(b.vx, b.vy));
  const sub = Math.max(1, Math.min(8, Math.ceil((maxv * H) / (R * 0.6))));
  const h = H / sub;
  for (let s = 0; s < sub; s++) {
    for (const b of live) {
      b.x += b.vx * h;
      b.y += b.vy * h;
    }
    for (const b of live) cushions(b);
    for (const b of live) jaws(b);
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) collide(live[i], live[j]);
    for (const b of live) {
      if (b.out) continue;
      pocketCheck(b);
    }
  }
  // safety net: a ball must never leave the felt.
  for (const b of live) {
    if (b.out) continue;
    if (b.x > railL - R && b.x < railR + R && b.y > railT - R && b.y < railB + R) continue;
    let diving = false;
    for (const p of POCKETS) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < CAP + R) {
        diving = true;
        break;
      }
    }
    if (diving) continue;
    b.x = Math.max(railL + R, Math.min(railR - R, b.x));
    b.y = Math.max(railT + R, Math.min(railB - R, b.y));
    b.vx *= -0.25;
    b.vy *= -0.25;
  }
  // friction + stop (apply once per full step)
  for (const b of live) {
    if (b.out) continue;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      let ns = sp * DECAY - ROLL;
      if (ns < STOP) ns = 0;
      const f = ns / sp;
      b.vx *= f;
      b.vy *= f;
    }
  }
}

// rail bookkeeping shared by cushions() and jaws() (trick-shot objectives)
function markRail(b: Ball): void {
  shotRail = true;
  ballRail[b.id] = true;
  if (b.id === 0 && shotFirstHit !== null) shotCueRailAfterContact = true;
}

function cushions(b: Ball): void {
  if (b.out) return;
  const sp = Math.hypot(b.vx, b.vy);
  if (b.vx < 0 && b.x - R < railL && b.y > railT + MC && b.y < railB - MC) {
    b.x = railL + R;
    b.vx = -b.vx * CUSH;
    b.vy *= CUSH;
    markRail(b);
    sfxCushion(sp);
  } else if (b.vx > 0 && b.x + R > railR && b.y > railT + MC && b.y < railB - MC) {
    b.x = railR - R;
    b.vx = -b.vx * CUSH;
    b.vy *= CUSH;
    markRail(b);
    sfxCushion(sp);
  }
  const onTopSpan = (b.x > railL + MC && b.x < midX - MS) || (b.x > midX + MS && b.x < railR - MC);
  if (b.vy < 0 && b.y - R < railT && onTopSpan) {
    b.y = railT + R;
    b.vy = -b.vy * CUSH;
    b.vx *= CUSH;
    markRail(b);
    sfxCushion(sp);
  } else if (b.vy > 0 && b.y + R > railB && onTopSpan) {
    b.y = railB - R;
    b.vy = -b.vy * CUSH;
    b.vx *= CUSH;
    markRail(b);
    sfxCushion(sp);
  }
}

function jaws(b: Ball): void {
  if (b.out) return;
  const min = R + JAWR, min2 = min * min;
  for (const j of JAWS) {
    const dx = b.x - j.x, dy = b.y - j.y, d2 = dx * dx + dy * dy;
    if (d2 >= min2 || d2 === 0) continue;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    b.x = j.x + nx * min;
    b.y = j.y + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + CUSH) * vn * nx;
      b.vy -= (1 + CUSH) * vn * ny;
      markRail(b);
      sfxCushion(Math.hypot(b.vx, b.vy));
    }
  }
}

function collide(a: Ball, b: Ball): void {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || d >= BALL) return;
  const nx = dx / d, ny = dy / d;
  const overlap = BALL - d;
  a.x -= (nx * overlap) / 2;
  a.y -= (ny * overlap) / 2;
  b.x += (nx * overlap) / 2;
  b.y += (ny * overlap) / 2;
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn > 0) return;
  const imp = (-(1 + BB) * vn) / 2;
  const ix = imp * nx, iy = imp * ny;
  a.vx -= ix;
  a.vy -= iy;
  b.vx += ix;
  b.vy += iy;
  if (shotFirstHit === null) {
    if (a.id === 0 && b.id !== 0) shotFirstHit = b.id;
    else if (b.id === 0 && a.id !== 0) shotFirstHit = a.id;
  }
  sfxClick(Math.abs(vn));
}

function pocketCheck(b: Ball): void {
  for (const p of POCKETS) {
    if (Math.hypot(b.x - p.x, b.y - p.y) < CAP) {
      b.out = true;
      b.vx = 0;
      b.vy = 0;
      b.sink = performance.now();
      b.px = p.x;
      b.py = p.y;
      if (b.id === 0) shotCueScratch = true;
      else shotPotted.push(b.id);
      sfxPocket();
      say(turn === "you" ? pick(LINES.potYou) : pick(LINES.potDrod), 1700);
      updateRacks();
      return;
    }
  }
}

function allStopped(): boolean {
  return !balls.some((b) => !b.out && (Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0));
}

/* ====================== shot resolution / rules ====================== */
function resolveShot(): void {
  const shooter = turn, opp: Side = shooter === "you" ? "drod" : "you";
  const potted = shotPotted.slice();
  const pottedNon8 = potted.filter((id) => id !== 8);
  const potted8 = potted.includes(8);
  const wasBreak = isBreak;
  isBreak = false;

  if (wasBreak && potted8) {
    const i = potted.indexOf(8);
    potted.splice(i, 1);
    respot8();
  }

  let foul = false, reason = "";
  if (shotCueScratch) {
    foul = true;
    reason = "scratch";
  }
  if (shotFirstHit === null) {
    foul = true;
    reason = "no contact";
  } else {
    const t = typeOf(shotFirstHit), g = groups[shooter];
    if (g) {
      if (groupClearedAtStart[shooter]) {
        if (shotFirstHit !== 8) {
          foul = true;
          reason = "must hit 8 first";
        }
      } else if (t === "eight") {
        foul = true;
        reason = "hit the 8 first";
      } else if (t !== g) {
        foul = true;
        reason = "wrong group first";
      }
    } else if (shotFirstHit === 8) {
      foul = true;
      reason = "8 first on open table";
    }
  }
  if (!foul && potted.length === 0 && !shotRail) {
    foul = true;
    reason = "no rail after contact";
  }

  if (openTable && !wasBreak && !foul && pottedNon8.length) {
    const g = typeOf(pottedNon8[0]);
    groups[shooter] = g;
    groups[opp] = g === "solid" ? "stripe" : "solid";
    openTable = false;
    say(shooter === "you" ? pick(LINES.groupYou).replace("{g}", g + "s") : pick(LINES.groupDrod).replace("{g}", g + "s"), 2400);
  }

  if (potted8) {
    const legal = !!groups[shooter] && groupClearedAtStart[shooter] && !foul;
    if (legal) finish(shooter, shooter === "you" ? "You sank the 8. You win!" : "Drod sinks the 8. Drod wins.");
    else finish(opp, shooter === "you" ? "You potted the 8 too early. You lose." : "Drod knocked in the 8 early. You win!");
    return;
  }

  if (shotCueScratch) respotCue();
  if (foul) {
    ballInHand = true;
    turn = opp;
    say(shooter === "you" ? (shotCueScratch ? pick(LINES.scratchYou) : pick(LINES.foulYou)) : shotCueScratch ? pick(LINES.scratchDrod) : pick(LINES.foulDrod), 2600);
    afterTurn(true, reason);
    return;
  }

  let continues = false;
  if (openTable || !groups[shooter]) continues = pottedNon8.length > 0;
  else continues = potted.some((id) => typeOf(id) === groups[shooter]);

  if (!continues) {
    turn = opp;
    say(shooter === "you" ? pick(LINES.missYou) : pick(LINES.missDrod), 2000);
  }
  afterTurn(false, "");
}

function afterTurn(_foul: boolean, _reason: string): void {
  aiming = false;
  power = 0;
  updateRacks();
  updateTurn();
  if (groups[turn] && isGroupCleared(turn) && !over) {
    say(turn === "you" ? pick(LINES.eight) : pick(LINES.eightDrod), 2600);
  }
  if (over) return;
  if (turn === "you") {
    phase = ballInHand ? "place" : "aim";
    setStatus(
      ballInHand
        ? "Ball in hand. Drag the cue ball to a spot."
        : groups.you
          ? isGroupCleared("you")
            ? "Sink the 8 to win."
            : "Your shot. You're " + groups.you + "s."
          : "Open table. Your shot.",
    );
  } else {
    phase = "aim";
    setStatus("Drod is lining up…");
    thinking = true;
    scheduleAI();
  }
}

function respotCue(): void {
  const cb = cueBall();
  if (!cb) return;
  cb.out = false;
  cb.sink = 0;
  cb.vx = 0;
  cb.vy = 0;
  let x = railL + PW * 0.24, y = midY, tries = 0;
  while (!legalCuePos(x, y) && tries < 200) {
    x = railL + PW * 0.18 + Math.random() * PW * 0.2;
    y = railT + R + Math.random() * (PH - BALL);
    tries++;
  }
  cb.x = x;
  cb.y = y;
}
function respot8(): void {
  const e = balls.find((b) => b.id === 8);
  if (!e) return;
  e.out = false;
  e.sink = 0;
  e.vx = 0;
  e.vy = 0;
  let x = railL + PW * 0.66, y = midY, tries = 0;
  while (!eightSpotFree(x, y) && tries < 200) {
    x = railL + PW * 0.5 + Math.random() * PW * 0.3;
    y = railT + R + Math.random() * (PH - BALL);
    tries++;
  }
  e.x = x;
  e.y = y;
}
function eightSpotFree(x: number, y: number): boolean {
  if (x < railL + R || x > railR - R || y < railT + R || y > railB - R) return false;
  for (const b of balls) {
    if (b.id === 8 || b.out) continue;
    if (Math.hypot(b.x - x, b.y - y) < BALL + 1) return false;
  }
  return true;
}

function finish(who: Side, msg: string): void {
  over = true;
  winner = who;
  phase = "over";
  thinking = false;
  setStatus(msg);
  say(who === "you" ? pick(LINES.lose) : pick(LINES.win), 5200);
  showOver(who === "you", msg);
  P.inc(who === "you" ? "poolWins" : "poolLosses");
}

/* ====================== Drod AI ====================== */
interface PocketDir {
  x: number;
  y: number;
  side: boolean;
}
const POCKET_DIR: PocketDir[] = POCKETS.map((p) => {
  const ix = p.x <= railL ? 1 : p.x >= railR ? -1 : 0;
  const iy = p.y <= railT ? 1 : -1;
  const m = Math.hypot(ix, iy) || 1;
  return { x: ix / m, y: iy / m, side: ix === 0 };
});

function scheduleAI(): void {
  setTimeout(() => {
    if (phase !== "aim" || turn !== "drod" || over || cueGlide) return;
    aiMove();
  }, 640);
}
function aiMove(): void {
  if (over || turn !== "drod") return;
  if (ballInHand) {
    ballInHand = false;
    const spot = aiCuePlacement();
    const cb = cueBall()!;
    setStatus("Drod lines up ball in hand…");
    startCueGlide(cb.x, cb.y, spot.x, spot.y, () => setTimeout(aiTakeShot, 480));
    return;
  }
  aiTakeShot();
}
function startCueGlide(fx: number, fy: number, tx: number, ty: number, then: (() => void) | null): void {
  thinking = true;
  cueGlide = { fx, fy, tx, ty, t0: performance.now(), dur: Math.min(720, 240 + Math.hypot(tx - fx, ty - fy) * 1.5), then };
}
function aiTakeShot(): void {
  if (over || turn !== "drod" || phase === "shooting") return;
  const cb = cueBall()!;
  let plan = bestShot(cb.x, cb.y, "drod", false);
  if (!plan) plan = bestShot(cb.x, cb.y, "drod", true);
  let angle: number, pw: number, q = 0.5, d = 300;
  if (plan) {
    angle = plan.angle;
    pw = plan.power;
    q = plan.quality;
    d = plan.dist;
  } else {
    const cb2 = cueBall()!;
    const tgt = legalTargets("drod").sort((a, b) => dist(cb2, a) - dist(cb2, b))[0];
    if (tgt) {
      angle = Math.atan2(tgt.y - cb2.y, tgt.x - cb2.x);
      pw = 0.52;
      q = 0.95;
      d = dist(cb2, tgt);
    } else {
      angle = Math.random() * 6.28;
      pw = 0.5;
    }
  }
  const errScale = level.err * (0.7 + d / 1100 + (1 - q) * 0.45);
  const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  angle += g * errScale;
  pw = Math.max(0.42, Math.min(1, pw * (0.93 + 0.07 * level.power) + (Math.random() * 2 - 1) * 0.03));
  thinking = false;
  shoot(angle, pw);
}
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function legalTargets(who: Side): Ball[] {
  const g = groups[who];
  if (!g) return balls.filter((b) => !b.out && b.id !== 0 && b.id !== 8);
  if (isGroupCleared(who)) return balls.filter((b) => !b.out && b.id === 8);
  return balls.filter((b) => !b.out && typeOf(b.id) === g);
}
function pathClear(x0: number, y0: number, x1: number, y1: number, ignore: number[], clearR: number): boolean {
  for (const b of balls) {
    if (b.out || b.id === 0) continue;
    if (ignore && ignore.includes(b.id)) continue;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
    let t = L2 ? ((b.x - x0) * dx + (b.y - y0) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t * dx, py = y0 + t * dy;
    if (Math.hypot(b.x - px, b.y - py) < clearR) return false;
  }
  return true;
}
function cueScratchRisk(gx: number, gy: number, ax: number, ay: number, ux: number, uy: number, cosCut: number, power: number): boolean {
  const sinCut = Math.sqrt(Math.max(0, 1 - cosCut * cosCut));
  const launch = VMIN + power * (VMAX - VMIN);
  const tanSpeed = launch * sinCut, follow = launch * 0.04 * cosCut;
  const rollDist = (s: number): number => (s <= 0 ? 0 : ((s + 70) / 0.96) * (1 - Math.exp(-0.0096 * ((s + 70) / 0.96))));
  const adotu = ax * ux + ay * uy;
  let tx = ax - adotu * ux, ty = ay - adotu * uy;
  const tl = Math.hypot(tx, ty);
  const check = (dx: number, dy: number, len: number): boolean => {
    if (len < 6) return false;
    for (const p of POCKETS) {
      const wx = p.x - gx, wy = p.y - gy;
      let proj = wx * dx + wy * dy;
      if (proj < 2) continue;
      if (proj > len) proj = len;
      const cxp = gx + dx * proj, cyp = gy + dy * proj;
      if (Math.hypot(p.x - cxp, p.y - cyp) < CAP + 5) return true;
    }
    return false;
  };
  if (tl > 1e-3 && check(tx / tl, ty / tl, Math.min(360, rollDist(tanSpeed)))) return true;
  if (check(ux, uy, Math.min(140, rollDist(follow)))) return true;
  return false;
}
function bestShot(cx: number, cy: number, who: Side, relax: boolean): Plan | null {
  const targets = legalTargets(who);
  const cutMin = relax ? 0.2 : 0.36;
  const appCorner = relax ? 0.05 : 0.16;
  const appSide = relax ? 0.3 : 0.5;
  const laneCue = relax ? 1.45 : 1.7;
  const laneObj = relax ? 1.05 : 1.2;
  let best: Plan | null = null;
  for (const t of targets) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi], pdir = POCKET_DIR[pi];
      const tpx = p.x - t.x, tpy = p.y - t.y;
      const tpd = Math.hypot(tpx, tpy);
      if (tpd < 6) continue;
      const ux = tpx / tpd, uy = tpy / tpd;
      const approachQ = -(ux * pdir.x + uy * pdir.y);
      if (approachQ < (pdir.side ? appSide : appCorner)) continue;
      const gx = t.x - ux * BALL, gy = t.y - uy * BALL;
      const cax = gx - cx, cay = gy - cy;
      const cad = Math.hypot(cax, cay);
      if (cad < 2) continue;
      const ax = cax / cad, ay = cay / cad;
      const cosCut = ax * ux + ay * uy;
      if (cosCut < cutMin) continue;
      if (!pathClear(cx, cy, gx, gy, [t.id], R * laneCue)) continue;
      if (!pathClear(t.x, t.y, p.x, p.y, [t.id], R * laneObj)) continue;
      const power = Math.max(0.4, Math.min(0.9, 0.34 + ((cad + tpd) / PW) * 0.4 + (1 - cosCut) * 0.1));
      const scratchy = cueScratchRisk(gx, gy, ax, ay, ux, uy, cosCut, power);
      if (scratchy && !relax) continue;
      const score = cosCut * 2.2 + approachQ * 1.1 - (tpd / PW) * 1.3 - (cad / PW) * 0.7 - (scratchy ? 2.5 : 0) - (pdir.side ? 0.5 : 0);
      if (!best || score > best.score) {
        best = { angle: Math.atan2(cay, cax), power, dist: cad, quality: cosCut, score };
      }
    }
  }
  return best;
}
function aiCuePlacement(): Vec2 {
  const targets = legalTargets("drod");
  let best: { x: number; y: number; score: number } | null = null;
  for (const t of targets) {
    for (let pi = 0; pi < POCKETS.length; pi++) {
      const p = POCKETS[pi], pdir = POCKET_DIR[pi];
      const tpx = t.x - p.x, tpy = t.y - p.y;
      const tpd = Math.hypot(tpx, tpy);
      if (tpd < 6) continue;
      const ux = tpx / tpd, uy = tpy / tpd;
      const approachQ = -(-ux * pdir.x + -uy * pdir.y);
      if (approachQ < (pdir.side ? 0.55 : 0.28)) continue;
      if (!pathClear(t.x, t.y, p.x, p.y, [t.id], R * 1.2)) continue;
      for (const D of [60, 95, 140]) {
        const x = t.x + ux * D, y = t.y + uy * D;
        if (!legalCuePos(x, y)) continue;
        if (!pathClear(x, y, t.x, t.y, [t.id], R * 1.7)) continue;
        const score = approachQ * 1.2 - (tpd / PW) * 1.1 - (D / PW) * 0.5;
        if (!best || score > best.score) best = { x, y, score };
      }
    }
  }
  if (best) return { x: best.x, y: best.y };
  let x = railL + PW * 0.22, y = midY, tries = 0;
  while (!legalCuePos(x, y) && tries < 200) {
    x = railL + PW * 0.15 + Math.random() * PW * 0.3;
    y = railT + R + Math.random() * (PH - BALL);
    tries++;
  }
  return { x, y };
}

/* ====================== rendering ====================== */
let bgCanvas: HTMLCanvasElement | null = null;
function buildBg(): void {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = CW;
  bgCanvas.height = CH;
  const g = bgCanvas.getContext("2d")!;
  roundRect(g, 0, 0, CW, CH, 16);
  g.fillStyle = "#7a4b2b";
  g.fill();
  let lg = g.createLinearGradient(0, 0, 0, CH);
  lg.addColorStop(0, "#a9743f");
  lg.addColorStop(0.5, "#7a4b2b");
  lg.addColorStop(1, "#5d3720");
  roundRect(g, 3, 3, CW - 6, CH - 6, 13);
  g.fillStyle = lg;
  g.fill();
  g.fillStyle = "#3a2414";
  roundRect(g, railL - 14, railT - 14, PW + 28, PH + 28, 10);
  g.fill();
  let fg = g.createRadialGradient(midX, midY, 40, midX, midY, Math.max(PW, PH) * 0.7);
  fg.addColorStop(0, "#2f8f57");
  fg.addColorStop(1, "#1f6d40");
  g.fillStyle = fg;
  g.fillRect(railL - 2, railT - 2, PW + 4, PH + 4);
  g.globalAlpha = 0.05;
  g.strokeStyle = "#0c3a22";
  g.lineWidth = 1;
  for (let x = railL; x < railR; x += 6) {
    g.beginPath();
    g.moveTo(x, railT);
    g.lineTo(x, railB);
    g.stroke();
  }
  for (let y = railT; y < railB; y += 6) {
    g.beginPath();
    g.moveTo(railL, y);
    g.lineTo(railR, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#185a34";
  g.fillRect(railL - 2, railT - 3, PW + 4, 3);
  g.fillRect(railL - 2, railB, PW + 4, 3);
  g.fillRect(railL - 3, railT - 2, 3, PH + 4);
  g.fillRect(railR, railT - 2, 3, PH + 4);
  g.fillStyle = "#efe2c2";
  const diamond = (x: number, y: number): void => {
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.fillRect(-2.5, -2.5, 5, 5);
    g.restore();
  };
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    const x = railL + (PW * i) / 8;
    diamond(x, railT - 22);
    diamond(x, railB + 22);
  }
  for (let i = 1; i < 4; i++) {
    const y = railT + (PH * i) / 4;
    diamond(railL - 22, y);
    diamond(railR + 22, y);
  }
  for (const p of POCKETS) {
    g.beginPath();
    g.arc(p.x, p.y, CAP + 5, 0, 7);
    g.fillStyle = "#241a10";
    g.fill();
    g.beginPath();
    g.arc(p.x, p.y, CAP + 2, 0, 7);
    g.strokeStyle = "#caa23a";
    g.lineWidth = 2;
    g.stroke();
    g.beginPath();
    g.arc(p.x, p.y, CAP, 0, 7);
    g.fillStyle = "#0a0a0c";
    g.fill();
  }
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawBall(g: CanvasRenderingContext2D, b: Ball): void {
  if (b.out) {
    const k = Math.min(1, (performance.now() - (b.sink || 0)) / 220);
    if (k >= 1) return;
    const rr = R * (1 - k * 0.8), a = 1 - k;
    g.save();
    g.globalAlpha = a;
    drawBallFace(g, b.px ?? b.x, b.py ?? b.y, b.id, rr);
    g.restore();
    return;
  }
  g.beginPath();
  g.ellipse(b.x + 2, b.y + 3, R * 0.95, R * 0.7, 0, 0, 7);
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.fill();
  drawBallFace(g, b.x, b.y, b.id, R);
}
function drawBallFace(g: CanvasRenderingContext2D, x: number, y: number, id: number, rr: number): void {
  const col = id === 0 ? "#f4f1e8" : COLORS[id];
  const stripe = id > 8;
  const rad = g.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.15, x, y, rr);
  rad.addColorStop(0, lighten(col, 0.55));
  rad.addColorStop(0.55, col);
  rad.addColorStop(1, darken(col, 0.42));
  g.beginPath();
  g.arc(x, y, rr, 0, 7);
  g.fillStyle = rad;
  g.fill();
  if (stripe) {
    g.save();
    g.beginPath();
    g.arc(x, y, rr, 0, 7);
    g.clip();
    g.fillStyle = "#f4f1e8";
    g.fillRect(x - rr, y - rr * 0.42, rr * 2, rr * 0.84);
    const bg = g.createLinearGradient(x, y - rr * 0.42, x, y + rr * 0.42);
    bg.addColorStop(0, "rgba(255,255,255,0.35)");
    bg.addColorStop(1, "rgba(0,0,0,0.12)");
    g.fillStyle = bg;
    g.fillRect(x - rr, y - rr * 0.42, rr * 2, rr * 0.84);
    g.restore();
  }
  if (id !== 0 && rr > 6) {
    g.beginPath();
    g.arc(x, y, rr * 0.46, 0, 7);
    g.fillStyle = "#f4f1e8";
    g.fill();
    g.fillStyle = "#1c1c1f";
    g.font = "bold " + rr * 0.62 + "px 'Silkscreen',monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(id), x, y + 0.5);
  }
  g.beginPath();
  g.ellipse(x - rr * 0.34, y - rr * 0.42, rr * 0.3, rr * 0.2, -0.5, 0, 7);
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fill();
}
function lighten(hex: string, t: number): string {
  return mix(hex, "#ffffff", t);
}
function darken(hex: string, t: number): string {
  return mix(hex, "#000000", t);
}
function mix(a: string, b: string, t: number): string {
  const pa = hx(a), pb = hx(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t),
    g = Math.round(pa[1] + (pb[1] - pa[1]) * t),
    bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
function hx(h: string): number[] {
  if (h[0] === "#") {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = h.match(/\d+/g);
  return m ? m.map(Number) : [0, 0, 0];
}

function drawAim(g: CanvasRenderingContext2D): void {
  if (turn !== "you" || over) return;
  const cb = cueBall();
  if (!cb || cb.out) return;
  if (phase === "place") {
    g.setLineDash([4, 4]);
    g.strokeStyle = "rgba(244,241,232,0.7)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(cb.x, cb.y, R + 3, 0, 7);
    g.stroke();
    g.setLineDash([]);
    return;
  }
  if (phase !== "aim" && !aiming) return;
  const dirx = Math.cos(aimAngle), diry = Math.sin(aimAngle);
  const hit = rayHit(cb.x, cb.y, dirx, diry);
  g.setLineDash([6, 6]);
  g.lineDashOffset = -(performance.now() / 40) % 12;
  g.strokeStyle = "rgba(244,241,232,0.85)";
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(cb.x, cb.y);
  g.lineTo(hit.x, hit.y);
  g.stroke();
  g.setLineDash([]);
  if (hit.ball) {
    g.beginPath();
    g.arc(hit.x, hit.y, R, 0, 7);
    g.strokeStyle = "rgba(244,241,232,0.9)";
    g.lineWidth = 1.5;
    g.stroke();
    const tx = hit.ball.x - hit.x, ty = hit.ball.y - hit.y;
    const td = Math.hypot(tx, ty) || 1;
    g.beginPath();
    g.moveTo(hit.ball.x, hit.ball.y);
    g.lineTo(hit.ball.x + (tx / td) * 46, hit.ball.y + (ty / td) * 46);
    g.strokeStyle = "rgba(231,163,62,0.95)";
    g.lineWidth = 1.6;
    g.stroke();
  } else if (hit.nx !== undefined) {
    const rdx = hit.nx ? -dirx : dirx, rdy = hit.nx ? diry : -diry;
    g.setLineDash([4, 5]);
    g.strokeStyle = "rgba(244,241,232,0.5)";
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(hit.x, hit.y);
    g.lineTo(hit.x + rdx * 70, hit.y + rdy * 70);
    g.stroke();
    g.setLineDash([]);
  }
  const gap = R + 4 + power * 60, len = 150;
  const bx = cb.x - dirx * gap, by = cb.y - diry * gap;
  const ex = bx - dirx * len, ey = by - diry * len;
  g.lineCap = "round";
  const sg = g.createLinearGradient(bx, by, ex, ey);
  sg.addColorStop(0, "#caa05a");
  sg.addColorStop(1, "#7a4b2b");
  g.strokeStyle = sg;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(ex, ey);
  g.stroke();
  g.strokeStyle = "#2f4b6e";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(bx, by);
  g.lineTo(bx - dirx * 6, by - diry * 6);
  g.stroke();
  g.lineCap = "butt";
}
interface RayHit {
  x: number;
  y: number;
  ball: Ball | null;
  t: number;
  nx?: boolean;
}
function rayHit(x: number, y: number, dx: number, dy: number): RayHit {
  let best: RayHit = { x: x + dx * 2000, y: y + dy * 2000, ball: null, t: 1e9 };
  for (const b of balls) {
    if (b.out || b.id === 0) continue;
    const ex = x - b.x, ey = y - b.y;
    const bq = 2 * (ex * dx + ey * dy), cq = ex * ex + ey * ey - BALL * BALL;
    const disc = bq * bq - 4 * cq;
    if (disc < 0) continue;
    const t = (-bq - Math.sqrt(disc)) / 2;
    if (t > 0 && t < best.t) best = { x: x + dx * t, y: y + dy * t, ball: b, t };
  }
  const cand: { t: number; nx: boolean }[] = [];
  if (dx < 0) cand.push({ t: (railL + R - x) / dx, nx: true });
  if (dx > 0) cand.push({ t: (railR - R - x) / dx, nx: true });
  if (dy < 0) cand.push({ t: (railT + R - y) / dy, nx: false });
  if (dy > 0) cand.push({ t: (railB - R - y) / dy, nx: false });
  for (const c of cand) {
    if (c.t > 0 && c.t < best.t) best = { x: x + dx * c.t, y: y + dy * c.t, ball: null, t: c.t, nx: c.nx };
  }
  return best;
}

function render(): void {
  if (!bctx) return;
  bctx.clearRect(0, 0, CW, CH);
  if (bgCanvas) bctx.drawImage(bgCanvas, 0, 0);
  if (balls.length) {
    for (const b of balls) if (b.out) drawBall(bctx, b);
    for (const b of balls) if (!b.out) drawBall(bctx, b);
    drawAim(bctx);
  }
}

/* ====================== panel sync ====================== */
function updateRacks(): void {
  const yEl = document.getElementById("plRackYou"), dEl = document.getElementById("plRackDrod");
  if (!yEl || !dEl) return;
  const remain = (g: BallType): number[] => balls.filter((b) => !b.out && typeOf(b.id) === g).map((b) => b.id).sort((a, b) => a - b);
  const renderSide = (g: BallType | null): string => (g ? remain(g).map((id) => ballChip(id)).join("") : `<span class="pl-open">open table</span>`);
  yEl.innerHTML = renderSide(groups.you);
  dEl.innerHTML = renderSide(groups.drod);
}
function ballChip(id: number): string {
  const col = COLORS[id], stripe = id > 8;
  return `<span class="pl-chip ${stripe ? "stripe" : ""}" style="--bc:${col}">${id}</span>`;
}
function updateTurn(): void {
  const yEl = document.getElementById("plSideYou"), dEl = document.getElementById("plSideDrod");
  if (!yEl || !dEl) return;
  yEl.classList.toggle("active", turn === "you");
  dEl.classList.toggle("active", turn === "drod");
}

function showOver(youWon: boolean, msg: string): void {
  const o = document.getElementById("plOver");
  if (!o) return;
  o.className = "pl-over";
  o.innerHTML = `
      <div class="pl-over-card ${youWon ? "win" : "lose"}">
        <div class="pl-over-title">${youWon ? "YOU WIN" : "DROD WINS"}</div>
        <div class="pl-over-sub">${msg}</div>
        <button class="ctl-btn" id="plAgain">↺ Rack again</button>
      </div>`;
  requestAnimationFrame(() => o.classList.add("show"));
  (document.getElementById("plAgain") as HTMLElement).onclick = () => startGame();
}
function hideOver(): void {
  const o = document.getElementById("plOver");
  if (o) {
    o.classList.remove("show");
    o.classList.add("hidden");
    o.innerHTML = "";
  }
}

/* ====================== main loop ====================== */
function step(dt: number): void {
  try {
    const now = performance.now();
    // physics (fixed-step accumulator) while shooting
    if (phase === "shooting") {
      acc += dt;
      let steps = 0;
      while (acc >= H && steps < 16) {
        physicsStep();
        acc -= H;
        steps++;
      }
      if (allStopped()) {
        acc = 0;
        if (mode === "trick") trickResolve();
        else resolveShot();
      }
    }
    // smooth cue-ball reposition (Drod taking ball in hand)
    if (cueGlide) {
      const cb = cueBall();
      const k = Math.min(1, (now - cueGlide.t0) / cueGlide.dur);
      const e = 1 - Math.pow(1 - k, 3);
      if (cb) {
        cb.x = cueGlide.fx + (cueGlide.tx - cueGlide.fx) * e;
        cb.y = cueGlide.fy + (cueGlide.ty - cueGlide.fy) * e;
      }
      if (k >= 1) {
        const then = cueGlide.then;
        cueGlide = null;
        if (then) then();
      }
    }
    // portrait
    portT += dt;
    const talking = now < talkUntil || thinking;
    const pc = document.getElementById("plPort") as HTMLCanvasElement | null;
    if (pc) {
      const c = pc.getContext("2d");
      if (c) drawPortraitFrame(c, "port_Drod", talking ? Math.floor(portT * (talking ? 13 : 5)) : 0, 96, 96);
    }
    const bub = document.getElementById("plBubble");
    if (bub) {
      const show = now < talkUntil && bubble;
      bub.textContent = show ? bubble : "";
      bub.classList.toggle("show", !!show);
    }
    // idle taunt while you dawdle
    if (phase === "aim" && turn === "you" && !over && now > talkUntil + 6500 && now - lastIdle > 9000) {
      if (Math.random() < 0.5) say(pick(LINES.idle), 2600);
      lastIdle = now;
    }
    render();
  } catch (err) {
    console.error("pool loop", err);
  }
}
