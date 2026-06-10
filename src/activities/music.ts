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
import * as P from "../progress";
import { serializePattern, parsePattern, BPM_MIN, BPM_MAX } from "./beat-util";
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

/* ---------- step sequencer window state ---------- */
let bpLoop: LoopHandle | null = null;
let bpClose: (() => void) | null = null;
let bpKey: ((e: KeyboardEvent) => void) | null = null;
const padCols = 8;
let drumPattern: boolean[][] = [];
let keyPattern: boolean[][] = [];
let step = 0;
let bpm = 110;
let padPlaying = false;
let bpSayUntil = 0;
let bpSayText = "";
let bpT = 0;
const PAD_LS_KEY = "beatPad1"; // auto-saved patterns + bpm (v2)

/* ---------- melodic rows (C-major pentatonic, high to low) ----------
   The classic two-section grid sequencer: KEYS on top, DRUMS below. */
const KEYS: { label: string; freq: number }[] = [
  { label: "C5", freq: 523.25 },
  { label: "A4", freq: 440 },
  { label: "G4", freq: 392 },
  { label: "E4", freq: 329.63 },
  { label: "D4", freq: 293.66 },
  { label: "C4", freq: 261.63 },
  { label: "A3", freq: 220 },
  { label: "G3", freq: 196 },
];

/* ---------- drum kit (CC0 one-shots from VCSL, synth fallback) ----------
   Rows top -> bottom. Samples lazy-load on first open; any row whose file
   fails to fetch/decode keeps its synthesized voice forever. */
interface DrumDef {
  key: string;
  label: string;
  file: string;
  gain: number;
  synth(when: number): void;
}
const KIT: DrumDef[] = [
  { key: "shaker", label: "SHK", file: "assets/audio/drums/shaker.wav", gain: 0.5, synth: (w) => synthNoise(w, 5000, "bandpass", 0.12, 0.1) },
  { key: "openhat", label: "OHH", file: "assets/audio/drums/openhat.wav", gain: 0.5, synth: (w) => synthNoise(w, 7000, "highpass", 0.4, 0.12) },
  { key: "hat", label: "HAT", file: "assets/audio/drums/hat.wav", gain: 0.55, synth: (w) => synthNoise(w, 7000, "highpass", 0.06, 0.14) },
  { key: "snare", label: "SNR", file: "assets/audio/drums/snare.wav", gain: 0.9, synth: synthSnare },
  { key: "kick", label: "KCK", file: "assets/audio/drums/kick.wav", gain: 1.0, synth: synthKick },
];
const drumBufs: (AudioBuffer | null)[] = KIT.map(() => null);
let drumsRequested = false;
let drumGain: GainNode | null = null;
let lastOpenHat: AudioBufferSourceNode | null = null;

function ensureDrumGraph(): void {
  ensureAC();
  if (!drumGain) {
    drumGain = ac!.createGain();
    drumGain.gain.value = 0.9;
    drumGain.connect(analyser!); // same graph as everything else (iOS-safe)
  }
}
function loadDrums(): void {
  if (drumsRequested) return;
  drumsRequested = true;
  ensureDrumGraph();
  KIT.forEach((d, i) => {
    fetch(d.file)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((ab) => new Promise<AudioBuffer>((res, rej) => ac!.decodeAudioData(ab, res, rej)))
      .then((buf) => {
        drumBufs[i] = buf;
      })
      .catch(() => {
        /* row stays on synth */
      });
  });
}
/** Trigger row `r` at AudioContext time `when` (sample if loaded, else synth). */
function hit(r: number, when: number): void {
  ensureDrumGraph();
  const d = KIT[r];
  const buf = drumBufs[r];
  if (!buf) {
    d.synth(when);
    return;
  }
  const src = ac!.createBufferSource();
  src.buffer = buf;
  const g = ac!.createGain();
  g.gain.value = d.gain;
  src.connect(g);
  g.connect(drumGain!);
  // closed hat chokes the open hat, like a real hi-hat pedal
  if (d.key === "hat" && lastOpenHat) {
    try {
      lastOpenHat.stop(when);
    } catch {
      /* already stopped */
    }
    lastOpenHat = null;
  }
  if (d.key === "openhat") lastOpenHat = src;
  src.start(when);
}

