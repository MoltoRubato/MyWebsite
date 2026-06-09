/* ============================================================
   GAME — main loop, rendering, input, transitions, interactions
   ============================================================ */
window.GAME = (function(){
  const W=window.WORLD, A=window.ASSETS, S=window.SPRITES, EN=window.ENTITIES, C=window.CONTENT;
  const canvas=document.getElementById("game"), ctx=canvas.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  const stage=document.getElementById("stage");
  const veil=document.getElementById("veil");
  const roomLabel=document.getElementById("roomLabel");
  const hintEl=document.getElementById("hint");

  const ROOM_IMG={lounge:"room_lounge",gym:"room_gym",game:"room_game",music:"room_music"};
  const TOP_IMG={lounge:"room_lounge_top",gym:"room_gym_top",game:"room_game_top",music:"room_music_top"};
  const PROPS_IMG={lounge:"room_lounge_props",gym:"room_gym_props",game:"room_game_props",music:"room_music_props"};
  const SPK_SCALE=1.2; // on-screen size of the animated jukebox speaker
  // Lounge TV — the flatscreen on the central media console (in the top layer,
  // inside the baseY:349 depth box). Body rect in world px (bezel-to-bezel),
  // traced off the art; an animated channel frame is stamped here so its navy
  // bezel lands over the painted one and the stand below stays visible.
  const TV_RECT = { x:517, y:283, w:52, h:25, baseY:349 };
  // The 3 supplied sheets, each with a cheeky on-air name flashed when selected.
  const TV_CHANNELS = [
    { key:"tv_ch0", label:"RYAN NEWS 24" },
    { key:"tv_ch1", label:"GENERAL HOSPITAL" },
    { key:"tv_ch2", label:"ER · AFTER DARK" }
  ];

  let player=EN.makePlayer();
  let curRoom="lounge";
  let rooms={}; // built lazily per room
  let keys={};
  let joy={x:0,y:0,active:false};   // analog touch joystick (-1..1 per axis)
  let paused=false, transitioning=false, running=false;
  let nearTarget=null; // {kind, ref}
  let doorGuard=null;  // tile string to ignore until stepped off
  let lastTs=0;
  let soundOn=true;
  let musicAnimT=0; // clock for the animated speaker (advances while music is audible)
  let tvCh=-1;      // lounge TV: -1 = off, else index into TV_CHANNELS
  let tvAnimT=0;    // channel playback clock (advances always; TV is ambient)
  let tvLabelT=0;   // seconds left to flash the channel name after a switch
  let showHitboxes=/[?&]dev=1\b/.test(location.search); // DEV: collision overlay (press 'H' or ?dev=1)
  let intro=null;   // opening cinematic: slow auto-walk to centre + room reveal (see startIntro)

  function ensureRoom(k){ if(!rooms[k]) rooms[k]=EN.buildRoom(k); return rooms[k]; }

  // ---------- scaling ----------
  function resize(){
    const availW=stage.clientWidth, availH=stage.clientHeight;
    const scale=Math.min(availW/canvas.width, availH/canvas.height);
    canvas.style.width=(canvas.width*scale)+"px";
    canvas.style.height=(canvas.height*scale)+"px";
  }
  window.addEventListener("resize",resize);

  // ---------- input ----------
  function bindInput(){
    window.addEventListener("keydown",(e)=>{
      const tag=(e.target&&e.target.tagName)||"";
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(e.target&&e.target.isContentEditable)) return;
      const k=e.key.toLowerCase();
      if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)) e.preventDefault();
      if(intro) return; // opening cinematic owns input until it finishes
      if(DIALOGUE.isOpen()){ if(k==="enter"||k===" "){ DIALOGUE.advance(); } return; }
      if(anyOverlayOpen()) return;
      keys[k]=true;
      if(k==="enter"||k==="e"){ interact(); }
      if(k==="m"){ HEADER.openMap(); }
      // if(k==="h"){ setHitboxes(!showHitboxes); }  // DEV hitbox toggle — disabled for now (still reachable via ?dev=1)
    });
    window.addEventListener("keyup",(e)=>{ keys[e.key.toLowerCase()]=false; });
    // touch joystick — analog drag-to-move. The stick spawns under the thumb
    // anywhere in the left zone; the knob deflection (clamped to R) drives a
    // continuous move vector, so direction + speed are both analog.
    const zone=document.getElementById("joyZone");
    const stick=document.getElementById("joystick");
    const knob=document.getElementById("joyKnob");
    if(zone&&stick&&knob){
      const R=52;                       // max knob travel (px) = full deflection
      let pid=null, ox=0, oy=0;          // active pointer id + stick origin
      const setKnob=(dx,dy)=>{ knob.style.transform="translate("+dx+"px,"+dy+"px)"; };
      const update=(cx,cy)=>{
        let dx=cx-ox, dy=cy-oy; const d=Math.hypot(dx,dy);
        if(d>R){ dx=dx/d*R; dy=dy/d*R; }
        setKnob(dx,dy); joy.x=dx/R; joy.y=dy/R; joy.active=true;
      };
      const start=(e)=>{
        if(anyOverlayOpen()||paused||transitioning||DIALOGUE.isOpen()) return;
        pid=e.pointerId; ox=e.clientX; oy=e.clientY;
        // #joystick is absolutely positioned inside #joyZone, so its left/top are
        // zone-local — convert the viewport touch point or it renders offset below the finger.
        const zr=zone.getBoundingClientRect();
        stick.style.left=(ox-zr.left)+"px"; stick.style.top=(oy-zr.top)+"px";
        setKnob(0,0); zone.classList.add("on");
        joy.x=0; joy.y=0; joy.active=true;
        try{ zone.setPointerCapture(pid); }catch(_){}
        e.preventDefault();
      };
      const move=(e)=>{ if(pid===null||e.pointerId!==pid) return; update(e.clientX,e.clientY); e.preventDefault(); };
      const end=(e)=>{ if(pid!==null&&e.pointerId!==pid) return;
        pid=null; zone.classList.remove("on"); setKnob(0,0); joy.x=0; joy.y=0; joy.active=false; };
      zone.addEventListener("pointerdown",start);
      zone.addEventListener("pointermove",move,{passive:false});
      zone.addEventListener("pointerup",end);
      zone.addEventListener("pointercancel",end);
    }
    const act=document.getElementById("actBtn");
    act.addEventListener("touchstart",(e)=>{e.preventDefault(); if(DIALOGUE.isOpen())DIALOGUE.advance(); else interact();});
    act.addEventListener("click",()=>{ if(DIALOGUE.isOpen())DIALOGUE.advance(); else interact();});
    if(("ontouchstart" in window)||navigator.maxTouchPoints>0||(window.matchMedia&&matchMedia("(pointer:coarse)").matches)) document.body.classList.add("touch");
  }
  function anyOverlayOpen(){ return CHESS.isOpen()||MUSIC.isOpen()||(window.POOL&&POOL.isOpen())||(window.WORKOUT&&WORKOUT.isOpen())||
    !document.getElementById("panel").classList.contains("hidden")||
    !document.getElementById("mapModal").classList.contains("hidden"); }

  // ---------- interaction ----------
  function findNear(){
    const R=ensureRoom(curRoom);
    let best=null, bestD=44;
    const cands=[];
    R.npcs.forEach(n=>cands.push({kind:"npc",ref:n,x:n.x,y:n.y}));
    R.objs.forEach(o=>cands.push({kind:"obj",ref:o,x:o.x,y:o.y}));
    (R.pets||[]).forEach(p=>cands.push({kind:"pet",ref:p,x:p.x,y:p.y}));
    for(const c of cands){ const d=Math.hypot(c.x-player.x, c.y-player.y);
      if(d<bestD){ bestD=d; best=c; } }
    return best;
  }
  function interact(){
    if(intro||transitioning||paused) return;
    const near=findNear();
    if(!near) return;
    if(near.kind==="npc") talkTo(near.ref);
    else if(near.kind==="pet") EN.petStart(near.ref);
    else if(near.kind==="obj" && near.ref.type==="music") openJukebox();
    else if(near.kind==="obj" && near.ref.type==="pool") openPool();
    else if(near.kind==="obj" && near.ref.type==="tv") cycleTV();
  }
  // One-button remote: off -> ch1 -> ch2 -> ch3 -> off. Each switch restarts
  // playback from frame 0 and flashes the channel's on-air name.
  function cycleTV(){
    tvCh = tvCh >= TV_CHANNELS.length-1 ? -1 : tvCh+1;
    if(tvCh>=0){ tvAnimT=0; tvLabelT=1.8; }
  }
  function talkTo(npc){
    const data=C.characters[npc.key];
    if(!data){ return; }
    // face the player
    const dx=player.x-npc.x, dy=player.y-npc.y;
    npc.watchDir = Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
    const opts={ charKey:npc.key, name:data.name, color:data.color, lines:data.lines.slice() };
    // Build the end-of-dialogue menu from two sources: the character's station
    // (chess/music/workout) and an optional header tab they can pull up (opens).
    const choices=[], actions={};
    const ACT={ chess:{def:"♟ Play a game", run:openChess},
                music:{def:"♫ Tap out a beat", run:openBeatpad},
                workout:{def:"◉ Hit the bag", run:openWorkout} };
    if(npc.interact && ACT[npc.interact]){
      choices.push({label:data.actLabel||ACT[npc.interact].def, value:"act"});
      actions.act=ACT[npc.interact].run;
    }
    if(data.opens && window.HEADER){
      choices.push({label:data.openLabel||"Show me", value:"open"});
      actions.open=()=>HEADER.openPanel(data.opens);
    }
    if(choices.length){
      choices.push({label:data.noLabel||"Maybe later", value:"no"});
      opts.choices=choices;
      opts.onChoice=(v)=>{ const fn=actions[v]; if(fn) fn(); };
    }
    DIALOGUE.start(opts);
  }

  function openChess(){ paused=true; CHESS.open({onClose:()=>{paused=false;}}); }
  function openPool(){ paused=true; POOL.open({onClose:()=>{paused=false;}}); }
  function openJukebox(){ paused=true; MUSIC.openJukebox({onClose:()=>{paused=false;}}); }
  function openBeatpad(){ paused=true; MUSIC.openBeatpad({onClose:()=>{paused=false;}}); }
  function openWorkout(){ paused=true; WORKOUT.open({onClose:()=>{paused=false;}}); }

  function setHitboxes(v){ showHitboxes=!!v; if(window.EDITOR) EDITOR.setVisible(showHitboxes, curRoom); }

  // ---------- movement + doors ----------
  function tryMove(dt){
    if(paused||transitioning||DIALOGUE.isOpen()||anyOverlayOpen()){ player.moving=false; return; }
    if(window.EDITOR && EDITOR.isEditing()){ player.moving=false; return; }
    let vx=0,vy=0;
    if(keys["w"]||keys["arrowup"]) vy-=1;
    if(keys["s"]||keys["arrowdown"]) vy+=1;
    if(keys["a"]||keys["arrowleft"]) vx-=1;
    if(keys["d"]||keys["arrowright"]) vx+=1;
    // analog joystick overrides keys; its magnitude scales speed (deadzone .06)
    let mag = (vx||vy) ? 1 : 0;
    if(joy.active && (joy.x||joy.y)){ vx=joy.x; vy=joy.y; mag=Math.min(1,Math.hypot(joy.x,joy.y)); }
    player.moving = mag>0.06;
    if(player.moving){
      if(Math.abs(vx)>Math.abs(vy)) player.dir = vx<0?"left":"right";
      else player.dir = vy<0?"up":"down";
      const len=Math.hypot(vx,vy)||1;
      const sp=player.speed*dt*60*mag;
      const nx=player.x+vx/len*sp, ny=player.y+vy/len*sp;
      if(EN.freeAt(curRoom,nx,player.y)) player.x=nx;
      if(EN.freeAt(curRoom,player.x,ny)) player.y=ny;
    }
    // door check — entrance hitboxes (world px) from the editable layer
    const fxp=player.x, fyp=player.y-6;
    const doors = window.HITBOXES ? HITBOXES.doors(curRoom) : [];
    let door=null;
    for(const d of doors){ if(fxp>=d.x && fxp<d.x+d.w && fyp>=d.y && fyp<d.y+d.h){ door=d; break; } }
    if(!door){ doorGuard=false; }
    else if(!doorGuard){ enterRoom(door.to, curRoom); }
  }

  // ---------- transitions ----------
  function placeAtSpawn(roomKey, fromRoom){
    // Per-source spawn: arriving from a known room drops the player just inside
    // the carpet that leads back there (e.g. lounge<-gym = under the gym carpet).
    // Falls back to the room's single spawn for map travel / first load, and
    // rejects a derived spot that would land in a wall.
    let sp = (fromRoom && window.HITBOXES && HITBOXES.spawnFrom)
      ? HITBOXES.spawnFrom(roomKey, fromRoom) : null;
    if(sp && !EN.freeAt(roomKey, sp.x, sp.y)) sp = null;
    if(!sp) sp = window.HITBOXES ? HITBOXES.spawn(roomKey) : null;
    if(sp){ player.x=sp.x; player.y=sp.y; player.dir=sp.face||"down"; }
    else { const h=(W.ROOMS[roomKey].home)||[15,9]; player.x=h[0]*W.TS+16; player.y=h[1]*W.TS+W.TS-2; player.dir="down"; }
    player.moving=false;
  }
  function enterRoom(to, fromRoom){
    if(transitioning) return;
    if(intro){ intro=null; player.moving=false; } // never let the opening cinematic follow you into another room
    transitioning=true; paused=true;
    veil.classList.add("show");
    setTimeout(()=>{
      curRoom=to; ensureRoom(to);
      placeAtSpawn(to, fromRoom);
      doorGuard=true;
      showRoomLabel();
      if(window.EDITOR) EDITOR.setRoom(to);
      veil.classList.remove("show"); // phase IN
      setTimeout(()=>{ transitioning=false; paused=false; }, 440);
    }, 440);
  }
  function travelTo(to){
    if(to===curRoom) return;
    enterRoom(to);
  }

  function showRoomLabel(){
    roomLabel.querySelector(".rl-inner").textContent=W.ROOMS[curRoom].label;
    roomLabel.classList.add("show");
    clearTimeout(showRoomLabel._t);
    showRoomLabel._t=setTimeout(()=>roomLabel.classList.remove("show"),2200);
  }

  // ---------- sound ----------
  function toggleSound(btn){
    soundOn=!soundOn;
    if(btn) btn.classList.toggle("muted",!soundOn);
    if(window.MUSIC) MUSIC.setMuted(!soundOn); // mutes/unmutes the site-wide jukebox
  }

  // ---------- render ----------
  function camera(){
    const v=W.ROOMS[curRoom].view || {x:0,y:0,w:canvas.width,h:canvas.height};
    const s=Math.min(canvas.width/v.w, canvas.height/v.h);
    const ox=(canvas.width - v.w*s)/2, oy=(canvas.height - v.h*s)/2;
    return {s, ox, oy, vx:v.x, vy:v.y};
  }
  // convert a world point to canvas (screen) coords using current camera
  function worldToScreen(wx,wy){ const c=camera(); return { x:(wx-c.vx)*c.s+c.ox, y:(wy-c.vy)*c.s+c.oy }; }

  // ---------- opening cinematic ----------
  // First time the world loads, the player auto-walks slowly from the lounge
  // spawn down to about the room centre while the scene reveals from darkness
  // (a pool of light around the player, drifting motes, a brief letterbox),
  // then control is handed over. Runs once — start() only, never on re-entry.
  function startIntro(){
    intro={ sx:player.x, sy:player.y, ty:player.y+100, dur:2.8, t:0, motes:[] };
    for(let i=0;i<16;i++) intro.motes.push({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-0.5)*16, vy:-10-Math.random()*18,
      r:1.1+Math.random()*2.6, ph:Math.random()*6.283 });
    player.dir="down"; player.moving=true;
  }
  function stepIntro(dt){
    intro.t+=dt;
    const p=Math.min(1, intro.t/intro.dur);
    const e=-(Math.cos(Math.PI*p)-1)/2;                  // easeInOutSine — gentle start/stop
    player.x=intro.sx; player.y=intro.sy+(intro.ty-intro.sy)*e;
    player.dir="down"; player.moving=p<1;
    for(const m of intro.motes){ m.x+=m.vx*dt; m.y+=m.vy*dt;
      if(m.y<-6){ m.y=canvas.height+6; m.x=Math.random()*canvas.width; } }
    if(p>=1){ player.moving=false; intro=null; }
  }
  function drawIntro(){
    if(!intro) return;
    const p=Math.min(1, intro.t/intro.dur);
    const eo=1-(1-p)*(1-p);                              // easeOutQuad — reveal eases open
    const W2=canvas.width, H2=canvas.height;
    const ps=worldToScreen(player.x, player.y-16);
    ctx.save();
    // radial reveal — a pool of light around the player widens as the dark lifts
    const R=Math.max(46, (0.14+0.92*eo)*Math.hypot(W2,H2)*0.6);
    const dA=0.92*(1-eo);
    const g=ctx.createRadialGradient(ps.x,ps.y,R*0.32, ps.x,ps.y,R);
    g.addColorStop(0,"rgba(7,9,16,0)");
    g.addColorStop(0.72,"rgba(7,9,16,"+(dA*0.55).toFixed(3)+")");
    g.addColorStop(1,"rgba(7,9,16,"+dA.toFixed(3)+")");
    ctx.fillStyle=g; ctx.fillRect(0,0,W2,H2);
    // drifting light motes — bloom in, then settle out as the room appears
    const mA=Math.min(1,p/0.18)*(1-eo)*0.85;
    if(mA>0.01){ ctx.fillStyle="#ffe7ad";
      for(const m of intro.motes){ const tw=0.45+0.55*Math.sin(intro.t*3.3+m.ph);
        ctx.globalAlpha=mA*tw; ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,6.283); ctx.fill(); }
      ctx.globalAlpha=1;
    }
    // cinematic letterbox — slides in, holds, then retracts
    const bm=H2*0.08;
    const bar = p<0.12 ? bm*(p/0.12) : p>0.84 ? bm*Math.max(0,(1-p)/0.16) : bm;
    if(bar>0.5){ ctx.fillStyle="#06080e"; ctx.fillRect(0,0,W2,bar); ctx.fillRect(0,H2-bar,W2,bar); }
    ctx.restore();
  }

  // Stamp the current channel frame over the painted lounge TV. Only the bezel
  // sub-rect of each 96x64 cell is drawn, scaled to the TV body, so the navy
  // frames overlap exactly and the broadcast fills the screen.
  function drawTV(){
    const sheet=A.get(TV_CHANNELS[tvCh].key);
    if(!sheet||!sheet.complete||!sheet.naturalWidth) return;
    const f=Math.floor(tvAnimT*A.TV_FPS)%A.TV_FRAMES;
    ctx.drawImage(sheet, f*A.TV_FW+A.TV_SX, A.TV_SY, A.TV_SW, A.TV_SH,
                  TV_RECT.x, TV_RECT.y, TV_RECT.w, TV_RECT.h);
  }

  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const cam=camera();
    ctx.save();
    ctx.translate(cam.ox,cam.oy); ctx.scale(cam.s,cam.s); ctx.translate(-cam.vx,-cam.vy);
    const img=A.get(ROOM_IMG[curRoom]);
    if(img&&img.complete) ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const R=ensureRoom(curRoom);
    const top=A.get(TOP_IMG[curRoom]);
    const propsImg=A.get(PROPS_IMG[curRoom]);
    const depth = window.HITBOXES ? HITBOXES.depth(curRoom) : [];
    // gather drawables (npcs + player + depth objects) and sort by feet/base y
    const draw=[];
    R.npcs.forEach(n=>draw.push({y:n.y, fn:()=>{ S.drawShadow(ctx,n.x,n.y,28,1); S.drawChar(ctx,n.char,n.x,n.y+2,n.dir,n.moving,n.frame,1); }}));
    (R.pets||[]).forEach(p=>draw.push({y:p.y, fn:()=>{ S.drawShadow(ctx,p.x,p.y,p.w*0.92,1); S.drawPet(ctx,p.kind,p.x,p.y,p.state,p.frame,p.w,p.h); }}));
    // Animated jukebox speaker — cycles its 3 frames + a tiny amplitude bob
    // while the site-wide music is audible; sits at rest otherwise.
    (R.objs||[]).forEach(o=>{ if(o.sprite!=="speaker") return;
      draw.push({y:o.y, fn:()=>{
        const audible = window.MUSIC && MUSIC.isAudible();
        const fr  = audible ? Math.floor(musicAnimT*8) : 0;
        const lvl = audible && MUSIC.level ? MUSIC.level() : 0;
        const bob = audible ? Math.sin(performance.now()/110)*(0.5+lvl*1.6) : 0;
        const spkW = A.SPK_FW*SPK_SCALE;          // speaker's on-screen width
        S.drawShadow(ctx,o.x,o.y,spkW/0.84,1);    // ground shadow as wide as the sprite (drawShadow x-radius = w*0.42)
        S.drawSpeaker(ctx,o.x,o.y-bob,fr,SPK_SCALE);
      }});
    });
    draw.push({y:player.y, fn:()=>{ S.drawShadow(ctx,player.x,player.y,28,1); S.drawChar(ctx,player.char,player.x,player.y+2,player.dir,player.moving,player.frame,1); }});
    // Each depth box samples BOTH the props and top PNGs at its rectangle, then
    // y-sorts against the characters by baseY. Sampling both — instead of
    // branching on o.src — means a box occludes the player no matter which PNG
    // its art lives in, so a props object (e.g. the music-room harp) correctly
    // goes in front of / behind the player as its depth box dictates.
    depth.forEach(o=>{ draw.push({y:o.baseY, fn:()=>{
      if(propsImg&&propsImg.complete) ctx.drawImage(propsImg, o.x,o.y,o.w,o.h, o.x,o.y,o.w,o.h);
      if(top&&top.complete)           ctx.drawImage(top,      o.x,o.y,o.w,o.h, o.x,o.y,o.w,o.h);
    }}); });
    // Lounge TV: the live channel y-sorts at the TV console's depth line so the
    // player passes in front of it like the painted set; pushed after the depth
    // boxes so it lands over the (top-layer) screen the box just re-stamped.
    if(curRoom==="lounge" && tvCh>=0) draw.push({y:TV_RECT.baseY, fn:drawTV});
    draw.sort((a,b)=>a.y-b.y);
    draw.forEach(d=>d.fn());

    // Foreground (Top/top1/11) stays above everything EXCEPT where a depth box
    // already painted it y-sorted: clip out every depth-box rect so that art is
    // drawn once at its sorted depth, never re-stamped on top of the player.
    if(top&&top.complete){
      ctx.save();
      ctx.beginPath();
      ctx.rect(0,0,canvas.width,canvas.height);
      depth.forEach(o=>ctx.rect(o.x,o.y,o.w,o.h));
      ctx.clip("evenodd");
      ctx.drawImage(top,0,0,canvas.width,canvas.height);
      ctx.restore();
    }

    // ---- DEV hitbox + editor overlay (toggle with 'H') ----
    if(showHitboxes){
      const solids = window.HITBOXES ? HITBOXES.solids(curRoom) : [];
      ctx.lineWidth=1.5/cam.s;
      solids.forEach(r=>{ ctx.fillStyle="rgba(255,45,45,0.24)"; ctx.fillRect(r.x,r.y,r.w,r.h);
        ctx.strokeStyle="rgba(255,80,80,0.85)"; ctx.strokeRect(r.x,r.y,r.w,r.h); });
      depth.forEach(o=>{ ctx.fillStyle="rgba(60,140,255,0.14)"; ctx.fillRect(o.x,o.y,o.w,o.h);
        ctx.strokeStyle="rgba(90,165,255,0.85)"; ctx.strokeRect(o.x,o.y,o.w,o.h);
        ctx.strokeStyle="rgba(255,215,40,0.95)"; ctx.beginPath(); ctx.moveTo(o.x,o.baseY); ctx.lineTo(o.x+o.w,o.baseY); ctx.stroke(); });
      const fw=EN.FEET_W, fh=EN.FEET_H;
      ctx.lineWidth=2/cam.s;
      ctx.strokeStyle="#39ff14"; ctx.strokeRect(player.x-fw/2, player.y-fh, fw, fh);
      ctx.strokeStyle="#19d3ff"; R.npcs.forEach(n=>ctx.strokeRect(n.x-fw/2, n.y-fh, fw, fh));

      // entrance hitboxes (doors) + room label
      const doors = window.HITBOXES ? HITBOXES.doors(curRoom) : [];
      const RL={lounge:"LOUNGE",gym:"GYM",game:"GAME",music:"MUSIC"};
      ctx.lineWidth=1.5/cam.s;
      doors.forEach(d=>{ ctx.fillStyle="rgba(80,220,140,0.16)"; ctx.fillRect(d.x,d.y,d.w,d.h);
        ctx.strokeStyle="rgba(95,235,150,0.9)"; ctx.strokeRect(d.x,d.y,d.w,d.h);
        ctx.fillStyle="rgba(180,255,210,0.95)"; ctx.font="bold "+(10/cam.s)+"px monospace"; ctx.textAlign="center";
        ctx.fillText("\u2192 "+(RL[d.to]||d.to), d.x+d.w/2, d.y+d.h/2+(3.5/cam.s)); });
      ctx.textAlign="left";

      // spawn marker (where the player appears when entering this room)
      const sp = window.HITBOXES ? HITBOXES.spawn(curRoom) : null;
      if(sp){
        ctx.fillStyle="rgba(231,163,62,0.9)"; ctx.strokeStyle="#1c1206"; ctx.lineWidth=1.5/cam.s;
        ctx.beginPath(); ctx.arc(sp.x,sp.y,7/cam.s,0,7); ctx.fill(); ctx.stroke();
        // facing arrow
        const a={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[sp.face||"down"];
        const L0=8/cam.s, L1=15/cam.s;
        ctx.strokeStyle="#e7a33e"; ctx.lineWidth=2.5/cam.s;
        ctx.beginPath(); ctx.moveTo(sp.x+a[0]*L0,sp.y+a[1]*L0); ctx.lineTo(sp.x+a[0]*L1,sp.y+a[1]*L1); ctx.stroke();
        ctx.fillStyle="#e7a33e"; ctx.font="bold "+(8.5/cam.s)+"px monospace"; ctx.textAlign="center";
        ctx.fillText("SPAWN", sp.x, sp.y-11/cam.s); ctx.textAlign="left";
      }
      if(window.EDITOR && EDITOR.isEditing()) EDITOR.drawOverlay(ctx, cam);
    }

    // interaction marker above near target (still inside world transform)
    nearTarget = (!intro&&!paused&&!transitioning&&!DIALOGUE.isOpen()&&!anyOverlayOpen()) ? findNear() : null;
    if(nearTarget){ const t=nearTarget;
      const bob=Math.sin(performance.now()/240)*3;
      ctx.save(); ctx.globalAlpha=0.95;
      ctx.fillStyle="#e7a33e";
      const mYoff = t.kind==="npc" ? 66
                  : t.kind==="pet" ? (t.ref.h||30)+8
                  : (t.ref.markerY!=null ? t.ref.markerY      // object-defined float height (e.g. pool table)
                  : (t.ref.sprite==="speaker" ? 64 : 30));    // float above the speaker

      const mx=t.x, my=t.y-mYoff+bob;
      ctx.beginPath(); ctx.moveTo(mx-7,my); ctx.lineTo(mx+7,my); ctx.lineTo(mx,my+9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    if(showHitboxes){
      ctx.save();
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(8,8,196,24);
      ctx.fillStyle="#39ff14"; ctx.font="12px monospace";
      ctx.fillText("DEV HITBOXES ON \u2014 press H", 14, 24);
      ctx.restore();
    }
    // Channel-name flash above the TV when a channel is selected (screen space,
    // fades over its final 0.4s). Drawn outside the world transform for crisp text.
    if(curRoom==="lounge" && tvCh>=0 && tvLabelT>0){
      const p=worldToScreen(TV_RECT.x+TV_RECT.w/2, TV_RECT.y-5);
      const label="CH "+(tvCh+1)+"   "+TV_CHANNELS[tvCh].label;
      ctx.save();
      ctx.globalAlpha=Math.min(1, tvLabelT/0.4);
      ctx.font="14px 'Silkscreen', monospace"; ctx.textAlign="center"; ctx.textBaseline="alphabetic";
      const bw=ctx.measureText(label).width+18, bh=22, bx=p.x-bw/2, by=p.y-bh;
      ctx.fillStyle="rgba(16,19,28,0.88)"; ctx.fillRect(bx,by,bw,bh);
      ctx.fillStyle="#e7a33e"; ctx.fillRect(bx,by,bw,2);
      ctx.fillStyle="#f4ead6"; ctx.fillText(label, p.x, by+15);
      ctx.restore(); ctx.textAlign="left";
    }
    drawIntro();   // opening cinematic overlay (no-op once it has finished)
    updateHint();
  }
  function updateHint(){
    if(nearTarget){
      let txt="Talk";
      if(nearTarget.kind==="obj"){
        if(nearTarget.ref.type==="tv") txt = tvCh<0 ? "Turn on TV"
              : (tvCh>=TV_CHANNELS.length-1 ? "Turn off TV" : "Change channel");
        else txt=nearTarget.ref.hint||"Use";
      }
      else if(nearTarget.kind==="pet") txt=nearTarget.ref.hint||"Pet";
      else if(nearTarget.ref.interact==="chess") txt="Play chess";
      else if(nearTarget.ref.interact==="music") txt="Make a beat";
      else if(nearTarget.ref.interact==="workout") txt="Train with Gojo";
      else txt="Talk to "+(C.characters[nearTarget.ref.key]?.name||nearTarget.ref.name);
      hintEl.querySelector(".hint-text").textContent=txt;
      hintEl.classList.remove("hidden");
    } else hintEl.classList.add("hidden");
  }

  // ---------- loop ----------
  let lastFrameAt=0;
  function frame(ts){
    if(!running) return;
    lastFrameAt=performance.now();
    try{
      if(!lastTs) lastTs=ts;
      let dt=(ts-lastTs)/1000; if(dt>0.05) dt=0.05; lastTs=ts;
      // update
      if(!paused && !transitioning){
        if(intro) stepIntro(dt); else tryMove(dt);
        const R=ensureRoom(curRoom);
        R.npcs.forEach(n=>EN.stepNPC(n,curRoom,dt));
        (R.pets||[]).forEach(p=>EN.stepPet(p,dt));
      }
      // player animation
      player.animT += dt;
      player.frame = Math.floor(player.animT*(player.moving?9:3));
      musicAnimT += dt; // speaker animation runs regardless of pause (music is site-wide)
      tvAnimT += dt; if(tvLabelT>0) tvLabelT=Math.max(0,tvLabelT-dt); // TV plays + caption fades even while paused
      render();
      DIALOGUE.tick(ts);
    } catch(err){ console.error("frame error", err); }
    requestAnimationFrame(frame);
  }

  function start(){
    ensureRoom("lounge");
    placeAtSpawn("lounge");
    startIntro();   // play the opening cinematic on first load
    resize();
    bindInput();
    running=true; lastTs=0;
    showRoomLabel();
    try{ render(); }catch(e){ console.error(e); }
    requestAnimationFrame(frame);
    // safety: if RAF was suspended (tab backgrounded) and the chain stalled,
    // re-arm when visible again — but only if the loop is actually stale.
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden && running && performance.now()-lastFrameAt>250){
        lastTs=0; requestAnimationFrame(frame);
      }
    });
    // watchdog: if RAF hasn't ticked recently (suspended / dropped chain),
    // keep the world updating via a timer so state never gets stuck.
    // NOTE: do NOT reset lastTs here — frame() needs a real elapsed dt to move.
    setInterval(()=>{
      if(running && performance.now()-lastFrameAt>200){
        frame(performance.now());
      }
    },90);
  }

  return { start, resize, pause:(v)=>{paused=v;}, currentRoom:()=>curRoom,
           travelTo, toggleSound, isPaused:()=>paused, isIntro:()=>!!intro,
           toggleHitboxes:()=>{ setHitboxes(!showHitboxes); return showHitboxes; },
           setHitboxes,
           camera:()=>camera(),
           canvasEl:()=>canvas,
           screenToWorld:(clientX,clientY)=>{
             const rect=canvas.getBoundingClientRect();
             const cx=(clientX-rect.left)*(canvas.width/rect.width);
             const cy=(clientY-rect.top)*(canvas.height/rect.height);
             const c=camera();
             return { x:(cx-c.ox)/c.s + c.vx, y:(cy-c.oy)/c.s + c.vy };
           },
           _dbg:()=>({x:Math.round(player.x),y:Math.round(player.y),dir:player.dir,transitioning,paused,keys:Object.keys(keys).filter(k=>keys[k]),
             npcs:(rooms[curRoom]?rooms[curRoom].npcs.map(n=>({k:n.key,x:Math.round(n.x),y:Math.round(n.y)})):[]),
             pets:(rooms[curRoom]&&rooms[curRoom].pets?rooms[curRoom].pets.map(p=>({k:p.kind,state:p.state,frame:p.frame})):[])}),
           _tp:(x,y)=>{ player.x=x*W.TS+16; player.y=y*W.TS+30; } };
})();
