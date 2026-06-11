/* ============================================================
   POKER EVAL — pure card types + 5/7-card hand evaluation.
   Framework-free and DOM-free (mirrors src/chess/engine.ts) so
   vitest covers it directly.
   Card encoding: 0..51 — rank = c % 13 (0='2' … 12='A'),
   suit = floor(c / 13) (0 ♠, 1 ♥, 2 ♦, 3 ♣).
   ============================================================ */

export type Card = number;
export const RANKS = "23456789TJQKA";
export const SUITS = ["♠", "♥", "♦", "♣"];
export const rankOf = (c: Card): number => c % 13;
export const suitOf = (c: Card): number => Math.floor(c / 13);
export const cardName = (c: Card): string => RANKS[rankOf(c)] + SUITS[suitOf(c)];

/** Hand categories, low to high. */
export const CATS = ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"] as const;

export interface HandResult {
  cat: number; // index into CATS
  score: number; // total ordering: higher wins; equal = chop
  name: string;
  best5: Card[]; // the 5 cards that made it (for showdown highlight)
}

export function freshDeck(): Card[] {
  const d: Card[] = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// pack up to five tiebreak ranks (each 0..12) under the category
const B = 13;
function pack(cat: number, ranks: number[]): number {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * B + (ranks[i] ?? 0);
  return s;
}

/** Evaluate exactly 5 cards. */
export function evaluate5(cards: Card[]): HandResult {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const flush = suits.every((s) => s === suits[0]);

  // straight detection (wheel: A-5-4-3-2 plays as 5-high)
  const uniq = [...new Set(ranks)];
  let straightHigh = -1;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 12 && uniq[1] === 3 && uniq[1] - uniq[4] === 3) straightHigh = 3; // wheel, 5-high
  }

  // rank multiplicities, ordered by (count, rank) desc
  const count = new Map<number, number>();
  for (const r of ranks) count.set(r, (count.get(r) || 0) + 1);
  const groups = [...count.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  let cat: number, tb: number[];
  if (flush && straightHigh >= 0) {
    cat = 8;
    tb = [straightHigh];
  } else if (groups[0][1] === 4) {
    cat = 7;
    tb = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    cat = 6;
    tb = [groups[0][0], groups[1][0]];
  } else if (flush) {
    cat = 5;
    tb = ranks;
  } else if (straightHigh >= 0) {
    cat = 4;
    tb = [straightHigh];
  } else if (groups[0][1] === 3) {
    cat = 3;
    tb = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    cat = 2;
    tb = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2) {
    cat = 1;
    tb = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  } else {
    cat = 0;
    tb = ranks;
  }
  return { cat, score: pack(cat, tb), name: CATS[cat], best5: cards.slice() };
}

/** Best 5-card hand out of 5..7 cards (all C(n,5) combos). */
export function evaluate7(cards: Card[]): HandResult {
  if (cards.length === 5) return evaluate5(cards);
  let best: HandResult | null = null;
  const n = cards.length;
  const idx = [0, 1, 2, 3, 4];
  const pickCards = (): Card[] => idx.map((i) => cards[i]);
  // iterate all 5-combinations of n
  while (true) {
    const r = evaluate5(pickCards());
    if (!best || r.score > best.score) best = r;
    // next combination
    let i = 4;
    while (i >= 0 && idx[i] === n - 5 + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
  }
  return best!;
}

/**
 * Chen-style preflop strength, normalized to 0..1.
 * Used by Drod instead of Monte Carlo on the preflop street.
 */
export function preflopStrength(a: Card, b: Card): number {
  const ra = rankOf(a), rb = rankOf(b);
  const hi = Math.max(ra, rb), lo = Math.min(ra, rb);
  // high-card points: A=10, K=8, Q=7, J=6, else (rank+2)/2
  let pts = hi === 12 ? 10 : hi === 11 ? 8 : hi === 10 ? 7 : hi === 9 ? 6 : (hi + 2) / 2;
  if (ra === rb) pts = Math.max(5, pts * 2); // pairs
  if (suitOf(a) === suitOf(b)) pts += 2; // suited
  const gap = hi - lo;
  if (ra !== rb) {
    if (gap === 1) pts += 1;
    else if (gap === 2) pts -= 1;
    else if (gap === 3) pts -= 2;
    else if (gap >= 4) pts -= 4;
    if (gap <= 2 && hi <= 9) pts += 1; // small connectors can straighten
  }
  return Math.max(0, Math.min(1, pts / 20));
}
