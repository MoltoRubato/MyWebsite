/* ============================================================
   ENTITIES — player + NPCs with ambient behavior
   Position model: (x,y) = feet point = center-bottom of the
   32x64 sprite. Collision box is a small rect at the feet.
   ============================================================ */
window.ENTITIES = (function(){
  const W = window.WORLD, TS = W.TS;
  // Collision footprint = a small box at the character's FEET (the bottom of
  // the sprite). (x,y) is the feet point; the box sits just above it so walls
  // are measured from the foot, not the whole body.
  const FEET_W = 16, FEET_H = 8;

  function makePlayer(){
    return {
      char:"char_Player", x:15*TS+16, y:9*TS+30,
      dir:"down", moving:false, frame:0, animT:0, speed:1.7
    };
  }

  // collision check for a feet point
  function freeAt(room, x, y){
    return W.canStand(room, x-FEET_W/2, y-FEET_H, FEET_W, FEET_H);
  }

  // NPC factory. spec: {char, tx, ty, dir, name, behavior, region}
  function makeNPC(spec){
    return {
      char:"char_"+spec.char, key:spec.char, name:spec.name||spec.char,
      x:spec.tx*TS+16, y:spec.ty*TS+TS-2, homeX:spec.tx*TS+16, homeY:spec.ty*TS+TS-2,
      dir:spec.dir||"down", moving:false, frame:0, animT:0,
      behavior:spec.behavior||"idle", speed:spec.speed||0.9,
      region:spec.region, interact:spec.interact, hint:spec.hint,
      state:"pause", timer:1+Math.random()*2, tx:0, ty:0,
      watchDir:spec.dir||"down", bob:Math.random()*6.28
    };
  }

  // NPC placement per room
  const NPCS = {
    lounge:[
      { char:"Bob",  name:"Bob",    tx:14, ty:11, dir:"right", behavior:"watch" },
      { char:"Dino", name:"Dino",   tx:14, ty:9,  dir:"down",  behavior:"wander", speed:0.85, region:{x0:13,y0:8,x1:18,y1:10} }
    ],
    gym:[
      { char:"Girl", name:"Amelia", tx:12, ty:9,  dir:"up",    behavior:"work" },
      { char:"Gojo", name:"Gojo",   tx:20, ty:8,  dir:"left",  behavior:"box", interact:"workout" }
    ],
    game:[
      { char:"Drod", name:"Drod",   tx:16, ty:9, dir:"up",  behavior:"idle", interact:"chess" }
    ],
    music:[
      { char:"Alex", name:"Alex",   tx:10, ty:9,  dir:"right", behavior:"groove", interact:"music" },
      { char:"DJ",   name:"DJ",     tx:15, ty:9,  dir:"left",  behavior:"groove", interact:"music" }
    ]
  };

  // Interactable objects (non-NPC). type drives the action.
  const OBJECTS = {
    music:[ { type:"music", name:"The Decks", tx:13, ty:11, hint:"play music", icon:"🎶" } ]
  };

  function buildRoom(roomKey){
    const npcs = (NPCS[roomKey]||[]).map(makeNPC);
    const objs = (OBJECTS[roomKey]||[]).map(o=>({
      ...o, x:o.tx*TS+16, y:o.ty*TS+TS-2
    }));
    return { npcs, objs };
  }

  // advance ambient AI for one NPC
  function stepNPC(n, room, dt){
    n.animT += dt;
    n.bob += dt*4;
    switch(n.behavior){
      case "wander": {
        if(!n.region){ n.moving=false; break; }
        n.timer -= dt;
        if (n.state==="pause"){
          n.moving=false;
          if (n.timer<=0){
            const r = n.region;
            const tx = (r.x0 + Math.floor(Math.random()*(r.x1-r.x0+1)));
            const ty = (r.y0 + Math.floor(Math.random()*(r.y1-r.y0+1)));
            n.tgtX = tx*TS+16; n.tgtY = ty*TS+TS-2;
            n.state="walk"; n.timer=4;
          }
        } else {
          const dx = n.tgtX-n.x, dy = n.tgtY-n.y;
          const d = Math.hypot(dx,dy);
          if (d < 2 || n.timer<=0){ n.state="pause"; n.moving=false; n.timer=1.2+Math.random()*2.5; }
          else {
            const step = n.speed*dt*60;
            const vx = dx/d*step, vy = dy/d*step;
            n.dir = Math.abs(dx)>Math.abs(dy) ? (dx<0?"left":"right") : (dy<0?"up":"down");
            if (freeAt(room, n.x+vx, n.y)) n.x+=vx; else n.state="pause";
            if (freeAt(room, n.x, n.y+vy)) n.y+=vy; else n.state="pause";
            n.moving=true;
          }
        }
        break;
      }
      case "watch": { // watch TV: stand, slow idle frames, rare glance
        n.moving=false; n.dir=n.watchDir;
        break;
      }
      case "work": { // gym: alternate idle/active to fake reps
        n.timer -= dt; n.moving = (Math.sin(n.bob)>0.2);
        break;
      }
      case "box": { // punch the bag — animate in place
        n.moving = true; n.dir = n.watchDir;
        break;
      }
      case "groove": { // music: bob in place
        n.moving = (Math.sin(n.bob*0.7)>0); n.dir = n.watchDir;
        break;
      }
      default: { n.moving=false; }
    }
    // frame animation
    const fps = n.moving ? 8 : 3.5;
    n.frame = Math.floor(n.animT * fps);
  }

  return { makePlayer, makeNPC, buildRoom, stepNPC, freeAt, FEET_W, FEET_H };
})();
