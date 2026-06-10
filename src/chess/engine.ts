/* ============================================================
   CHESS ENGINE — legal move generation + alpha-beta search.

   Board: 64-length array, index = rank*8 + file. rank 0 = top (black's
   back rank / the 8th rank). White pieces are uppercase and move UP the
   board (toward index 0); black pieces are lowercase and move down.

   Ported verbatim (behaviour-preserving) from the original
   js/chess-engine.js IIFE into a typed ES module. One intentional quirk
   is preserved: pawns only ever promote to a queen (no under-promotions),
   exactly as the original game played.
   ============================================================ */

export type Color = "w" | "b";

export interface CastleRights {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export interface GameState {
  /** 64 cells, each a piece char ("PNBRQK"/"pnbrqk") or "." for empty. */
  b: string[];
  turn: Color;
  castle: CastleRights;
  /** En-passant target square index, or -1 if none. */
  ep: number;
}

export interface Move {
  from: number;
  to: number;
  piece: string;
  /** Captured piece char, or "." if the move is not a capture. */
  cap: string;
  promo?: string;
  /** Pawn double-push (sets the en-passant square). */
  dbl?: boolean;
  /** En-passant capture. */
  ep?: boolean;
  castle?: "K" | "Q";
}

export type GameStatus = "play" | "check" | "checkmate" | "stalemate";

const WP = "PNBRQK";
const BP = "pnbrqk";
export const isW = (p: string): boolean => p !== "." && WP.includes(p);
export const isB = (p: string): boolean => p !== "." && BP.includes(p);
export const colorOf = (p: string): Color | null =>
  p === "." ? null : isW(p) ? "w" : "b";

export function initialState(): GameState {
  const b = "rnbqkbnr"
    .split("")
    .concat("pppppppp".split(""))
    .concat(Array(32).fill("."))
    .concat("PPPPPPPP".split(""))
    .concat("RNBQKBNR".split(""));
  return { b, turn: "w", castle: { wk: true, wq: true, bk: true, bq: true }, ep: -1 };
}

export function clone(s: GameState): GameState {
  return { b: s.b.slice(), turn: s.turn, castle: { ...s.castle }, ep: s.ep };
}

export const rank = (i: number): number => i >> 3;
export const file = (i: number): number => i & 7;
const onB = (r: number, f: number): boolean => r >= 0 && r < 8 && f >= 0 && f < 8;

type Vec = [number, number];
const KN: Vec[] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG: Vec[] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const BISH: Vec[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK: Vec[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Is square `sq` attacked by the `by` colour? */
export function attacked(b: string[], sq: number, by: Color): boolean {
  const r = rank(sq), f = file(sq);
  // pawns
  if (by === "w") {
    // white pawns attack upward (from r+1)
    for (const df of [-1, 1]) {
      const rr = r + 1, ff = f + df;
      if (onB(rr, ff) && b[rr * 8 + ff] === "P") return true;
    }
  } else {
    for (const df of [-1, 1]) {
      const rr = r - 1, ff = f + df;
      if (onB(rr, ff) && b[rr * 8 + ff] === "p") return true;
    }
  }
  // knights
  for (const [dr, df] of KN) {
    const rr = r + dr, ff = f + df;
    if (onB(rr, ff)) {
      const p = b[rr * 8 + ff];
      if (p !== "." && colorOf(p) === by && p.toUpperCase() === "N") return true;
    }
  }
  // king
  for (const [dr, df] of KG) {
    const rr = r + dr, ff = f + df;
    if (onB(rr, ff)) {
      const p = b[rr * 8 + ff];
      if (p !== "." && colorOf(p) === by && p.toUpperCase() === "K") return true;
    }
  }
  // sliders
  const sl: [Vec[], string][] = [[BISH, "BQ"], [ROOK, "RQ"]];
  for (const [dirs, types] of sl) {
    for (const [dr, df] of dirs) {
      let rr = r + dr, ff = f + df;
      while (onB(rr, ff)) {
        const p = b[rr * 8 + ff];
        if (p !== ".") {
          if (colorOf(p) === by && types.includes(p.toUpperCase())) return true;
          break;
        }
        rr += dr;
        ff += df;
      }
    }
  }
  return false;
}

export function kingSq(b: string[], color: Color): number {
  const k = color === "w" ? "K" : "k";
  for (let i = 0; i < 64; i++) if (b[i] === k) return i;
  return -1;
}

export function inCheck(s: GameState, color: Color): boolean {
  return attacked(s.b, kingSq(s.b, color), color === "w" ? "b" : "w");
}

/** Pseudo-legal moves for the side to move (king-safety not yet enforced). */
export function pseudo(s: GameState): Move[] {
  const b = s.b, me = s.turn, opp: Color = me === "w" ? "b" : "w", moves: Move[] = [];
  const dir = me === "w" ? -1 : 1; // pawn forward
  const startRank = me === "w" ? 6 : 1;
  const promoRank = me === "w" ? 0 : 7;
  const add = (from: number, to: number, extra?: Partial<Move>): void => {
    moves.push({ from, to, piece: b[from], cap: b[to], ...extra });
  };
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p === "." || colorOf(p) !== me) continue;
    const r = rank(i), f = file(i), T = p.toUpperCase();
    if (T === "P") {
      const r1 = r + dir;
      if (onB(r1, f) && b[r1 * 8 + f] === ".") {
        // forward
        if (r1 === promoRank) add(i, r1 * 8 + f, { promo: "Q" });
        else add(i, r1 * 8 + f);
        if (r === startRank) {
          const r2 = r + 2 * dir;
          if (b[r2 * 8 + f] === ".") add(i, r2 * 8 + f, { dbl: true });
        }
      }
      for (const df of [-1, 1]) {
        const rr = r + dir, ff = f + df;
        if (!onB(rr, ff)) continue;
        const t = rr * 8 + ff;
        if (b[t] !== "." && colorOf(b[t]) === opp) {
          if (rr === promoRank) add(i, t, { promo: "Q" });
          else add(i, t);
        } else if (t === s.ep) {
          add(i, t, { ep: true });
        }
      }
    } else if (T === "N") {
      for (const [dr, df] of KN) {
        const rr = r + dr, ff = f + df;
        if (!onB(rr, ff)) continue;
        const t = rr * 8 + ff;
        if (b[t] === "." || colorOf(b[t]) === opp) add(i, t);
      }
    } else if (T === "K") {
      for (const [dr, df] of KG) {
        const rr = r + dr, ff = f + df;
        if (!onB(rr, ff)) continue;
        const t = rr * 8 + ff;
        if (b[t] === "." || colorOf(b[t]) === opp) add(i, t);
      }
      // castling
      const rRank = me === "w" ? 7 : 0, base = rRank * 8;
      const ck = me === "w" ? s.castle.wk : s.castle.bk;
      const cq = me === "w" ? s.castle.wq : s.castle.bq;
      if (ck && b[base + 5] === "." && b[base + 6] === "." &&
        !attacked(b, base + 4, opp) && !attacked(b, base + 5, opp) && !attacked(b, base + 6, opp))
        add(base + 4, base + 6, { castle: "K" });
      if (cq && b[base + 1] === "." && b[base + 2] === "." && b[base + 3] === "." &&
        !attacked(b, base + 4, opp) && !attacked(b, base + 3, opp) && !attacked(b, base + 2, opp))
        add(base + 4, base + 2, { castle: "Q" });
    } else {
      const dirs = T === "B" ? BISH : T === "R" ? ROOK : BISH.concat(ROOK);
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (onB(rr, ff)) {
          const t = rr * 8 + ff;
          if (b[t] === ".") {
            add(i, t);
          } else {
            if (colorOf(b[t]) === opp) add(i, t);
            break;
          }
          rr += dr;
          ff += df;
        }
      }
    }
  }
  return moves;
}

