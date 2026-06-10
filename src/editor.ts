/* ============================================================
   EDITOR — in-browser level editor (dev tool). Toggle DEV view
   with 'H' (or ?dev=1), then click "Edit". Four modes:
     • Collision — solid blocker rects
     • Depth     — Y-sorted art rects (drag yellow line = baseline)
     • Door      — entrance rects that send you to another room
     • Spawn     — where the player appears when entering THIS room
   Everything autosaves to your browser; Export hands back the JSON.
   ============================================================ */
import * as HB from "./hitboxes";
import type { Camera, GameApi, RoomKey } from "./core/types";

type Mode = "solid" | "overlay" | "door" | "spawn";
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  baseY?: number;
  src?: string;
  to?: string;
}
interface Selected {
  list: Mode | "spawn";
  index?: number;
}
interface Drag {
  type: "spawn" | "resize" | "baseline" | "move" | "draw";
  H?: Handle;
  orig?: Box;
  start?: { x: number; y: number };
}
interface Handle {
  id: string;
  l?: number;
  t?: number;
  r?: number;
  b?: number;
}

let game: GameApi | null = null;
let visible = false, editing = false;
let room: RoomKey = "lounge";
let mode: Mode = "solid";
let selected: Selected | null = null;
let drag: Drag | null = null;
let canvas: HTMLCanvasElement | null = null;

interface El {
  panel: HTMLElement;
  body: HTMLElement;
  room: HTMLElement;
  edit: HTMLElement;
  seg: HTMLElement[];
  addRow: HTMLElement;
  add: HTMLElement;
  del: HTMLElement;
  x: HTMLInputElement;
  y: HTMLInputElement;
  wh: HTMLElement;
  w: HTMLInputElement;
  h: HTMLInputElement;
  baseWrap: HTMLElement;
  base: HTMLInputElement;
  toWrap: HTMLElement;
  to: HTMLSelectElement;
  faceWrap: HTMLElement;
  face: HTMLSelectElement;
  hint: HTMLElement;
  exp: HTMLElement;
  reset: HTMLElement;
  done: HTMLElement;
}
let el: El | null = null;

const HANDLES: Handle[] = [
  { id: "tl", l: 1, t: 1 }, { id: "tr", r: 1, t: 1 }, { id: "bl", l: 1, b: 1 }, { id: "br", r: 1, b: 1 },
  { id: "tm", t: 1 }, { id: "bm", b: 1 }, { id: "lm", l: 1 }, { id: "rm", r: 1 },
];
const ROOM_LABEL: Record<RoomKey, string> = { lounge: "The Lounge", gym: "The Gym", game: "The Game Room", music: "The Music Studio" };
const ROOM_KEYS: RoomKey[] = ["lounge", "gym", "game", "music"];
const RECT_MODES: Record<string, number> = { solid: 1, overlay: 1, door: 1 };

// ---------- data helpers ----------
function listFor(m?: Mode | "spawn"): Box[] | null {
  m = m || mode;
  if (m === "solid") return HB.solids(room) as Box[];
  if (m === "overlay") return HB.depth(room) as Box[];
  if (m === "door") return HB.doors(room) as Box[];
  return null; // spawn
}
function selRect(): Box | null {
  if (!selected || selected.list === "spawn") return null;
  const L = listFor(selected.list);
  return L ? L[selected.index!] || null : null;
}
function firstOtherRoom(): RoomKey {
  return ROOM_KEYS.find((r) => r !== room) || "lounge";
}
function save(): void {
  HB.save();
}

