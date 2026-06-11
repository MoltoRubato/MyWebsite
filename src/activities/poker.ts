/* ============================================================
   POKER — heads-up Texas Hold'em vs. Drod at the card table.
   Real rules (blinds escalate, min-raise, BB option, all-in
   run-outs with uncalled-bet refunds — heads-up, so no side
   pots ever), a Monte-Carlo AI with a signature 6% bluff, and
   a canvas table with procedural cards. Mirrors the pool
   overlay's shape (table canvas + Drod panel).
   ============================================================ */
import { drawPortraitFrame } from "../sprites";
import { pick } from "../core/util";
import * as P from "../progress";
import * as EV from "../poker/eval";
import type { Card, HandResult } from "../poker/eval";
import { openOverlay, closeOverlay, isOverlayOpen, startLoop, type LoopHandle } from "./base";

interface OpenOpts {
  onClose?: () => void;
}

/* ---------------- table geometry (canvas px) ---------------- */
const CW = 684, CH = 400;
const CARD_W = 46, CARD_H = 66; // drod + board
const MY_W = 56, MY_H = 80; // your holes, a touch bigger
const DECK_X = CW - 70, DECK_Y = 178;

const START_STACK = 1000;
const SAVE_KEY = "rw_poker_save";

/* ---------------- banter (Drod's voice) ---------------- */
const LINES = {
  intro: [
    "Cards. Excellent. The chess board judges you slower than I deal.",
    "House rules: chips are fake, the trash talk is real.",
    "I shuffle in O(n). The owner is very proud of that line.",
  ],
  deal: ["Cards out. Try to look unreadable.", "Fresh hand. New regrets.", "Deal 'em. I already like mine."],
  drodBet: ["Bet. Your move.", "Let's make it interesting.", "Chips in. Sweat a little."],
  drodRaise: ["Raise. I can see your tells through the screen, you know.", "Let's go up a floor.", "Raising. The owner taught me fear, then deleted it."],
  drodCall: ["Call. Show me something.", "I'll pay to see it.", "Fine, call."],
  drodFold: ["Fold. The owner programmed shame into me, unfortunately.", "Take it. I fold faster than a lawn chair.", "Nope. All yours."],
  drodCheck: ["Check.", "Tap tap. Free card.", "Check. Nothing going on here."],
  youWin: ["Ugh. Take it.", "That pot was emotionally mine.", "Fine. FINE."],
  drodWin: ["Chips, come home.", "Thank you for your donation.", "As forecast."],
  allIn: ["ALL IN?! Okay. Okay okay okay.", "Shoving? Bold. I respect it. I also call."],
  badBeat: ["...I ran the odds. The odds lied.", "That river was personal."],
  bustYou: ["And that's the whole stack. Rebuy? I'll pretend to feel bad.", "Felted. The dealer sends condolences."],
  bustDrod: ["Felted. By a guest. Delete my memory before Ryan checks the logs.", "I'm out of chips. This is the worst day of my runtime."],
  idle: ["Blinds don't wait forever. Well, they do. Still.", "Take your time. I'm only simulating impatience.", "The owner watches these hands, you know. No pressure."],
};

/* ---------------- state ---------------- */
type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
type Actor = "you" | "drod";
const opp = (a: Actor): Actor => (a === "you" ? "drod" : "you");

interface CardAnim {
  card: Card | -1; // -1 = face down
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  w: number;
  h: number;
  t0: number;
  dur: number;
  flip: boolean; // reveal at the end of the slide
}

let stacks = { you: START_STACK, drod: START_STACK };
let committed = { you: 0, drod: 0 };
let pot = 0;
let handNo = 1;
let handsWon = 0;
let dealer: Actor = "you";
let street: Street = "preflop";
let toAct: Actor = "you";
let acted = { you: false, drod: false };
let holes = { you: [] as Card[], drod: [] as Card[] };
let board: Card[] = [];
let deck: Card[] = [];
let lastRaiseSize = 0;
let revealDrod = false;
let over = false; // someone busted
let handBusy = true; // dealing / resolving — buttons off
let result: { you: HandResult; drod: HandResult } | null = null;
let winnerSeat: Actor | "split" | null = null;
let anims: CardAnim[] = [];
let gen = 0; // generation guard for every timeout

let loop: LoopHandle | null = null;
let onClose: (() => void) | null = null;
let bctx: CanvasRenderingContext2D | null = null;
let cnv: HTMLCanvasElement | null = null;
let portT = 0, talkUntil = 0, bubble = "", thinking = false, lastIdle = 0;
let pkKey: ((e: KeyboardEvent) => void) | null = null;

function say(t: string, dur?: number): void {
  bubble = t;
  talkUntil = performance.now() + (dur || 2600);
}
function setStatus(t: string): void {
  const s = document.getElementById("pkStatus");
  if (s) s.textContent = t;
}
function later(ms: number, fn: () => void): void {
  const g = gen;
  setTimeout(() => {
    if (g === gen && loop) fn();
  }, ms);
}

