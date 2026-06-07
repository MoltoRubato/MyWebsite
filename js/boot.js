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

  // ambient walkers for the loading scene
  const walkers=[
    {char:"char_Player",x:0.30,dir:"right",ph:0,row:11},
    {char:"char_Dino",  x:0.62,dir:"left", ph:2,row:9},
    {char:"char_Alex",  x:0.80,dir:"down", ph:4,row:7}
  ];

  let ready=false, entered=false, t0=performance.now();

  function drawScene(now){
    const W=lc.width, H=lc.height;
    lctx.clearRect(0,0,W,H);
    const room=A.get("room_lounge");
    if(room&&room.complete){
      // cover-fit the room, slow ken-burns pan
      const ar=room.width/room.height;
      let dw=W, dh=W/ar; if(dh<H){ dh=H; dw=H*ar; }
      const pan=Math.sin(now/4000)*20;
      const ox=(W-dw)/2+pan, oy=(H-dh)/2;
      lctx.drawImage(room,ox,oy,dw,dh);
      // scale factor from room px to screen
      const sx=dw/room.width, sy=dh/room.height;
      // walking sprites along a path
      walkers.forEach(w=>{
        const t=(now/3200 + w.ph)%1;
        const tx = w.dir==="left" ? (1-t) : t;
        const px = ox + (4 + tx*22)*32*sx; // travel cols 4..26
        const py = oy + (w.row+1)*32*sy;
        const moving=true;
        const frame=Math.floor(now/110 + w.ph*4);
        S.drawShadow(lctx,px,py,28,sx*1.0);
        S.drawChar(lctx,w.char,px,py,w.dir,moving,frame,sx);
      });
    } else {
      lctx.fillStyle="#0c1018"; lctx.fillRect(0,0,W,H);
    }
    // subtle vignette handled by overlay CSS
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