export function apply(s: GameState, m: Move): GameState {
  const n = clone(s);
  const b = n.b;
  const me = s.turn;
  const T = m.piece.toUpperCase();
  b[m.to] = m.promo ? (me === "w" ? m.promo : m.promo.toLowerCase()) : m.piece;
  b[m.from] = ".";
  if (m.ep) {
    const capSq = m.to + (me === "w" ? 8 : -8);
    b[capSq] = ".";
  }
  if (m.castle) {
    const base = (me === "w" ? 7 : 0) * 8;
    if (m.castle === "K") {
      b[base + 5] = b[base + 7];
      b[base + 7] = ".";
    } else {
      b[base + 3] = b[base + 0];
      b[base + 0] = ".";
    }
  }
  // update castle rights
  if (T === "K") {
    if (me === "w") n.castle.wk = n.castle.wq = false;
    else n.castle.bk = n.castle.bq = false;
  }
  if (m.from === 63 || m.to === 63) n.castle.wk = false;
  if (m.from === 56 || m.to === 56) n.castle.wq = false;
  if (m.from === 7 || m.to === 7) n.castle.bk = false;
  if (m.from === 0 || m.to === 0) n.castle.bq = false;
  n.ep = m.dbl ? m.from + (me === "w" ? -8 : 8) : -1;
  n.turn = me === "w" ? "b" : "w";
  return n;
}

export function legalMoves(s: GameState): Move[] {
  const out: Move[] = [];
  for (const m of pseudo(s)) {
    const n = apply(s, m);
    if (!attacked(n.b, kingSq(n.b, s.turn), s.turn === "w" ? "b" : "w")) out.push(m);
  }
  return out;
}

