/* ============================================================
   WORLD — room layout, collision, doors, transitions
   Tile grid 30x20, tile = 32px. Canvas 960x640.
   ============================================================ */
window.WORLD = (function(){
  const TS = 32, COLS = 30, ROWS = 20;

  // Parse collision bitstrings -> 2D int arrays
  const COL = {};
  for (const k in window.COLLISION){
    COL[k] = window.COLLISION[k].map(s => s.split('').map(Number));
  }

  // Room registry. grid = key into COLLISION, img = ASSETS key.
  const ROOMS = {
    lounge: {
      key:"lounge", label:"The Lounge", img:"room_lounge", grid:"LoungeRoom",
      mapPos:[1,1], view:{x:198,y:100,w:534,h:352}, home:[14,9],
      doors:[
        { zone:[13,15,4,4],  to:"gym",   spawn:[17,9], face:"up"    },
        { zone:[7,7,8,11],   to:"game",  spawn:[17,9], face:"left"  },
        { zone:[21,21,8,11], to:"music", spawn:[9,9],  face:"right" }
      ]
    },
    gym: {
      key:"gym", label:"The Gym", img:"room_gym", grid:"gym",
      mapPos:[1,0], view:{x:134,y:38,w:660,h:372}, home:[14,7],
      doors:[
        { x:17, y:10, to:"lounge", spawn:[14,6], face:"down" }
      ]
    },
    game: {
      key:"game", label:"The Game Room", img:"room_game", grid:"Game",
      mapPos:[0,1], view:{x:230,y:102,w:468,h:384}, home:[13,10],
      doors:[
        { x:18, y:9, to:"lounge", spawn:[9,9], face:"right" }
      ]
    },
    music: {
      key:"music", label:"The Music Studio", img:"room_music", grid:"Music",
      mapPos:[2,1], view:{x:198,y:70,w:468,h:384}, home:[13,9],
      doors:[
        { x:9, y:9, to:"lounge", spawn:[19,9], face:"left" }
      ]
    }
  };

  function room(k){ return ROOMS[k]; }
  function grid(k){ return COL[ROOMS[k].grid]; }

  // ---- collision: free-form rectangles (see js/hitboxes.js) ----
  // canStand: TRUE if the feet box (w x h at px,py) fits with no solid hit.
  function canStand(roomKey, px, py, w, h){
    // out of the room canvas = cannot stand
    if(px<0 || py<0 || px+w>COLS*TS || py+h>ROWS*TS) return false;
    const rs = window.HITBOXES ? HITBOXES.solids(roomKey) : [];
    for(const r of rs){
      if(px < r.x+r.w && px+w > r.x && py < r.y+r.h && py+h > r.y) return false;
    }
    return true;
  }
  // point-in-solid (kept for compatibility)
  function solidAtPx(roomKey, px, py){
    if(px<0||py<0||px>=COLS*TS||py>=ROWS*TS) return true;
    const rs = window.HITBOXES ? HITBOXES.solids(roomKey) : [];
    for(const r of rs){ if(px>=r.x && px<r.x+r.w && py>=r.y && py<r.y+r.h) return true; }
    return false;
  }

  function doorAt(roomKey, tx, ty){
    const r = ROOMS[roomKey];
    return r.doors.find(d => {
      if (d.zone){ const [x0,x1,y0,y1]=d.zone; return tx>=x0&&tx<=x1&&ty>=y0&&ty<=y1; }
      return d.x===tx && d.y===ty;
    }) || null;
  }

  // mini-map adjacency for arrows / map modal
  function neighbors(roomKey){
    const r = ROOMS[roomKey], list=[];
    r.doors.forEach(d=>{
      let dir = d.face; // direction of travel toward door ~ face when arriving; map to compass
      list.push({ to:d.to });
    });
    return list;
  }

  return { TS, COLS, ROWS, ROOMS, room, grid, solidAtPx, canStand, doorAt, neighbors,
           tile:(p)=>Math.floor(p/TS), px:(t)=>t*TS };
})();
