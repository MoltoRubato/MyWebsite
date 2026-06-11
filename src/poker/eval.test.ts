import { describe, it, expect } from "vitest";
import { evaluate5, evaluate7, preflopStrength, freshDeck, RANKS } from "./eval";
import type { Card } from "./eval";

/** "AS" = ace of spades; suits S H D C. */
function c(code: string): Card {
  const rank = RANKS.indexOf(code[0]);
  const suit = "SHDC".indexOf(code[1]);
  if (rank < 0 || suit < 0) throw new Error("bad card " + code);
  return suit * 13 + rank;
}
const hand = (...codes: string[]): Card[] => codes.map(c);

describe("evaluate5 categories", () => {
  it("recognizes every category", () => {
    expect(evaluate5(hand("AS", "KS", "QS", "JS", "TS")).name).toBe("Straight flush");
    expect(evaluate5(hand("9S", "9H", "9D", "9C", "2S")).name).toBe("Four of a kind");
    expect(evaluate5(hand("9S", "9H", "9D", "4C", "4S")).name).toBe("Full house");
    expect(evaluate5(hand("AS", "JS", "8S", "6S", "2S")).name).toBe("Flush");
    expect(evaluate5(hand("9S", "8H", "7D", "6C", "5S")).name).toBe("Straight");
    expect(evaluate5(hand("9S", "9H", "9D", "KC", "2S")).name).toBe("Three of a kind");
    expect(evaluate5(hand("9S", "9H", "4D", "4C", "AS")).name).toBe("Two pair");
    expect(evaluate5(hand("9S", "9H", "KD", "7C", "2S")).name).toBe("Pair");
    expect(evaluate5(hand("AS", "JH", "8D", "6C", "2S")).name).toBe("High card");
  });

  it("handles the wheel (A-5 straight) as 5-high", () => {
    const wheel = evaluate5(hand("AS", "2H", "3D", "4C", "5S"));
    expect(wheel.name).toBe("Straight");
    const sixHigh = evaluate5(hand("2S", "3H", "4D", "5C", "6S"));
    expect(sixHigh.score).toBeGreaterThan(wheel.score);
    const steelWheel = evaluate5(hand("AS", "2S", "3S", "4S", "5S"));
    expect(steelWheel.name).toBe("Straight flush");
  });

  it("orders kickers correctly", () => {
    const aKick = evaluate5(hand("9S", "9H", "AD", "7C", "2S"));
    const kKick = evaluate5(hand("9D", "9C", "KD", "7H", "2D"));
    expect(aKick.score).toBeGreaterThan(kKick.score);
    // identical hands in different suits chop
    const a = evaluate5(hand("AS", "JH", "8D", "6C", "2S"));
    const b = evaluate5(hand("AH", "JD", "8C", "6S", "2H"));
    expect(a.score).toBe(b.score);
  });

  it("ranks two-pair by high pair, low pair, kicker", () => {
    const acesUp = evaluate5(hand("AS", "AH", "2D", "2C", "3S"));
    const kingsUp = evaluate5(hand("KS", "KH", "QD", "QC", "AS"));
    expect(acesUp.score).toBeGreaterThan(kingsUp.score);
  });
});

describe("evaluate7", () => {
  it("finds the best 5 of 7", () => {
    // board pairs the deuce but the real hand is the flush
    const r = evaluate7(hand("AS", "KS", "2H", "2S", "9S", "4S", "7D"));
    expect(r.name).toBe("Flush");
    expect(r.best5).toHaveLength(5);
  });
  it("spots a straight using exactly one hole card", () => {
    const r = evaluate7(hand("9H", "2C", "8S", "7D", "6C", "5H", "KD"));
    expect(r.name).toBe("Straight");
  });
  it("never downgrades vs the 5-card baseline", () => {
    for (let trial = 0; trial < 50; trial++) {
      const deck = freshDeck();
      const seven = deck.slice(0, 7);
      const whole = evaluate7(seven);
      const first5 = evaluate5(seven.slice(0, 5));
      expect(whole.score).toBeGreaterThanOrEqual(first5.score);
    }
  });
});

describe("preflopStrength", () => {
  it("ranks premium hands above trash", () => {
    const aces = preflopStrength(c("AS"), c("AH"));
    const aks = preflopStrength(c("AS"), c("KS"));
    const seventyTwo = preflopStrength(c("7S"), c("2H"));
    expect(aces).toBeGreaterThan(aks);
    expect(aks).toBeGreaterThan(seventyTwo);
    expect(aces).toBeLessThanOrEqual(1);
    expect(seventyTwo).toBeGreaterThanOrEqual(0);
  });
});

describe("freshDeck", () => {
  it("is a full permutation of 52", () => {
    const d = freshDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d).size).toBe(52);
  });
});
