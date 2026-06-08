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

  let player=EN.makePlayer();
  let curRoom="lounge";
  let rooms={}; // built lazily per room
  let keys={};
  let paused=false, transitioning=false, running=false;
  let nearTarget=null; // {kind, ref}
  let doorGuard=null;  // tile string to ignore until stepped off
  let lastTs=0;
  let soundOn=true, ambientAudio=null;
  let showHitboxes=/[?&]dev=1\b/.test(location.search); // DEV: collision overlay (press 'H' or ?dev=1)

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
      if(DIALOGUE.isOpen()){ if(k==="enter"||k===" "){ DIALOGUE.advance(); } return; }
      if(anyOverlayOpen()) return;
      keys[k]=true;
      if(k==="enter"||k==="e"){ interact(); }
      if(k==="m"){ HEADER.openMap(); }
      if(k==="h"){ setHitboxes(!showHitboxes); }
    });
    window.addEventListener("keyup",(e)=>{ keys[e.key.toLowerCase()]=false; });
    // touch dpad
    const tmap={up:"arrowup",down:"arrowdown",left:"arrowleft",right:"arrowright"};
    document.querySelectorAll("#dpad .db").forEach(b=>{
      const key=tmap[b.dataset.key];
      const on=(e)=>{e.preventDefault();keys[key]=true;}, off=(e)=>{e.preventDefault();keys[key]=false;};
      b.addEventListener("touchstart",on,{passive:false}); b.addEventListener("touchend",off);
      b.addEventListener("mousedown",on); b.addEventListener("mouseup",off); b.addEventListener("mouseleave",off);
    });
    const act=document.getElementById("actBtn");
    act.addEventListener("touchstart",(e)=>{e.preventDefault(); if(DIALOGUE.isOpen())DIALOGUE.advance(); else interact();});
    act.addEventListener("click",()=>{ if(DIALOGUE.isOpen())DIALOGUE.advance(); else interact();});
    if(("ontouchstart" in window)||navigator.maxTouchPoints>0) document.body.classList.add("touch");
  }
  function anyOverlayOpen(){ return CHESS.isOpen()||MUSIC.isOpen()||(window.WORKOUT&&WORKOUT.isOpen())||
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
    if(transitioning||paused) return;
    const near=findNear();
    if(!near) return;
    if(near.kind==="npc") talkTo(near.ref);
    else if(near.kind==="pet") EN.petStart(near.ref);
    else if(near.kind==="obj" && near.ref.type==="music") openMusic();
  }
  function talkTo(npc){
    const data=C.characters[npc.key];
    if(!data){ return; }
    // face the player
    const dx=player.x-npc.x, dy=player.y-npc.y;
    npc.watchDir = Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
    const opts={ charKey:npc.key, name:data.name, color:data.color, lines:data.lines.slice() };
    if(npc.interact==="chess"){
      opts.choices=[{label:"♟ Play a game",value:"chess"},{label:"Maybe later",value:"no"}];
      opts.onChoice=(v)=>{ if(v==="chess") openChess(); };
    } else if(npc.interact==="music"){
      opts.choices=[{label:"🎵 Open the studio",value:"music"},{label:"Just vibing",value:"no"}];
      opts.onChoice=(v)=>{ if(v==="music") openMusic(); };
    } else if(npc.interact==="workout"){
      opts.choices=[{label:"🥊 Hit the bag",value:"workout"},{label:"Just stretching",value:"no"}];
      opts.onChoice=(v)=>{ if(v==="workout") openWorkout(); };
    }
    DIALOGUE.start(opts);
  }

  function openChess(){ paused=true; CHESS.open({onClose:()=>{paused=false;}}); }
  function openMusic(){ paused=true; MUSIC.open({onClose:()=>{paused=false;}}); }
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
    player.moving = (vx||vy)!==0;
    if(player.moving){
      if(Math.abs(vx)>Math.abs(vy)) player.dir = vx<0?"left":"right";
      else player.dir = vy<0?"up":"down";
      const len=Math.hypot(vx,vy)||1;
      const sp=player.speed*dt*60;
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
    if(!soundOn){ if(ambientAudio) ambientAudio.pause(); }
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
    nearTarget = (!paused&&!transitioning&&!DIALOGUE.isOpen()&&!anyOverlayOpen()) ? findNear() : null;
    if(nearTarget){ const t=nearTarget;
      const bob=Math.sin(performance.now()/240)*3;
      ctx.save(); ctx.globalAlpha=0.95;
      ctx.fillStyle="#e7a33e";
      const mYoff = t.kind==="npc" ? 66 : (t.kind==="pet" ? (t.ref.h||30)+8 : 30);
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
    updateHint();
  }
  function updateHint(){
    if(nearTarget){
      let txt="Talk";
      if(nearTarget.kind==="obj") txt=nearTarget.ref.hint||"Use";
      else if(nearTarget.kind==="pet") txt=nearTarget.ref.hint||"Pet";
      else if(nearTarget.ref.interact==="chess") txt="Play chess";
      else if(nearTarget.ref.interact==="music") txt="Open studio";
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
        tryMove(dt);
        const R=ensureRoom(curRoom);
        R.npcs.forEach(n=>EN.stepNPC(n,curRoom,dt));
        (R.pets||[]).forEach(p=>EN.stepPet(p,dt));
      }
      // player animation
      player.animT += dt;
      player.frame = Math.floor(player.animT*(player.moving?9:3));
      render();
      DIALOGUE.tick(ts);
    } catch(err){ console.error("frame error", err); }
    requestAnimationFrame(frame);
  }

  function start(){
    ensureRoom("lounge");
    placeAtSpawn("lounge");
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
           travelTo, toggleSound, isPaused:()=>paused,
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
