/* ============================================================
   PROGRESS — site-wide visit tracking + achievements.
   Pure module: imports nothing from game/activities, everyone
   imports it. One versioned localStorage blob; in-memory object
   is the source of truth, saved after every mutation. Toasts are
   created lazily so the module also loads in the vitest node env.
   ============================================================ */
import type { RoomKey } from "./core/types";

const LS_KEY = "rw_progress_v1";

export type NumKey =
  | "chessWins"
  | "chessLosses"
  | "chessDraws"
  | "poolWins"
  | "poolLosses"
  | "trickshotStars"
  | "gymBest"
  | "pokerChips"
  | "pokerHands"
  | "pianoNotes"
  | "beatsDownloaded"
  | "tracksPlayed"
  | "petsGiven"
  | "buttonPresses";

export type FlagKey =
  | "guestbookSigned"
  | "pressedButton"
  | "pokerBusted"
  | "pokerBigWin"
  | `room_${RoomKey}`
  | `pet_${string}`
  | `track_${string}`;

// Keys where record() keeps the best value instead of overwriting.
const MAX_KEYS: ReadonlySet<NumKey> = new Set<NumKey>(["gymBest", "pokerChips", "trickshotStars"]);

export interface ProgressData {
  v: 1;
  nums: Partial<Record<NumKey, number>>;
  flags: Partial<Record<string, true>>;
  ach: Record<string, number>; // achievement id -> unlock timestamp
}

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  hidden?: boolean;
  cond(p: ProgressData): boolean;
}

export type ProgressEvent = { type: "change"; key: string } | { type: "achievement"; def: Achievement };

const hasStorage = typeof localStorage !== "undefined";
const hasDOM = typeof document !== "undefined";

function blank(): ProgressData {
  return { v: 1, nums: {}, flags: {}, ach: {} };
}

function load(): ProgressData {
  if (!hasStorage) return blank();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as ProgressData;
      if (d && d.v === 1 && d.nums && d.flags && d.ach) return d;
    }
  } catch {
    /* corrupted / private mode — start fresh */
  }
  return blank();
}

const data: ProgressData = load();

// Migration: the gym combo trainer used a bare "gymBest2" key before this
// module existed. Seed from it once; the old key is left untouched.
if (hasStorage && data.nums.gymBest === undefined) {
  try {
    const old = parseInt(localStorage.getItem("gymBest2") || "", 10);
    if (Number.isFinite(old) && old > 0) data.nums.gymBest = old;
  } catch {
    /* ignore */
  }
}

function save(): void {
  if (!hasStorage) return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

// ---------------------------------------------------------------- listeners
type Listener = (e: ProgressEvent) => void;
const listeners = new Set<Listener>();

export function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(e: ProgressEvent): void {
  listeners.forEach((cb) => {
    try {
      cb(e);
    } catch {
      /* a bad listener never breaks progress writes */
    }
  });
}

// ---------------------------------------------------------------- mutations
export function record(key: NumKey, value: number): void {
  if (!Number.isFinite(value)) return;
  const cur = data.nums[key] ?? 0;
  const next = MAX_KEYS.has(key) ? Math.max(cur, value) : value;
  if (next === cur && data.nums[key] !== undefined) return;
  data.nums[key] = next;
  save();
  emit({ type: "change", key });
  evaluate();
}

export function inc(key: NumKey, by = 1): void {
  data.nums[key] = (data.nums[key] ?? 0) + by;
  save();
  emit({ type: "change", key });
  evaluate();
}

export function flag(name: FlagKey): void {
  if (data.flags[name]) return; // idempotent — never re-toasts
  data.flags[name] = true;
  save();
  emit({ type: "change", key: name });
  evaluate();
}

export function hasFlag(name: FlagKey): boolean {
  return !!data.flags[name];
}

export function num(key: NumKey): number {
  return data.nums[key] ?? 0;
}

export function get(): Readonly<ProgressData> {
  return data;
}

/** Count flags matching a prefix, e.g. flagCount("track_") = distinct tracks played. */
export function flagCount(prefix: string): number {
  let n = 0;
  for (const k in data.flags) if (k.startsWith(prefix)) n++;
  return n;
}

// ---------------------------------------------------------------- achievements
const ROOM_KEYS: RoomKey[] = ["lounge", "gym", "game", "music"];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "tourist", title: "Grand Tour", desc: "Visited all four rooms. Still hasn't paid rent.", cond: (p) => ROOM_KEYS.every((r) => !!p.flags["room_" + r]) },
  { id: "drod-slayer", title: "Drod Slayer", desc: "Beat the resident chess champ. He's telling Ryan to nerf you.", cond: (p) => (p.nums.chessWins ?? 0) >= 1 },
  { id: "humbled", title: "Humbled", desc: "Lost to Drod three times. He keeps a tally. Of course he keeps a tally.", hidden: true, cond: (p) => (p.nums.chessLosses ?? 0) >= 3 },
  { id: "rack-champ", title: "Rack Champion", desc: "Won a game of 8-ball on Drod's own table.", cond: (p) => (p.nums.poolWins ?? 0) >= 1 },
  { id: "trick-artist", title: "Trickshot Artist", desc: "Earned 12 stars on the trick-shot table.", cond: (p) => (p.nums.trickshotStars ?? 0) >= 12 },
  { id: "combo-machine", title: "Combo Machine", desc: "Scored 600+ in Gojo's combo trainer.", cond: (p) => (p.nums.gymBest ?? 0) >= 600 },
  { id: "card-shark", title: "Card Shark", desc: "Stacked 1,500 chips at the card table.", cond: (p) => (p.nums.pokerChips ?? 0) >= 1500 },
  { id: "bankrupt", title: "Bankrupt Speedrun", desc: "Lost every chip. The dealer sends condolences.", hidden: true, cond: (p) => !!p.flags.pokerBusted },
  { id: "resident-dj", title: "Resident DJ", desc: "Spun 5 different tracks on the jukebox.", cond: (p) => flagCountIn(p, "track_") >= 5 },
  { id: "open-mic", title: "Open Mic", desc: "Played 100 notes on the piano. Neighbors filed exactly one complaint.", cond: (p) => (p.nums.pianoNotes ?? 0) >= 100 },
  { id: "producer", title: "Certified Producer", desc: "Downloaded a beat. It goes hard. Probably.", cond: (p) => (p.nums.beatsDownloaded ?? 0) >= 1 },
  { id: "left-a-mark", title: "Left a Mark", desc: "Signed the guestbook. Immortalized in localStorage and KV.", cond: (p) => !!p.flags.guestbookSigned },
  { id: "good-human", title: "Good Human", desc: "Petted both Mimi and Batman. They talk about you when you leave.", cond: (p) => !!p.flags.pet_Mimi && !!p.flags.pet_Batman },
  { id: "warned-you", title: "We Warned You", desc: "It said DO NOT PRESS.", hidden: true, cond: (p) => !!p.flags.pressedButton },
];

