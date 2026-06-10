/* ============================================================
   GUESTBOOK — a real book on the lounge side table that real
   visitors sign. Backend: a Cloudflare Pages Function at
   /api/guestbook backed by KV (see functions/api/guestbook.ts).
   In local dev (vite has no Functions runtime) a localStorage
   mock takes over so the overlay stays fully playable.
   SECURITY RULE: entry text only ever reaches the DOM through
   textContent — never innerHTML.
   ============================================================ */
import * as P from "../progress";
import { openOverlay, closeOverlay, isOverlayOpen } from "./base";

interface OpenOpts {
  onClose?: () => void;
}
interface Entry {
  name: string;
  msg: string;
  ts: number;
}

const API = "/api/guestbook";
const NAME_MAX = 20, MSG_MAX = 80;
const SIGNED_AT_KEY = "rw_gb_signed_at"; // client-side resign debounce
const MOCK_KEY = "rw_gb_mock_entries"; // dev-only mock store
const DEV = import.meta.env.DEV;

let onClose: (() => void) | null = null;
let gbKey: ((e: KeyboardEvent) => void) | null = null;
let mockMode = false;

export function open(opts?: OpenOpts): void {
  onClose = opts?.onClose ?? null;
  mockMode = false;
  openOverlay(shell());
  (document.getElementById("gbClose") as HTMLElement).onclick = close;
  (document.getElementById("gbTabRead") as HTMLElement).onclick = () => showView("read");
  (document.getElementById("gbTabSign") as HTMLElement).onclick = () => showView("sign");
  (document.getElementById("gbSubmit") as HTMLElement).onclick = () => void submit();
  const msg = document.getElementById("gbMsg") as HTMLTextAreaElement;
  msg.oninput = () => {
    const c = document.getElementById("gbCount");
    if (c) c.textContent = `${msg.value.length}/${MSG_MAX}`;
  };
  gbKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", gbKey);
  if (alreadySigned()) markSigned();
  void refresh();
}
export function close(): void {
  closeOverlay();
  if (gbKey) {
    window.removeEventListener("keydown", gbKey);
    gbKey = null;
  }
  const fn = onClose;
  onClose = null;
  if (fn) fn();
}
export function isOpen(): boolean {
  return isOverlayOpen();
}

function shell(): string {
  return `<div class="mz-wrap gb-wrap">
      <button class="chess-x" id="gbClose">✕</button>
      <div class="gb-head">
        <div>
          <div class="mz-kick">GUESTBOOK</div>
          <div class="gb-sub">Visitors who wandered through Ryan's place</div>
        </div>
        <div class="gb-tabs">
          <button class="gb-tab on" id="gbTabRead">Read</button>
          <button class="gb-tab" id="gbTabSign">Sign</button>
        </div>
      </div>
      <div class="gb-page" id="gbRead"><div class="gb-note">Fetching the book…</div></div>
      <div class="gb-page gb-form hidden" id="gbSign">
        <label class="gb-field">Name
          <input id="gbName" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" placeholder="Visitor">
        </label>
        <label class="gb-field">Message
          <textarea id="gbMsg" maxlength="${MSG_MAX}" rows="3" placeholder="Petted the cat. 10/10 would trespass again."></textarea>
          <span class="gb-count" id="gbCount">0/${MSG_MAX}</span>
        </label>
        <input id="gbHp" name="website" class="gb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="gb-err" id="gbErr"></div>
        <button class="ctl-btn" id="gbSubmit">✒ Sign the book</button>
      </div>
    </div>`;
}

function showView(which: "read" | "sign"): void {
  document.getElementById("gbRead")!.classList.toggle("hidden", which !== "read");
  document.getElementById("gbSign")!.classList.toggle("hidden", which !== "sign");
  document.getElementById("gbTabRead")!.classList.toggle("on", which === "read");
  document.getElementById("gbTabSign")!.classList.toggle("on", which === "sign");
}

function alreadySigned(): boolean {
  try {
    return Date.now() - (+localStorage.getItem(SIGNED_AT_KEY)! || 0) < 10 * 60_000;
  } catch {
    return false;
  }
}
function markSigned(): void {
  const tab = document.getElementById("gbTabSign") as HTMLButtonElement | null;
  if (tab) {
    tab.textContent = "Signed ✓";
    tab.disabled = true;
  }
}