/* ---------------- blinds ---------------- */
function blinds(n: number): { sb: number; bb: number } {
  const sb = 10 * Math.pow(2, Math.min(4, Math.floor((n - 1) / 8)));
  return { sb, bb: sb * 2 };
}

/* ---------------- SFX (private AC, pool precedent) ---------------- */
let ac: AudioContext | null = null;
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
function sfxDeal(): void {
  const a = ensureAC();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(900, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(300, a.currentTime + 0.06);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.07, a.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.07);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.08);
}
function sfxChip(): void {
  const a = ensureAC();
  if (!a) return;
  [1800, 1400].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, a.currentTime + i * 0.03);
    g.gain.exponentialRampToValueAtTime(0.08, a.currentTime + i * 0.03 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + i * 0.03 + 0.045);
    o.connect(g);
    g.connect(a.destination);
    o.start(a.currentTime + i * 0.03);
    o.stop(a.currentTime + i * 0.03 + 0.05);
  });
}
function sfxWin(): void {
  const a = ensureAC();
  if (!a) return;
  [520, 660, 880].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "triangle";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, a.currentTime + i * 0.09);
    g.gain.exponentialRampToValueAtTime(0.1, a.currentTime + i * 0.09 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + i * 0.09 + 0.12);
    o.connect(g);
    g.connect(a.destination);
    o.start(a.currentTime + i * 0.09);
    o.stop(a.currentTime + i * 0.09 + 0.14);
  });
}
function sfxFold(): void {
  const a = ensureAC();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(180, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(90, a.currentTime + 0.12);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.09, a.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.16);
  o.connect(g);
  g.connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.17);
}

/* ---------------- persistence ---------------- */
interface PokerSave {
  v: 1;
  you: number;
  drod: number;
  handNo: number;
  handsWon: number;
}
function loadSave(): PokerSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as PokerSave;
    if (d && d.v === 1 && d.you > 0 && d.drod > 0) return d;
  } catch {
    /* corrupted */
  }
  return null;
}
function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, you: stacks.you, drod: stacks.drod, handNo, handsWon } satisfies PokerSave));
  } catch {
    /* private mode */
  }
}
function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* private mode */
  }
}

/* ---------------- open / close ---------------- */
export function open(opts?: OpenOpts): void {
  onClose = opts?.onClose ?? null;
  gen++;
  openOverlay(shell());
  cnv = document.getElementById("pkTable") as HTMLCanvasElement;
  bctx = cnv.getContext("2d");
  buildBg();
  wire();
  portT = 0;
  bubble = "";
  thinking = false;
  over = false;
  anims = [];
  loop = startLoop(step);
  const save = loadSave();
  if (save) showResume(save);
  else {
    initStacks(START_STACK, START_STACK, 1, 0);
    say(pick(LINES.intro), 3400);
    later(700, startHand);
  }
}
export function close(): void {
  gen++;
  closeOverlay();
  loop?.stop();
  loop = null;
  if (pkKey) {
    window.removeEventListener("keydown", pkKey);
    pkKey = null;
  }
  const fn = onClose;
  onClose = null;
  if (fn) fn();
}
export function isOpen(): boolean {
  return isOverlayOpen();
}
/** Read-only debug snapshot (GAME._dbg convention). */
export function _dbg(): unknown {
  return { street, toAct, pot, committed: { ...committed }, stacks: { ...stacks }, handNo, dealer, over, handBusy, board: board.map(EV.cardName), holes: { you: holes.you.map(EV.cardName), drod: revealDrod ? holes.drod.map(EV.cardName) : "hidden" } };
}

function initStacks(you: number, drod: number, hand: number, won: number): void {
  stacks = { you, drod };
  handNo = hand;
  handsWon = won;
  dealer = hand % 2 === 1 ? "you" : "drod";
  syncHud();
}

function showResume(save: PokerSave): void {
  handBusy = true;
  const overEl = document.getElementById("pkOver")!;
  overEl.className = "pl-over show";
  overEl.innerHTML = `
    <div class="pl-over-card">
      <div class="pl-over-title">WELCOME BACK</div>
      <div class="pl-over-sub">Chips on the table from last time.</div>
      <button class="ctl-btn" id="pkResume">▶ Resume — you ${save.you} · Drod ${save.drod}</button>
      <button class="ctl-btn ghost" id="pkFresh">↺ Fresh stacks</button>
    </div>`;
  (document.getElementById("pkResume") as HTMLElement).onclick = () => {
    hideOverCard();
    initStacks(save.you, save.drod, save.handNo, save.handsWon);
    say("Right where we left off.", 2200);
    later(500, startHand);
  };
  (document.getElementById("pkFresh") as HTMLElement).onclick = () => {
    hideOverCard();
    clearSave();
    initStacks(START_STACK, START_STACK, 1, 0);
    say(pick(LINES.intro), 3000);
    later(500, startHand);
  };
}
function hideOverCard(): void {
  const o = document.getElementById("pkOver");
  if (o) {
    o.className = "pl-over hidden";
    o.innerHTML = "";
  }
}

