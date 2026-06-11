/* ============================================================
   PIANO — the music studio's grand piano, actually playable.
   Visuals: the keyboard is composed on a tiny native-resolution
   canvas from RagnaPixel's "Pixel Piano" sprites (Old theme,
   public/assets/piano/*) and upscaled with pixelated rendering.
   Audio: FreePats "Upright Piano KW" samples (CC0) lazy-loaded
   into the site's shared AudioContext, pitch-shifted to the
   nearest sampled note — with a synth voice that covers the
   keys while samples load (or forever, offline).
   Input: DAW-style keybinds on desktop, multi-touch chords +
   glissando via pointer events on phones.
   ============================================================ */
import { pick } from "../core/util";
import * as MUSIC from "./music";
import * as P from "../progress";
import { openOverlay, closeOverlay, isOverlayOpen, startLoop, type LoopHandle } from "./base";

interface OpenOpts {
  onClose?: () => void;
}

/* ---------------- music theory helpers ---------------- */
// semitone offsets of the white keys within an octave + which have a sharp
const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const HAS_SHARP = [true, true, false, true, true, true, false]; // C D E F G A B

/* ---------------- sprite metrics (native px) ---------------- */
const KW = 4, KH = 27; // white key sprite
const SW = 3, SH = 16; // sharp key sprite
const STRIDE = 5; // white key + 1px gap
const FELT_H = 2;
const PAD = 1; // frame margin around the strip
const KBD_H = PAD + FELT_H + KH + PAD;

/* ---------------- samples ---------------- */
interface SampleDef {
  midi: number;
  base: string;
}
const SAMPLES: SampleDef[] = [
  { midi: 48, base: "assets/audio/piano/C3" },
  { midi: 54, base: "assets/audio/piano/Fs3" },
  { midi: 60, base: "assets/audio/piano/C4" },
  { midi: 66, base: "assets/audio/piano/Fs4" },
  { midi: 72, base: "assets/audio/piano/C5" },
  { midi: 78, base: "assets/audio/piano/Fs5" },
  { midi: 84, base: "assets/audio/piano/C6" },
  { midi: 90, base: "assets/audio/piano/Fs6" },
  { midi: 96, base: "assets/audio/piano/C7" },
];
const buffers: { midi: number; buf: AudioBuffer }[] = [];
let loadState: "idle" | "loading" | "samples" | "synth" = "idle";

/* ---------------- voices ---------------- */
interface Voice {
  stop(): void;
}
const active = new Map<number, Voice>();
let pianoGain: GainNode | null = null;

/* ---------------- window state ---------------- */
let loop: LoopHandle | null = null;
let onClose: (() => void) | null = null;
let baseOct = 4; // lowest visible C = C(baseOct)
let whites = 15; // 2 octaves + top C (8 on touch/narrow)
let kbd: HTMLCanvasElement | null = null;
let kctx: CanvasRenderingContext2D | null = null;
const down = new Set<number>(); // midis currently held (for drawing)
const pointers = new Map<number, number>(); // pointerId -> midi
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let keyUpHandler: ((e: KeyboardEvent) => void) | null = null;
let blurHandler: (() => void) | null = null;

const FLAVOR = [
  "The owner calls this 'his instrument.' The neighbors call it 'a situation.'",
  "Played nightly at 2am. Allegedly 'lo-fi research.'",
  "Tuned by ear. Whose ear remains an open question.",
  "Chopsticks counts. Nobody here is judging. (Alex is judging.)",
];

/* ---------------- sprites ---------------- */
const SPRITES = ["key1", "key1p", "key2", "key2p", "key3", "key3p", "key4", "key4p", "sharp", "sharpp", "felt"] as const;
type SpriteKey = (typeof SPRITES)[number];
const imgs: Partial<Record<SpriteKey, HTMLImageElement>> = {};
let imgsRequested = false;
function loadSprites(): void {
  if (imgsRequested) return;
  imgsRequested = true;
  for (const k of SPRITES) {
    const im = new Image();
    im.src = `assets/piano/${k}.png`;
    im.onload = () => drawKbd();
    imgs[k] = im;
  }
}

/* ---------------- audio ---------------- */
function ensureGain(): GainNode {
  const { ac, analyser } = MUSIC.audioGraph();
  if (!pianoGain) {
    pianoGain = ac.createGain();
    pianoGain.gain.value = 0.9;
    pianoGain.connect(analyser);
  }
  return pianoGain;
}