// ---------- styles ----------
function injectCSS(): void {
  const s = document.createElement("style");
  s.textContent = `
    #hbE{position:fixed;top:78px;right:14px;z-index:9000;width:240px;
      font-family:'Silkscreen',monospace;color:#e8e6df;
      background:rgba(18,20,26,.94);border:1px solid #3a3f4b;border-radius:10px;
      box-shadow:0 14px 40px rgba(0,0,0,.5);padding:12px;display:none;
      -webkit-user-select:none;user-select:none}
    #hbE.show{display:block}
    #hbE .hbE-bar{display:flex;align-items:center;gap:8px;justify-content:space-between}
    #hbE h4{margin:0;font-size:11px;letter-spacing:.5px;color:#f0c060;font-weight:700}
    #hbE .hbE-room{font-size:9px;color:#9aa0ab;margin-top:2px}
    #hbE button{font-family:inherit;cursor:pointer;border-radius:7px;border:1px solid #444b59;
      background:#262b35;color:#e8e6df;font-size:10px;padding:6px 8px;line-height:1}
    #hbE button:hover{background:#323845}
    #hbE button.pri{background:#e7a33e;border-color:#e7a33e;color:#201400;font-weight:700}
    #hbE button.danger{background:#3a2326;border-color:#6b3640;color:#ffb4b4}
    #hbE .hbE-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:10px 0 8px}
    #hbE .hbE-seg button{border-radius:6px;background:#1c2027;padding:6px 2px;font-size:9px}
    #hbE .hbE-seg button.on{color:#0e1116;font-weight:700}
    #hbE .hbE-seg button.on[data-m="solid"]{background:#ff5d5d;border-color:#ff5d5d}
    #hbE .hbE-seg button.on[data-m="overlay"]{background:#5aa5ff;border-color:#5aa5ff}
    #hbE .hbE-seg button.on[data-m="door"]{background:#56e596;border-color:#56e596}
    #hbE .hbE-seg button.on[data-m="spawn"]{background:#e7a33e;border-color:#e7a33e}
    #hbE .hbE-row{display:flex;gap:6px;margin-top:8px}
    #hbE .hbE-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
    #hbE .hbE-f{display:flex;align-items:center;gap:5px;background:#1c2027;border:1px solid #333a45;border-radius:6px;padding:3px 6px}
    #hbE .hbE-f label{font-size:9px;color:#8a909b;white-space:nowrap}
    #hbE .hbE-f input,#hbE .hbE-f select{width:100%;background:transparent;border:0;color:#fff;font-family:inherit;font-size:11px;outline:none}
    #hbE .hbE-f select{cursor:pointer}
    #hbE .hbE-f select option{background:#1c2027}
    #hbE .hbE-hint{font-size:8.5px;line-height:1.5;color:#878d98;margin-top:9px}
    #hbE .hbE-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}
    #hbE .hbE-actions button{padding:7px 6px}
    #hbE .hbE-done{width:100%;margin-top:8px}
    #hbToast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9100;
      background:#1b1e25;border:1px solid #3a3f4b;color:#dfe3ea;font-family:'Silkscreen',monospace;
      font-size:11px;padding:8px 14px;border-radius:8px;opacity:0;transition:opacity .25s;pointer-events:none}
    #hbToast.show{opacity:1}
    `;
  document.head.appendChild(s);
}
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(msg: string): void {
  let t = document.getElementById("hbToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "hbToast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t!.classList.remove("show"), 1500);
}