/* ---------------- DOM shell ---------------- */
function shell(): string {
  return `<div class="pool-wrap pk-wrap">
      <div class="pool-left">
        <div class="pl-frame"><canvas id="pkTable" width="${CW}" height="${CH}"></canvas>
          <div id="pkOver" class="pl-over hidden"></div>
        </div>
        <div class="pl-status" id="pkStatus">Shuffling…</div>
      </div>
      <div class="pool-right">
        <button class="chess-x" id="pkClose">✕</button>
        <div class="drod-card">
          <div class="drod-port"><canvas id="pkPort" width="96" height="96"></canvas></div>
          <div class="drod-meta"><div class="drod-name">DROD</div><div class="drod-sub" id="pkSub">card shark</div></div>
        </div>
        <div class="drod-bubble" id="pkBubble"></div>
        <div class="wk-stats pk-hud">
          <div class="wk-stat"><span class="wk-k">Pot</span><b id="pkPot">0</b></div>
          <div class="wk-stat"><span class="wk-k">Blinds</span><b id="pkBlinds">10/20</b></div>
          <div class="wk-stat"><span class="wk-k">Won</span><b id="pkWon">0</b></div>
        </div>
        <div class="pk-actions">
          <button class="ctl-btn ghost" id="pkFold">Fold <small>F</small></button>
          <button class="ctl-btn" id="pkCall">Check <small>C</small></button>
        </div>
        <div class="pk-raise" id="pkRaiseRow">
          <input type="range" id="pkSlider" min="0" max="100" step="20">
          <button class="ctl-btn" id="pkRaise">Raise <small>R</small></button>
        </div>
        <button class="ctl-btn ghost" id="pkAllin">ALL IN <small>A</small></button>
        <div class="pool-tip" id="pkTip">F fold · C check/call · R raise · A all-in · ←/→ size the raise</div>
      </div>
    </div>`;
}

function wire(): void {
  (document.getElementById("pkClose") as HTMLElement).onclick = close;
  (document.getElementById("pkFold") as HTMLElement).onclick = () => act("you", { kind: "fold" });
  (document.getElementById("pkCall") as HTMLElement).onclick = () => act("you", { kind: "call" });
  (document.getElementById("pkRaise") as HTMLElement).onclick = () => {
    const slider = document.getElementById("pkSlider") as HTMLInputElement;
    act("you", { kind: "raise", to: +slider.value });
  };
  (document.getElementById("pkAllin") as HTMLElement).onclick = () => act("you", { kind: "raise", to: committed.you + stacks.you });
  (document.getElementById("pkSlider") as HTMLInputElement).oninput = () => syncRaiseLabel();
  pkKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
      return;
    }
    const tag = (e.target as HTMLElement | null)?.tagName || "";
    if (tag === "INPUT") return; // the slider owns its own arrow keys
    if (!myTurn()) return;
    const k = e.key.toLowerCase();
    const slider = document.getElementById("pkSlider") as HTMLInputElement | null;
    if (k === "f") act("you", { kind: "fold" });
    else if (k === "c") act("you", { kind: "call" });
    else if (k === "r" && raiseLegal()) act("you", { kind: "raise", to: +(slider?.value ?? 0) });
    else if (k === "a") act("you", { kind: "raise", to: committed.you + stacks.you });
    else if ((k === "arrowleft" || k === "arrowright") && slider && raiseLegal()) {
      e.preventDefault();
      const bb = blinds(handNo).bb;
      const d = (k === "arrowleft" ? -1 : 1) * (e.shiftKey ? 5 * bb : bb);
      slider.value = String(Math.max(+slider.min, Math.min(+slider.max, +slider.value + d)));
      syncRaiseLabel();
    }
  };
  window.addEventListener("keydown", pkKey);
}

/* ---------------- hand lifecycle ---------------- */
function startHand(): void {
  if (over) return;
  hideOverCard();
  deck = EV.freshDeck();
  holes = { you: [deck.pop()!, deck.pop()!], drod: [deck.pop()!, deck.pop()!] };
  board = [];
  pot = 0;
  committed = { you: 0, drod: 0 };
  acted = { you: false, drod: false };
  street = "preflop";
  revealDrod = false;
  result = null;
  winnerSeat = null;
  handBusy = true;
  dealer = handNo % 2 === 1 ? "you" : "drod";
  const { sb, bb } = blinds(handNo);
  lastRaiseSize = bb;
  post(dealer, Math.min(sb, stacks[dealer]));
  post(opp(dealer), Math.min(bb, stacks[opp(dealer)]));
  syncHud();
  setStatus(`Hand ${handNo} — blinds ${sb}/${bb}.`);
  say(pick(LINES.deal), 2000);
  // deal animation: 2 to you (face up), 2 to Drod (face down)
  const mine = myHolePos(), his = drodHolePos();
  [0, 1].forEach((i) => {
    queueCard(holes.you[i], mine[i].x, mine[i].y, MY_W, MY_H, 220 + i * 160, true);
    queueCard(-1, his[i].x, his[i].y, CARD_W, CARD_H, 60 + i * 160, false);
  });
  later(720, () => {
    handBusy = false;
    beginAction();
  });
}

