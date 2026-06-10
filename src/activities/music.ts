/* ============================================================
   MUSIC — a persistent jukebox engine + two separate windows
     • Jukebox  (opens from the speaker) — sets the site-wide track.
     • Beat Pad (opens from Alex / DJ)    — tap sequencer.
   The chosen jukebox track becomes the background music for the whole
   site and KEEPS PLAYING after the jukebox window is closed. The beat
   pad ducks (fades out) that music while it's open and fades it back
   in when it closes, so the two never fight.
   ============================================================ */
import { CONTENT as C } from "../content";
import { drawPortraitFrame } from "../sprites";
import { openOverlay, closeOverlay, isOverlayOpen, startLoop, type LoopHandle } from "./base";

interface OpenOpts {
  onClose?: () => void;
}

/* ---------- persistent audio engine (survives window open/close) -------- */
let ac: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let data: Uint8Array<ArrayBuffer> | null = null; // shared Web Audio graph
let bgAudio: HTMLAudioElement | null = null;
let bgSrc: MediaElementAudioSourceNode | null = null; // current background <audio> + nodes
let bgGain: GainNode | null = null;
let curTrack = -1;
let playing = false; // jukebox state
let muted = false; // global (header) mute
let padDuck = false; // beat pad ducking the bg music
let fadeRAF = 0; // in-flight volume fade
const FULL_VOL = 0.82;

let onChange: (() => void) | null = null; // open window live-sync

/* ---------- jukebox window state ---------- */
let jkLoop: LoopHandle | null = null;
let jkClose: (() => void) | null = null;
let jkKey: ((e: KeyboardEvent) => void) | null = null;

/* ---------- beat pad window state ---------- */
let bpLoop: LoopHandle | null = null;
let bpClose: (() => void) | null = null;
let bpKey: ((e: KeyboardEvent) => void) | null = null;
const padCols = 8;
const padRows = 4;
let pattern: boolean[][] = [];
let step = 0;
let seqTimer: ReturnType<typeof setTimeout> | null = null;
let bpm = 110;
let padPlaying = false;
let bpSayUntil = 0;
let bpSayText = "";
let bpT = 0;

// pentatonic-ish notes per row (Hz) — top bright down to low
const NOTES = [
  [523.25, 587.33, 659.25, 783.99, 880, 1046.5],
  [392, 440, 493.88, 587.33, 659.25, 783.99],
  [261.63, 293.66, 329.63, 392, 440, 523.25],
  [130.81, 146.83, 164.81, 196, 220, 261.63],
];

const AudioCtor: typeof AudioContext =
  window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