/** Trigger melodic row `r` at time `when` — a soft kalimba-ish pluck. */
function hitKey(r: number, when: number): void {
  ensureDrumGraph();
  const freq = KEYS[r].freq;
  const g = ac!.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.16, when + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);
  const f = ac!.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq * 4;
  [-5, 5].forEach((cents) => {
    const o = ac!.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    o.detune.value = cents;
    o.connect(f);
    o.start(when);
    o.stop(when + 0.5);
  });
  f.connect(g);
  g.connect(drumGain!); // through the same bus so recordings include the melody
}

// ---- synth kit (also the offline fallback) ----
let noiseBuf: AudioBuffer | null = null;
function noise(): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ac!.createBuffer(1, ac!.sampleRate, ac!.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function synthNoise(when: number, freq: number, type: BiquadFilterType, dur: number, vol: number): void {
  const src = ac!.createBufferSource();
  src.buffer = noise();
  const f = ac!.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ac!.createGain();
  g.gain.setValueAtTime(vol, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(f);
  f.connect(g);
  g.connect(drumGain!);
  src.start(when);
  src.stop(when + dur + 0.02);
}
function synthKick(when: number): void {
  const o = ac!.createOscillator(), g = ac!.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, when);
  o.frequency.exponentialRampToValueAtTime(48, when + 0.12);
  g.gain.setValueAtTime(0.55, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.35);
  o.connect(g);
  g.connect(drumGain!);
  o.start(when);
  o.stop(when + 0.36);
}
function synthSnare(when: number): void {
  synthNoise(when, 1800, "bandpass", 0.2, 0.25);
  const o = ac!.createOscillator(), g = ac!.createGain();
  o.type = "triangle";
  o.frequency.value = 190;
  g.gain.setValueAtTime(0.18, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.1);
  o.connect(g);
  g.connect(drumGain!);
  o.start(when);
  o.stop(when + 0.11);
}

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
  P.inc("tracksPlayed");
  P.flag(`track_${C.tracks[i].name}`);
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

// instrument ducking — fade music down/out while an instrument is open
// (beat pad here, piano in piano.ts), back in after it closes.
export function duckBg(): void {
  padDuck = true;
  if (bgAudio && playing) fadeTo(0, 340);
}
export function unduckBg(): void {
  padDuck = false;
  if (bgAudio && playing && !muted) fadeTo(FULL_VOL, 750);
}
const duckForPad = duckBg;
const unduckAfterPad = unduckBg;

/* ---- shared audio graph (other activities plug into the same
       AudioContext + analyser so the visualizer reacts to them too) ---- */
let extLive = false; // a non-jukebox instrument (piano) is currently sounding
export function audioGraph(): { ac: AudioContext; analyser: AnalyserNode } {
  ensureAC();
  return { ac: ac!, analyser: analyser! };
}
/** Mark an external instrument as live so level()/the visualizer read the analyser. */
export function setLive(on: boolean): void {
  extLive = on;
}
/** Draw the shared warm-gold visualizer into any canvas (piano reuses it). */
export function drawVizTo(cnv: HTMLCanvasElement | null): void {
  drawViz(cnv);
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
/** Name of the track currently playing site-wide, or null. (NPC reactions use this.) */
export function nowPlaying(): string | null {
  return playing && curTrack >= 0 ? C.tracks[curTrack].name : null;
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
  if (!isAudible() && !padPlaying && !extLive) return 0;
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
  const arr = isAudible() || padPlaying || extLive ? vizData() : null;
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

/* ====================== track preloading ============================= */
// Warm the browser cache for every jukebox track the first time the jukebox is
// opened, so picking one plays instantly. The full set is ~56 MB, so it's only
// fetched once the user shows interest in music — never on a plain page load.
let tracksPreloaded = false;
const trackWarmers: HTMLAudioElement[] = [];
export function preloadTracks(): void {
  if (tracksPreloaded) return;
  tracksPreloaded = true;
  for (const t of C.tracks) {
    const a = new Audio();
    a.preload = "auto";
    a.src = t.file; // begins fetching into the browser cache
    trackWarmers.push(a); // keep a ref so it isn't GC'd mid-fetch
  }
}

/* ====================== JUKEBOX WINDOW ================================== */
export function openJukebox(opts?: OpenOpts): void {
  jkClose = opts?.onClose ?? null;
  ensureAC();
  preloadTracks(); // warm all tracks so picking one is instant
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
  loadDrums(); // lazy: kit samples fetch on first open only
  openOverlay(beatpadShell());
  duckForPad(); // fade the jukebox music out
  buildPad(true); // hydrate the auto-saved pattern
  wireBeat();
  bpSay("Welcome to the booth. Tap out something filthy. ;)");
  bpT = 0;
  bpLoop = startLoop(beatStep);
}
export function closeBeatpad(): void {
  cancelRecording();
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
      <button class="chess-x" id="bpClose" aria-label="Close">✕</button>
      <div class="mz-head">
        <div class="mz-djs">
          <div class="mz-dj"><canvas id="mzPortA" width="64" height="64"></canvas><span>Alex</span></div>
          <div class="mz-dj"><canvas id="mzPortD" width="64" height="64"></canvas><span>DJ</span></div>
        </div>
        <div class="mz-title"><div class="mz-kick">STEP SEQUENCER</div><div class="mz-say" id="mzSay"></div></div>
      </div>
      <canvas id="mzViz" class="mz-viz" width="720" height="104"></canvas>
      <div class="mz-pad">
        <div class="mz-sub">Keys <span class="mz-hint">a note per row · 8 steps loop</span></div>
        <div class="mz-grid keys" id="mzGridKeys"></div>
        <div class="mz-sub">Drums <span class="mz-hint">click cells · space runs · auto-saves</span></div>
        <div class="mz-grid" id="mzGrid"></div>
        <div class="mz-padctl">
          <button class="ctl-btn" id="mzPlay">▶ Run</button>
          <button class="ctl-btn ghost" id="mzClear">Clear</button>
          <button class="ctl-btn ghost" id="mzDl">⬇ Save beat</button>
        </div>
        <label class="mz-bpm">BPM <input type="range" id="mzBpm" min="${BPM_MIN}" max="${BPM_MAX}" value="110"></label>
      </div>
    </div>`;
}

let padSaveTimer: ReturnType<typeof setTimeout> | null = null;
function savePad(): void {
  if (padSaveTimer) clearTimeout(padSaveTimer);
  padSaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PAD_LS_KEY, serializePattern(drumPattern, keyPattern, bpm));
    } catch {
      /* quota / private mode */
    }
  }, 250);
}

function buildGrid(el: HTMLElement, pattern: boolean[][], labels: string[], preview: (r: number) => void): void {
  el.style.gridTemplateColumns = `36px repeat(${padCols},1fr)`;
  el.innerHTML = "";
  for (let r = 0; r < pattern.length; r++) {
    const lab = document.createElement("span");
    lab.className = "mz-rowlab";
    lab.textContent = labels[r];
    el.appendChild(lab);
    for (let c = 0; c < padCols; c++) {
      const cell = document.createElement("button");
      cell.className = "pad-cell" + (pattern[r][c] ? " on" : "");
      cell.dataset.c = String(c);
      cell.onclick = () => {
        pattern[r][c] = !pattern[r][c];
        cell.classList.toggle("on", pattern[r][c]);
        if (pattern[r][c]) preview(r);
        savePad();
        refreshDl();
      };
      el.appendChild(cell);
    }
  }
}

function buildPad(fromStorage: boolean): void {
  drumPattern = Array.from({ length: KIT.length }, () => Array(padCols).fill(false));
  keyPattern = Array.from({ length: KEYS.length }, () => Array(padCols).fill(false));
  if (fromStorage) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(PAD_LS_KEY);
    } catch {
      /* private mode */
    }
    const saved = parsePattern(raw, KIT.length, KEYS.length, padCols);
    if (saved) {
      drumPattern = saved.drums;
      keyPattern = saved.keys;
      bpm = saved.bpm;
      const slider = document.getElementById("mzBpm") as HTMLInputElement | null;
      if (slider) slider.value = String(bpm);
    }
  }
  ensureDrumGraph();
  buildGrid(document.getElementById("mzGridKeys")!, keyPattern, KEYS.map((k) => k.label), (r) => hitKey(r, ac!.currentTime));
  buildGrid(document.getElementById("mzGrid")!, drumPattern, KIT.map((k) => k.label), (r) => hit(r, ac!.currentTime));
  refreshDl();
}
function stepClass(): void {
  const pad = document.querySelector(".mz-pad");
  if (!pad) return;
  pad.querySelectorAll<HTMLElement>(".pad-cell").forEach((c) => c.classList.toggle("col", +c.dataset.c! === step));
}
/** Two-tone alarm for the DO NOT PRESS button. Unlike blip(), this respects
    the header mute — the button's joke survives on shake + flicker alone. */
export function klaxon(): void {
  if (muted) return;
  ensureAC();
  const t0 = ac!.currentTime;
  const seg = 0.18;
  for (let i = 0; i < 6; i++) {
    const o = ac!.createOscillator(), g = ac!.createGain();
    o.type = "square";
    o.frequency.value = i % 2 === 0 ? 620 : 470;
    g.gain.setValueAtTime(0.0001, t0 + i * seg);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + i * seg + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * seg);
    o.connect(g);
    g.connect(analyser!);
    o.start(t0 + i * seg);
    o.stop(t0 + (i + 1) * seg + 0.01);
  }
}

/* ---- lookahead scheduler: hits land at exact ac.currentTime offsets,
        so the groove no longer wobbles with setTimeout jitter. The RAF
        loop only drains stepQueue to move the column highlight. ---- */
let nextStepTime = 0; // ac.currentTime-domain
let schedStep = 0; // next step index to schedule
let schedTimer: ReturnType<typeof setInterval> | null = null;
let stepQueue: { step: number; time: number }[] = [];
const LOOKAHEAD_S = 0.12, TICK_MS = 25;
const stepDur = (): number => 60 / bpm / 2; // 8 steps = 4 beats

function schedule(): void {
  const now = ac!.currentTime;
  while (nextStepTime < now + LOOKAHEAD_S) {
    for (let r = 0; r < KIT.length; r++) if (drumPattern[r][schedStep]) hit(r, nextStepTime);
    for (let r = 0; r < KEYS.length; r++) if (keyPattern[r][schedStep]) hitKey(r, nextStepTime);
    stepQueue.push({ step: schedStep, time: nextStepTime });
    nextStepTime += stepDur();
    schedStep = (schedStep + 1) % padCols;
  }
}
function runPad(): void {
  ensureAC();
  if (padPlaying) {
    stopPad();
    return;
  }
  padPlaying = true;
  step = 0;
  schedStep = 0;
  stepQueue = [];
  nextStepTime = ac!.currentTime + 0.06;
  schedule();
  schedTimer = setInterval(schedule, TICK_MS);
  const b = document.getElementById("mzPlay");
  if (b) b.textContent = "■ Stop";
  bpSay("Now we're cooking. :D");
}
function stopPad(): void {
  padPlaying = false;
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
  stepQueue = [];
  const b = document.getElementById("mzPlay");
  if (b) b.textContent = "▶ Run";
  const g = document.getElementById("mzGrid");
  if (g) g.querySelectorAll<HTMLElement>(".pad-cell").forEach((c) => c.classList.remove("col"));
}

/* ---- "Download my beat": record exactly two loop cycles off the drum bus.
        Safari records audio/mp4 (never webm); the mime pick handles it.
        The button is hidden entirely where MediaRecorder is unsupported. ---- */
let recDest: MediaStreamAudioDestinationNode | null = null;
let recorder: MediaRecorder | null = null;
let recArmAt = 0; // ac time the captured loop starts
let recDur = 0;
let recCancelled = false;
function recMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "" };
  if (MediaRecorder.isTypeSupported("audio/mp4")) return { mime: "audio/mp4", ext: "m4a" };
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return { mime: "audio/webm;codecs=opus", ext: "webm" };
  return { mime: "audio/webm", ext: "webm" };
}
function hasAnyStep(): boolean {
  return drumPattern.some((row) => row.some(Boolean)) || keyPattern.some((row) => row.some(Boolean));
}
function refreshDl(): void {
  const b = document.getElementById("mzDl") as HTMLButtonElement | null;
  if (!b) return;
  const supported = recMime().mime !== "";
  b.style.display = supported ? "" : "none";
  if (!recorder) b.disabled = !hasAnyStep();
}
function startDownload(): void {
  if (recorder || recMime().mime === "") return;
  if (!hasAnyStep()) return;
  ensureDrumGraph();
  if (!recDest) {
    recDest = ac!.createMediaStreamDestination();
    drumGain!.connect(recDest);
  }
  const { mime, ext } = recMime();
  // restart the loop so the capture starts on a clean cycle boundary
  stopPad();
  runPad();
  const chunks: Blob[] = [];
  recCancelled = false;
  recorder = new MediaRecorder(recDest.stream, { mimeType: mime });
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = () => {
    recorder = null;
    const b = document.getElementById("mzDl") as HTMLButtonElement | null;
    if (b) b.textContent = "⬇ Save beat";
    refreshDl();
    if (recCancelled || !chunks.length) return;
    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ryans-world-beat.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    P.inc("beatsDownloaded");
    bpSay("Cooked. Check your downloads. ;)");
  };
  recArmAt = nextStepTime - 0.06;
  recDur = 2 * padCols * stepDur() + 0.3; // two cycles + decay tail
  recorder.start();
  const b = document.getElementById("mzDl") as HTMLButtonElement | null;
  if (b) {
    b.textContent = "● Recording…";
    b.disabled = true;
  }
  bpSay("Recording two loops — keep it running!");
}
function cancelRecording(): void {
  if (!recorder) return;
  recCancelled = true;
  try {
    recorder.stop();
  } catch {
    /* already stopped */
  }
}
function wireBeat(): void {
  (document.getElementById("bpClose") as HTMLElement).onclick = closeBeatpad;
  (document.getElementById("mzPlay") as HTMLElement).onclick = runPad;
  (document.getElementById("mzClear") as HTMLElement).onclick = () => {
    buildPad(false);
    try {
      localStorage.removeItem(PAD_LS_KEY);
    } catch {
      /* private mode */
    }
  };
  (document.getElementById("mzDl") as HTMLElement).onclick = startDownload;
  (document.getElementById("mzBpm") as HTMLInputElement).oninput = (e) => {
    bpm = +(e.target as HTMLInputElement).value;
    savePad();
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
  refreshDl();
}

function bpSay(t: string): void {
  bpSayText = t;
  bpSayUntil = performance.now() + 3200;
}
function beatStep(dt: number): void {
  try {
    const now = performance.now();
    bpT += dt;
    // drain due scheduler steps -> column highlight stays on RAF
    if (padPlaying && ac) {
      const t = ac.currentTime;
      let moved = false;
      while (stepQueue.length && stepQueue[0].time <= t) {
        step = stepQueue.shift()!.step;
        moved = true;
      }
      if (moved) stepClass();
    }
    // recording: stop after exactly two cycles (timed on the audio clock)
    if (recorder && recorder.state === "recording" && ac && ac.currentTime >= recArmAt + recDur) {
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
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