function post(a: Actor, amount: number): void {
  stacks[a] -= amount;
  committed[a] += amount;
}

function beginAction(): void {
  // preflop: dealer (SB) acts first; postflop: non-dealer first
  toAct = street === "preflop" ? dealer : opp(dealer);
  promptTurn();
}

function myTurn(): boolean {
  return toAct === "you" && !handBusy && !over && street !== "showdown";
}

function toCall(a: Actor): number {
  return Math.max(0, committed[opp(a)] - committed[a]);
}
function raiseLegal(): boolean {
  // can the actor raise at all (more than a call left behind)?
  return stacks[toAct] > toCall(toAct);
}

interface Action {
  kind: "fold" | "call" | "raise";
  to?: number; // raise: target committed total
}

function act(a: Actor, action: Action): void {
  if (a !== toAct || handBusy || over || street === "showdown") return;
  const need = toCall(a);
  if (action.kind === "fold") {
    sfxFold();
    if (a === "you") say(pick(LINES.drodWin), 2400);
    endByFold(opp(a));
    return;
  }
  if (action.kind === "call") {
    const pay = Math.min(need, stacks[a]);
    post(a, pay);
    if (pay > 0) sfxChip();
    acted[a] = true;
    if (a === "drod") say(pick(need > 0 ? LINES.drodCall : LINES.drodCheck), 1800);
    afterAction();
    return;
  }
  // raise to action.to — clamped so the all-in-for-less shove stays legal
  const allInTo = committed[a] + stacks[a];
  const minTo = Math.min(allInTo, committed[opp(a)] + Math.max(blinds(handNo).bb, lastRaiseSize));
  let to = Math.min(allInTo, Math.max(minTo, Math.round(action.to ?? minTo)));
  if (to <= committed[opp(a)]) to = Math.min(allInTo, committed[opp(a)] + 1); // degenerate: treat as call-ish shove
  const raiseSize = to - committed[opp(a)];
  if (raiseSize > 0) lastRaiseSize = Math.max(lastRaiseSize, raiseSize);
  post(a, to - committed[a]);
  sfxChip();
  acted[a] = true;
  acted[opp(a)] = false; // a raise reopens action
  if (a === "drod") say(pick(stacks.drod === 0 ? LINES.allIn : need > 0 ? LINES.drodRaise : LINES.drodBet), 2200);
  else if (stacks.you === 0) say(pick(LINES.allIn), 2200);
  afterAction();
}

function afterAction(): void {
  syncHud();
  const both = acted.you && acted.drod;
  const equal = committed.you === committed.drod;
  const shortAllIn = (committed.you < committed.drod && stacks.you === 0 && acted.you) || (committed.drod < committed.you && stacks.drod === 0 && acted.drod);
  if ((both && equal) || shortAllIn) {
    // refund any uncalled excess (heads-up: kills side pots entirely)
    if (!equal) {
      const big = committed.you > committed.drod ? "you" : ("drod" as Actor);
      const refund = committed[big] - committed[opp(big)];
      committed[big] -= refund;
      stacks[big] += refund;
    }
    closeStreet();
    return;
  }
  toAct = opp(toAct);
  promptTurn();
}

function closeStreet(): void {
  pot += committed.you + committed.drod;
  committed = { you: 0, drod: 0 };
  acted = { you: false, drod: false };
  syncHud();
  const bothAllIn = stacks.you === 0 || stacks.drod === 0;
  const advance = (): void => {
    if (street === "preflop") {
      street = "flop";
      dealBoard(3);
    } else if (street === "flop") {
      street = "turn";
      dealBoard(1);
    } else if (street === "turn") {
      street = "river";
      dealBoard(1);
    } else {
      showdown();
      return;
    }
    if (bothAllIn) {
      // run it out with suspense beats
      revealDrodCards();
      setStatus(street === "river" ? "River…" : street[0].toUpperCase() + street.slice(1) + "…");
      later(900, advance);
    } else {
      later(520, () => {
        handBusy = false;
        beginAction();
      });
    }
  };
  handBusy = true;
  later(bothAllIn ? 700 : 380, advance);
}

function dealBoard(n: number): void {
  const pos = boardPos();
  for (let i = 0; i < n; i++) {
    const bi = board.length;
    board.push(deck.pop()!);
    queueCard(board[bi], pos[bi].x, pos[bi].y, CARD_W, CARD_H, i * 150, true);
  }
}

function endByFold(winner: Actor): void {
  handBusy = true;
  pot += committed.you + committed.drod;
  committed = { you: 0, drod: 0 };
  stacks[winner] += pot;
  if (winner === "you") {
    handsWon++;
    say(pick(LINES.drodFold), 2400);
    recordWin(pot);
  }
  setStatus(winner === "you" ? `Drod folds — you take ${pot}.` : `You fold. Drod takes ${pot}.`);
  pot = 0;
  winnerSeat = winner;
  finishHand();
}

