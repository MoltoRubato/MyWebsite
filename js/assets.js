/* ============================================================
   ASSETS — image loader + spritesheet metadata
   ============================================================ */
window.ASSETS = (function(){
  const images = {};
  let total = 0, loaded = 0;

  function load(key, src){
    total++;
    const img = new Image();
    img.onload = ()=>{ loaded++; };
    img.onerror = ()=>{ loaded++; console.warn("missing asset", src); };
    img.src = src;
    images[key] = img;
    return img;
  }

  // rooms (base = below player, top = above player)
  load("room_lounge",     "assets/rooms/LoungeRoom_base.png");
  load("room_lounge_top", "assets/rooms/LoungeRoom_top.png");
  load("room_lounge_props","assets/rooms/LoungeRoom_props.png");
  load("room_gym",        "assets/rooms/gym_base.png");
  load("room_gym_top",    "assets/rooms/gym_top.png");
  load("room_gym_props",  "assets/rooms/gym_props.png");
  load("room_game",       "assets/rooms/Game_base.png");
  load("room_game_top",   "assets/rooms/Game_top.png");
  load("room_game_props", "assets/rooms/Game_props.png");
  load("room_music",      "assets/rooms/Music_base.png");
  load("room_music_top",  "assets/rooms/Music_top.png");
  load("room_music_props","assets/rooms/Music_props.png");

  // characters (32x64 frames)
  ["Player","Alex","DJ","Dino","Girl","Gojo","Drod","Bob"].forEach(n=>{
    load("char_"+n, "assets/chars/"+n+".png");
  });
  // portraits (64x64 frames, talking)
  ["Player","Alex","DJ","Dino","Girl","Gojo","Drod","Bob"].forEach(n=>{
    load("port_"+n, "assets/portraits/"+n+".png");
  });

  // chess
  load("chess_white", "assets/chess/WhitePieces.png");
  load("chess_black", "assets/chess/BlackPieces.png");
  load("chess_board", "assets/chess/board.png");

  // pets (own spritesheets: idle + being-petted rows)
  load("pet_dog", "assets/pets/dog.png");
  load("pet_cat", "assets/pets/cat.png");

  // animated props — speaker/amp the jukebox plays through (3 frames, 32x64)
  load("prop_speaker", "assets/props/speaker.png");

  return {
    images,
    get: (k)=>images[k],
    progress: ()=> total ? loaded/total : 1,
    ready: ()=> loaded >= total,
    // sprite layout constants
    CHAR_FW: 32, CHAR_FH: 64,
    // row index in sheet for idle (1) and walk (2)
    ROW_IDLE: 1, ROW_WALK: 2,
    // first column for each facing direction (6 frames each)
    DIR_COL: { right:0, up:6, left:12, down:18 },
    DIR_FRAMES: 6,
    PORT_FW: 64, PORT_FH: 64, PORT_FRAMES: 30, PORT_COLS: 10,
    // speaker sheet: 3 frames laid out horizontally, each cell 32x64.
    // The speaker art sits in the TOP of each cell (alpha bbox y:6..46), so it
    // anchors at content-bottom (46), not the cell bottom.
    SPK_FW: 32, SPK_FH: 64, SPK_FRAMES: 3, SPK_CONTENT_BOTTOM: 46
  };
})();
