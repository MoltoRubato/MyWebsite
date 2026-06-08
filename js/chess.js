/* ============================================================
   CHESS UI — board, pieces, Drod portrait, difficulty + banter
   ============================================================ */
window.CHESS = (function(){
  const E = window.CHESSENGINE;
  const host = document.getElementById("activity");
  const inner = document.getElementById("activityInner");
  const SC=3, SQ=16*SC, BORDER=7*SC, BOARD=142*SC; // 426

  const PCOL={P:0,N:1,R:2,B:3,Q:4,K:5};

  const LEVELS={
    chill:  { name:"Chill",  depth:1, rand:0.55, label:"just for fun" },
    normal: { name:"Normal", depth:2, rand:0.12, label:"he's paying attention" },
    sweat:  { name:"Sweat",  depth:3, rand:0,    label:"he's actually trying" }
  };
  const LINES={
    intro:{
      chill:["Chill mode? Alright, relax — let's just push some wood.","No pressure. I'll even let you take stuff back. ...maybe."],
      normal:["Normal it is. I'm paying attention now.","Don't hang your queen and we'll have a real game."],
      sweat:["Hmm, you want me to actually try, don't you.","Fine. No more Mr. Nice Drod. Let's go."]
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
  let over=false, capturedW=[], capturedB=[], onClose=null, anim=0;
  let bctx, pcanvas;

  function say(txt, dur){ bubble=txt; talkUntil=performance.now()+(dur||2600); }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function open(opts){
    onClose = opts && opts.onClose;
    inner.innerHTML = shell();
    host.classList.remove("hidden");
    requestAnimationFrame(()=>host.classList.add("in"));
    bctx = document.getElementById("cbBoard").getContext("2d");
    bctx.imageSmoothingEnabled=false;
    wireDifficulty();
    portFrame=0; portT=0; bubble=""; thinking=false; lastT=0;
    showDifficulty(true);
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
          <div class="diff-title">Pick your poison</div>
          ${Object.entries(LEVELS).map(([k,v])=>`<button class="diff-btn" data-lv="${k}"><b>${v.name}</b><small>${v.label}</small></button>`).join("")}
        </div>
        <div class="chess-controls hidden" id="cbControls">
          <div class="cap-row"><span class="cap-lbl">You took</span><div class="cap-list" id="capW"></div></div>
          <div class="cap-row"><span class="cap-lbl">Drod took</span><div class="cap-list" id="capB"></div></div>
          <div class="ctl-btns">
            <button class="ctl-btn" id="cbNew">New game</button>
            <button class="ctl-btn ghost" id="cbResign">Resign</button>
          </div>
        </div>
        <div class="chess-tip">Click a piece, then a square · You play White</div>
      </div>
    </div>`;
  }

  function wireDifficulty(){
    document.getElementById("cbClose").onclick=close;
    inner.querySelectorAll(".diff-btn").forEach(b=>{
      b.onclick=()=>{ level=LEVELS[b.getAttribute("data-lv")]; startGame(); };
    });
  }
  function showDifficulty(show){
    document.getElementById("cbDiff").classList.toggle("hidden",!show);
    document.getElementById("cbControls").classList.toggle("hidden",show);
  }

  function startGame(){
    state=E.initialState(); sel=-1; legal=[]; lastMove=null; over=false;
    capturedW=[]; capturedB=[]; renderCaps();
    document.getElementById("cbLevel").textContent = level.name+" — "+level.label;
    showDifficulty(false);
    setStatus("Your move.");
    say(pick(LINES.intro[Object.keys(LEVELS).find(k=>LEVELS[k]===level)]), 3600);
    // board click
    document.getElementById("cbBoard").onclick = onBoardClick;
    document.getElementById("cbNew").onclick = ()=>{ showDifficulty(true); setStatus("Choose a difficulty"); state=null; sel=-1; legal=[]; lastMove=null; };
    document.getElementById("cbResign").onclick = ()=>{ if(state&&!over){ over=true; setStatus("You resigned."); say(pick(LINES.win),4000); } };
  }

  function setStatus(t){ const s=document.getElementById("cbStatus"); if(s) s.textContent=t; }

  function squareFromXY(mx,my){
    const f=Math.floor((mx-BORDER)/SQ), r=Math.floor((my-BORDER)/SQ);
    if(f<0||f>7||r<0||r>7) return -1;
    return r*8+f;
  }

  function onBoardClick(e){
    if(!state || over || thinking || state.turn!=="w") return;
    const rect=e.target.getBoundingClientRect();
    const scaleX=BOARD/rect.width, scaleY=BOARD/rect.height;
    const sq=squareFromXY((e.clientX-rect.left)*scaleX,(e.clientY-rect.top)*scaleY);
    if(sq<0) return;
    const p=state.b[sq];
    if(sel===-1){
      if(p!=="."&&E.isW(p)){ sel=sq; legal=E.legalMoves(state).filter(m=>m.from===sq); }
    } else {
      const mv=legal.find(m=>m.to===sq);
      if(mv){ doMove(mv,"w"); sel=-1; legal=[]; }
      else if(p!=="."&&E.isW(p)){ sel=sq; legal=E.legalMoves(state).filter(m=>m.from===sq); }
      else { sel=-1; legal=[]; }
    }
  }

  function doMove(mv,who){
    if(mv.cap!=="."){ if(who==="w"){capturedW.push(mv.cap);} else {capturedB.push(mv.cap);} renderCaps(); }
    state=E.apply(state,mv); lastMove={from:mv.from,to:mv.to};
    // banter
    if(mv.cap!=="."){ say(pick(who==="w"?LINES.playerCap:LINES.aiCap), 2200); }
    const st=E.status(state);
    if(st==="checkmate"){ over=true;
      if(state.turn==="b"){ setStatus("Checkmate — you win! 🏆"); say(pick(LINES.lose),5000); }
      else { setStatus("Checkmate — Drod wins."); say(pick(LINES.win),5000); }
      return;
    }
    if(st==="stalemate"){ over=true; setStatus("Stalemate — it's a draw."); say(pick(LINES.draw),5000); return; }
    if(st==="check"){ if(state.turn==="w"){ setStatus("You're in check!"); say(pick(LINES.check),2600); }
                      else { setStatus("Drod is in check!"); say(pick(LINES.inCheck),2600); } }
    else { setStatus(state.turn==="w"?"Your move.":"Drod is thinking…"); }
    if(state.turn==="b" && !over){ thinkAndMove(); }
  }

  function thinkAndMove(){
    thinking=true;
    const t0=performance.now();
    setStatus("Drod is thinking…");
    // run search off the paint frame
    setTimeout(()=>{
      const mv=E.bestMove(state, level.depth, level.rand);
      const elapsed=performance.now()-t0;
      const wait=Math.max(420, 700-elapsed); // small human pause
      setTimeout(()=>{ thinking=false; if(mv) doMove(mv,"b"); else { over=true; setStatus("No moves — game over."); } }, wait);
    }, 30);
  }

  let lastIdle=0;
  function renderCaps(){
    const w=document.getElementById("capW"), b=document.getElementById("capB");
    if(!w) return;
    w.innerHTML=capturedW.map(p=>pieceImg(p,18)).join("");
    b.innerHTML=capturedB.map(p=>pieceImg(p,18)).join("");
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
      bctx.fillRect(BORDER+E.file(i)*SQ, BORDER+E.rank(i)*SQ, SQ, SQ);
    }); }
    // selection + legal dots
    if(sel>=0){ bctx.fillStyle="rgba(95,176,201,0.45)";
      bctx.fillRect(BORDER+E.file(sel)*SQ, BORDER+E.rank(sel)*SQ, SQ, SQ); }
    const pulse=0.5+0.5*Math.sin(now/260);
    legal.forEach(m=>{ const i=m.to; const cx=BORDER+E.file(i)*SQ+SQ/2, cy=BORDER+E.rank(i)*SQ+SQ/2;
      bctx.fillStyle = m.cap!=="." ? `rgba(231,90,80,${0.5+0.3*pulse})` : `rgba(40,40,40,0.32)`;
      bctx.beginPath();
      if(m.cap!=="."){ bctx.lineWidth=4; bctx.strokeStyle=`rgba(231,90,80,${0.6+0.3*pulse})`;
        bctx.arc(cx,cy,SQ*0.42,0,7); bctx.stroke(); }
      else { bctx.arc(cx,cy,SQ*0.17,0,7); bctx.fill(); }
    });
    // pieces (tall: 16x32 -> SQ wide, 2*SQ tall, anchored bottom)
    for(let i=0;i<64;i++){ const p=state.b[i]; if(p===".")continue;
      const sheet=ASSETS.get(E.isW(p)?"chess_white":"chess_black"); if(!sheet||!sheet.complete) continue;
      const col=PCOL[p.toUpperCase()];
      const dx=BORDER+E.file(i)*SQ, dy=BORDER+(E.rank(i)+1)*SQ-SQ*2;
      // shadow
      bctx.fillStyle="rgba(0,0,0,0.18)"; bctx.beginPath();
      bctx.ellipse(dx+SQ/2,dy+SQ*2-2,SQ*0.32,SQ*0.12,0,0,7); bctx.fill();
      bctx.drawImage(sheet, col*16,0,16,32, dx,dy,SQ,SQ*2);
    }
  }

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
    if(state && !over && !thinking && state.turn==="w" && now>talkUntil+6000 && now-lastIdle>9000){
      if(Math.random()<0.5){ say(pick(LINES.idle),2600); lastIdle=now; } else lastIdle=now-4000;
    }
    drawBoard(now);
    }catch(err){ console.error("chess loop", err); }
    raf=requestAnimationFrame(loop);
  }

  return { open, close, isOpen:()=>!host.classList.contains("hidden") };
})();