/* ---------------- data ---------------- */
function mockEntries(): Entry[] {
  let saved: Entry[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(MOCK_KEY) || "[]") as Entry[];
  } catch {
    saved = [];
  }
  const seed: Entry[] = [
    { name: "Mimi", msg: "woof (translated: great snacks)", ts: Date.now() - 86400e3 * 3 },
    { name: "Drod", msg: "I live here and I STILL signed it. Beat that.", ts: Date.now() - 86400e3 * 2 },
    { name: "a pigeon", msg: "window was open. nice place. left a feather as tip", ts: Date.now() - 86400e3 },
  ];
  return [...saved, ...seed];
}

async function fetchEntries(): Promise<Entry[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(API, { signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()) as { entries?: Entry[] };
    return Array.isArray(d.entries) ? d.entries : [];
  } finally {
    clearTimeout(t);
  }
}

async function refresh(): Promise<void> {
  const page = document.getElementById("gbRead");
  if (!page) return;
  try {
    const entries = await fetchEntries();
    renderEntries(entries, false);
  } catch {
    if (DEV) {
      mockMode = true;
      renderEntries(mockEntries(), true);
    } else {
      page.replaceChildren(note("The guestbook is at the binders. Try again later."));
      const tab = document.getElementById("gbTabSign") as HTMLButtonElement | null;
      if (tab && tab.textContent !== "Signed ✓") tab.disabled = true;
    }
  }
}

function note(text: string): HTMLElement {
  const n = document.createElement("div");
  n.className = "gb-note";
  n.textContent = text;
  return n;
}

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d ago";
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** All user text lands via textContent — never innerHTML. */
function entryRow(e: Entry, pending = false): HTMLElement {
  const row = document.createElement("div");
  row.className = "gb-row" + (pending ? " pending" : "");
  const head = document.createElement("div");
  head.className = "gb-row-head";
  const name = document.createElement("span");
  name.className = "gb-row-name";
  name.textContent = e.name;
  const when = document.createElement("span");
  when.className = "gb-row-when";
  when.textContent = pending ? "signing…" : timeAgo(e.ts);
  head.append(name, when);
  const msg = document.createElement("p");
  msg.className = "gb-row-msg";
  msg.textContent = e.msg;
  row.append(head, msg);
  return row;
}

function renderEntries(entries: Entry[], mocked: boolean): void {
  const page = document.getElementById("gbRead");
  if (!page) return;
  page.replaceChildren();
  if (mocked) page.appendChild(note("local preview — guestbook API offline"));
  if (!entries.length) page.appendChild(note("Blank pages. Be the first."));
  for (const e of entries.slice(0, 50)) page.appendChild(entryRow(e));
}

/* ---------------- signing ---------------- */
function err(text: string): void {
  const el = document.getElementById("gbErr");
  if (el) el.textContent = text;
}

async function submit(): Promise<void> {
  const nameEl = document.getElementById("gbName") as HTMLInputElement;
  const msgEl = document.getElementById("gbMsg") as HTMLTextAreaElement;
  const hp = (document.getElementById("gbHp") as HTMLInputElement).value;
  const btn = document.getElementById("gbSubmit") as HTMLButtonElement;
  const name = nameEl.value.trim().slice(0, NAME_MAX);
  const msg = msgEl.value.trim().slice(0, MSG_MAX);
  err("");
  if (!name || !msg) {
    err("Needs a name and a message. The book has standards. Low ones, but standards.");
    return;
  }
  if (alreadySigned()) {
    err("One signature per visit — the ink needs to dry.");
    return;
  }
  btn.disabled = true;
  // optimistic: show your line in the book immediately
  const entry: Entry = { name, msg, ts: Date.now() };
  showView("read");
  const page = document.getElementById("gbRead");
  const row = entryRow(entry, true);
  page?.prepend(row);
  try {
    if (mockMode) {
      let saved: Entry[] = [];
      try {
        saved = JSON.parse(localStorage.getItem(MOCK_KEY) || "[]") as Entry[];
      } catch {
        saved = [];
      }
      localStorage.setItem(MOCK_KEY, JSON.stringify([entry, ...saved].slice(0, 50)));
      await new Promise((r) => setTimeout(r, 350));
    } else {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, msg, website: hp }),
      });
      if (r.status === 429) throw new Error("One signature per visit — the ink needs to dry.");
      if (!r.ok) throw new Error("The pen is out of ink (server said " + r.status + "). Try again later.");
    }
    row.classList.remove("pending");
    row.querySelector(".gb-row-when")!.textContent = "just now";
    try {
      localStorage.setItem(SIGNED_AT_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    P.flag("guestbookSigned");
    markSigned();
  } catch (e) {
    row.remove();
    showView("sign");
    btn.disabled = false;
    err(e instanceof Error ? e.message : "Something smudged. Try again.");
  }
}