function ensureSamples(): void {
  if (loadState !== "idle") return;
  loadState = "loading";
  const { ac } = MUSIC.audioGraph();
  const jobs = SAMPLES.map((s) =>
    fetch(s.base + ".m4a")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .catch(() => fetch(s.base + ".flac").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))))
      .then((ab) => new Promise<AudioBuffer>((res, rej) => ac.decodeAudioData(ab, res, rej)))
      .then((buf) => buffers.push({ midi: s.midi, buf })),
  );
  void Promise.allSettled(jobs).then(() => {
    // under 3 decoded buffers the pitch stretch gets ugly — stay on synth
    loadState = buffers.length >= 3 ? "samples" : "synth";
    setSay(pick(FLAVOR));
  });
}

function midiFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function sampleVoice(midi: number): Voice | null {
  if (!buffers.length) return null;
  const { ac } = MUSIC.audioGraph();
  let nearest = buffers[0];
  for (const b of buffers) if (Math.abs(midi - b.midi) < Math.abs(midi - nearest.midi)) nearest = b;
  const src = ac.createBufferSource();
  src.buffer = nearest.buf;
  src.playbackRate.value = Math.pow(2, (midi - nearest.midi) / 12);
  const g = ac.createGain();
  g.gain.value = 1;
  src.connect(g);
  g.connect(ensureGain());
  src.start();
  return {
    stop() {
      const t = ac.currentTime;
      g.gain.setTargetAtTime(0, t, 0.06); // damper, not a click
      try {
        src.stop(t + 0.5);
      } catch {
        /* already stopped */
      }
    },
  };
}

