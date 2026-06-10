/* ============================================================
   STOCKFISH BRIDGE — drives the official Stockfish WASM build
   (assets/engine/stockfish.wasm.js) in a Web Worker over UCI.
   Single-threaded build: no SharedArrayBuffer / COOP-COEP needed,
   so it runs on plain static hosting (GitHub Pages, etc.).
   Async by nature; CHESS falls back to the built-in engine if the
   worker can't load (e.g. opened via file://).
   ============================================================ */
const SRC = "assets/engine/stockfish.wasm.js";

let worker: Worker | null = null;
let dead = false;
let readyP: Promise<boolean> | null = null;
let bootResolve: ((ok: boolean) => void) | null = null;
let bootTimer = 0;
let pending: { resolve: (mv: string | null) => void; id: number } | null = null;
let reqId = 0;

export interface SearchOpts {
  skill?: number; // 0..20
  movetime?: number; // ms
}

function onLine(line: string | undefined): void {
  if (typeof line !== "string") return;
  if (line === "readyok") {
    if (bootResolve) {
      clearTimeout(bootTimer);
      const r = bootResolve;
      bootResolve = null;
      r(true);
    }
    return;
  }
  if (pending && line.lastIndexOf("bestmove", 0) === 0) {
    const mv = line.split(/\s+/)[1];
    const p = pending;
    pending = null;
    p.resolve(mv && mv !== "(none)" ? mv : null);
  }
}

/**
 * Lazily boot the worker. Resolves true once the engine answers `readyok`,
 * false if the worker can't be created or doesn't respond in time.
 */
export function init(): Promise<boolean> {
  if (readyP) return readyP;
  readyP = new Promise<boolean>((resolve) => {
    if (typeof Worker === "undefined") {
      dead = true;
      return resolve(false);
    }
    try {
      worker = new Worker(SRC);
    } catch {
      dead = true;
      return resolve(false);
    }
    bootResolve = resolve;
    bootTimer = setTimeout(() => {
      if (bootResolve) {
        dead = true;
        const r = bootResolve;
        bootResolve = null;
        r(false);
      }
    }, 12000);
    worker.onmessage = (e: MessageEvent) => {
      const d = e.data;
      onLine(typeof d === "string" ? d : d && d.line);
    };
    worker.onerror = () => {
      if (bootResolve) {
        clearTimeout(bootTimer);
        dead = true;
        const r = bootResolve;
        bootResolve = null;
        r(false);
      } else {
        dead = true;
      }
    };
    worker.postMessage("uci");
    worker.postMessage("isready");
  });
  return readyP;
}
export const ready = init;

/**
 * Resolve to a UCI bestmove string ("e2e4") for a FEN, or null on failure.
 * One search at a time.
 */
export function bestMove(fen: string, opts?: SearchOpts): Promise<string | null> {
  if (dead || !worker) return Promise.resolve(null);
  return new Promise<string | null>((resolve) => {
    if (pending) {
      const p = pending;
      pending = null;
      p.resolve(null);
    } // cancel a stale one
    const id = ++reqId;
    pending = { resolve, id };
    const skill = opts && opts.skill != null ? opts.skill : 20;
    const mt = (opts && opts.movetime) || 500;
    worker!.postMessage("setoption name Skill Level value " + skill);
    worker!.postMessage("position fen " + fen);
    worker!.postMessage("go movetime " + mt);
    // safety net: never hang the turn if the engine goes quiet
    setTimeout(() => {
      if (pending && pending.id === id) {
        const p = pending;
        pending = null;
        p.resolve(null);
      }
    }, mt + 5000);
  });
}

export function newGame(): void {
  if (worker && !dead) {
    try {
      worker.postMessage("ucinewgame");
    } catch {
      /* worker gone */
    }
  }
}

export function isDead(): boolean {
  return dead;
}