function revealDrodCards(): void {
  if (revealDrod) return;
  revealDrod = true;
  sfxDeal();
}

function showdown(): void {
  street = "showdown";
  handBusy = true;
  revealDrodCards();
  result = { you: EV.evaluate7([...holes.you, ...board]), drod: EV.evaluate7([...holes.drod, ...board]) };
  const y = result.you.score, d = result.drod.score;
  later(560, () => {
    if (!result) return;
    if (y > d) {
      winnerSeat = "you";
      stacks.you += pot;
      handsWon++;
      recordWin(pot);
      sfxWin();
      say(pick(result.you.cat >= 4 ? LINES.badBeat : LINES.youWin), 3000);
      setStatus(`${result.you.name} — you take ${pot}.`);
    } else if (d > y) {
      winnerSeat = "drod";
      stacks.drod += pot;
      sfxFold();
      say(pick(LINES.drodWin), 3000);
      setStatus(`Drod's ${result.drod.name} wins ${pot}.`);
    } else {
      winnerSeat = "split";
      const half = Math.floor(pot / 2);
      const odd = pot - half * 2;
      stacks.you += half + (dealer === "you" ? odd : 0);
      stacks.drod += half + (dealer === "drod" ? odd : 0);
      say("Chop. How anticlimactic.", 2600);
      setStatus(`Split pot — ${result.you.name} each.`);
    }
    pot = 0;
    finishHand();
  });
}

function recordWin(potWon: number): void {
  P.record("pokerChips", stacks.you);
  if (potWon >= 500) P.flag("pokerBigWin");
}

function finishHand(): void {
  syncHud();
  P.inc("pokerHands");
  handNo++;
  persist();
  if (stacks.you <= 0 || stacks.drod <= 0) {
    over = true;
    clearSave();
    const youBust = stacks.you <= 0;
    if (youBust) P.flag("pokerBusted");
    else {
      P.flag("pokerBigWin");
      P.record("pokerChips", stacks.you);
    }
    say(pick(youBust ? LINES.bustYou : LINES.bustDrod), 4200);
    const overEl = document.getElementById("pkOver")!;
    overEl.className = "pl-over";
    overEl.innerHTML = `
      <div class="pl-over-card ${youBust ? "lose" : "win"}">
        <div class="pl-over-title">${youBust ? "DROD BUSTS YOU" : "YOU FELTED DROD"}</div>
        <div class="pl-over-sub">${youBust ? "Every chip, gone. The dealer sends condolences." : "All " + stacks.you + " chips are yours. He'll never mention this again."}</div>
        <button class="ctl-btn" id="pkAgain">↺ Rebuy &amp; restart</button>
      </div>`;
    requestAnimationFrame(() => overEl.classList.add("show"));
    (document.getElementById("pkAgain") as HTMLElement).onclick = () => {
      over = false;
      hideOverCard();
      initStacks(START_STACK, START_STACK, 1, 0);
      later(400, startHand);
    };
    return;
  }
  // auto-deal with a skip button
  const overEl = document.getElementById("pkOver")!;
  overEl.className = "pl-over show pk-next";
  overEl.innerHTML = `<button class="ctl-btn" id="pkNext">▶ Deal next</button>`;
  (document.getElementById("pkNext") as HTMLElement).onclick = () => startHand();
  later(2600, () => {
    if (!over && street !== "preflop") startHand();
  });
}

function promptTurn(): void {
  syncButtons();
  if (toAct === "drod") {
    thinking = true;
    setStatus("Drod is thinking…");
    later(700 + Math.random() * 700, () => {
      thinking = false;
      drodAct();
    });
  } else {
    const need = toCall("you");
    setStatus(need > 0 ? `${need} to call.` : "Your action.");
  }
}