// ---------- panel ----------
function buildPanel(): void {
  const p = document.createElement("div");
  p.id = "hbE";
  p.innerHTML = `
      <div class="hbE-bar">
        <div><h4>LEVEL EDITOR</h4><div class="hbE-room" id="hbeRoom">—</div></div>
        <button id="hbeEdit" class="pri">Edit</button>
      </div>
      <div id="hbeBody" style="display:none">
        <div class="hbE-seg">
          <button data-m="solid"   class="on">■ Solid</button>
          <button data-m="overlay">▦ Depth</button>
          <button data-m="door">⌑ Door</button>
          <button data-m="spawn">Spawn</button>
        </div>
        <div class="hbE-row" id="hbeAddRow">
          <button id="hbeAdd" style="flex:1">+ Add box</button>
          <button id="hbeDel" class="danger" style="flex:1">Delete</button>
        </div>
        <div class="hbE-grid">
          <div class="hbE-f"><label>X</label><input id="hbeX" type="number"></div>
          <div class="hbE-f"><label>Y</label><input id="hbeY" type="number"></div>
        </div>
        <div class="hbE-grid" id="hbeWH">
          <div class="hbE-f"><label>W</label><input id="hbeW" type="number"></div>
          <div class="hbE-f"><label>H</label><input id="hbeH" type="number"></div>
        </div>
        <div class="hbE-grid" id="hbeBaseWrap" style="display:none;grid-template-columns:1fr">
          <div class="hbE-f"><label>Base&nbsp;Y</label><input id="hbeBase" type="number"></div>
        </div>
        <div class="hbE-grid" id="hbeToWrap" style="display:none;grid-template-columns:1fr">
          <div class="hbE-f"><label>Goes&nbsp;to</label><select id="hbeTo"></select></div>
        </div>
        <div class="hbE-grid" id="hbeFaceWrap" style="display:none;grid-template-columns:1fr">
          <div class="hbE-f"><label>Faces</label>
            <select id="hbeFace"><option value="down">Down</option><option value="up">Up</option><option value="left">Left</option><option value="right">Right</option></select></div>
        </div>
        <div class="hbE-hint" id="hbeHint"></div>
        <div class="hbE-actions">
          <button id="hbeExport">Export</button>
          <button id="hbeReset" class="danger">↺ Reset room</button>
        </div>
        <button id="hbeDone" class="hbE-done">Done editing</button>
      </div>`;
  document.body.appendChild(p);
  const q = <T extends HTMLElement = HTMLElement>(id: string): T => p.querySelector(id) as T;
  el = {
    panel: p,
    body: q("#hbeBody"),
    room: q("#hbeRoom"),
    edit: q("#hbeEdit"),
    seg: [...p.querySelectorAll<HTMLElement>(".hbE-seg button")],
    addRow: q("#hbeAddRow"),
    add: q("#hbeAdd"),
    del: q("#hbeDel"),
    x: q<HTMLInputElement>("#hbeX"),
    y: q<HTMLInputElement>("#hbeY"),
    wh: q("#hbeWH"),
    w: q<HTMLInputElement>("#hbeW"),
    h: q<HTMLInputElement>("#hbeH"),
    baseWrap: q("#hbeBaseWrap"),
    base: q<HTMLInputElement>("#hbeBase"),
    toWrap: q("#hbeToWrap"),
    to: q<HTMLSelectElement>("#hbeTo"),
    faceWrap: q("#hbeFaceWrap"),
    face: q<HTMLSelectElement>("#hbeFace"),
    hint: q("#hbeHint"),
    exp: q("#hbeExport"),
    reset: q("#hbeReset"),
    done: q("#hbeDone"),
  };

  el.edit.onclick = () => setEditing(true);
  el.done.onclick = () => setEditing(false);
  el.seg.forEach((b) => (b.onclick = () => setMode(b.dataset.m as Mode)));
  el.add.onclick = addBoxCentered;
  el.del.onclick = deleteSelected;
  el.reset.onclick = () => {
    if (confirm("Reset " + ROOM_LABEL[room] + " to defaults? (collision, depth, doors & spawn)")) {
      HB.resetRoom(room);
      selected = null;
      refresh();
      toast("Room reset");
    }
  };
  el.exp.onclick = exportData;
  (["x", "y", "w", "h", "base"] as const).forEach((key) => {
    el![key].oninput = () => {
      const v = Math.round(parseFloat(el![key].value) || 0);
      if (mode === "spawn") {
        const sp = HB.spawn(room);
        if (key === "x") sp.x = v;
        if (key === "y") sp.y = v;
        save();
        return;
      }
      const r = selRect();
      if (!r) return;
      if (key === "base") r.baseY = v;
      else if (key === "x") r.x = v;
      else if (key === "y") r.y = v;
      else if (key === "w") r.w = Math.max(2, v);
      else if (key === "h") r.h = Math.max(2, v);
      save();
    };
  });
  el.to.onchange = () => {
    const r = selRect();
    if (r) {
      r.to = el!.to.value;
      save();
    }
  };
  el.face.onchange = () => {
    const sp = HB.spawn(room);
    sp.face = el!.face.value as HB.Spawn["face"];
    save();
  };
}

const HINTS: Record<Mode, string> = {
  solid: "Drag floor → new blocker · click → select · handles → resize · Del removes.",
  overlay: "Drag floor → new depth box · drag the yellow line to set the baseline (player passes behind above it).",
  door: "Drag floor → new entrance · pick its target room below · walk into it to travel.",
  spawn: "Click anywhere to move this room's spawn point · set the facing below.",
};

function setMode(m: Mode): void {
  mode = m;
  selected = null;
  el!.seg.forEach((b) => b.classList.toggle("on", b.dataset.m === m));
  refresh();
}

function populateTargets(): void {
  el!.to.innerHTML = "";
  ROOM_KEYS.filter((r) => r !== room).forEach((r) => {
    const o = document.createElement("option");
    o.value = r;
    o.textContent = ROOM_LABEL[r];
    el!.to.appendChild(o);
  });
}

