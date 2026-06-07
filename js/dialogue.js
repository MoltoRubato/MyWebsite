/* ============================================================
   DIALOGUE — modern UI text box with animated talking portrait
   ============================================================ */
window.DIALOGUE = (function(){
  const el = {
    root:  document.getElementById("dialogue"),
    port:  document.getElementById("dlgPortrait"),
    name:  document.getElementById("dlgName"),
    text:  document.getElementById("dlgText"),
    next:  document.getElementById("dlgNext"),
    close: document.getElementById("dlgClose"),
    choices: document.getElementById("dlgChoices")
  };
  const pctx = el.port.getContext("2d");

  let open=false, lines=[], idx=0, full="", shown=0, typeT=0, typing=false;
  let portKey="port_Player", portFrame=0, portT=0, talking=false;
  let onDone=null, choices=null;
  let lastTs=0;

  function start(opts){
    // opts: { charKey, name, lines, choices, onChoice, onDone }
    open=true;
    portKey = "port_"+(opts.charKey||"Player");
    el.name.textContent = opts.name||"";
    el.name.style.color = opts.color || "var(--accent)";
    lines = opts.lines||[""];
    idx=0; choices=opts.choices||null; onChoice=opts.onChoice||null; onDone=opts.onDone||null;
    el.choices.innerHTML=""; el.choices.classList.add("hidden");
    el.root.classList.remove("hidden");
    requestAnimationFrame(()=>el.root.classList.add("in"));
    setLine(0);
  }
  let onChoice=null;

  function setLine(i){
    full = lines[i]||"";
    shown=0; typing=true; typeT=0; talking=true;
    el.next.classList.remove("show");
    render();
  }

  function render(){
    const sub = full.slice(0,shown)
      .replace(/\{ENTER\}/g,'<span class="em">ENTER</span>');
    el.text.innerHTML = sub + (typing ? '<span class="cursor">▍</span>' : '');
  }

  function finishTyping(){ shown=full.length; typing=false; talking=false; render(); afterLine(); }

  function afterLine(){
    if (idx >= lines.length-1 && choices){
      // show choices
      el.choices.innerHTML="";
      choices.forEach((c,ci)=>{
        const b=document.createElement("button");
        b.className="dlg-choice"; b.innerHTML=c.label;
        b.onclick=()=>{ const fn=onChoice; const val=c.value; closeNow(); if(fn) fn(val); };
        el.choices.appendChild(b);
      });
      el.choices.classList.remove("hidden");
    } else {
      el.next.classList.add("show");
    }
  }

  function advance(){
    if (typing){ finishTyping(); return; }
    if (!el.choices.classList.contains("hidden")) return; // waiting on choice
    if (idx < lines.length-1){ idx++; setLine(idx); }
    else { const fn=onDone; closeNow(); if(fn) fn(); }
  }

  function closeNow(){
    if(!open) return;
    open=false;
    el.root.classList.remove("in");
    setTimeout(()=>el.root.classList.add("hidden"), 320);
  }

  // animation tick (called from main loop)
  function tick(ts){
    if(!lastTs) lastTs=ts;
    const dt=(ts-lastTs)/1000; lastTs=ts;
    if(!open) return;
    // typewriter
    if (typing){
      typeT += dt;
      const cps = 42; // chars/sec
      const target = Math.min(full.length, Math.floor(typeT*cps));
      if (target!==shown){ shown=target; render(); }
      if (shown>=full.length){ typing=false; talking=false; render(); afterLine(); }
    }
    // portrait talking animation
    portT += dt;
    const fps = talking ? 14 : 5;
    portFrame = Math.floor(portT*fps);
    SPRITES.drawPortraitFrame(pctx, portKey, talking?portFrame:0, el.port.width, el.port.height);
  }

  // input wiring
  el.root.addEventListener("click",(e)=>{
    if (e.target===el.close) return;
    if (e.target.closest(".dlg-choice")) return;
    advance();
  });
  el.close.addEventListener("click",(e)=>{ e.stopPropagation(); const fn=onDone; closeNow(); });

  return {
    start, advance, isOpen:()=>open, close:closeNow, tick
  };
})();
