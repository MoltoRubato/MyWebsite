/* ============================================================
   RACK 'EM RIGHT — the gym's thinking game (host: Amelia).
   Somebody left the weight plates stacked on the wrong upright.
   Move the whole stack to the far one — one plate at a time,
   and never rest a bigger plate on a smaller one. Tower of
   Hanoi in gym clothes: pure puzzle, zero reflexes. Tap an
   upright to lift its top plate, tap another to set it down
   (keys 1/2/3 do the same).
   ============================================================ */
import { drawPortraitFrame } from "../sprites";
import { pick } from "../core/util";
import * as P from "../progress";
import { openOverlay, closeOverlay, isOverlayOpen, startLoop, type LoopHandle } from "./base";

interface OpenOpts {
  onClose?: () => void;
}

const LINES = {
  intro: [
    "Someone — naming no owners — left the rack like this. Move the whole stack to the right-hand upright.",
    "Re-rack time. Whole stack to the far upright. I'd help, but I'm supervising.",
  ],
  rule: ["House rule: a bigger plate never rests on a smaller one. Physics, and also my sanity."],
  illegal: [
    "Big plate on a little plate? That's how toes get lost.",
    "Nope. The little plate has rights.",
    "I am NOT writing that incident report.",
  ],
  good: ["Clean.", "Smooth hands.", "See, THIS is form.", "The rack approves."],
  stuck: ["Take your time. The plates aren't going anywhere. Unlike my afternoon.", "The owner once spent twenty minutes on this. You're fine."],
  done3: ["Minimum moves?! You re-rack better than anyone who actually lifts here.", "Perfect. I'm putting your name on the rack. With tape, but still."],
  done2: ["Tidy work. A couple of wasted moves, but the toes survived.", "Solid. The rack has seen far worse. The rack has seen the owner."],
  done1: ["Done is done. We don't talk about the route you took.", "It's... re-racked. The plates need a minute."],
};

// plate weights + muted, room-friendly colors (heaviest first)
const PLATES = [
  { kg: 45, color: "#7a4b2b", w: 100 },
  { kg: 35, color: "#9c4a3c", w: 86 },
  { kg: 25, color: "#5f7a46", w: 72 },
  { kg: 15, color: "#5b6b8a", w: 58 },
  { kg: 10, color: "#b08c4f", w: 46 },
  { kg: 5, color: "#6e5a72", w: 36 },
];
const SIZES = [
  { plates: 4, label: "Warm-up", sub: "4 plates · par 15" },
  { plates: 5, label: "Standard", sub: "5 plates · par 31" },
  { plates: 6, label: "Gojo-sized", sub: "6 plates · par 63" },
];

let loop: LoopHandle | null = null;
let onClose: (() => void) | null = null;
let rkKey: ((e: KeyboardEvent) => void) | null = null;
let pegs: number[][] = []; // plate indices (into PLATES), bottom -> top
let held: { peg: number; plate: number } | null = null;
let moves = 0;
let par = 0;
let nPlates = 5;
let playing = false;
let portT = 0, talkUntil = 0, bubble = "";

function say(t: string, d?: number): void {
  bubble = t;
  talkUntil = performance.now() + (d || 2600);
}

export function open(opts?: OpenOpts): void {
  onClose = opts?.onClose ?? null;
  openOverlay(shell());
  (document.getElementById("rkClose") as HTMLElement).onclick = close;
  document.querySelectorAll<HTMLElement>("#rkSizes .diff-btn").forEach((b) => {
    b.onclick = () => start(+b.getAttribute("data-n")!);
  });
  rkKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (!playing) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") tapPeg(+e.key - 1);
  };
  window.addEventListener("keydown", rkKey);
  playing = false;
  portT = 0;
  say(pick(LINES.intro), 4200);
  loop = startLoop(step);
}
export function close(): void {
  closeOverlay();
  loop?.stop();
  loop = null;
  if (rkKey) {
    window.removeEventListener("keydown", rkKey);
    rkKey = null;
  }
  const fn = onClose;
  onClose = null;
  if (fn) fn();
}
export function isOpen(): boolean {
  return isOverlayOpen();
}

function shell(): string {
  return `<div class="mz-wrap rk-wrap">
      <button class="chess-x" id="rkClose" aria-label="Close">✕</button>
      <div class="rk-head">
        <div class="drod-card">
          <div class="drod-port"><canvas id="rkPort" width="92" height="92"></canvas></div>
          <div class="drod-meta"><div class="drod-name">AMELIA</div><div class="drod-sub">rack marshal</div></div>
        </div>
        <div class="wk-stats rk-hud">
          <div class="wk-stat"><span class="wk-k">Moves</span><b id="rkMoves">0</b></div>
          <div class="wk-stat"><span class="wk-k">Par</span><b id="rkPar">–</b></div>
        </div>
      </div>
      <div class="drod-bubble" id="rkBubble"></div>
      <div class="chess-diff" id="rkSizes">
        <div class="diff-title">How much are we moving?</div>
        ${SIZES.map((s) => `<button class="diff-btn" data-n="${s.plates}"><b>${s.label}</b><small>${s.sub}</small></button>`).join("")}
      </div>
      <div class="rk-floor hidden" id="rkFloor"></div>
      <div class="rk-tip hidden" id="rkTip">Tap an upright to lift its top plate · tap another to set it down · keys 1 2 3</div>
    </div>`;
}

