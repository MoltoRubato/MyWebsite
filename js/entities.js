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

  // NPC placement per room. Every NPC wanders within a region (tile bounds) the
  // way Dino does; interactive NPCs keep a tighter region so they linger near
  // their station (decks / bag / chess board) yet still mill about.
  const NPCS = {
    lounge:[
      { char:"Bob",  name:"Bob",    tx:14, ty:11, dir:"left",  behavior:"wander", speed:0.8,  region:{x0:12,y0:10,x1:17,y1:12} },
      { char:"Dino", name:"Dino",   tx:14, ty:9,  dir:"down",  behavior:"wander", speed:0.85, region:{x0:13,y0:8,x1:18,y1:10} }
    ],
    gym:[
      { char:"Girl", name:"Amelia", tx:12, ty:9,  dir:"down",  behavior:"wander", speed:0.85, region:{x0:8,y0:6,x1:13,y1:9} },
      { char:"Gojo", name:"Gojo",   tx:20, ty:8,  dir:"left",  behavior:"wander", speed:0.85, region:{x0:17,y0:6,x1:21,y1:9}, interact:"workout" }
    ],
    game:[
      { char:"Drod", name:"Drod",   tx:16, ty:9,  dir:"down",  behavior:"wander", speed:0.8,  region:{x0:13,y0:9,x1:17,y1:11}, interact:"chess" }
    ],
    music:[
      { char:"Alex", name:"Alex",   tx:10, ty:9,  dir:"right", behavior:"wander", speed:0.85, region:{x0:9,y0:8,x1:12,y1:10}, interact:"music" },
      { char:"DJ",   name:"DJ",     tx:15, ty:9,  dir:"left",  behavior:"wander", speed:0.85, region:{x0:14,y0:8,x1:17,y1:10}, interact:"music" }
    ]
  };

  // Interactable objects (non-NPC). type drives the action.
  // The speaker is rendered as an animated sprite (see game.js render) and is
  // the jukebox trigger — it bobs/animates while site-wide music is playing.
  const OBJECTS = {
    music:[ { type:"music", name:"Speaker", tx:13, ty:12, hint:"Open jukebox", sprite:"speaker" } ],
    // Pool table is baked into the game-room art (bottom-left). This is just the
    // interaction anchor: stand at the table's front edge to rack 'em up vs Drod.
    // px/py = feet point in world px; markerY floats the prompt above the table.
    game:[ { type:"pool", name:"Pool table", px:354, py:430, hint:"Play pool", markerY:104 } ]
  };

  // Pets — critters you can walk up to and pet (Enter/E). Placed in world px
  // (like the hand-traced lounge hitboxes) so they dodge the furniture cleanly.
  // (x,y) = feet/base point; w,h = on-screen draw size in world px.
  const PETS = {
    lounge:[
      { kind:"dog", name:"the dog", x:405, y:270, w:30, h:44, hint:"Pet the dog" },
      { kind:"cat", name:"the cat", x:625, y:260, w:44, h:34, hint:"Pet the cat" }
    ]
  };
  function makePet(spec){
    return { ...spec, state:"idle", frame:0, animT:0, petTimer:0,
             petDur:2.0, idleFps:5, petFps:6 };
  }
  // begin the petting animation (only from idle, matching the original)
  function petStart(p){
    if(!p || p.state!=="idle") return;
    p.state="petted"; p.petTimer=p.petDur; p.animT=0; p.frame=0;
  }
  // advance a pet's animation + petting timer for one tick
  function stepPet(p, dt){
    p.animT += dt;
    if(p.state==="petted"){
      p.petTimer -= dt;
      if(p.petTimer<=0){ p.state="idle"; p.animT=0; p.frame=0; }
    }
    const fps = p.state==="petted" ? p.petFps : p.idleFps;
    p.frame = Math.floor(p.animT*fps);
  }

  function buildRoom(roomKey){
    const npcs = (NPCS[roomKey]||[]).map(makeNPC);
    const objs = (OBJECTS[roomKey]||[]).map(o=>({
      ...o,
      x: o.px!=null ? o.px : o.tx*TS+16,
      y: o.py!=null ? o.py : o.ty*TS+TS-2
    }));
    const pets = (PETS[roomKey]||[]).map(makePet);
    return { npcs, objs, pets };
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
            // pick a WALKABLE target tile inside the region (retry a few times),
            // so NPCs never march into furniture; idle again if none is free.
            let tx, ty, ok=false;
            for(let i=0;i<8 && !ok;i++){
              tx = r.x0 + Math.floor(Math.random()*(r.x1-r.x0+1));
              ty = r.y0 + Math.floor(Math.random()*(r.y1-r.y0+1));
              ok = freeAt(room, tx*TS+16, ty*TS+TS-2);
            }
            if(ok){ n.tgtX = tx*TS+16; n.tgtY = ty*TS+TS-2; n.state="walk"; n.timer=4; }
            else { n.timer = 0.6+Math.random()*1.2; }
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

  return { makePlayer, makeNPC, makePet, petStart, buildRoom, stepNPC, stepPet, freeAt, FEET_W, FEET_H };
})();