function ensureAC(): AudioContext {
  if (!ac) {
    ac = new AudioCtor();
    analyser = ac.createAnalyser();
    analyser.fftSize = 128;
    data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    // master gain for the background track. iOS Safari ignores
    // HTMLMediaElement.volume (hardware-controlled), so all volume, ducking and
    // muting must go through a Web Audio GainNode instead.
    // graph: bgSrc -> bgGain -> analyser -> destination
    // (beat-pad blips connect straight to the analyser, so they're never ducked)
    bgGain = ac.createGain();
    bgGain.gain.value = FULL_VOL;
    bgGain.connect(analyser);
    analyser.connect(ac.destination);
  }
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

function clearFade(): void {
  if (fadeRAF) {
    cancelAnimationFrame(fadeRAF);
    fadeRAF = 0;
  }
}
// ramp bgAudio.volume -> target over ms, then run cb
function fadeTo(target: number, ms: number, cb?: () => void): void {
  clearFade();
  if (!bgGain) {
    if (cb) cb();
    return;
  }
  const from = bgGain.gain.value,
    t0 = performance.now();
  const tick = (now: number): void => {
    const k = Math.min(1, (now - t0) / Math.max(1, ms));
    try {
      bgGain!.gain.value = Math.max(0, Math.min(1, from + (target - from) * k));
    } catch {
      /* node gone mid-fade */
    }
    if (k < 1) fadeRAF = requestAnimationFrame(tick);
    else {
      fadeRAF = 0;
      if (cb) cb();
    }
  };
  fadeRAF = requestAnimationFrame(tick);
}

// play track i as the looping, site-wide background music
function playTrack(i: number): void {
  ensureAC();
  if (i < 0 || i >= C.tracks.length) return;
  if (curTrack === i && playing) return; // already on it
  clearFade();
  if (bgAudio) {
    bgAudio.pause();
    try {
      bgSrc?.disconnect();
    } catch {
      /* already disconnected */
    }
    bgAudio = null;
    bgSrc = null;
  }
  curTrack = i;
  playing = true;
  bgAudio = new Audio(C.tracks[i].file);
  bgAudio.crossOrigin = "anonymous";
  bgAudio.loop = true;
  // volume is driven entirely by bgGain (see ensureAC) — leave the element at 1
  try {
    bgSrc = ac!.createMediaElementSource(bgAudio);
    bgSrc.connect(bgGain!);
  } catch {
    /* source already created for this element */
  }
  bgGain!.gain.value = muted || padDuck ? 0 : 0.0001;
  void bgAudio.play().catch(() => {});
  if (!muted && !padDuck) fadeTo(FULL_VOL, 450);
  emit();
}
export function stop(): void {
  clearFade();
  playing = false;
  if (bgAudio) {
    bgAudio.pause();
    bgAudio.currentTime = 0;
  }
  emit();
}
function toggleTrack(i: number): void {
  if (curTrack === i && playing) stop();
  else playTrack(i);
}

// beat pad ducking — fade music down/out while the pad is open, back in after
function duckForPad(): void {
  padDuck = true;
  if (bgAudio && playing) fadeTo(0, 340);
}
function unduckAfterPad(): void {
  padDuck = false;
  if (bgAudio && playing && !muted) fadeTo(FULL_VOL, 750);
}

// global mute (header sound button)
export function setMuted(m: boolean): void {
  muted = !!m;
  if (muted) fadeTo(0, 240);
  else if (bgAudio && playing && !padDuck) fadeTo(FULL_VOL, 400);
}

// state queries
export function isPlaying(): boolean {
  return playing;
}
export function isAudible(): boolean {
  return playing && !padDuck && !muted;
} // drives speaker anim
function vizData(): Uint8Array<ArrayBuffer> | null {
  if (analyser && data) {
    analyser.getByteFrequencyData(data);
    return data;
  }
  return null;
}
export function level(): number {
  // 0..1 overall amplitude
  if (!isAudible() && !padPlaying) return 0;
  const d = vizData();
  if (!d) return 0;
  let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i];
  return s / d.length / 255;
}

function emit(): void {
  if (onChange) onChange();
}

// shared visualizer — warm gold bars to match the wood/cream UI
function drawViz(cnv: HTMLCanvasElement | null): void {
  if (!cnv) return;
  const vctx = cnv.getContext("2d");
  if (!vctx) return;
  const W = cnv.width,
    H = cnv.height;
  vctx.clearRect(0, 0, W, H);
  const arr = isAudible() || padPlaying ? vizData() : null;
  const n = 32,
    bw = W / n;
  for (let i = 0; i < n; i++) {
    let v: number;
    if (arr) v = arr[i % arr.length] / 255;
    else v = 0.09 + 0.07 * Math.abs(Math.sin(performance.now() / 650 + i * 0.5));
    const h = Math.max(3, v * H);
    const hue = 28 + (i / n) * 18; // amber -> gold
    vctx.fillStyle = `hsl(${hue} 78% ${44 + v * 22}%)`;
    vctx.fillRect(i * bw + 2, H - h, bw - 4, h);
  }
}