function synthVoice(midi: number): Voice {
  const { ac } = MUSIC.audioGraph();
  const t = ac.currentTime;
  const freq = midiFreq(midi);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.06, t + 1.2);
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = Math.max(800, freq * 5);
  const oscs = [-4, 4].map((cents) => {
    const o = ac.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    o.detune.value = cents;
    o.connect(f);
    o.start(t);
    o.stop(t + 6);
    return o;
  });
  f.connect(g);
  g.connect(ensureGain());
  // hammer thump
  const nb = ac.createBuffer(1, 600, ac.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
  const ns = ac.createBufferSource();
  ns.buffer = nb;
  const ng = ac.createGain();
  ng.gain.value = 0.05;
  ns.connect(ng);
  ng.connect(ensureGain());
  ns.start(t);
  return {
    stop() {
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0.0001, now, 0.05);
      for (const o of oscs) {
        try {
          o.stop(now + 0.4);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

function noteOn(midi: number): void {
  if (down.has(midi)) noteOff(midi); // re-strike
  const v = (loadState === "samples" ? sampleVoice(midi) : null) ?? synthVoice(midi);
  active.set(midi, v);
  down.add(midi);
  P.inc("pianoNotes");
  drawKbd();
}
function noteOff(midi: number): void {
  const v = active.get(midi);
  if (v) {
    v.stop();
    active.delete(midi);
  }
  down.delete(midi);
  drawKbd();
}
function releaseAll(): void {
  for (const [, v] of active) v.stop();
  active.clear();
  down.clear();
  pointers.clear();
  drawKbd();
}

/* ---------------- keyboard geometry ---------------- */
function midiOfWhite(i: number): number {
  return (baseOct + 1 + Math.floor(i / 7)) * 12 + WHITE_SEMIS[i % 7];
}
/** Sharp on the boundary between white i and i+1 (or null). */
function sharpAfter(i: number): number | null {
  if (i >= whites - 1) return null;
  return HAS_SHARP[i % 7] ? midiOfWhite(i) + 1 : null;
}
function kbdNativeW(): number {
  return whites * STRIDE - 1 + PAD * 2;
}

function drawKbd(): void {
  if (!kctx || !kbd) return;
  const g = kctx;
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#2f2b39"; // frame/gap ink
  g.fillRect(0, 0, kbd.width, kbd.height);
  const felt = imgs.felt;
  if (felt && felt.complete && felt.naturalWidth) {
    for (let x = PAD; x < kbd.width - PAD; x += felt.naturalWidth) {
      g.drawImage(felt, 0, 0, Math.min(felt.naturalWidth, kbd.width - PAD - x), FELT_H, x, PAD, Math.min(felt.naturalWidth, kbd.width - PAD - x), FELT_H);
    }
  }
  const keyY = PAD + FELT_H;
  // white keys: shadow variant from which neighbors actually carry a sharp
  for (let i = 0; i < whites; i++) {
    const midi = midiOfWhite(i);
    const left = i > 0 && sharpAfter(i - 1) !== null;
    const right = sharpAfter(i) !== null;
    const variant = left && right ? "key3" : right ? "key2" : left ? "key4" : "key1";
    const img = imgs[(variant + (down.has(midi) ? "p" : "")) as SpriteKey];
    const x = PAD + i * STRIDE;
    if (img && img.complete && img.naturalWidth) g.drawImage(img, x, keyY);
    else {
      g.fillStyle = down.has(midi) ? "#948a75" : "#e1d2b1";
      g.fillRect(x, keyY, KW, KH);
    }
  }
  // sharps over the boundaries
  for (let i = 0; i < whites - 1; i++) {
    const midi = sharpAfter(i);
    if (midi === null) continue;
    const img = imgs[down.has(midi) ? "sharpp" : "sharp"];
    const x = PAD + (i + 1) * STRIDE - 1 - SW / 2 + 0.5; // centered on the 1px gap
    if (img && img.complete && img.naturalWidth) g.drawImage(img, Math.round(x), keyY);
    else {
      g.fillStyle = down.has(midi) ? "#3b372f" : "#221e1a";
      g.fillRect(Math.round(x), keyY, SW, SH);
    }
  }
}

/** Map a pointer event to a midi note (sharps win in their zone), or null. */
function hitTest(e: PointerEvent): number | null {
  if (!kbd) return null;
  const r = kbd.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * kbd.width;
  const y = ((e.clientY - r.top) / r.height) * kbd.height;
  const keyY = PAD + FELT_H;
  if (y < keyY || y > keyY + KH) return null;
  if (y <= keyY + SH + 1) {
    for (let i = 0; i < whites - 1; i++) {
      const midi = sharpAfter(i);
      if (midi === null) continue;
      const sx = PAD + (i + 1) * STRIDE - 1 - SW / 2 + 0.5;
      if (x >= sx - 0.5 && x <= sx + SW + 0.5) return midi;
    }
  }
  const i = Math.floor((x - PAD) / STRIDE);
  if (i < 0 || i >= whites) return null;
  return midiOfWhite(i);
}

/* ---------------- desktop key map (layout-independent e.code) ---------------- */
const CODE_OFFSET: Record<string, number> = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9,
  KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
};
const codeDown = new Map<string, number>(); // code -> midi (held)

function octRange(): [number, number] {
  return whites <= 8 ? [3, 6] : [3, 5];
}
function shiftOctave(d: -1 | 1): void {
  const [lo, hi] = octRange();
  const next = Math.max(lo, Math.min(hi, baseOct + d));
  if (next === baseOct) return;
  releaseAll();
  codeDown.clear();
  baseOct = next;
  const lbl = document.getElementById("pnOctLbl");
  if (lbl) lbl.textContent = octLabel();
  drawKbd();
}
function octLabel(): string {
  return `C${baseOct}–C${baseOct + Math.floor(whites / 7)}`;
}

function setSay(t: string): void {
  const el = document.getElementById("pnSay");
  if (el) el.textContent = t;
}

/* ---------------- open / close ---------------- */
export function open(opts?: OpenOpts): void {
  onClose = opts?.onClose ?? null;
  const touch = document.body.classList.contains("touch") || window.innerWidth < 560;
  whites = touch ? 8 : 15;
  baseOct = 4;
  loadSprites();
  ensureGain(); // resumes the shared AC (we're inside a user gesture)
  ensureSamples();
  MUSIC.duckBg();
  MUSIC.setLive(true);
  openOverlay(shell(touch));
  kbd = document.getElementById("pnKbd") as HTMLCanvasElement;
  kbd.width = kbdNativeW();
  kbd.height = KBD_H;
  kctx = kbd.getContext("2d");
  drawKbd();
  wire();
  setSay(loadState === "loading" ? "Tuning up…" : pick(FLAVOR));
  loop = startLoop(() => {
    try {
      MUSIC.drawVizTo(document.getElementById("pnViz") as HTMLCanvasElement | null);
    } catch {
      /* canvas gone between frames */
    }
  });
}

export function close(): void {
  releaseAll();
  closeOverlay();
  loop?.stop();
  loop = null;
  if (keyHandler) window.removeEventListener("keydown", keyHandler);
  if (keyUpHandler) window.removeEventListener("keyup", keyUpHandler);
  if (blurHandler) {
    window.removeEventListener("blur", blurHandler);
    document.removeEventListener("visibilitychange", blurHandler);
  }
  keyHandler = keyUpHandler = blurHandler = null;
  codeDown.clear();
  kbd = null;
  kctx = null;
  MUSIC.setLive(false);
  MUSIC.unduckBg();
  const fn = onClose;
  onClose = null;
  if (fn) fn();
}
export function isOpen(): boolean {
  return isOverlayOpen();
}

function shell(touch: boolean): string {
  const foot = touch
    ? "tap the keys · two thumbs welcome · ‹ › shift octaves"
    : "A S D F G H J K L ; ' white · W E T Y U O P black · Z/X octave · hold to sustain";
  return `<div class="mz-wrap pn-wrap">
      <button class="chess-x" id="pnClose">✕</button>
      <div class="jk-head">
        <div class="jk-titles">
          <div class="mz-kick">GRAND PIANO</div>
          <div class="jk-now" id="pnSay">Tuning up…</div>
        </div>
        <div class="pn-oct">
          <button class="ctl-btn ghost" id="pnOctDn">‹${touch ? "" : " Z"}</button>
          <span class="pn-octlbl" id="pnOctLbl">${octLabel()}</span>
          <button class="ctl-btn ghost" id="pnOctUp">${touch ? "" : "X "}›</button>
        </div>
      </div>
      <canvas id="pnViz" class="mz-viz" width="720" height="92"></canvas>
      <div class="pn-kbdwrap"><canvas id="pnKbd"></canvas></div>
      <div class="jk-foot">${foot}</div>
    </div>`;
}

function wire(): void {
  (document.getElementById("pnClose") as HTMLElement).onclick = close;
  (document.getElementById("pnOctDn") as HTMLElement).onclick = () => shiftOctave(-1);
  (document.getElementById("pnOctUp") as HTMLElement).onclick = () => shiftOctave(1);

  // ---- desktop keys ----
  keyHandler = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.code === "KeyZ") {
      shiftOctave(-1);
      return;
    }
    if (e.code === "KeyX") {
      shiftOctave(1);
      return;
    }
    const off = CODE_OFFSET[e.code];
    if (off === undefined) return;
    e.preventDefault();
    const midi = (baseOct + 1) * 12 + off;
    if (midi > (baseOct + 1 + Math.floor(whites / 7)) * 12) return; // beyond visible top C
    if (codeDown.has(e.code)) return;
    codeDown.set(e.code, midi);
    noteOn(midi);
  };
  keyUpHandler = (e: KeyboardEvent): void => {
    const midi = codeDown.get(e.code);
    if (midi !== undefined) {
      codeDown.delete(e.code);
      noteOff(midi);
    }
  };
  window.addEventListener("keydown", keyHandler);
  window.addEventListener("keyup", keyUpHandler);

  // ---- pointers: chords (one note per finger) + glissando ----
  kbd!.addEventListener("pointerdown", (e) => {
    const midi = hitTest(e);
    if (midi === null) return;
    try {
      kbd!.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
    pointers.set(e.pointerId, midi);
    noteOn(midi);
    e.preventDefault();
  });
  kbd!.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const midi = hitTest(e);
    const cur = pointers.get(e.pointerId)!;
    if (midi !== null && midi !== cur) {
      noteOff(cur);
      pointers.set(e.pointerId, midi);
      noteOn(midi);
    }
    e.preventDefault();
  });
  const lift = (e: PointerEvent): void => {
    const midi = pointers.get(e.pointerId);
    if (midi !== undefined) {
      pointers.delete(e.pointerId);
      noteOff(midi);
    }
  };
  kbd!.addEventListener("pointerup", lift);
  kbd!.addEventListener("pointercancel", lift);

  // no stuck notes when the tab loses focus mid-chord
  blurHandler = (): void => {
    if (document.visibilityState === "hidden" || !document.hasFocus()) {
      releaseAll();
      codeDown.clear();
    }
  };
  window.addEventListener("blur", blurHandler);
  document.addEventListener("visibilitychange", blurHandler);
}