function refresh(): void {
  if (!el || !el.panel) return;
  el.room.textContent = ROOM_LABEL[room] || room;
  el.body.style.display = editing ? "block" : "none";
  el.edit.textContent = editing ? "Editing…" : "Edit";
  el.edit.style.display = editing ? "none" : "inline-block";
  el.addRow.style.display = mode === "spawn" ? "none" : "flex";
  el.add.textContent = mode === "door" ? "+ Add door" : "+ Add box";
  el.wh.style.display = RECT_MODES[mode] ? "grid" : "none";
  el.hint.textContent = HINTS[mode] || "";
  populateTargets();
  refreshFields();
}
function refreshFields(): void {
  if (!el) return;
  el.baseWrap.style.display = mode === "overlay" ? "grid" : "none";
  el.toWrap.style.display = mode === "door" ? "grid" : "none";
  el.faceWrap.style.display = mode === "spawn" ? "grid" : "none";
  if (mode === "spawn") {
    const sp = HB.spawn(room);
    el.x.value = String(Math.round(sp.x));
    el.y.value = String(Math.round(sp.y));
    el.face.value = sp.face || "down";
    return;
  }
  const r = selRect();
  if (!r) {
    (["x", "y", "w", "h", "base"] as const).forEach((k) => (el![k].value = ""));
    return;
  }
  el.x.value = String(Math.round(r.x));
  el.y.value = String(Math.round(r.y));
  el.w.value = String(Math.round(r.w));
  el.h.value = String(Math.round(r.h));
  if (mode === "overlay") el.base.value = String(Math.round(r.baseY != null ? r.baseY : r.y + r.h));
  if (mode === "door") el.to.value = r.to || firstOtherRoom();
}

// ---------- actions ----------
function addBoxCentered(): void {
  if (mode === "spawn") return;
  const L = listFor(mode);
  if (!L) return;
  const cx = 480, cy = 320;
  let box: Box;
  if (mode === "solid") box = { x: cx - 40, y: cy - 30, w: 80, h: 60 };
  else if (mode === "overlay") box = { x: cx - 40, y: cy - 50, w: 80, h: 80, baseY: cy + 30, src: "top" };
  else box = { x: cx - 30, y: cy - 40, w: 60, h: 80, to: firstOtherRoom() }; // door
  L.push(box);
  selected = { list: mode, index: L.length - 1 };
  save();
  refresh();
}
function deleteSelected(): void {
  if (mode === "spawn" || !selected || selected.list === "spawn") return;
  const L = listFor(selected.list);
  if (!L) return;
  L.splice(selected.index!, 1);
  selected = null;
  save();
  refresh();
  toast("Deleted");
}
function exportData(): void {
  const text = HB.exportJSON();
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ryanworld-hitboxes.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* download blocked */
  }
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
  toast("Exported (file + clipboard)");
}

// ---------- visibility / mode ----------
export function setVisible(v: boolean, rm?: RoomKey): void {
  visible = v;
  if (rm) room = rm;
  if (!el || !el.panel) return;
  el.panel.classList.toggle("show", v);
  if (!v) setEditing(false);
  else refresh();
}
export function setRoom(rm: RoomKey): void {
  room = rm;
  selected = null;
  if (visible) refresh();
}
function setEditing(v: boolean): void {
  editing = v;
  if (v) {
    visible = true;
    game?.setHitboxes(true);
  }
  if (canvas) canvas.style.cursor = v ? "crosshair" : "";
  refresh();
}
export function isEditing(): boolean {
  return editing;
}

// ---------- hit testing ----------
function handleAt(wx: number, wy: number, cam: Camera): Handle | null {
  const r = selRect();
  if (!r) return null;
  const hs = 8 / cam.s;
  for (const H of HANDLES) {
    const hx = r.x + (H.l ? 0 : H.r ? r.w : r.w / 2);
    const hy = r.y + (H.t ? 0 : H.b ? r.h : r.h / 2);
    if (Math.abs(wx - hx) <= hs && Math.abs(wy - hy) <= hs) return H;
  }
  if (mode === "overlay" && r.baseY != null && Math.abs(wy - r.baseY) <= hs && wx >= r.x - hs && wx <= r.x + r.w + hs) return { id: "base" };
  return null;
}
function rectAt(wx: number, wy: number): number {
  const L = listFor(mode);
  if (!L) return -1;
  for (let i = L.length - 1; i >= 0; i--) {
    const r = L[i];
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i;
  }
  return -1;
}

