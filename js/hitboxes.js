/* ============================================================
   HITBOXES — free-form (pixel) collision + depth layer data.
   Data lives in world pixels (the 960x640 room space).
   Editable live via the editor (press 'H', then Edit).

   Shape per room:
     { solids: [ {x,y,w,h}, ... ],                  // collision blockers
       depth:  [ {x,y,w,h, baseY, src, label}, ...] } // Y-sorted art

   A depth box re-draws a patch of the room art, sorted against the
   player by its baseY (the object's "feet" line). Player passes BEHIND
   it when standing above baseY, IN FRONT when below.

   Each box samples BOTH <Room>_props.png and <Room>_top.png at its rect,
   so it occludes the player no matter which PNG the art lives in. ('src'
   is retained for editor/export compatibility but no longer changes how a
   box renders — props-only objects like the music-room harp now sort
   correctly even if a box is tagged 'top'.)
   ============================================================ */
window.HITBOXES = (function(){
  const TS = 32;
  // v4: bumped when the exported room config below was baked in as the new
  // default. Reading only v4 means older cached edits (v2/v3) no longer shadow
  // these defaults — fresh visitors and previously-edited browsers both get the
  // baked config; future in-editor saves persist to v4.
  const LS_KEY     = "ryanworld_hitboxes_v4";   // saved level-editor config (current)

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
      { x:416, y:128, w:96, h:22,  to:"gym"   },
      { x:224, y:256, w:13, h:128, to:"game"  },
      { x:691, y:256, w:13, h:128, to:"music" }
    ],
    gym:   [ { x:513, y:367, w:95, h:34,  to:"lounge" } ],
    game:  [ { x:630, y:255, w:43, h:130, to:"lounge" } ],
    music: [ { x:224, y:223, w:42, h:129, to:"lounge" } ]
  };
  const SEED_SPAWN = {
    lounge:{ x:467, y:220, face:"down"  },
    gym:   { x:560, y:343, face:"up"    },
    game:  { x:605, y:319, face:"left"  },
    music: { x:289, y:288, face:"right" }
  };

  // Depth boxes — baked from the in-editor export (ryanworld-hitboxes). baseY is
  // each object's feet line for Y-sorting; the renderer samples both the props
  // and top PNGs per box, so the 'src' tag is informational only.
  const SEED_DEPTH = {
    lounge: [
      { x:292, y:144, w:28,  h:78, baseY:222, src:"props", label:"dining set" },
      { x:614, y:302, w:20,  h:69, baseY:368, src:"props", label:"clothing stand" },
      { x:322, y:352, w:94,  h:50, baseY:402, src:"props", label:"flower vases" },
      { x:310, y:225, w:87,  h:54, baseY:279, src:"top" },
      { x:476, y:272, w:141, h:93, baseY:349, src:"top" },
      { x:470, y:366, w:141, h:51, baseY:383, src:"top" },
      { x:609, y:202, w:31,  h:41, baseY:238, src:"top" },
      { x:516, y:170, w:50,  h:55, baseY:216, src:"top" },
      { x:384, y:144, w:31,  h:79, baseY:223, src:"top" },
      { x:319, y:140, w:65,  h:70, baseY:206, src:"top" },
      { x:610, y:297, w:24,  h:47, baseY:367, src:"top" }
    ],
    gym: [
      { x:672, y:64,  w:32, h:96, baseY:160, src:"props", label:"punch bag" },
      { x:192, y:192, w:32, h:32, baseY:224, src:"props", label:"ball" },
      { x:704, y:172, w:32, h:72, baseY:244, src:"props", label:"co2 tank" },
      { x:672, y:256, w:64, h:64, baseY:320, src:"props", label:"machine" },
      { x:362, y:108, w:38, h:37, baseY:145, src:"top" },
      { x:316, y:287, w:38, h:35, baseY:322, src:"top" },
      { x:353, y:257, w:29, h:25, baseY:282, src:"top" },
      { x:255, y:290, w:34, h:28, baseY:318, src:"top" },
      { x:319, y:129, w:32, h:26, baseY:155, src:"top" },
      { x:260, y:125, w:53, h:22, baseY:147, src:"top" },
      { x:356, y:152, w:57, h:20, baseY:169, src:"top" },
      { x:191, y:289, w:35, h:17, baseY:306, src:"top" }
    ],
    music: [
      { x:388, y:118, w:56, h:26, baseY:144, src:"props", label:"stool" },
      { x:224, y:182, w:32, h:32, baseY:214, src:"props", label:"wall hook" },
      { x:453, y:152, w:90, h:72, baseY:224, src:"props", label:"drums / amps" },
      { x:550, y:234, w:18, h:54, baseY:288, src:"props", label:"mic stand" },
      { x:320, y:356, w:64, h:55, baseY:411, src:"props", label:"keyboard" },
      { x:578, y:366, w:30, h:50, baseY:416, src:"props", label:"mic stand" },
      { x:314, y:190, w:39, h:37, baseY:222, src:"top" },
      { x:315, y:123, w:68, h:64, baseY:185, src:"top" },
      { x:570, y:203, w:42, h:87, baseY:290, src:"top" },
      { x:454, y:344, w:54, h:67, baseY:411, src:"top" },
      { x:512, y:307, w:57, h:78, baseY:385, src:"top" },
      { x:512, y:385, w:56, h:28, baseY:413, src:"top" },
      { x:383, y:158, w:30, h:28, baseY:186, src:"top" }
    ],
    game: [
      { x:288, y:140, w:32,  h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:352, y:140, w:32,  h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:416, y:140, w:32,  h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:480, y:140, w:32,  h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:544, y:140, w:32,  h:36,  baseY:176, src:"props", label:"hanging plant" },
      { x:289, y:419, w:29,  h:31,  baseY:439, src:"top" },
      { x:281, y:190, w:149, h:105, baseY:295, src:"top" },
      { x:435, y:204, w:151, h:86,  baseY:290, src:"top" },
      { x:460, y:322, w:101, h:108, baseY:388, src:"top" },
      { x:296, y:381, w:18,  h:37,  baseY:439, src:"top" }
    ]
  };

  // Free-form solid blockers (world px), hand-traced against the room art in the
  // editor. When a room has an entry here it REPLACES the tile-grid-derived
  // collision. Baked from the in-editor export (ryanworld-hitboxes).
  const SEED_SOLIDS = {
    lounge: [
      { x:0,   y:0,   w:960, h:128 },
      { x:0,   y:128, w:287, h:129 },
      { x:512, y:128, w:448, h:64  },
      { x:640, y:192, w:320, h:63  },
      { x:0,   y:256, w:224, h:384 },
      { x:704, y:256, w:256, h:384 },
      { x:224, y:384, w:86,  h:256 },
      { x:619, y:385, w:85,  h:255 },
      { x:264, y:123, w:150, h:68  },
      { x:387, y:194, w:24,  h:26  },
      { x:294, y:195, w:23,  h:25  },
      { x:325, y:190, w:20,  h:15  },
      { x:354, y:191, w:28,  h:14  },
      { x:529, y:180, w:43,  h:29  },
      { x:612, y:219, w:24,  h:19  },
      { x:579, y:185, w:55,  h:24  },
      { x:486, y:309, w:116, h:37  },
      { x:612, y:354, w:23,  h:13  },
      { x:512, y:357, w:64,  h:46  },
      { x:289, y:417, w:350, h:55  },
      { x:314, y:231, w:77,  h:43  },
      { x:344, y:391, w:16,  h:8   },
      { x:330, y:386, w:13,  h:9   },
      { x:361, y:388, w:13,  h:6   },
      { x:608, y:190, w:33,  h:49  }
    ],
    gym: [
      { x:18,  y:-1,  w:960, h:128 },
      { x:0,   y:128, w:192, h:512 },
      { x:736, y:128, w:224, h:512 },
      { x:192, y:320, w:320, h:320 },
      { x:608, y:320, w:128, h:320 },
      { x:512, y:384, w:96,  h:256 },
      { x:686, y:283, w:35,  h:36  },
      { x:705, y:222, w:30,  h:20  },
      { x:224, y:237, w:32,  h:62  },
      { x:426, y:96,  w:44,  h:83  },
      { x:193, y:95,  w:62,  h:47  },
      { x:606, y:119, w:34,  h:39  },
      { x:667, y:118, w:39,  h:42  },
      { x:190, y:215, w:33,  h:8   },
      { x:320, y:311, w:31,  h:8   },
      { x:260, y:309, w:22,  h:5   },
      { x:193, y:299, w:28,  h:6   },
      { x:355, y:274, w:23,  h:8   },
      { x:359, y:163, w:51,  h:7   },
      { x:365, y:132, w:32,  h:11  },
      { x:321, y:146, w:26,  h:6   },
      { x:263, y:138, w:47,  h:6   }
    ],
    game: [
      { x:0,   y:0,   w:960, h:192 },
      { x:0,   y:192, w:288, h:448 },
      { x:288, y:449, w:320, h:191 },
      { x:578, y:385, w:200, h:72  },
      { x:292, y:223, w:117, h:64  },
      { x:452, y:223, w:119, h:63  },
      { x:306, y:339, w:97,  h:79  },
      { x:497, y:350, w:34,  h:80  },
      { x:467, y:370, w:88,  h:43  },
      { x:577, y:191, w:130, h:65  },
      { x:294, y:432, w:22,  h:10  }
    ],
    music: [
      { x:0,   y:0,   w:960, h:158 },
      { x:610, y:128, w:350, h:512 },
      { x:288, y:417, w:352, h:223 },
      { x:135, y:128, w:183, h:95  },
      { x:133, y:352, w:184, h:84  },
      { x:546, y:161, w:62,  h:28  },
      { x:509, y:340, w:58,  h:45  },
      { x:463, y:394, w:29,  h:14  },
      { x:321, y:362, w:62,  h:47  },
      { x:578, y:212, w:27,  h:76  },
      { x:459, y:193, w:78,  h:31  },
      { x:321, y:158, w:92,  h:29  },
      { x:549, y:271, w:20,  h:17  },
      { x:322, y:211, w:21,  h:11  },
      { x:580, y:403, w:26,  h:10  },
      { x:514, y:311, w:25,  h:30  },
      { x:528, y:334, w:28,  h:5   },
      { x:523, y:313, w:20,  h:21  },
      { x:527, y:394, w:28,  h:13  },
      { x:413, y:396, w:37,  h:16  }
    ]
  };

  function buildDefaults(){
    const out = {};
    for(const room in GRID_KEY){
      const g = TILE[GRID_KEY[room]];
      out[room] = {
        solids: SEED_SOLIDS[room] ? SEED_SOLIDS[room].map(o=>({...o}))
                                  : (g ? tilesToRects(g) : []),
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
    const raw = localStorage.getItem(LS_KEY);
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

  // Per-source spawn: when the player walks into `roomKey` from `fromKey`, drop
  // them just inside the carpet (door) that leads back to that room, facing into
  // the room — e.g. returning to the lounge from the gym lands you right under
  // the gym's (green) carpet. Returns null if this room has no door back to
  // fromKey, so callers can fall back to the room's single spawn.
  const CW = 30*TS, CH = 20*TS;            // room canvas in world px (960x640)
  function spawnFrom(roomKey, fromKey){
    const back = (doors(roomKey)).find(d => d.to === fromKey);
    if(!back) return null;
    const GAP = 22;                        // stand off the door trigger, on the floor
    const cx = back.x + back.w/2, cy = back.y + back.h/2;
    if(back.w >= back.h){                  // wide carpet -> top/bottom wall
      return cy < CH/2
        ? { x:cx, y:back.y+back.h+GAP, face:"down" }   // top wall: step down in
        : { x:cx, y:back.y-GAP,        face:"up"   };  // bottom wall: step up in
    }
    return cx < CW/2                       // tall carpet -> left/right wall
      ? { x:back.x+back.w+GAP, y:cy, face:"right" }    // left wall: step right in
      : { x:back.x-GAP,        y:cy, face:"left"  };   // right wall: step left in
  }
  function resetRoom(k){ const d=buildDefaults(); DATA[k]=d[k]; save(); }
  function exportJSON(){ return JSON.stringify(DATA, null, 2); }

  return { TS, solids, depth, doors, spawn, spawnFrom, overlays:depth /*alias*/, room, save, resetRoom, exportJSON,
           _data:()=>DATA, _defaults:buildDefaults };
})();
