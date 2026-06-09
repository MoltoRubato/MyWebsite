/* ============================================================
   DIALOGUE — modern UI text box with an animated talking portrait.
   ============================================================ */
import { drawPortraitFrame } from "./sprites";

export interface DialogueChoice {
  label: string;
  value: string;
}
export interface DialogueOptions {
  charKey?: string;
  name?: string;
  color?: string;
  lines?: string[];
  choices?: DialogueChoice[] | null;
  onChoice?: ((value: string) => void) | null;
  onDone?: (() => void) | null;
}

const el = {
  root: document.getElementById("dialogue") as HTMLElement,
  port: document.getElementById("dlgPortrait") as HTMLCanvasElement,
  name: document.getElementById("dlgName") as HTMLElement,
  text: document.getElementById("dlgText") as HTMLElement,
  next: document.getElementById("dlgNext") as HTMLElement,
  close: document.getElementById("dlgClose") as HTMLElement,
  choices: document.getElementById("dlgChoices") as HTMLElement,
};
const pctx = el.port.getContext("2d")!;

let open = false;
let lines: string[] = [];
let idx = 0;
let full = "";
let shown = 0;
let typeT = 0;
let typing = false;
let portKey = "port_Player";
let portFrame = 0;
let portT = 0;
let talking = false;
let onDone: (() => void) | null = null;
let onChoice: ((value: string) => void) | null = null;
let choices: DialogueChoice[] | null = null;
let lastTs = 0;

export function start(opts: DialogueOptions): void {
  open = true;
  portKey = "port_" + (opts.charKey || "Player");
  el.name.textContent = opts.name || "";
  el.name.style.color = opts.color || "var(--accent)";
  lines = opts.lines || [""];
  idx = 0;
  choices = opts.choices || null;
  onChoice = opts.onChoice || null;
  onDone = opts.onDone || null;
  el.choices.innerHTML = "";
  el.choices.classList.add("hidden");
  el.root.classList.remove("hidden");
  requestAnimationFrame(() => el.root.classList.add("in"));
  setLine(0);
}

function setLine(i: number): void {
  full = lines[i] || "";
  shown = 0;
  typing = true;
  typeT = 0;
  talking = true;
  el.next.classList.remove("show");
  render();
}

function render(): void {
  const sub = full.slice(0, shown).replace(/\{ENTER\}/g, '<span class="em">ENTER</span>');
  el.text.innerHTML = sub + (typing ? '<span class="cursor">▍</span>' : "");
}

function finishTyping(): void {
  shown = full.length;
  typing = false;
  talking = false;
  render();
  afterLine();
}

function afterLine(): void {
  if (idx >= lines.length - 1 && choices) {
    // show choices
    el.choices.innerHTML = "";
    choices.forEach((c) => {
      const b = document.createElement("button");
      b.className = "dlg-choice";
      b.innerHTML = c.label;
      b.onclick = () => {
        const fn = onChoice;
        const val = c.value;
        closeNow();
        if (fn) fn(val);
      };
      el.choices.appendChild(b);
    });
    el.choices.classList.remove("hidden");
  } else {
    el.next.classList.add("show");
  }
}

export function advance(): void {
  if (typing) {
    finishTyping();
    return;
  }
  if (!el.choices.classList.contains("hidden")) return; // waiting on choice
  if (idx < lines.length - 1) {
    idx++;
    setLine(idx);
  } else {
    const fn = onDone;
    closeNow();
    if (fn) fn();
  }
}

export function closeNow(): void {
  if (!open) return;
  open = false;
  el.root.classList.remove("in");
  setTimeout(() => el.root.classList.add("hidden"), 320);
}

export function isOpen(): boolean {
  return open;
}

/** Animation tick — called from the main loop. */
export function tick(ts: number): void {
  if (!lastTs) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!open) return;
  // typewriter
  if (typing) {
    typeT += dt;
    const cps = 42; // chars/sec
    const target = Math.min(full.length, Math.floor(typeT * cps));
    if (target !== shown) {
      shown = target;
      render();
    }
    if (shown >= full.length) {
      typing = false;
      talking = false;
      render();
      afterLine();
    }
  }
  // portrait talking animation
  portT += dt;
  const fps = talking ? 14 : 5;
  portFrame = Math.floor(portT * fps);
  drawPortraitFrame(pctx, portKey, talking ? portFrame : 0, el.port.width, el.port.height);
}

// input wiring
el.root.addEventListener("click", (e) => {
  if (e.target === el.close) return;
  if ((e.target as HTMLElement).closest(".dlg-choice")) return;
  advance();
});
el.close.addEventListener("click", (e) => {
  e.stopPropagation();
  closeNow();
});