function start(n: number): void {
  nPlates = n;
  par = Math.pow(2, n) - 1;
  pegs = [Array.from({ length: n }, (_, i) => i), [], []];
  held = null;
  moves = 0;
  playing = true;
  document.getElementById("rkSizes")!.classList.add("hidden");
  document.getElementById("rkFloor")!.classList.remove("hidden");
  document.getElementById("rkTip")!.classList.remove("hidden");
  document.getElementById("rkPar")!.textContent = String(par);
  document.getElementById("rkMoves")!.textContent = "0";
  say(pick(LINES.rule), 3600);
  render();
}

function tapPeg(i: number): void {
  if (!playing) return;
  if (held === null) {
    const stack = pegs[i];
    if (!stack.length) return;
    held = { peg: i, plate: stack[stack.length - 1] };
    render();
    return;
  }
  // drop on i (tapping the source peg just puts it back)
  if (i === held.peg) {
    held = null;
    render();
    return;
  }
  const top = pegs[i][pegs[i].length - 1];
  if (top !== undefined && held.plate < top) {
    // bigger (lower index = bigger) onto smaller: refused
    say(pick(LINES.illegal), 2400);
    wiggle(i);
    return;
  }
  pegs[held.peg].pop();
  pegs[i].push(held.plate);
  held = null;
  moves++;
  document.getElementById("rkMoves")!.textContent = String(moves);
  if (moves === par && Math.random() < 0.8) say(pick(LINES.stuck), 2400);
  else if (Math.random() < 0.18) say(pick(LINES.good), 1600);
  render();
  if (pegs[2].length === nPlates) finish();
}

function wiggle(i: number): void {
  const peg = document.querySelectorAll(".rk-peg")[i];
  if (!peg) return;
  peg.classList.remove("no");
  void (peg as HTMLElement).offsetWidth;
  peg.classList.add("no");
}

function finish(): void {
  playing = false;
  const stars = moves === par ? 3 : moves <= Math.round(par * 1.6) ? 2 : 1;
  P.record("rackStars", stars);
  if (moves === par) P.flag("rackPar");
  say(pick(stars === 3 ? LINES.done3 : stars === 2 ? LINES.done2 : LINES.done1), 5200);
  const floor = document.getElementById("rkFloor")!;
  const card = document.createElement("div");
  card.className = "rk-done";
  card.innerHTML = `
    <div class="rk-done-stars">${"★".repeat(stars)}${"☆".repeat(3 - stars)}</div>
    <div class="rk-done-sub">${moves} moves · par ${par}</div>
    <button class="ctl-btn" id="rkAgain">↺ Re-rack again</button>
    <button class="ctl-btn ghost" id="rkSize">Change weights</button>`;
  floor.appendChild(card);
  (document.getElementById("rkAgain") as HTMLElement).onclick = () => start(nPlates);
  (document.getElementById("rkSize") as HTMLElement).onclick = () => {
    document.getElementById("rkSizes")!.classList.remove("hidden");
    document.getElementById("rkFloor")!.classList.add("hidden");
    document.getElementById("rkTip")!.classList.add("hidden");
  };
}

/** Plate width as a % of its peg (capped at the design px) so narrow phone
    columns scale the whole set down while keeping the size ordering. */
function sizePlate(el: HTMLElement, p: (typeof PLATES)[number]): void {
  el.style.width = Math.round((p.w / 110) * 100) + "%";
  el.style.maxWidth = p.w + "px";
  el.style.background = p.color;
}

function render(): void {
  const floor = document.getElementById("rkFloor");
  if (!floor) return;
  floor.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const peg = document.createElement("button");
    peg.className = "rk-peg" + (held && held.peg === i ? " lift" : "");
    peg.onclick = () => tapPeg(i);
    const post = document.createElement("span");
    post.className = "rk-post";
    peg.appendChild(post);
    // held plate floats above its peg
    if (held && held.peg === i) {
      const p = PLATES[held.plate];
      const el = document.createElement("span");
      el.className = "rk-plate held";
      sizePlate(el, p);
      el.textContent = String(p.kg);
      peg.appendChild(el);
    }
    const stack = document.createElement("span");
    stack.className = "rk-stack";
    const items = held && held.peg === i ? pegs[i].slice(0, -1) : pegs[i];
    for (let k = items.length - 1; k >= 0; k--) {
      const p = PLATES[items[k]];
      const el = document.createElement("span");
      el.className = "rk-plate";
      sizePlate(el, p);
      el.textContent = String(p.kg);
      stack.appendChild(el);
    }
    peg.appendChild(stack);
    const base = document.createElement("span");
    base.className = "rk-base";
    peg.appendChild(base);
    floor.appendChild(peg);
  }
}

function step(dt: number): void {
  try {
    const now = performance.now();
    portT += dt;
    const talking = now < talkUntil;
    const pc = document.getElementById("rkPort") as HTMLCanvasElement | null;
    if (pc) {
      const c = pc.getContext("2d");
      if (c) drawPortraitFrame(c, "port_Girl", talking ? Math.floor(portT * 13) : 0, 92, 92);
    }
    const bub = document.getElementById("rkBubble");
    if (bub) {
      const show = now < talkUntil && bubble;
      bub.textContent = show ? bubble : "";
      bub.classList.toggle("show", !!show);
    }
  } catch (err) {
    console.error("rack loop", err);
  }
}
