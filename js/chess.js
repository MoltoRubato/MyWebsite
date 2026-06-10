/* ============================================================
   CHESS UI — board, pieces, Drod portrait, difficulty + banter.
   Play as White / Black / Random, choose your promotion piece,
   and face real Stockfish (WASM) — with the from-scratch engine
   as an offline fallback.
   ============================================================ */
window.CHESS = (function(){
  const E = window.CHESSENGINE;
  const SF = window.SFENGINE;
  const host = document.getElementById("activity");
  const inner = document.getElementById("activityInner");
  const SC=3, SQ=16*SC, BORDER=7*SC, BOARD=142*SC; // 426

  const PCOL={P:0,N:1,R:2,B:3,Q:4,K:5};

  const LEVELS={
    chill:  { name:"Chill",  depth:1, rand:0.55, sf:{skill:0,  movetime:150},  label:"just for fun" },
    normal: { name:"Normal", depth:2, rand:0.12, sf:{skill:5,  movetime:260},  label:"he's paying attention" },
    sweat:  { name:"Sweat",  depth:3, rand:0.02, sf:{skill:12, movetime:520},  label:"he's actually trying" },
    brutal: { name:"Brutal", depth:3, rand:0,    sf:{skill:20, movetime:1100}, label:"no mercy" }
  };
  const LINES={
    intro:{
      chill:["Chill mode? Alright, relax — let's just push some wood.","No pressure. I'll even let you take stuff back. ...maybe."],
      normal:["Normal it is. I'm paying attention now.","Don't hang your queen and we'll have a real game."],
      sweat:["Hmm, you want me to actually try, don't you.","Fine. No more Mr. Nice Drod. Let's go."],
      brutal:["Brutal mode. I stopped pretending to be nice three calculations ago.","You asked for the real engine. Don't say I didn't warn you."]
    },
    playerCap:["Ouch. Okay, okay.","You saw that, huh.","Lucky.","Hey! I was using that."],
    aiCap:["Mine now.","Thank you very much.","Snack.","That was free."],
    check:["Check. Wake up.","Tick tock — your king's exposed.","Check! Feeling it yet?"],
    inCheck:["Uh oh, that's check on ME. Cute.","You got me sweating. Briefly."],
    win:["GG. Ryan built me too well, huh?","Better luck next round.","Don't worry, I do this professionally."],
    lose:["...okay that was actually good. Respect.","You win. I demand a rematch.","Fine! You're better than the README said."],
    draw:["A draw. Diplomatic of us.","Stalemate. Nobody wins, everybody thinks."],
    idle:["Take your time. I've got nothing but time.","You good over there?","I can hear you thinking.","Ryan watches these games, you know."]
  };

  let state, sel=-1, legal=[], lastMove=null, level=LEVELS.normal;
  let raf=0, portFrame=0, portT=0, talkUntil=0, bubble="", thinking=false, lastT=0;
  let over=false, capByPlayer=[], capByAI=[], onClose=null;
  let bctx;
  // colour / orientation
  let chosenColor="w", playerColor="w", aiColor="b", flip=false;
  let promoPending=false;

  function say(txt, dur){ bubble=txt; talkUntil=performance.now()+(dur||2600); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  const levelKey=()=> Object.keys(LEVELS).find(k=>LEVELS[k]===level);
  // board index -> on-screen row / col (rotated 180° when the player is Black)
  const scr=i=> flip ? 7-E.rank(i) : E.rank(i);
  const scf=i=> flip ? 7-E.file(i) : E.file(i);

  function open(opts){
    onClose = opts && opts.onClose;
    inner.innerHTML = shell();
    host.classList.remove("hidden");
    requestAnimationFrame(()=>host.classList.add("in"));
    bctx = document.getElementById("cbBoard").getContext("2d");
    bctx.imageSmoothingEnabled=false;
    wireDifficulty();
    portFrame=0; portT=0; bubble=""; thinking=false; lastT=0; promoPending=false;
    showDifficulty(true);
    // boot Stockfish early so it's ready by the first AI move; reflect status
    if(SF){ SF.init().then(ok=>{ const el=document.getElementById("cbEngine");
      if(el) el.textContent = ok ? "♟ Powered by Stockfish" : "♟ Drod's home-brew engine"; }); }
    loop();
  }

  function close(){
    host.classList.remove("in");
    setTimeout(()=>{ host.classList.add("hidden"); inner.innerHTML=""; }, 350);
    cancelAnimationFrame(raf); raf=0;
    const fn=onClose; if(fn) fn();
  }

  function shell(){
    return `<div class="chess-wrap">
      <div class="chess-left">
        <div class="cb-frame"><canvas id="cbBoard" width="${BOARD}" height="${BOARD}"></canvas>
          <div id="cbOver" class="cb-over hidden"></div>
        </div>
        <div class="cb-status" id="cbStatus">Choose a difficulty</div>
      </div>
      <div class="chess-right">
        <button class="chess-x" id="cbClose">✕</button>
        <div class="drod-card">
          <div class="drod-port"><canvas id="cbPort" width="96" height="96"></canvas></div>
          <div class="drod-meta"><div class="drod-name">DROD</div><div class="drod-sub" id="cbLevel">the resident champ</div></div>
        </div>
        <div class="drod-bubble" id="cbBubble"></div>
        <div class="chess-diff" id="cbDiff">
          <div class="diff-title">Play as</div>
          <div class="chess-colors" id="cbColors">
            <button class="col-btn active" data-col="w"><span class="col-dot w"></span>White</button>
            <button class="col-btn" data-col="b"><span class="col-dot b"></span>Black</button>
            <button class="col-btn" data-col="r"><span class="col-dot r"></span>Random</button>
          </div>
          <div class="diff-title">Difficulty</div>
          ${Object.entries(LEVELS).map(([k,v])=>`<button class="diff-btn" data-lv="${k}"><b>${v.name}</b><small>${v.label}</small></button>`).join("")}
          <div class="chess-engine" id="cbEngine"></div>
        </div>
        <div class="chess-controls hidden" id="cbControls">
          <div class="cap-row"><span class="cap-lbl">You took</span><div class="cap-list" id="capW"></div></div>
          <div class="cap-row"><span class="cap-lbl">Drod took</span><div class="cap-list" id="capB"></div></div>
          <div class="ctl-btns">
            <button class="ctl-btn" id="cbNew">New game</button>
            <button class="ctl-btn ghost" id="cbResign">Resign</button>
          </div>
        </div>
        <div class="chess-tip" id="cbTip">Click a piece, then a square · pick your colour above</div>
      </div>
    </div>`;
  }

  function wireDifficulty(){
    document.getElementById("cbClose").onclick=close;
    inner.querySelectorAll("#cbColors .col-btn").forEach(b=>{
      b.onclick=()=>{ chosenColor=b.getAttribute("data-col");
        inner.querySelectorAll("#cbColors .col-btn").forEach(x=>x.classList.toggle("active",x===b)); };
    });
    inner.querySelectorAll(".diff-btn").forEach(b=>{
      b.onclick=()=>{ level=LEVELS[b.getAttribute("data-lv")]; startGame(); };
    });
  }
  function showDifficulty(show){
    document.getElementById("cbDiff").classList.toggle("hidden",!show);
    document.getElementById("cbControls").classList.toggle("hidden",show);
    // no Drod banter on the selection screen — collapse the bubble so there's
    // no empty gap under his portrait (it only reserves space during play)
    const bub=document.getElementById("cbBubble"); if(bub) bub.classList.toggle("no-slot",show);
  }

  function startGame(){
    // resolve colour (random picks a side)
    playerColor = chosenColor==="r" ? (Math.random()<0.5?"w":"b") : chosenColor;
    aiColor = playerColor==="w" ? "b" : "w";
    flip = (playerColor==="b");
    state=E.initialState(); sel=-1; legal=[]; lastMove=null; over=false; promoPending=false;
    capByPlayer=[]; capByAI=[]; renderCaps();
    hidePromo();
    if(SF) SF.newGame();
    document.getElementById("cbLevel").textContent = level.name+" — "+level.label;
    const tip=document.getElementById("cbTip");
    if(tip) tip.textContent = "Click a piece, then a square · you play "+(playerColor==="w"?"White":"Black");
    showDifficulty(false);
    say(pick(LINES.intro[levelKey()]), 3600);
    document.getElementById("cbBoard").onclick = onBoardClick;
    document.getElementById("cbNew").onclick = ()=>{ showDifficulty(true); setStatus("Choose a difficulty"); state=null; sel=-1; legal=[]; lastMove=null; over=false; hidePromo(); };
    document.getElementById("cbResign").onclick = ()=>{ if(state&&!over){ over=true; setStatus("You resigned."); say(pick(LINES.win),4000); } };
    if(state.turn===playerColor){ setStatus("Your move."); }
    else { setStatus("Drod opens — he's "+(aiColor==="w"?"White":"Black")+"."); thinkAndMove(); }
  }

  function setStatus(t){ const s=document.getElementById("cbStatus"); if(s) s.textContent=t; }

  function squareFromXY(mx,my){
    const sf=Math.floor((mx-BORDER)/SQ), sr=Math.floor((my-BORDER)/SQ);
    if(sf<0||sf>7||sr<0||sr>7) return -1;
    const f=flip?7-sf:sf, r=flip?7-sr:sr;
    return r*8+f;
  }

  function onBoardClick(e){
    if(!state || over || thinking || promoPending || state.turn!==playerColor) return;
    const rect=e.target.getBoundingClientRect();
    const scaleX=BOARD/rect.width, scaleY=BOARD/rect.height;
    const sq=squareFromXY((e.clientX-rect.left)*scaleX,(e.clientY-rect.top)*scaleY);
    if(sq<0) return;
    const p=state.b[sq];
    if(sel===-1){
      if(p!=="."&&E.colorOf(p)===playerColor){ sel=sq; legal=E.legalMoves(state).filter(m=>m.from===sq); }
    } else {
      const mv=legal.find(m=>m.to===sq);
      if(mv){
        sel=-1; legal=[];
        if(mv.promo){ askPromotion(playerColor, (choice)=>{ if(!over) doMove(Object.assign({},mv,{promo:choice}),"player"); }); }
        else doMove(mv,"player");
      }
      else if(p!=="."&&E.colorOf(p)===playerColor){ sel=sq; legal=E.legalMoves(state).filter(m=>m.from===sq); }
      else { sel=-1; legal=[]; }
    }
  }

  function doMove(mv,who){               // who: "player" | "ai"
    if(mv.cap!=="."){ (who==="player"?capByPlayer:capByAI).push(mv.cap); renderCaps(); }
    state=E.apply(state,mv); lastMove={from:mv.from,to:mv.to};
    if(mv.cap!=="."){ say(pick(who==="player"?LINES.playerCap:LINES.aiCap), 2200); }
    const st=E.status(state);
    if(st==="checkmate"){ over=true;
      if(state.turn===aiColor){ setStatus("Checkmate — you win! :D"); say(pick(LINES.lose),5000); }
      else { setStatus("Checkmate — Drod wins."); say(pick(LINES.win),5000); }
      return;
    }
    if(st==="stalemate"){ over=true; setStatus("Stalemate — it's a draw."); say(pick(LINES.draw),5000); return; }
    if(st==="check"){ if(state.turn===playerColor){ setStatus("You're in check!"); say(pick(LINES.check),2600); }
                      else { setStatus("Drod is in check!"); say(pick(LINES.inCheck),2600); } }
    else { setStatus(state.turn===playerColor?"Your move.":"Drod is thinking…"); }
    if(state.turn===aiColor && !over){ thinkAndMove(); }
  }

  // Ask Stockfish for the AI's move (falls back to the built-in engine). Async.
  async function runAI(s, lv){
    if(SF && !SF.isDead()){
      try{
        const ok=await SF.ready();
        if(ok){
          const uci=await SF.bestMove(E.toFEN(s), lv.sf);
          const mv=uci?E.uciToMove(s,uci):null;
          if(mv) return mv;
        }
      }catch(_){ /* fall through to built-in */ }
    }
    return E.bestMove(s, lv.depth, lv.rand);
  }

  function thinkAndMove(){
    thinking=true;
    setStatus("Drod is thinking…");
    const snapshot=state, t0=performance.now();
    runAI(state, level).then((mv)=>{
      // bail if the game moved on (new game, resign, overlay closed, player turn)
      if(over || raf===0 || state!==snapshot){ thinking=false; return; }
      const elapsed=performance.now()-t0;
      const wait=Math.max(240, 640-elapsed);   // keep a small, human-ish beat
      setTimeout(()=>{
        if(over || raf===0 || state!==snapshot){ thinking=false; return; }
        thinking=false;
        if(mv) doMove(mv,"ai");
        else { over=true; setStatus("No moves — game over."); }
      }, wait);
    }).catch(()=>{ thinking=false; });
  }

  /* ---- promotion picker ---- */
  function askPromotion(color, cb){
    const ov=document.getElementById("cbOver");
    if(!ov){ cb("Q"); return; }
    promoPending=true;
    const order=["Q","R","B","N"];
    ov.className="cb-over promo";
    ov.innerHTML=`<div class="promo-card"><div class="promo-title">Promote to</div>
      <div class="promo-row">${order.map(P=>{ const ch=color==="w"?P:P.toLowerCase();
        return `<button class="promo-btn" data-p="${P}" title="${P}">${pieceImg(ch,30)}</button>`; }).join("")}</div></div>`;
    ov.classList.remove("hidden");
    ov.querySelectorAll(".promo-btn").forEach(b=>{
      b.onclick=()=>{ const P=b.getAttribute("data-p"); hidePromo(); cb(P); };
    });
  }
  function hidePromo(){ const ov=document.getElementById("cbOver"); if(ov){ ov.classList.add("hidden"); ov.innerHTML=""; } promoPending=false; }

  function renderCaps(){
    const w=document.getElementById("capW"), b=document.getElementById("capB");
    if(!w) return;
    w.innerHTML=capByPlayer.map(p=>pieceImg(p,18)).join("");
    b.innerHTML=capByAI.map(p=>pieceImg(p,18)).join("");
  }
  function pieceImg(p,size){
    const col=PCOL[p.toUpperCase()];
    const sheet = E.isW(p)?"assets/chess/WhitePieces.png":"assets/chess/BlackPieces.png";
    return `<span class="cap-pc" style="width:${size}px;height:${size*2}px;background-image:url('${sheet}');background-size:${size*6}px ${size*2}px;background-position:-${col*size}px 0;"></span>`;
  }

  function drawBoard(now){
    if(!bctx) return;
    const board=ASSETS.get("chess_board");
    bctx.clearRect(0,0,BOARD,BOARD);
    if(board&&board.complete) bctx.drawImage(board,0,0,BOARD,BOARD);
    if(!state) return;
    // last move highlight
    if(lastMove){ [lastMove.from,lastMove.to].forEach(i=>{
      bctx.fillStyle="rgba(231,163,62,0.35)";
      bctx.fillRect(BORDER+scf(i)*SQ, BORDER+scr(i)*SQ, SQ, SQ);
    }); }
    // selection + legal dots
    if(sel>=0){ bctx.fillStyle="rgba(95,176,201,0.45)";
      bctx.fillRect(BORDER+scf(sel)*SQ, BORDER+scr(sel)*SQ, SQ, SQ); }
    const pulse=0.5+0.5*Math.sin(now/260);
    legal.forEach(m=>{ const i=m.to; const cx=BORDER+scf(i)*SQ+SQ/2, cy=BORDER+scr(i)*SQ+SQ/2;
      bctx.fillStyle = m.cap!=="." ? `rgba(231,90,80,${0.5+0.3*pulse})` : `rgba(40,40,40,0.32)`;
      bctx.beginPath();
      if(m.cap!=="."){ bctx.lineWidth=4; bctx.strokeStyle=`rgba(231,90,80,${0.6+0.3*pulse})`;
        bctx.arc(cx,cy,SQ*0.42,0,7); bctx.stroke(); }
      else { bctx.arc(cx,cy,SQ*0.17,0,7); bctx.fill(); }
    });
    // pieces (tall: 16x32 -> SQ wide, 2*SQ tall, anchored bottom). Draw by SCREEN
    // row, back-to-front, so the nearer piece overlaps the farther one — correct
    // in both orientations (the board flips when you play Black). Shadows go down
    // first (flat on the felt) so a front piece's shadow never darkens the piece
    // standing behind it.
    const occ=[];
    for(let i=0;i<64;i++) if(state.b[i]!==".") occ.push(i);
    occ.sort((a,b)=> scr(a)-scr(b));
    for(const i of occ){ const dx=BORDER+scf(i)*SQ, dy=BORDER+(scr(i)+1)*SQ-SQ*2;
      bctx.fillStyle="rgba(0,0,0,0.18)"; bctx.beginPath();
      bctx.ellipse(dx+SQ/2,dy+SQ*2-2,SQ*0.32,SQ*0.12,0,0,7); bctx.fill(); }
    for(const i of occ){ const p=state.b[i];
      const sheet=ASSETS.get(E.isW(p)?"chess_white":"chess_black"); if(!sheet||!sheet.complete) continue;
      const col=PCOL[p.toUpperCase()];
      const dx=BORDER+scf(i)*SQ, dy=BORDER+(scr(i)+1)*SQ-SQ*2;
      bctx.drawImage(sheet, col*16,0,16,32, dx,dy,SQ,SQ*2);
    }
  }

  let lastIdle=0;
  function loop(){
    try{
    const now=performance.now();
    if(!lastT) lastT=now; const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
    portT+=dt;
    const talking = now<talkUntil || thinking;
    portFrame=Math.floor(portT*(talking?13:5));
    const pc=document.getElementById("cbPort");
    if(pc){ SPRITES.drawPortraitFrame(pc.getContext("2d"),"port_Drod", talking?portFrame:0, 96,96); }
    const bub=document.getElementById("cbBubble");
    if(bub){ const show = now<talkUntil && bubble;
      bub.textContent = show?bubble:""; bub.classList.toggle("show",!!show); }
    // idle taunt
    if(state && !over && !thinking && !promoPending && state.turn===playerColor && now>talkUntil+6000 && now-lastIdle>9000){
      if(Math.random()<0.5){ say(pick(LINES.idle),2600); lastIdle=now; } else lastIdle=now-4000;
    }
    drawBoard(now);
    }catch(err){ console.error("chess loop", err); }
    raf=requestAnimationFrame(loop);
  }

  return { open, close, isOpen:()=>!host.classList.contains("hidden") };
})();