// ---- evaluation ----
const VAL: Record<string, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
// piece-square tables (white perspective, index 0 = top)
const PST: Record<string, number[]> = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const mirror = (i: number): number => (7 - rank(i)) * 8 + file(i);

export function evaluate(s: GameState): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = s.b[i];
    if (p === ".") continue;
    const T = p.toUpperCase();
    const v = VAL[T] + PST[T][isW(p) ? i : mirror(i)];
    score += isW(p) ? v : -v;
  }
  return s.turn === "w" ? score : -score; // from side-to-move
}

function orderMoves(ms: Move[]): Move[] {
  return ms.sort((a, b) => {
    const av = a.cap !== "." ? VAL[a.cap.toUpperCase()] * 10 - VAL[a.piece.toUpperCase()] : 0;
    const bv = b.cap !== "." ? VAL[b.cap.toUpperCase()] * 10 - VAL[b.piece.toUpperCase()] : 0;
    return bv - av;
  });
}

// Quiescence: at the search horizon, keep resolving captures/promotions so the
// evaluation isn't taken in the middle of a trade (kills most hung-piece blunders).
function quiesce(s: GameState, alpha: number, beta: number): number {
  const stand = evaluate(s);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  const caps = legalMoves(s).filter((m) => m.cap !== "." || m.promo);
  orderMoves(caps);
  for (const m of caps) {
    const sc = -quiesce(apply(s, m), -beta, -alpha);
    if (sc >= beta) return beta;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}

function negamax(s: GameState, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return quiesce(s, alpha, beta);
  const ms = legalMoves(s);
  if (ms.length === 0) return inCheck(s, s.turn) ? -100000 - depth : 0; // mate / stalemate
  orderMoves(ms);
  let best = -Infinity;
  for (const m of ms) {
    const sc = -negamax(apply(s, m), depth - 1, -beta, -alpha);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Pick a move at the given depth; `randomness` adds a blunder chance (easy modes). */
export function bestMove(s: GameState, depth: number, randomness?: number): Move | null {
  const ms = legalMoves(s);
  if (ms.length === 0) return null;
  orderMoves(ms);
  const scored = ms.map((m) => ({ m, sc: -negamax(apply(s, m), depth - 1, -Infinity, Infinity) }));
  scored.sort((a, b) => b.sc - a.sc);
  if (randomness && Math.random() < randomness) {
    // pick from a wider pool (blunder)
    const pool = scored.slice(0, Math.min(scored.length, 4 + Math.floor(Math.random() * 4)));
    return pool[Math.floor(Math.random() * pool.length)].m;
  }
  // pick among near-best
  const top = scored[0].sc;
  const ties = scored.filter((x) => x.sc >= top - 8);
  return ties[Math.floor(Math.random() * ties.length)].m;
}

export function status(s: GameState): GameStatus {
  const ms = legalMoves(s);
  if (ms.length > 0) return inCheck(s, s.turn) ? "check" : "play";
  return inCheck(s, s.turn) ? "checkmate" : "stalemate";
}

// ---- UCI / FEN bridge (for the Stockfish worker) ----
const algebraic = (i: number): string => String.fromCharCode(97 + file(i)) + (8 - rank(i)); // index -> "e4"
function indexOfSquare(str: string): number {
  // "e4" -> index
  const f = str.charCodeAt(0) - 97,
    rr = 8 - (str.charCodeAt(1) - 48);
  if (f < 0 || f > 7 || rr < 0 || rr > 7) return -1;
  return rr * 8 + f;
}
export function toFEN(s: GameState): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    // r=0 is our top row = FEN's 8th rank
    let row = "",
      empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = s.b[r * 8 + f];
      if (p === ".") {
        empty++;
      } else {
        if (empty) {
          row += empty;
          empty = 0;
        }
        row += p; // our letters already match FEN
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const cr = (s.castle.wk ? "K" : "") + (s.castle.wq ? "Q" : "") + (s.castle.bk ? "k" : "") + (s.castle.bq ? "q" : "") || "-";
  const ep = s.ep >= 0 ? algebraic(s.ep) : "-";
  return rows.join("/") + " " + s.turn + " " + cr + " " + ep + " 0 1";
}
// Turn a UCI string ("e2e4", "e7e8q") into our move object by matching the legal
// move with the same from/to, then overriding the promotion piece.
export function uciToMove(s: GameState, uci: string): Move | null {
  if (!uci || uci.length < 4) return null;
  const from = indexOfSquare(uci.slice(0, 2)),
    to = indexOfSquare(uci.slice(2, 4));
  if (from < 0 || to < 0) return null;
  let mv = legalMoves(s).find((m) => m.from === from && m.to === to);
  if (!mv) return null;
  if (uci.length >= 5) mv = { ...mv, promo: uci[4].toUpperCase() };
  return mv;
}