/* ---------------- Drod AI ---------------- */
function gauss(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}
function equity(hole: Card[], boardCards: Card[], n = 400): number {
  if (boardCards.length === 0) return EV.preflopStrength(hole[0], hole[1]);
  const seen = new Set([...hole, ...boardCards]);
  const rest: Card[] = [];
  for (let c = 0; c < 52; c++) if (!seen.has(c)) rest.push(c);
  let wins = 0;
  const need = 5 - boardCards.length;
  for (let t = 0; t < n; t++) {
    // partial Fisher-Yates: draw 2 + need cards from rest
    for (let i = 0; i < 2 + need; i++) {
      const j = i + Math.floor(Math.random() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const oppHole = [rest[0], rest[1]];
    const fullBoard = [...boardCards, ...rest.slice(2, 2 + need)];
    const me = EV.evaluate7([...hole, ...fullBoard]).score;
    const them = EV.evaluate7([...oppHole, ...fullBoard]).score;
    if (me > them) wins++;
    else if (me === them) wins += 0.5;
  }
  return wins / n;
}

function drodAct(): void {
  if (over || toAct !== "drod" || handBusy || street === "showdown") return;
  const bb = blinds(handNo).bb;
  const need = toCall("drod");
  let eq = equity(holes.drod, board);
  eq = Math.max(0, Math.min(1, eq + gauss() * 0.05)); // beatable on purpose
  const potNow = pot + committed.you + committed.drod;
  const round = (x: number): number => Math.max(bb, Math.round(x / bb) * bb);
  const allInTo = committed.drod + stacks.drod;

  if (need > 0) {
    const potOdds = need / (potNow + need);
    if (eq < potOdds - 0.03) {
      if (Math.random() < 0.06 && raiseLegal()) {
        // the signature bluff
        const to = Math.min(allInTo, committed.you + round((potNow + need) * 1.2));
        act("drod", { kind: "raise", to });
        return;
      }
      act("drod", { kind: "fold" });
      return;
    }
    if (eq < potOdds + 0.15 || !raiseLegal()) {
      act("drod", { kind: "call" });
      return;
    }
    if (eq > 0.85 && allInTo - committed.you >= stacks.drod * 0.6) {
      act("drod", { kind: "raise", to: allInTo });
      return;
    }
    const to = Math.min(allInTo, committed.you + round(potNow * (0.55 + Math.random() * 0.25)));
    act("drod", { kind: "raise", to });
    return;
  }
  // unopened / checked to Drod
  if (eq > 0.9 && street === "flop" && Math.random() < 0.35) {
    act("drod", { kind: "call" }); // slowplay check
    say(pick(LINES.drodCheck), 1600);
    return;
  }
  if (eq > 0.55) {
    const to = Math.min(allInTo, committed.you + round(potNow * 0.55));
    act("drod", { kind: "raise", to });
    return;
  }
  const semiP = 0.12 + (street === "flop" ? 0.06 : 0);
  if (eq > 0.3 && Math.random() < semiP) {
    act("drod", { kind: "raise", to: Math.min(allInTo, committed.you + round(potNow * 0.6)) });
    return;
  }
  act("drod", { kind: "call" }); // check
}

/* ---------------- HUD / buttons ---------------- */
function syncHud(): void {
  const { sb, bb } = blinds(handNo);
  const set = (id: string, v: string): void => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  set("pkPot", String(pot + committed.you + committed.drod));
  set("pkBlinds", `${sb}/${bb}`);
  set("pkWon", String(handsWon));
  set("pkSub", `stack: ${stacks.drod}`);
}
function syncButtons(): void {
  const mine = myTurn();
  const need = toCall("you");
  const fold = document.getElementById("pkFold") as HTMLButtonElement | null;
  const call = document.getElementById("pkCall") as HTMLButtonElement | null;
  const raise = document.getElementById("pkRaise") as HTMLButtonElement | null;
  const allin = document.getElementById("pkAllin") as HTMLButtonElement | null;
  const row = document.getElementById("pkRaiseRow") as HTMLElement | null;
  const slider = document.getElementById("pkSlider") as HTMLInputElement | null;
  if (!fold || !call || !raise || !allin || !row || !slider) return;
  fold.disabled = call.disabled = raise.disabled = allin.disabled = !mine;
  call.innerHTML = need > 0 ? `Call ${Math.min(need, stacks.you)} <small>C</small>` : `Check <small>C</small>`;
  const legal = mine && raiseLegal();
  row.style.display = legal ? "" : "none";
  allin.style.display = mine && stacks.you > 0 ? "" : "none";
  if (legal) {
    const bb = blinds(handNo).bb;
    const allInTo = committed.you + stacks.you;
    const minTo = Math.min(allInTo, committed.drod + Math.max(bb, lastRaiseSize));
    slider.min = String(minTo);
    slider.max = String(allInTo);
    slider.step = String(bb);
    if (+slider.value < minTo || +slider.value > allInTo) slider.value = String(Math.min(allInTo, minTo + Math.round((allInTo - minTo) * 0.25)));
    syncRaiseLabel();
  }
}
function syncRaiseLabel(): void {
  const slider = document.getElementById("pkSlider") as HTMLInputElement | null;
  const raise = document.getElementById("pkRaise") as HTMLButtonElement | null;
  if (slider && raise) raise.innerHTML = `Raise to ${slider.value} <small>R</small>`;
}

/* ---------------- rendering ---------------- */
let bgCanvas: HTMLCanvasElement | null = null;
function buildBg(): void {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = CW;
  bgCanvas.height = CH;
  const g = bgCanvas.getContext("2d")!;
  // wood frame
  g.fillStyle = "#7a4b2b";
  g.fillRect(0, 0, CW, CH);
  const lg = g.createLinearGradient(0, 0, 0, CH);
  lg.addColorStop(0, "#a9743f");
  lg.addColorStop(0.5, "#7a4b2b");
  lg.addColorStop(1, "#5d3720");
  g.fillStyle = lg;
  g.fillRect(3, 3, CW - 6, CH - 6);
  g.fillStyle = "#3a2414";
  g.fillRect(16, 16, CW - 32, CH - 32);
  // felt
  const fg = g.createRadialGradient(CW / 2, CH / 2, 60, CW / 2, CH / 2, CW * 0.62);
  fg.addColorStop(0, "#2f8f57");
  fg.addColorStop(1, "#1d6a3e");
  g.fillStyle = fg;
  g.fillRect(22, 22, CW - 44, CH - 44);
  // stitched oval
  g.strokeStyle = "rgba(244,234,214,.18)";
  g.lineWidth = 2;
  g.setLineDash([6, 5]);
  g.beginPath();
  g.ellipse(CW / 2, CH / 2, CW / 2 - 60, CH / 2 - 46, 0, 0, 7);
  g.stroke();
  g.setLineDash([]);
}

function drodHolePos(): { x: number; y: number }[] {
  return [{ x: CW / 2 - CARD_W - 6, y: 34 }, { x: CW / 2 + 6, y: 34 }];
}
function boardPos(): { x: number; y: number }[] {
  const total = 5 * CARD_W + 4 * 10;
  const x0 = (CW - total) / 2;
  return Array.from({ length: 5 }, (_, i) => ({ x: x0 + i * (CARD_W + 10), y: 158 }));
}
function myHolePos(): { x: number; y: number }[] {
  return [{ x: CW / 2 - MY_W - 7, y: 296 }, { x: CW / 2 + 7, y: 296 }];
}

function queueCard(card: Card | -1, tx: number, ty: number, w: number, h: number, delay: number, flip: boolean): void {
  anims.push({ card, fx: DECK_X, fy: DECK_Y, tx, ty, w, h, t0: performance.now() + delay, dur: 260, flip });
  later(delay, sfxDeal);
}

const SUIT_RED = new Set([1, 2]);
function drawCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, card: Card | -1, scaleX = 1, glow = false): void {
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.scale(Math.max(0.04, Math.abs(scaleX)), 1);
  g.translate(-w / 2, -h / 2);
  const r = 5;
  g.beginPath();
  g.moveTo(r, 0);
  g.arcTo(w, 0, w, h, r);
  g.arcTo(w, h, 0, h, r);
  g.arcTo(0, h, 0, 0, r);
  g.arcTo(0, 0, w, 0, r);
  g.closePath();
  if (glow) {
    g.shadowColor = "#e7a33e";
    g.shadowBlur = 14;
  }
  if (card === -1) {
    g.fillStyle = "#b5442f";
    g.fill();
    g.shadowBlur = 0;
    // stroke the card outline NOW, while the rounded-rect is the current path
    // (the lattice loop below replaces the path with its diagonals)
    g.strokeStyle = "#7d2417";
    g.lineWidth = 2;
    g.stroke();
    // lattice stays inside the rounded card: clip to the same path,
    // inset a hair so the pattern never kisses the border stroke
    g.save();
    g.clip();
    g.strokeStyle = "rgba(244,234,214,.3)";
    g.lineWidth = 1;
    for (let d = -h; d < w + h; d += 7) {
      g.beginPath();
      g.moveTo(d, 3);
      g.lineTo(d + h - 6, h - 3);
      g.stroke();
      g.beginPath();
      g.moveTo(d + h - 6, 3);
      g.lineTo(d, h - 3);
      g.stroke();
    }
    g.restore();
    // inner frame line gives the back a printed-card look
    g.strokeStyle = "rgba(244,234,214,.5)";
    g.lineWidth = 1.5;
    g.strokeRect(3.5, 3.5, w - 7, h - 7);
  } else {
    g.fillStyle = "#f4f1e8";
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = "#1c1c1f";
    g.lineWidth = 2;
    g.stroke();
    const red = SUIT_RED.has(EV.suitOf(card));
    g.fillStyle = red ? "#d5392c" : "#1c1c1f";
    g.font = `bold ${Math.round(h * 0.26)}px 'Silkscreen',monospace`;
    g.textAlign = "left";
    g.textBaseline = "top";
    g.fillText(EV.RANKS[EV.rankOf(card)], 4, 3);
    g.font = `${Math.round(h * 0.42)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(EV.SUITS[EV.suitOf(card)], w / 2, h * 0.62);
  }
  g.restore();
}

function drawChipStack(g: CanvasRenderingContext2D, x: number, y: number, amount: number): void {
  if (amount <= 0) return;
  const chips = Math.min(8, 1 + Math.floor(Math.log2(Math.max(1, amount / 10))));
  for (let i = 0; i < chips; i++) {
    g.beginPath();
    g.ellipse(x, y - i * 4, 11, 5, 0, 0, 7);
    g.fillStyle = i % 2 ? "#d5392c" : "#f3c12b";
    g.fill();
    g.strokeStyle = "rgba(0,0,0,.4)";
    g.lineWidth = 1;
    g.stroke();
  }
  g.fillStyle = "#f4ead6";
  g.font = "11px 'Silkscreen',monospace";
  g.textAlign = "center";
  g.fillText(String(amount), x, y + 18);
}

function render(): void {
  if (!bctx) return;
  const g = bctx;
  g.clearRect(0, 0, CW, CH);
  if (bgCanvas) g.drawImage(bgCanvas, 0, 0);
  const now = performance.now();

  // settled cards (skip ones still animating)
  const animating = new Set<string>();
  for (const a of anims) if (now < a.t0 + a.dur) animating.add(`${a.tx},${a.ty}`);
  const his = drodHolePos(), bp = boardPos(), mine = myHolePos();
  const best = result && winnerSeat && winnerSeat !== "split" ? new Set(result[winnerSeat].best5) : null;

  holes.drod.forEach((c, i) => {
    const p = his[i];
    if (animating.has(`${p.x},${p.y}`)) return;
    drawCard(g, p.x, p.y, CARD_W, CARD_H, revealDrod ? c : -1, 1, !!best && revealDrod && best.has(c));
  });
  board.forEach((c, i) => {
    const p = bp[i];
    if (animating.has(`${p.x},${p.y}`)) return;
    drawCard(g, p.x, p.y, CARD_W, CARD_H, c, 1, !!best && best.has(c));
  });
  holes.you.forEach((c, i) => {
    const p = mine[i];
    if (animating.has(`${p.x},${p.y}`)) return;
    drawCard(g, p.x, p.y, MY_W, MY_H, c, 1, !!best && best.has(c));
  });

  // in-flight card animations
  anims = anims.filter((a) => now < a.t0 + a.dur);
  for (const a of anims) {
    if (now < a.t0) continue;
    const k = Math.min(1, (now - a.t0) / a.dur);
    const e = 1 - Math.pow(1 - k, 3);
    const x = a.fx + (a.tx - a.fx) * e, y = a.fy + (a.ty - a.fy) * e;
    let face: Card | -1 = -1;
    let sx = 1;
    if (a.flip) {
      // back for the first 60%, then flip open
      const fk = (k - 0.6) / 0.4;
      if (k < 0.6) face = -1;
      else {
        sx = Math.abs(fk * 2 - 1);
        face = fk < 0.5 ? -1 : a.card;
      }
    }
    drawCard(g, x, y, a.w, a.h, face, sx);
  }

  // deck
  drawCard(g, DECK_X, DECK_Y, CARD_W, CARD_H, -1);
  g.fillStyle = "rgba(0,0,0,.25)";

  // seats: stacks + committed chips + dealer disc
  g.font = "13px 'Silkscreen',monospace";
  g.textAlign = "center";
  g.fillStyle = "#f4ead6";
  g.fillText(`DROD · ${stacks.drod}`, CW / 2, 22);
  g.fillText(`YOU · ${stacks.you}`, CW / 2, CH - 10);
  drawChipStack(g, CW / 2 - 110, 96, committed.drod);
  drawChipStack(g, CW / 2 - 110, 282, committed.you);
  // pot
  if (pot > 0) {
    g.fillStyle = "#ffe7ad";
    g.font = "14px 'Silkscreen',monospace";
    g.fillText(`POT ${pot}`, CW / 2, 142);
  }
  // dealer disc
  const dy = dealer === "drod" ? 56 : 312;
  g.beginPath();
  g.arc(CW / 2 + 96, dy, 11, 0, 7);
  g.fillStyle = "#f4ead6";
  g.fill();
  g.strokeStyle = "#8a5a25";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#4a3526";
  g.font = "bold 11px 'Silkscreen',monospace";
  g.fillText("D", CW / 2 + 96, dy + 4);
  // showdown hand names
  if (result && street === "showdown") {
    g.font = "12px 'Silkscreen',monospace";
    g.fillStyle = winnerSeat === "drod" ? "#ffe7ad" : "rgba(244,234,214,.75)";
    g.fillText(result.drod.name, CW / 2, 118);
    g.fillStyle = winnerSeat === "you" ? "#ffe7ad" : "rgba(244,234,214,.75)";
    g.fillText(result.you.name, CW / 2, 262);
  }
}

/* ---------------- main loop ---------------- */
function step(dt: number): void {
  try {
    const now = performance.now();
    portT += dt;
    const talking = now < talkUntil || thinking;
    const pc = document.getElementById("pkPort") as HTMLCanvasElement | null;
    if (pc) {
      const c = pc.getContext("2d");
      if (c) drawPortraitFrame(c, "port_Drod", talking ? Math.floor(portT * 13) : 0, 96, 96);
    }
    const bub = document.getElementById("pkBubble");
    if (bub) {
      const show = now < talkUntil && bubble;
      bub.textContent = show ? bubble : "";
      bub.classList.toggle("show", !!show);
    }
    if (myTurn() && now > talkUntil + 7000 && now - lastIdle > 10000) {
      if (Math.random() < 0.5) say(pick(LINES.idle), 2600);
      lastIdle = now;
    }
    render();
  } catch (err) {
    console.error("poker loop", err);
  }
}