/* ====================== JUKEBOX WINDOW ================================== */
export function openJukebox(opts?: OpenOpts): void {
  jkClose = opts?.onClose ?? null;
  ensureAC();
  openOverlay(jukeboxShell());
  buildJukeTracks();
  onChange = refreshJuke;
  (document.getElementById("jkClose") as HTMLElement).onclick = closeJukebox;
  (document.getElementById("jkStop") as HTMLElement).onclick = () => stop();
  jkKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") closeJukebox();
  };
  window.addEventListener("keydown", jkKey);
  jkLoop = startLoop(() => {
    try {
      drawViz(document.getElementById("jkViz") as HTMLCanvasElement | null);
    } catch {
      /* canvas gone between frames */
    }
  });
}
export function closeJukebox(): void {
  closeOverlay();
  jkLoop?.stop();
  jkLoop = null;
  onChange = null;
  if (jkKey) {
    window.removeEventListener("keydown", jkKey);
    jkKey = null;
  }
  const fn = jkClose;
  jkClose = null;
  if (fn) fn();
  // music keeps playing — intentionally NOT stopped here
}
function jukeboxShell(): string {
  return `<div class="mz-wrap jk-wrap">
      <button class="chess-x" id="jkClose">✕</button>
      <div class="jk-head">
        <div class="jk-titles">
          <div class="mz-kick">JUKEBOX</div>
          <div class="jk-now" id="jkNow"></div>
        </div>
        <button class="ctl-btn ghost jk-stop" id="jkStop">■ Stop</button>
      </div>
      <canvas id="jkViz" class="mz-viz" width="720" height="92"></canvas>
      <div class="jk-tracks" id="jkTracks"></div>
      <div class="jk-foot">Plays everywhere as you explore. The beat pad pauses it.</div>
    </div>`;
}
function buildJukeTracks(): void {
  const wrap = document.getElementById("jkTracks")!;
  wrap.innerHTML = C.tracks
    .map(
      (t, i) =>
        `<button class="mz-track jk-track" data-i="${i}"><span class="mz-eq"><i></i><i></i><i></i></span><span class="mz-tn">${t.name}</span></button>`,
    )
    .join("");
  wrap.querySelectorAll<HTMLElement>(".jk-track").forEach((b) => (b.onclick = () => toggleTrack(+b.getAttribute("data-i")!)));
  refreshJuke();
}
function refreshJuke(): void {
  const now = document.getElementById("jkNow");
  if (now) now.textContent = playing ? "Now playing · " + C.tracks[curTrack].name : "Pick a track to set the vibe.";
  document.querySelectorAll<HTMLElement>(".jk-track").forEach((b, i) => b.classList.toggle("on", i === curTrack && playing));
  const sb = document.getElementById("jkStop");
  if (sb) sb.style.visibility = playing ? "visible" : "hidden";
}

/* ====================== BEAT PAD WINDOW ================================= */
export function openBeatpad(opts?: OpenOpts): void {
  bpClose = opts?.onClose ?? null;
  ensureAC();
  openOverlay(beatpadShell());
  duckForPad(); // fade the jukebox music out
  buildPad();
  wireBeat();
  bpSay("Welcome to the booth. Tap out something filthy. ;)");
  bpT = 0;
  bpLoop = startLoop(beatStep);
}
export function closeBeatpad(): void {
  stopPad();
  unduckAfterPad(); // fade the jukebox music back in
  closeOverlay();
  bpLoop?.stop();
  bpLoop = null;
  if (bpKey) {
    window.removeEventListener("keydown", bpKey);
    bpKey = null;
  }
  const fn = bpClose;
  bpClose = null;
  if (fn) fn();
}
function beatpadShell(): string {
  return `<div class="mz-wrap bp-wrap">
      <button class="chess-x" id="bpClose">✕</button>
      <div class="mz-head">
        <div class="mz-djs">
          <div class="mz-dj"><canvas id="mzPortA" width="64" height="64"></canvas><span>Alex</span></div>
          <div class="mz-dj"><canvas id="mzPortD" width="64" height="64"></canvas><span>DJ</span></div>
        </div>
        <div class="mz-title"><div class="mz-kick">BEAT PAD</div><div class="mz-say" id="mzSay"></div></div>
      </div>
      <canvas id="mzViz" class="mz-viz" width="720" height="104"></canvas>
      <div class="mz-pad">
        <div class="mz-sub">Tap a beat <span class="mz-hint">click cells · space to run</span></div>
        <div class="mz-grid" id="mzGrid"></div>
        <div class="mz-padctl">
          <button class="ctl-btn" id="mzPlay">▶ Run</button>
          <button class="ctl-btn ghost" id="mzClear">Clear</button>
          <label class="mz-bpm">BPM <input type="range" id="mzBpm" min="70" max="160" value="110"></label>
        </div>
      </div>
    </div>`;
}