// ---------- mouse ----------
function onDown(e: MouseEvent): void {
  if (!editing || !game) return;
  e.preventDefault();
  const p = game.screenToWorld(e.clientX, e.clientY), cam = game.camera();

  if (mode === "spawn") {
    const sp = HB.spawn(room);
    sp.x = Math.round(p.x);
    sp.y = Math.round(p.y);
    selected = { list: "spawn" };
    drag = { type: "spawn" };
    refreshFields();
    return;
  }
  // 1) handle of current selection
  const H = handleAt(p.x, p.y, cam);
  if (H) {
    const r = selRect()!;
    drag = { type: H.id === "base" ? "baseline" : "resize", H, orig: { ...r }, start: p };
    return;
  }
  // 2) existing rect
  const idx = rectAt(p.x, p.y);
  if (idx >= 0) {
    selected = { list: mode, index: idx };
    drag = { type: "move", orig: { ...listFor(mode)![idx] }, start: p };
    refreshFields();
    return;
  }
  // 3) draw new
  const L = listFor(mode)!;
  let box: Box;
  if (mode === "solid") box = { x: p.x, y: p.y, w: 0, h: 0 };
  else if (mode === "overlay") box = { x: p.x, y: p.y, w: 0, h: 0, baseY: p.y, src: "top" };
  else box = { x: p.x, y: p.y, w: 0, h: 0, to: firstOtherRoom() };
  L.push(box);
  selected = { list: mode, index: L.length - 1 };
  drag = { type: "draw", start: p };
  refreshFields();
}
function onMove(e: MouseEvent): void {
  if (!editing || !drag || !game) return;
  const p = game.screenToWorld(e.clientX, e.clientY);
  if (drag.type === "spawn") {
    const sp = HB.spawn(room);
    sp.x = Math.round(p.x);
    sp.y = Math.round(p.y);
    refreshFields();
    return;
  }
  const r = selRect();
  if (!r) return;
  const dx = p.x - drag.start!.x, dy = p.y - drag.start!.y;
  if (drag.type === "move") {
    r.x = Math.round(drag.orig!.x + dx);
    r.y = Math.round(drag.orig!.y + dy);
    if (r.baseY != null && drag.orig!.baseY != null) r.baseY = Math.round(drag.orig!.baseY + dy);
  } else if (drag.type === "baseline") {
    r.baseY = Math.round(Math.max(0, Math.min(640, p.y)));
  } else if (drag.type === "draw") {
    r.x = Math.round(Math.min(drag.start!.x, p.x));
    r.y = Math.round(Math.min(drag.start!.y, p.y));
    r.w = Math.round(Math.abs(dx));
    r.h = Math.round(Math.abs(dy));
    if (r.baseY != null) r.baseY = r.y + r.h;
  } else if (drag.type === "resize") {
    const o = drag.orig!, H = drag.H!;
    let x = o.x, y = o.y, w = o.w, h = o.h;
    if (H.l) {
      x = o.x + dx;
      w = o.w - dx;
    }
    if (H.r) w = o.w + dx;
    if (H.t) {
      y = o.y + dy;
      h = o.h - dy;
    }
    if (H.b) h = o.h + dy;
    if (w < 2) w = 2;
    if (h < 2) h = 2;
    r.x = Math.round(x);
    r.y = Math.round(y);
    r.w = Math.round(w);
    r.h = Math.round(h);
    if (r.baseY != null && (r.baseY < r.y || r.baseY > r.y + r.h + 200)) r.baseY = r.y + r.h;
  }
  refreshFields();
}
function onUp(): void {
  if (!drag) return;
  if (drag.type === "draw") {
    const r = selRect();
    if (r && (r.w < 4 || r.h < 4)) {
      listFor(mode)!.pop();
      selected = null;
      refreshFields();
    }
  }
  drag = null;
  save();
}

// ---------- editor visuals (drawn by GAME inside world transform) ----------
export function drawOverlay(ctx: CanvasRenderingContext2D, cam: Camera): void {
  if (mode === "spawn") {
    const sp = HB.spawn(room);
    if (!sp) return;
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2 / cam.s;
    ctx.setLineDash([5 / cam.s, 4 / cam.s]);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 12 / cam.s, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  const r = selRect();
  if (!r) return;
  ctx.save();
  ctx.lineWidth = 2 / cam.s;
  ctx.setLineDash([6 / cam.s, 4 / cam.s]);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  const hs = 4.5 / cam.s;
  HANDLES.forEach((H) => {
    const hx = r.x + (H.l ? 0 : H.r ? r.w : r.w / 2), hy = r.y + (H.t ? 0 : H.b ? r.h : r.h / 2);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1 / cam.s;
    ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
    ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
  });
  if (mode === "overlay" && r.baseY != null) {
    ctx.strokeStyle = "#ffd728";
    ctx.lineWidth = 2.5 / cam.s;
    ctx.beginPath();
    ctx.moveTo(r.x, r.baseY);
    ctx.lineTo(r.x + r.w, r.baseY);
    ctx.stroke();
    ctx.fillStyle = "#ffd728";
    ctx.fillRect(r.x + r.w / 2 - hs, r.baseY - hs, hs * 2, hs * 2);
  }
  ctx.restore();
}

// ---------- init ----------
export function init(g: GameApi): void {
  game = g;
  injectCSS();
  buildPanel();
  canvas = game.canvasEl();
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("keydown", (e) => {
    if (!editing) return;
    const tag = (e.target as HTMLElement | null)?.tagName || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelected();
    }
    if (e.key === "Escape") {
      selected = null;
      refreshFields();
    }
  });
}
