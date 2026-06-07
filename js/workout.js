/* ============================================================
   WORKOUT — Gym "Combo Trainer" (trainer: Gojo)
   Gojo calls punch combos; hit the arrow keys (or WASD / on-screen
   buttons) in order before the timer runs out. 8 quick combos.
   ============================================================ */
window.WORKOUT = (function(){
  const host=document.getElementById("activity");
  const inner=document.getElementById("activityInner");
  let raf=0, onClose=null;
  let phase="ready";                 // ready | play | done
  let combos=[], ci=0, mi=0;
  let comboTime=0, comboMax=0;
  let score=0, streak=0, best=+(localStorage.getItem("gymBest2")||0);
  let bag={ox:0,oy:0,vx:0,vy:0,shake:0}, sparks=[];
  let bctx=null, bagImg=null;
  let portT=0, talkUntil=0, bubble="", lastT=0;
  const TOTAL=8;
  const DIRS=["left","up","right","down"];
  const GLYPH={left:"◀",up:"▲",right:"▶",down:"▼"};
  const PUNCH={left:"Jab",up:"Uppercut",right:"Cross",down:"Body"};
  const LINES={
    intro:["Hands up. Follow my combos — eyes sharp.","Ryan's got fast hands. Let's see yours.","Listen for the combo, then let 'em fly."],
    good:["Sharp!","That's it!","Clean combo!","Beautiful hands!","Ryan would nod at that."],
    great:["UNREAL. Keep it up!","You're a machine!","Coach is impressed."],
    miss:["Nope — reset.","Sloppy! Again.","Eyes on the combo!","Dropped it."],
    timeout:["Too slow! Faster hands.","Tick tock. Move!"],
    endLow:["Rough round. Shake it off, again tomorrow.","Eh. Ryan started there too. Keep at it."],
    endMid:["Solid session. Real hands on you.","Not bad! You've got rhythm."],
    endHigh:["MONSTER session. New record!","Throughout heaven and earth… you alone hit clean.","That's championship work."]
  };
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  function say(t,d){ bubble=t; talkUntil=performance.now()+(d||2200); }

  function open(opts){
    onClose=opts&&opts.onClose;
    inner.innerHTML=shell();
    host.classList.remove("hidden");
    requestAnimationFrame(()=>host.classList.add("in"));
    document.getElementById("wkClose").onclick=close;
    document.getElementById("wkStart").onclick=start;
    bagImg=new Image(); bagImg.src="assets/ui/heavybag.png";
    bctx=document.getElementById("wkBag").getContext("2d"); bctx.imageSmoothingEnabled=false;
    wireInput();
    phase="ready"; portT=0; score=0; streak=0;
    say(pick(LINES.intro),3400);
    renderCombo();
    loop();
  }
  function close(){
    host.classList.remove("in");
    setTimeout(()=>{host.classList.add("hidden");inner.innerHTML="";},350);
    cancelAnimationFrame(raf); raf=0;
    window.removeEventListener("keydown",onKey);
    const fn=onClose; if(fn) fn();
  }

  function shell(){
    return `<div class="wk-wrap">
      <button class="chess-x" id="wkClose">✕</button>
      <div class="wk-left" id="wkLeft">
        <canvas id="wkBag" width="220" height="260"></canvas>
      </div>
      <div class="wk-right">
        <div class="drod-card">
          <div class="drod-port"><canvas id="wkPort" width="92" height="92"></canvas></div>
          <div class="drod-meta"><div class="drod-name">GOJO</div><div class="drod-sub" id="wkSub">your trainer</div></div>
        </div>
        <div class="drod-bubble" id="wkBubble"></div>
        <div class="wk-combo-box">
          <div class="wk-combo-head"><span id="wkComboName">Get ready…</span><span class="wk-combo-count" id="wkCount">0/${TOTAL}</span></div>
          <div class="wk-arrows" id="wkArrows"></div>
          <div class="wk-cdwrap"><div class="wk-cd" id="wkCd"></div></div>
        </div>
        <div class="wk-stats">
          <div class="wk-stat"><span class="wk-k">Score</span><b id="wkScore">0</b></div>
          <div class="wk-stat"><span class="wk-k">Streak</span><b id="wkStreak">0</b></div>
          <div class="wk-stat"><span class="wk-k">Best</span><b id="wkBest">${best}</b></div>
        </div>
        <button class="ctl-btn" id="wkStart">▶ Start training</button>
        <div class="wk-dpad" id="wkDpad">
          <button data-d="up">▲</button><div class="wk-dmid"><button data-d="left">◀</button><button data-d="right">▶</button></div><button data-d="down">▼</button>
        </div>
      </div>
    </div>`;
  }

  function start(){
    score=0; streak=0; ci=0; phase="play";
    combos=[];
    for(let i=0;i<TOTAL;i++){
      const len=3+Math.floor(i/3);                 // 3,3,3,4,4,4,5,5
      const seq=[]; for(let j=0;j<len;j++) seq.push(DIRS[Math.floor(Math.random()*4)]);
      combos.push(seq);
    }
    document.getElementById("wkStart").style.display="none";
    document.getElementById("wkScore").textContent="0";
    document.getElementById("wkStreak").textContent="0";
    loadCombo(0);
    say("Here we go — combo one!",1600);
  }

  function loadCombo(i){
    ci=i; mi=0;
    comboMax=Math.max(1.5, 2.8 - i*0.13);
    comboTime=comboMax;
    document.getElementById("wkComboName").textContent="Combo "+(i+1)+" — follow Gojo!";
    document.getElementById("wkCount").textContent=(i+1)+"/"+TOTAL;
    renderCombo();
  }

  function renderCombo(){
    const wrap=document.getElementById("wkArrows"); if(!wrap) return;
    if(phase!=="play"||!combos[ci]){ wrap.innerHTML=""; return; }
    wrap.innerHTML=combos[ci].map((d,i)=>{
      const cls = i<mi?"done":(i===mi?"active":"");
      return `<span class="wk-arrow ${cls} a-${d}">${GLYPH[d]}</span>`;
    }).join("");
  }

  function hit(dir){
    if(phase!=="play") return;
    const seq=combos[ci]; if(!seq) return;
    if(dir===seq[mi]){
      shoveBag(dir); addSpark(dir); popWord();
      mi++;
      if(mi>=seq.length){ comboDone(true); }
      else renderCombo();
    } else {
      bag.shake=0.5; comboFail("miss");
    }
  }

  function comboDone(success){
    if(success){
      const timeBonus=Math.round(comboTime*22);
      const base=combos[ci].length*14;
      streak++;
      const sb=streak>=3?streak*8:0;
      score += base+timeBonus+sb;
      document.getElementById("wkScore").textContent=score;
      document.getElementById("wkStreak").textContent=streak;
      if(streak>=4 && Math.random()<0.6) say(pick(LINES.great),1500);
      else if(Math.random()<0.5) say(pick(LINES.good),1300);
      flashBox("ok");
    }
    next();
  }
  function comboFail(reason){
    streak=0; document.getElementById("wkStreak").textContent="0";
    say(pick(reason==="timeout"?LINES.timeout:LINES.miss),1500);
    flashBox("bad");
    next();
  }
  function next(){
    if(ci+1>=TOTAL){ endRound(); return; }
    phase="gap";
    const nextI=ci+1;
    setTimeout(()=>{ if(phase==="gap"){ phase="play"; loadCombo(nextI); } }, 360);
  }
  function flashBox(kind){
    const b=document.querySelector(".wk-combo-box"); if(!b)return;
    b.classList.remove("ok","bad"); void b.offsetWidth; b.classList.add(kind);
  }

  function endRound(){
    phase="done";
    document.getElementById("wkArrows").innerHTML="";
    document.getElementById("wkComboName").textContent="Round complete!";
    const btn=document.getElementById("wkStart"); btn.style.display=""; btn.textContent="▶ Train again";
    let line;
    if(score>best){ best=score; localStorage.setItem("gymBest2",best); document.getElementById("wkBest").textContent=best; line=pick(LINES.endHigh); }
    else if(score>=300) line=pick(LINES.endMid);
    else line=pick(LINES.endLow);
    say(score+" pts. "+line, 5200);
  }

  // ---- bag physics + fx ----
  // 2D impulse model: punches shove the bag in their direction; it springs back.
  function shoveBag(dir){
    if(dir==="left")  bag.vx += 7.5;   // jab from left -> bag flies right
    else if(dir==="right") bag.vx -= 7.5;
    else if(dir==="up")  bag.vy -= 8.5; // uppercut -> lifts up
    else if(dir==="down") bag.vy += 7.5; // body shot -> drives down
    bag.shake=Math.min(1,bag.shake+0.5);
  }
  function addSpark(dir){
    const cx=110, cy=150;
    const ox = dir==="left"?-26:dir==="right"?26:0;
    const oy = dir==="up"?-34:dir==="down"?34:0;
    for(let i=0;i<10;i++) sparks.push({x:cx+ox,y:cy+oy,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,life:1});
  }

  // comic "POW!" burst over the bag on a clean hit
  const WORDS=["POW","BAM","BOOM","WHAM","KAPOW","SMACK","BIFF","KO!"];
  function popWord(){
    const stage=document.getElementById("wkLeft"); if(!stage) return;
    const el=document.createElement("div");
    el.className="wk-pop";
    el.textContent = streak>=4 ? (Math.random()<0.5?"KAPOW":"BOOM") : WORDS[Math.floor(Math.random()*WORDS.length)];
    const rot=(Math.random()*24-12);
    el.style.left=(28+Math.random()*44)+"%";
    el.style.top=(24+Math.random()*40)+"%";
    el.style.setProperty("--rot", rot+"deg");
    stage.appendChild(el);
    setTimeout(()=>el.remove(), 620);
  }

  function drawBag(dt){
    if(!bctx) return;
    const W=220,H=260;
    bctx.clearRect(0,0,W,H);
    // spring physics on 2D offset
    bag.vx += -bag.ox*0.22; bag.vx*=0.88; bag.ox += bag.vx*dt*60*0.4;
    bag.vy += -bag.oy*0.22; bag.vy*=0.88; bag.oy += bag.vy*dt*60*0.4;
    bag.shake=Math.max(0,bag.shake-dt*3);
    const ang = bag.ox*0.010;                 // lean from horizontal push (around mount)
    const lift = Math.min(0, bag.oy*0.5);     // uppercut lifts up only
    const squashY = 1 + Math.max(-0.18, Math.min(0.18, bag.oy*0.004)); // body shot squashes
    const sxJit=(Math.random()-0.5)*bag.shake*5;
    bctx.fillStyle="rgba(0,0,0,0.3)";
    bctx.beginPath(); bctx.ellipse(110+bag.ox*0.4,236,38,9,0,0,7); bctx.fill();
    if(bagImg&&bagImg.complete&&bagImg.naturalWidth){
      const scale=4, bw=26*scale, bh=46*scale;          // 104x184
      const topX=110, topY=18;
      bctx.save();
      bctx.translate(topX+sxJit, topY+lift);
      bctx.rotate(ang);
      bctx.scale(1, squashY);
      bctx.imageSmoothingEnabled=false;
      bctx.drawImage(bagImg, -bw/2, 0, bw, bh);
      bctx.restore();
    }
    // sparks
    for(const s of sparks){ s.x+=s.vx; s.y+=s.vy; s.life-=dt*2.2;
      if(s.life>0){ bctx.fillStyle=`rgba(231,200,90,${s.life})`; const r=Math.ceil(s.life*4); bctx.fillRect(s.x-r/2,s.y-r/2,r,r); } }
    sparks=sparks.filter(s=>s.life>0);
  }

  // ---- input ----
  function onKey(e){
    const m={arrowleft:"left",a:"left",arrowup:"up",w:"up",arrowright:"right",d:"right",arrowdown:"down",s:"down"};
    const d=m[e.key.toLowerCase()];
    if(d){ e.preventDefault(); hit(d); }
  }
  function wireInput(){
    window.addEventListener("keydown",onKey);
    document.querySelectorAll("#wkDpad button").forEach(b=>{
      b.onclick=()=>hit(b.getAttribute("data-d"));
    });
  }

  function loop(){
    try{
      const now=performance.now();
      if(!lastT) lastT=now; const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
      // combo timer
      if(phase==="play" && combos[ci]){
        comboTime-=dt;
        const cd=document.getElementById("wkCd"); if(cd){ cd.style.width=Math.max(0,comboTime/comboMax*100)+"%"; cd.style.background=comboTime<comboMax*0.33?"#b5442f":"linear-gradient(90deg,#c98a36,#e0a64a)"; }
        if(comboTime<=0){ comboFail("timeout"); }
      }
      drawBag(dt);
      // portrait
      portT+=dt; const talking=now<talkUntil;
      const f=Math.floor(portT*(talking?13:5));
      const pc=document.getElementById("wkPort"); if(pc) SPRITES.drawPortraitFrame(pc.getContext("2d"),"port_Gojo",talking?f:0,92,92);
      const bub=document.getElementById("wkBubble"); if(bub){ const show=now<talkUntil&&bubble; bub.textContent=show?bubble:""; bub.classList.toggle("show",!!show); }
    }catch(err){ console.error("workout loop",err); }
    raf=requestAnimationFrame(loop);
  }

  return { open, close, isOpen:()=>!host.classList.contains("hidden") };
})();