function flagCountIn(p: ProgressData, prefix: string): number {
  let n = 0;
  for (const k in p.flags) if (k.startsWith(prefix)) n++;
  return n;
}

export function achievements(): { def: Achievement; unlocked: boolean; ts?: number }[] {
  return ACHIEVEMENTS.map((def) => ({ def, unlocked: !!data.ach[def.id], ts: data.ach[def.id] }));
}

let booted = false; // toasts only for unlocks after boot (no storm for returning visitors)
function evaluate(): void {
  let changed = false;
  for (const def of ACHIEVEMENTS) {
    if (!data.ach[def.id] && def.cond(data)) {
      data.ach[def.id] = Date.now();
      changed = true;
      if (booted) {
        emit({ type: "achievement", def });
        toast(def);
      }
    }
  }
  if (changed) save();
}
// Silent first pass picks up anything earned before this code shipped.
evaluate();
booted = true;

// ---------------------------------------------------------------- toast UI
interface QueuedToast {
  title: string;
  desc: string;
}
const toastQueue: QueuedToast[] = [];
let toastBusy = false;

const TROPHY_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v2h3v4a4 4 0 0 1-4 4h-.35A6 6 0 0 1 13 15.92V18h3v2l1 2H7l1-2v-2h3v-2.08A6 6 0 0 1 7.35 12H7a4 4 0 0 1-4-4V4h3V2zm13 4h-1v3.5c0 .17 0 .34-.02.5H18a2 2 0 0 0 2-2V6zM5 6h1v4H6a2 2 0 0 1-2-2V6h1z"/></svg>';

function toast(def: Achievement): void {
  if (!hasDOM) return;
  toastQueue.push({ title: def.title, desc: def.desc });
  if (!toastBusy) nextToast();
}

function nextToast(): void {
  const t = toastQueue.shift();
  if (!t) {
    toastBusy = false;
    return;
  }
  toastBusy = true;
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    host.setAttribute("aria-live", "polite");
    (document.getElementById("stage") || document.body).appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast";
  const ic = document.createElement("span");
  ic.className = "toast-ic";
  ic.innerHTML = TROPHY_SVG; // static trusted SVG, never user data
  const body = document.createElement("span");
  body.className = "toast-body";
  const kick = document.createElement("span");
  kick.className = "toast-kick";
  kick.textContent = "ACHIEVEMENT";
  const title = document.createElement("span");
  title.className = "toast-title";
  title.textContent = t.title;
  body.appendChild(kick);
  body.appendChild(title);
  el.appendChild(ic);
  el.appendChild(body);
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("in"));
  setTimeout(() => {
    el.classList.remove("in");
    setTimeout(() => {
      el.remove();
      nextToast();
    }, 320);
  }, 3400);
}
