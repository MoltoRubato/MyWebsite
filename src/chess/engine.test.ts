import { describe, it, expect } from "vitest";
import {
  initialState,
  legalMoves,
  apply,
  status,
  inCheck,
  evaluate,
  bestMove,
  type GameState,
  type Color,
} from "./engine";

/**
 * Minimal FEN -> GameState parser for tests. FEN ranks run 8 -> 1 (top to
 * bottom), which matches the engine's index scheme (rank 0 = the 8th rank),
 * so each FEN row maps straight onto board indices rank*8 + file.
 */
function fromFEN(fen: string): GameState {
  const [board, turn, castle, ep] = fen.trim().split(/\s+/);
  const b: string[] = [];
  for (const row of board.split("/")) {
    for (const ch of row) {
      if (/\d/.test(ch)) for (let k = 0; k < Number(ch); k++) b.push(".");
      else b.push(ch);
    }
  }
  if (b.length !== 64) throw new Error(`bad FEN board: ${b.length} squares`);
  let epIdx = -1;
  if (ep && ep !== "-") {
    const f = ep.charCodeAt(0) - 97; // 'a' -> 0
    const r = 8 - Number(ep[1]); // rank from top
    epIdx = r * 8 + f;
  }
  return {
    b,
    turn: (turn === "b" ? "b" : "w") as Color,
    castle: {
      wk: castle.includes("K"),
      wq: castle.includes("Q"),
      bk: castle.includes("k"),
      bq: castle.includes("q"),
    },
    ep: epIdx,
  };
}

function perft(s: GameState, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(s);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const m of moves) nodes += perft(apply(s, m), depth - 1);
  return nodes;
}

describe("perft (full legal move generation from the start position)", () => {
  // Canonical perft node counts. Depths 1-4 involve no promotions or en-passant
  // captures, so they exactly validate the generator including check filtering,
  // double pushes, and pin/legality.
  it("depth 1 = 20", () => expect(perft(initialState(), 1)).toBe(20));
  it("depth 2 = 400", () => expect(perft(initialState(), 2)).toBe(400));
  it("depth 3 = 8902", () => expect(perft(initialState(), 3)).toBe(8902));
  it("depth 4 = 197281", () => expect(perft(initialState(), 4)).toBe(197281));
});

describe("checkmate / stalemate / check detection", () => {
  it("detects fool's mate as checkmate", () => {
    // 1. f3 e5 2. g4 Qh4# — white to move, mated.
    const s = fromFEN("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3");
    expect(inCheck(s, "w")).toBe(true);
    expect(status(s)).toBe("checkmate");
  });

  it("detects a king-and-pawn stalemate", () => {
    // Black to move: Ka8 has no legal move (a7 pawn defended by Kb6, b8 covered
    // by the a7 pawn, b7 covered by the king) and is not in check.
    const s = fromFEN("k7/P7/1K6/8/8/8/8/8 b - - 0 1");
    expect(inCheck(s, "b")).toBe(false);
    expect(status(s)).toBe("stalemate");
    expect(legalMoves(s)).toHaveLength(0);
  });

  it("reports an ordinary check as 'check', not mate", () => {
    const s = fromFEN("4k3/8/8/8/7q/8/8/4K3 w - - 0 1");
    expect(inCheck(s, "w")).toBe(true);
    expect(status(s)).toBe("check");
  });
});

describe("special moves", () => {
  it("generates and applies an en-passant capture", () => {
    // White pawn e5, black pawn d5, ep target d6.
    const s = fromFEN("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    const ep = legalMoves(s).find((m) => m.ep);
    expect(ep).toBeDefined();
    expect(ep!.from).toBe(28); // e5
    expect(ep!.to).toBe(19); // d6
    const n = apply(s, ep!);
    expect(n.b[19]).toBe("P"); // pawn arrives on d6
    expect(n.b[27]).toBe("."); // captured d5 pawn removed
    expect(n.b[28]).toBe("."); // e5 vacated
  });

  it("offers both castles when the path is clear", () => {
    const s = fromFEN("4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1");
    const castles = legalMoves(s).filter((m) => m.castle);
    expect(castles.map((m) => m.castle).sort()).toEqual(["K", "Q"]);
    // king-side castle relocates the h1 rook to f1
    const k = castles.find((m) => m.castle === "K")!;
    const n = apply(s, k);
    expect(n.b[62]).toBe("K"); // g1
    expect(n.b[61]).toBe("R"); // f1
    expect(n.b[63]).toBe("."); // h1 vacated
  });

  it("forbids castling through an attacked square", () => {
    // Black rook on f2 attacks f1 (the king's king-side transit square).
    const s = fromFEN("4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1");
    const castles = legalMoves(s).filter((m) => m.castle).map((m) => m.castle);
    expect(castles).not.toContain("K");
    expect(castles).toContain("Q");
  });

  it("promotes a pawn to a queen", () => {
    const s = fromFEN("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    const promo = legalMoves(s).find((m) => m.from === 8 && m.to === 0);
    expect(promo?.promo).toBe("Q");
    const n = apply(s, promo!);
    expect(n.b[0]).toBe("Q");
  });
});

describe("evaluation + search", () => {
  it("evaluates the symmetric start position as 0", () => {
    expect(evaluate(initialState())).toBe(0);
  });

  it("finds a forced mate-in-one (back-rank mate)", () => {
    // Black king boxed in by its own pawns; Ra1-a8 is mate.
    const s = fromFEN("6k1/5ppp/8/8/8/8/8/R6K w - - 0 1");
    const mv = bestMove(s, 2, 0);
    expect(mv).not.toBeNull();
    expect(status(apply(s, mv!))).toBe("checkmate");
  });
});
