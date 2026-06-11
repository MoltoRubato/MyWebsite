/* Progress module — storage semantics, migration, achievements.
   The vitest env is node: localStorage is stubbed with a Map shim and the
   module re-imported fresh per test (it holds module-level state). */
import { describe, it, expect, beforeEach, vi } from "vitest";

type ProgressModule = typeof import("./progress");

function stubStorage(seed: Record<string, string> = {}): Map<string, string> {
  const map = new Map<string, string>(Object.entries(seed));
  const shim = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("localStorage", shim);
  return map;
}

async function freshImport(): Promise<ProgressModule> {
  vi.resetModules();
  return import("./progress");
}

describe("progress", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("record() uses max semantics for best-score keys", async () => {
    stubStorage();
    const P = await freshImport();
    P.record("gymBest", 300);
    P.record("gymBest", 120);
    expect(P.num("gymBest")).toBe(300);
    P.record("gymBest", 450);
    expect(P.num("gymBest")).toBe(450);
  });

  it("record() overwrites for plain keys and inc() accumulates", async () => {
    stubStorage();
    const P = await freshImport();
    P.record("tracksPlayed", 5);
    P.record("tracksPlayed", 2);
    expect(P.num("tracksPlayed")).toBe(2);
    P.inc("petsGiven");
    P.inc("petsGiven", 3);
    expect(P.num("petsGiven")).toBe(4);
  });

  it("flag() is idempotent and persists", async () => {
    const map = stubStorage();
    const P = await freshImport();
    P.flag("pressedButton");
    P.flag("pressedButton");
    expect(P.hasFlag("pressedButton")).toBe(true);
    const saved = JSON.parse(map.get("rw_progress_v1")!);
    expect(saved.flags.pressedButton).toBe(true);
  });

  it("migrates legacy gymBest2", async () => {
    stubStorage({ gymBest2: "777" });
    const P = await freshImport();
    expect(P.num("gymBest")).toBe(777);
    // existing progress beats migration on next load
    P.record("gymBest", 900);
    const P2 = await freshImport();
    expect(P2.num("gymBest")).toBe(900);
  });

  it("achievements fire exactly once, via subscribe", async () => {
    stubStorage();
    const P = await freshImport();
    const seen: string[] = [];
    P.subscribe((e) => {
      if (e.type === "achievement") seen.push(e.def.id);
    });
    P.inc("chessWins");
    P.inc("chessWins");
    expect(seen).toEqual(["drod-slayer"]);
    expect(P.achievements().find((a) => a.def.id === "drod-slayer")!.unlocked).toBe(true);
  });

  it("is silent for achievements already earned at boot", async () => {
    stubStorage({ gymBest2: "999" }); // combo-machine condition pre-met
    const P = await freshImport();
    const seen: string[] = [];
    P.subscribe((e) => {
      if (e.type === "achievement") seen.push(e.def.id);
    });
    expect(P.achievements().find((a) => a.def.id === "combo-machine")!.unlocked).toBe(true);
    expect(seen).toEqual([]); // unlocked silently during module init
  });

  it("counts prefixed flags for resident-dj", async () => {
    stubStorage();
    const P = await freshImport();
    for (const t of ["Coffee", "Cozy", "Chill", "Rainy", "Cabin"]) P.flag(`track_${t}`);
    expect(P.flagCount("track_")).toBe(5);
    expect(P.achievements().find((a) => a.def.id === "resident-dj")!.unlocked).toBe(true);
  });

  it("unsubscribe stops events", async () => {
    stubStorage();
    const P = await freshImport();
    let n = 0;
    const off = P.subscribe(() => n++);
    P.inc("poolWins");
    const before = n;
    off();
    P.inc("poolWins");
    expect(n).toBe(before);
  });

  it("survives a missing localStorage (node env default)", async () => {
    // no stub at all — module must still import and work in-memory
    const P = await freshImport();
    P.inc("chessDraws");
    expect(P.num("chessDraws")).toBe(1);
  });
});
