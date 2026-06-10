/* ============================================================
   ASSETS — image loader + spritesheet metadata.
   Images load eagerly on import (matching the original behaviour);
   `assetsProgress()` drives the loading screen.
   ============================================================ */

const images: Record<string, HTMLImageElement> = {};
let total = 0;
let loaded = 0;

function load(key: string, src: string): HTMLImageElement {
  total++;
  const img = new Image();
  img.onload = () => {
    loaded++;
  };
  img.onerror = () => {
    loaded++;
    console.warn("missing asset", src);
  };
  img.src = src;
  images[key] = img;
  return img;
}

// rooms (base = below player, top = above player)
load("room_lounge", "assets/rooms/LoungeRoom_base.png");
load("room_lounge_top", "assets/rooms/LoungeRoom_top.png");
load("room_lounge_props", "assets/rooms/LoungeRoom_props.png");
load("room_gym", "assets/rooms/gym_base.png");
load("room_gym_top", "assets/rooms/gym_top.png");
load("room_gym_props", "assets/rooms/gym_props.png");
load("room_game", "assets/rooms/Game_base.png");
load("room_game_top", "assets/rooms/Game_top.png");
load("room_game_props", "assets/rooms/Game_props.png");
load("room_music", "assets/rooms/Music_base.png");
load("room_music_top", "assets/rooms/Music_top.png");
load("room_music_props", "assets/rooms/Music_props.png");

// characters (32x64 frames)
for (const n of ["Player", "Alex", "DJ", "Dino", "Girl", "Gojo", "Drod", "Bob"]) {
  load("char_" + n, "assets/chars/" + n + ".png");
}
// portraits (64x64 frames, talking)
for (const n of ["Player", "Alex", "DJ", "Dino", "Girl", "Gojo", "Drod", "Bob"]) {
  load("port_" + n, "assets/portraits/" + n + ".png");
}

// chess
load("chess_white", "assets/chess/WhitePieces.png");
load("chess_black", "assets/chess/BlackPieces.png");
load("chess_board", "assets/chess/board.png");

// pets (own spritesheets: idle + being-petted rows)
load("pet_dog", "assets/pets/dog.png");
load("pet_cat", "assets/pets/cat.png");

// animated props — speaker/amp the jukebox plays through (3 frames, 32x64)
load("prop_speaker", "assets/props/speaker.png");

// animated TV channels — each sheet is 24 frames laid out horizontally, every
// cell 96x64. The TV artwork (bezel + screen) sits at x2..93 / y2..43 inside its
// cell; only the screen content animates, so one fixed crop works for every
// frame. Played over the lounge TV when switched on.
load("tv_ch0", "assets/props/tv_news.png");
load("tv_ch1", "assets/props/tv_hospital.png");
load("tv_ch2", "assets/props/tv_hospital2.png");

// room-map thumbnails — preloaded so the floor-plan / fast-travel modal opens
// with no fetch delay (header.ts requests these same ?v=3 URLs, so the browser
// serves them straight from cache).
for (const n of ["lounge", "gym", "game", "music"]) {
  load("map_" + n, "assets/maps/" + n + ".png?v=3");
}

export function getImage(key: string): HTMLImageElement | undefined {
  return images[key];
}
export function assetsProgress(): number {
  return total ? loaded / total : 1;
}
export function assetsReady(): boolean {
  return loaded >= total;
}

// ---- sprite layout constants ----
export const CHAR_FW = 32;
export const CHAR_FH = 64;
// row index in sheet for idle (1) and walk (2)
export const ROW_IDLE = 1;
export const ROW_WALK = 2;
// first column for each facing direction (6 frames each)
export const DIR_COL: Record<string, number> = { right: 0, up: 6, left: 12, down: 18 };
export const DIR_FRAMES = 6;

export const PORT_FW = 64;
export const PORT_FH = 64;
export const PORT_FRAMES = 30;
export const PORT_COLS = 10;

// speaker sheet: 3 frames laid out horizontally, each cell 32x64.
// The speaker art sits in the TOP of each cell (alpha bbox y:6..46), so it
// anchors at content-bottom (46), not the cell bottom.
export const SPK_FW = 32;
export const SPK_FH = 64;
export const SPK_FRAMES = 3;
export const SPK_CONTENT_BOTTOM = 46;

// TV channel sheets: 24 frames of 96x64. The TV (bezel+screen) occupies the
// sub-rect [TV_SX,TV_SY,TV_SW,TV_SH] of each cell; draw just that over the
// lounge TV so the bezels line up. TV_FPS matches the source GIFs (10fps).
export const TV_FW = 96;
export const TV_FH = 64;
export const TV_FRAMES = 24;
export const TV_FPS = 10;
export const TV_SX = 2;
export const TV_SY = 2;
export const TV_SW = 92;
export const TV_SH = 42;
