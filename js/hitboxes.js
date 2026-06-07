/* ============================================================
   HITBOXES — free-form (pixel) collision + depth layer data.
   Data lives in world pixels (the 960x640 room space).
   Editable live via the editor (press 'H', then Edit).

   Shape per room:
     { solids: [ {x,y,w,h}, ... ],                  // collision blockers
       depth:  [ {x,y,w,h, baseY, src, label}, ...] } // Y-sorted art

   A depth box re-draws a patch of a layer image, sorted against the
   player by its baseY (the object's "feet" line). Player passes BEHIND
   it when standing above baseY, IN FRONT when below.
     src:'props' -> sample <Room>_props.png  (the Tiled "Objects" layer)
     src:'top'   -> sample <Room>_top.png    (the Tiled Top/top1/11 layers)
   ============================================================ */
window.HITBOXES = (function(){
  const TS = 32;
  const LS_KEY     = "ryanworld_hitboxes_v3";   // your saved level-editor config
  const LS_KEY_OLD = "ryanworld_hitboxes_v2";   // oldest fallback (solids only)

  // --- migrate the existing collision tile grids into rectangles ---
  function tilesToRects(grid){
    const rows = grid.length, cols = grid[0].length;
    const used = grid.map(r => r.map(()=>false));
    const rects = [];
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++){
      if(grid[y][x]!==1 || used[y][x]) continue;
      let w=1; while(x+w<cols && grid[y][x+w]===1 && !used[y][x+w]) w++;
      let h=1, ok=true;
      while(y+h<rows && ok){
        for(let k=0;k<w;k++){ if(grid[y+h][x+k]!==1 || used[y+h][x+k]){ ok=false; break; } }
        if(ok) h++;
      }
      for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++) used[y+dy][x+dx]=true;
      rects.push({ x:x*TS, y:y*TS, w:w*TS, h:h*TS });
    }
    return rects;
  }

  const TILE = {};
  for(const k in window.COLLISION){
    TILE[k] = window.COLLISION[k].map(s => s.split('').map(Number));
  }
  const GRID_KEY = { lounge:"LoungeRoom", gym:"gym", game:"Game", music:"Music" };

  // Entrance hitboxes (world px rects) that send the player to another room,
  // + one spawn point per room (feet position in world px, + facing) where the
  // player appears on entering that room. Seeded from world.js tile data; fully
  // editable in the in-browser editor (press 'H' -> Edit -> Door / Spawn).
  const SEED_DOORS = {
    lounge: [
      { x:416, y:128, w:96,  h:32,  to:"gym"   },
      { x:224, y:256, w:32,  h:128, to:"game"  },
      { x:672, y:256, w:32,  h:128, to:"music" }
    ],
    gym:   [ { x:544, y:320, w:32, h:32, to:"lounge" } ],
    game:  [ { x:576, y:288, w:32, h:32, to:"lounge" } ],
    music: [ { x:288, y:288, w:32, h:32, to:"lounge" } ]
  };
  const SEED_SPAWN = {
    lounge:{ x:496, y:318, face:"down"  },
    gym:   { x:560, y:318, face:"up"    },
    game:  { x:560, y:318, face:"left"  },
    music: { x:336, y:318, face:"right" }
  };

  // Depth props auto-generated from each room's Tiled "Objects" layer
  // (rendered to <Room>_props.png, segmented into objects by their base row).
  const SEED_DEPTH = {
    lounge: [
      { x:422, y:128, w:84,  h:30, baseY:158, src:"props", label:"entry mat" },
      { x:582, y:132, w:54,  h:80, baseY:212, src:"props", label:"bookshelf" },
      { x:292, y:144, w:120, h:78, baseY:222, src:"props", label:"dining set" },
      { x:546, y:228, w:26,  h:20, baseY:248, src:"props", label:"decor" },
      { x:316, y:232, w:40,  h:46, baseY:278, src:"props", label:"sideboard" },
      { x:608, y:308, w:26,  h:60, baseY:368, src:"props", label:"clothing stand" },
      { x:322, y:352, w:94,  h:50, baseY:402, src:"props", label:"flower vases" },
      { x:486, y:366, w:116, h:50, baseY:416, src:"props", label:"tv / console" }
    ],
    gym: [
      { x:576, y:64,  w:64,  h:96,  baseY:160, src:"props", label:"punch bag" },
      { x:672, y:64,  w:32,  h:96,  baseY:160, src:"props", label:"punch bag" },
      { x:192, y:192, w:32,  h:32,  baseY:224, src:"props", label:"ball" },
      { x:548, y:172, w:120, h:72,  baseY:244, src:"props", label:"mat / bench" },
      { x:704, y:172, w:32,  h:72,  baseY:244, src:"props", label:"co2 tank" },
      { x:192, y:64,  w:288, h:256, baseY:320, src:"props", label:"equipment" },
      { x:672, y:256, w:64,  h:64,  baseY:320, src:"props", label:"machine" },
      { x:518, y:358, w:84,  h:26,  baseY:384, src:"props", label:"mat" }
    ],
    music: [
      { x:388, y:118, w:56,  h:26, baseY:144, src:"props", label:"stool" },
      { x:224, y:182, w:32,  h:32, baseY:214, src:"props", label:"wall hook" },
      { x:456, y:118, w:152, h:106, baseY:224, src:"props", label:"drums / amps" },
      { x:320, y:128, w:94,  h:96, baseY:224, src:"props", label:"guitars" },
      { x:578, y:214, w:28,  h:74, baseY:288, src:"props", label:"congas" },
      { x:550, y:234, w:18,  h:54, baseY:288, src:"props", label:"mic stand" },
      { x:366, y:246, w:104, h:90, baseY:336, src:"props", label:"piano" },
      { x:462, y:312, w:106, h:98, baseY:410, src:"props", label:"grand piano" },
      { x:320, y:356, w:64,  h:55, baseY:411, src:"props", label:"keyboard" },
      { x:578, y:366, w:30,  h:50, baseY:416, src:"props", label:"mic stand" }
    ],
    game: [
      { x:288, y:140, w:32, h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:352, y:140, w:32, h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:416, y:140, w:32, h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:480, y:140, w:32, h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:544, y:140, w:32, h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:292, y:205, w:120, h:83, baseY:288, src:"props", label:"table + chairs" },
      { x:452, y:205, w:120, h:83, baseY:288, src:"props", label:"table + chairs" },
      { x:472, y:330, w:80,  h:100, baseY:430, src:"props", label:"arcade table" },
      { x:292, y:338, w:108, h:108, baseY:446, src:"props", label:"pool table" }
    ]
  };

  function buildDefaults(){
    const out = {};
    for(const room in GRID_KEY){
      const g = TILE[GRID_KEY[room]];
      out[room] = {
        solids: g ? tilesToRects(g) : [],
        depth:  (SEED_DEPTH[room] || []).map(o=>({...o})),
        doors:  (SEED_DOORS[room] || []).map(o=>({...o})),
        spawn:  SEED_SPAWN[room] ? {...SEED_SPAWN[room]} : {x:480,y:320,face:"down"}
      };
    }
    return out;
  }

  let DATA = buildDefaults();

  // ---- load saved overrides ----
  // Restore the user's saved level-editor config faithfully — never overwrite it.
  // The only auto-fill is depth props for a room the user never configured
  // (depth absent or empty): those keep the default seed so every room's layers
  // stay managed. A room with saved depth is left exactly as the user left it.
  try{
    const raw = localStorage.getItem(LS_KEY) || localStorage.getItem(LS_KEY_OLD);
    if(raw){
      const saved = JSON.parse(raw);
      for(const room in saved){
        if(!DATA[room]) DATA[room] = {solids:[],depth:[],doors:[],spawn:{x:480,y:320,face:"down"}};
        if(Array.isArray(saved[room].solids)) DATA[room].solids = saved[room].solids;
        // depth: keep the user's if they set any; otherwise keep the default seed
        if(Array.isArray(saved[room].depth) && saved[room].depth.length) DATA[room].depth = saved[room].depth;
        else if(Array.isArray(saved[room].overlays) && saved[room].overlays.length) DATA[room].depth = saved[room].overlays; // v2 name
        // doors: restore, but never let an empty array strand a room
        if(Array.isArray(saved[room].doors) && saved[room].doors.length) DATA[room].doors = saved[room].doors;
        if(saved[room].spawn) DATA[room].spawn = saved[room].spawn;
      }
    }
  }catch(e){ console.warn("hitbox load failed", e); }

  function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(DATA)); }catch(e){} }
  function room(k){ if(!DATA[k]) DATA[k]={solids:[],depth:[],doors:[],spawn:{x:480,y:320,face:"down"}}; return DATA[k]; }
  function solids(k){ return room(k).solids; }
  function depth(k){ return room(k).depth; }
  function doors(k){ return room(k).doors || (room(k).doors=[]); }
  function spawn(k){ return room(k).spawn || (room(k).spawn={x:480,y:320,face:"down"}); }
  function resetRoom(k){ const d=buildDefaults(); DATA[k]=d[k]; save(); }
  function exportJSON(){ return JSON.stringify(DATA, null, 2); }

  return { TS, solids, depth, doors, spawn, overlays:depth /*alias*/, room, save, resetRoom, exportJSON,
           _data:()=>DATA, _defaults:buildDefaults };
})();
