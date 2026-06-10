/* ============================================================
   ICONS — tiny pixel-grid glyphs for dialogue choice buttons.
   Drawn as 1px SVG rects on a 10-wide grid with crispEdges, so
   they read like the rest of the pixel art (no emoji, no fonts).
   Tinted via currentColor.
   ============================================================ */

function pixelIcon(rows: string[]): string {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  let rects = "";
  for (let y = 0; y < h; y++) {
    // merge horizontal runs so the SVG stays small
    let x = 0;
    while (x < rows[y].length) {
      if (rows[y][x] !== "#") {
        x++;
        continue;
      }
      let x2 = x;
      while (x2 < rows[y].length && rows[y][x2] === "#") x2++;
      rects += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1"/>`;
      x = x2;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${rects}</svg>`;
}

/** Choice-button icons, keyed by name. */
export const PIX_ICONS: Record<string, string> = {
  // chess pawn
  pawn: pixelIcon([
    "...##...",
    "..####..",
    "..####..",
    "...##...",
    "..####..",
    "...##...",
    "..####..",
    ".######.",
  ]),
  // playing cards (poker)
  cards: pixelIcon([
    ".####...",
    ".#..###.",
    ".#..#.#.",
    ".#..#.#.",
    ".####.#.",
    "...#..#.",
    "...####.",
  ]),
  // erlenmeyer flask (the experiments)
  flask: pixelIcon([
    "..####..",
    "...##...",
    "...##...",
    "..####..",
    ".##..##.",
    "##....##",
    "########",
    ".######.",
  ]),
  // eighth note (music)
  note: pixelIcon([
    "...####.",
    "...#..##",
    "...#...#",
    "...#....",
    "...#....",
    ".###....",
    "####....",
    ".##.....",
  ]),
  // boxing glove (hit the bag)
  glove: pixelIcon([
    "..#####.",
    ".#######",
    ".#######",
    ".#######",
    "..#####.",
    "...###..",
    "...###..",
  ]),
  // handset (contact)
  phone: pixelIcon([
    ".##.....",
    "####....",
    "####....",
    ".###....",
    "..###...",
    "...####.",
    "....####",
    ".....##.",
  ]),
  // dossier folder (his file)
  folder: pixelIcon([
    ".###....",
    ".#######",
    ".#######",
    ".#.....#",
    ".#.....#",
    ".#.....#",
    ".#######",
  ]),
  // rundown list (experience)
  list: pixelIcon([
    "########",
    "........",
    "######..",
    "........",
    "########",
    "........",
    "#####...",
  ]),
  // hammer (his builds)
  hammer: pixelIcon([
    ".######.",
    ".######.",
    ".######.",
    "...##...",
    "...##...",
    "...##...",
    "...##...",
  ]),
  // barbell plates (the gym rack)
  plates: pixelIcon([
    ".#....#.",
    "###..###",
    "########",
    "###..###",
    ".#....#.",
  ]),
};
