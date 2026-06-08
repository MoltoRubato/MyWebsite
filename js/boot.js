/* ============================================================
   BOOT — animated loading screen, then start the world
   ============================================================ */
(function(){
  const A=window.ASSETS, S=window.SPRITES;
  const loader=document.getElementById("loader");
  const lc=document.getElementById("loadCanvas"), lctx=lc.getContext("2d");
  lctx.imageSmoothingEnabled=false;
  const fill=document.getElementById("loadFill");
  const statusEl=document.getElementById("loadStatus");
  const enterBtn=document.getElementById("loadEnter");

  // fit loader canvas to viewport
  function sizeLoader(){
    lc.width=Math.floor(window.innerWidth);
    lc.height=Math.floor(window.innerHeight);
    lctx.imageSmoothingEnabled=false;
  }
  sizeLoader(); window.addEventListener("resize",sizeLoader);

  let ready=false, entered=false, t0=performance.now();

  /* ---- Intro composition: "Lineup" with spotlight lighting -------------
     Characters stand in place (idle), so nothing ever walks off-frame.
     dx offsets are fractions of screen width; gyf is the feet ground line. */
  const INTRO={ gyf:0.605, baseDiv:168,
    cast:[
      {char:"char_Dino",   dx:-0.165, dir:"right", scale:0.82, ph:1.7},
      {char:"char_Alex",   dx: 0.165, dir:"left",  scale:0.82, ph:3.1},
      {char:"char_Player", dx: 0.000, dir:"down",  scale:1.00, ph:0.0}
    ]};

  function drawScene(now){
    const W=lc.width, H=lc.height, P=INTRO;
    lctx.clearRect(0,0,W,H);
    const room=A.get("room_lounge");
    if(room&&room.complete){
      // cover-fit the room, slow ken-burns pan
      const ar=room.width/room.height;
      let dw=W, dh=W/ar; if(dh<H){ dh=H; dw=H*ar; }
      const pan=Math.sin(now/4000)*20;
      const ox=(W-dw)/2+pan, oy=(H-dh)/2;
      lctx.drawImage(room,ox,oy,dw,dh);
      // spotlight lighting — radial pool centered on the cast, edges fall to dark
      const g=lctx.createRadialGradient(W/2,H*0.46,H*0.05,W/2,H*0.52,H*0.66);
      g.addColorStop(0,"rgba(7,9,16,0)");
      g.addColorStop(1,"rgba(7,9,16,0.84)");
      lctx.fillStyle=g;
      lctx.fillRect(0,0,W,H);
      // standing cast — idle animation, gentle breathing bob, never moves in x
      const base=Math.max(2.4, H/P.baseDiv);
      const gy=H*P.gyf;
      P.cast.forEach(c=>{
        const s=base*c.scale;
        const cx=W/2 + c.dx*W;
        const bob=Math.sin(now/620 + c.ph)*2.2*c.scale;
        const cy=gy + bob;
        const frame=Math.floor(now/170 + c.ph*3);
        lctx.globalAlpha = c.scale<1 ? 0.92 : 1;
        S.drawShadow(lctx,cx,gy,28,s*1.0);
        S.drawChar(lctx,c.char,cx,cy,c.dir,false,frame,s);
        lctx.globalAlpha = 1;
      });
    } else {
      lctx.fillStyle="#0c1018"; lctx.fillRect(0,0,W,H);
    }
  }

  function loop(now){
    drawScene(now);
    // progress
    const p=A.progress();
    fill.style.width=Math.floor(Math.max(p, (now-t0)/2500*0.6)*100)+"%";
    if(!ready && p>=1 && now-t0>900){
      ready=true;
      fill.style.width="100%";
      statusEl.textContent="READY";
      enterBtn.classList.remove("hidden");
    }
    if(!entered) requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // status flavor text
  const flavor=["LOADING…","WAKING THE NPCS…","DUSTING THE CHESS BOARD…","TUNING THE STUDIO…","WARMING UP THE GYM…"];
  let fi=0;
  const flavorTimer=setInterval(()=>{ if(ready){clearInterval(flavorTimer);return;} fi=(fi+1)%flavor.length; statusEl.textContent=flavor[fi]; },1100);

  function enterWorld(){
    if(entered) return; entered=true;
    clearInterval(flavorTimer);
    loader.classList.add("out");
    HEADER.init(); HEADER.reveal();
    GAME.start();
    setTimeout(()=>{ loader.classList.add("hidden"); }, 650);
  }
  enterBtn.addEventListener("click",enterWorld);
  // allow Enter key to start once ready
  window.addEventListener("keydown",(e)=>{ if(ready && !entered && (e.key==="Enter"||e.key===" ")) enterWorld(); });

  // safety: if assets stall, allow entry after 6s
  setTimeout(()=>{ if(!ready){ ready=true; fill.style.width="100%"; statusEl.textContent="READY"; enterBtn.classList.remove("hidden"); } },6000);
})();