function buildPad(): void {
  pattern = Array.from({ length: padRows }, () => Array(padCols).fill(false));
  const g = document.getElementById("mzGrid")!;
  g.style.gridTemplateColumns = `repeat(${padCols},1fr)`;
  g.innerHTML = "";
  for (let r = 0; r < padRows; r++)
    for (let c = 0; c < padCols; c++) {
      const cell = document.createElement("button");
      cell.className = "pad-cell";
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.onclick = () => {
        pattern[r][c] = !pattern[r][c];
        cell.classList.toggle("on", pattern[r][c]);
        if (pattern[r][c]) blip(NOTES[r][2], 0.12);
      };
      g.appendChild(cell);
    }
}
function stepClass(): void {
  const g = document.getElementById("mzGrid");
  if (!g) return;
  g.querySelectorAll<HTMLElement>(".pad-cell").forEach((c) => c.classList.toggle("col", +c.dataset.c! === step));
}
function blip(freq: number, dur?: number): void {
  ensureAC();
  const o = ac!.createOscillator(),
    gain = ac!.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, ac!.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.22, ac!.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac!.currentTime + (dur || 0.18));
  o.connect(gain);
  gain.connect(analyser!);
  o.start();
  o.stop(ac!.currentTime + (dur || 0.18));
}
function runPad(): void {
  ensureAC();
  if (padPlaying) {
    stopPad();
    return;
  }
  padPlaying = true;
  step = 0;
  const b = document.getElementById("mzPlay");
  if (b) b.textContent = "■ Stop";
  const tick = (): void => {
    for (let r = 0; r < padRows; r++) if (pattern[r][step]) blip(NOTES[r][step % 6], 0.16);
    stepClass();
    step = (step + 1) % padCols;
    seqTimer = setTimeout(tick, ((60 / bpm) * 1000) / 2);
  };
  tick();
  bpSay("Now we're cooking. :D");
}
function stopPad(): void {
  padPlaying = false;
  if (seqTimer) clearTimeout(seqTimer);
  seqTimer = null;
  const b = document.getElementById("mzPlay");
  if (b) b.textContent = "▶ Run";
  const g = document.getElementById("mzGrid");
  if (g) g.querySelectorAll<HTMLElement>(".pad-cell").forEach((c) => c.classList.remove("col"));
}
function wireBeat(): void {
  (document.getElementById("bpClose") as HTMLElement).onclick = closeBeatpad;
  (document.getElementById("mzPlay") as HTMLElement).onclick = runPad;
  (document.getElementById("mzClear") as HTMLElement).onclick = () => buildPad();
  (document.getElementById("mzBpm") as HTMLInputElement).oninput = (e) => {
    bpm = +(e.target as HTMLInputElement).value;
  };
  bpKey = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName || "";
    if (e.key === "Escape") {
      closeBeatpad();
      return;
    }
    if ((e.key === " " || e.code === "Space") && tag !== "INPUT") {
      e.preventDefault();
      runPad();
    }
  };
  window.addEventListener("keydown", bpKey);
}

function bpSay(t: string): void {
  bpSayText = t;
  bpSayUntil = performance.now() + 3200;
}
function beatStep(dt: number): void {
  try {
    const now = performance.now();
    bpT += dt;
    const f = Math.floor(bpT * (padPlaying ? 12 : 5));
    const pA = document.getElementById("mzPortA") as HTMLCanvasElement | null;
    const pD = document.getElementById("mzPortD") as HTMLCanvasElement | null;
    if (pA) {
      const c = pA.getContext("2d");
      if (c) drawPortraitFrame(c, "port_Alex", padPlaying ? f : 0, 64, 64);
    }
    if (pD) {
      const c = pD.getContext("2d");
      if (c) drawPortraitFrame(c, "port_DJ", padPlaying ? f + 3 : 0, 64, 64);
    }
    const se = document.getElementById("mzSay");
    if (se) se.textContent = now < bpSayUntil ? bpSayText : "";
    drawViz(document.getElementById("mzViz") as HTMLCanvasElement | null);
  } catch (err) {
    console.error("beat loop", err);
  }
}

export function isOpen(): boolean {
  return isOverlayOpen();
}
