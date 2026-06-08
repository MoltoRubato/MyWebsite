/* ============================================================
   MUSIC — a persistent jukebox engine + two separate windows
     • Jukebox  (opens from the speaker) — sets the site-wide track.
     • Beat Pad (opens from Alex / DJ)    — tap sequencer.
   The chosen jukebox track becomes the background music for the whole
   site and KEEPS PLAYING after the jukebox window is closed. The beat
   pad ducks (fades out) that music while it's open and fades it back
   in when it closes, so the two never fight.
   ============================================================ */
window.MUSIC = (function(){
  const C=window.CONTENT;
  const host=document.getElementById("activity");
  const inner=document.getElementById("activityInner");

  /* ---------- persistent audio engine (survives window open/close) -------- */
  let ac=null, analyser=null, data=null;     // shared Web Audio graph
  let bgAudio=null, bgSrc=null;              // current background <audio> + node
  let curTrack=-1, playing=false;            // jukebox state
  let muted=false;                           // global (header) mute
  let padDuck=false;                         // beat pad ducking the bg music
  let fadeRAF=0;                             // in-flight volume fade
  const FULL_VOL=0.82;

  function ensureAC(){
    if(!ac){
      ac=new (window.AudioContext||window.webkitAudioContext)();
      analyser=ac.createAnalyser(); analyser.fftSize=128;
      data=new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(ac.destination);
    }
    if(ac.state==="suspended") ac.resume();
    return ac;
  }

  function clearFade(){ if(fadeRAF){ cancelAnimationFrame(fadeRAF); fadeRAF=0; } }
  // ramp bgAudio.volume -> target over ms, then run cb
  function fadeTo(target, ms, cb){
    clearFade();
    if(!bgAudio){ if(cb)cb(); return; }
    const from=bgAudio.volume, t0=performance.now();
    const tick=(now)=>{
      const k=Math.min(1,(now-t0)/Math.max(1,ms));
      try{ bgAudio.volume = Math.max(0,Math.min(1, from+(target-from)*k)); }catch(e){}
      if(k<1) fadeRAF=requestAnimationFrame(tick);
      else { fadeRAF=0; if(cb)cb(); }
    };
    fadeRAF=requestAnimationFrame(tick);
  }

  // play track i as the looping, site-wide background music
  function playTrack(i){
    ensureAC();
    if(i<0 || i>=C.tracks.length) return;
    if(curTrack===i && playing) return;            // already on it
    clearFade();
    if(bgAudio){ bgAudio.pause(); try{ bgSrc&&bgSrc.disconnect(); }catch(e){} bgAudio=null; bgSrc=null; }
    curTrack=i; playing=true;
    bgAudio=new Audio(C.tracks[i].file); bgAudio.crossOrigin="anonymous"; bgAudio.loop=true;
    bgAudio.volume = (muted||padDuck) ? 0 : 0.0001;
    try{ bgSrc=ac.createMediaElementSource(bgAudio); bgSrc.connect(analyser); }catch(e){}
    bgAudio.play().catch(()=>{});
    if(!muted && !padDuck) fadeTo(FULL_VOL, 450);
    emit();
  }
  function stop(){
    clearFade(); playing=false;
    if(bgAudio){ bgAudio.pause(); bgAudio.currentTime=0; }
    emit();
  }
  function toggleTrack(i){ if(curTrack===i && playing) stop(); else playTrack(i); }

  // beat pad ducking — fade music down/out while the pad is open, back in after
  function duckForPad(){ padDuck=true; if(bgAudio && playing) fadeTo(0, 340); }
  function unduckAfterPad(){ padDuck=false; if(bgAudio && playing && !muted) fadeTo(FULL_VOL, 750); }

  // global mute (header sound button)
  function setMuted(m){
    muted=!!m;
    if(muted) fadeTo(0, 240);
    else if(bgAudio && playing && !padDuck) fadeTo(FULL_VOL, 400);
  }

  // state queries
  function isPlaying(){ return playing; }
  function isAudible(){ return playing && !padDuck && !muted; } // drives speaker anim
  function vizData(){ if(analyser){ analyser.getByteFrequencyData(data); return data; } return null; }
  function level(){                              // 0..1 overall amplitude
    if(!isAudible() && !padPlaying) return 0;
    const d=vizData(); if(!d) return 0;
    let s=0; for(let i=0;i<d.length;i++) s+=d[i];
    return (s/d.length)/255;
  }

  // let an open window live-sync its "now playing" UI
  let onChange=null;
  function emit(){ if(onChange) onChange(); }

  // shared visualizer — warm gold bars to match the wood/cream UI
  function drawViz(cnv){
    if(!cnv) return; const vctx=cnv.getContext("2d");
    const W=cnv.width, H=cnv.height; vctx.clearRect(0,0,W,H);
    const arr=(isAudible()||padPlaying) ? vizData() : null;
    const n=32, bw=W/n;
    for(let i=0;i<n;i++){
      let v;
      if(arr) v=arr[i%arr.length]/255;
      else v=0.09+0.07*Math.abs(Math.sin(performance.now()/650+i*0.5));
      const h=Math.max(3,v*H);
      const hue=28 + (i/n)*18;                   // amber -> gold
      vctx.fillStyle=`hsl(${hue} 78% ${44+v*22}%)`;
      vctx.fillRect(i*bw+2, H-h, bw-4, h);
    }
  }

  /* ====================== JUKEBOX WINDOW ================================== */
  let jkRaf=0, jkClose=null, jkKey=null;

  function openJukebox(opts){
    jkClose=opts&&opts.onClose;
    ensureAC();
    inner.innerHTML=jukeboxShell();
    host.classList.remove("hidden"); requestAnimationFrame(()=>host.classList.add("in"));
    buildJukeTracks();
    onChange=refreshJuke;
    document.getElementById("jkClose").onclick=closeJukebox;
    document.getElementById("jkStop").onclick=()=>{ stop(); };
    jkKey=(e)=>{ if(e.key==="Escape") closeJukebox(); };
    window.addEventListener("keydown", jkKey);
    jkRaf=requestAnimationFrame(jukeLoop);
  }
  function closeJukebox(){
    host.classList.remove("in"); setTimeout(()=>{ host.classList.add("hidden"); inner.innerHTML=""; },350);
    cancelAnimationFrame(jkRaf); jkRaf=0; onChange=null;
    if(jkKey){ window.removeEventListener("keydown", jkKey); jkKey=null; }
    const fn=jkClose; jkClose=null; if(fn) fn();
    // music keeps playing — intentionally NOT stopped here
  }
  function jukeboxShell(){
    return `<div class="mz-wrap jk-wrap">
      <button class="chess-x" id="jkClose">✕</button>
      <div class="jk-head">
        <div class="jk-titles">
          <div class="mz-kick">JUKEBOX</div>
          <div class="jk-now" id="jkNow"></div>
        </div>
        <button class="ctl-btn ghost jk-stop" id="jkStop">■ Stop</button>
      </div>
      <canvas id="jkViz" class="mz-viz" width="720" height="92"></canvas>
      <div class="jk-tracks" id="jkTracks"></div>
      <div class="jk-foot">Plays everywhere as you explore. The beat pad pauses it.</div>
    </div>`;
  }
  function buildJukeTracks(){
    const wrap=document.getElementById("jkTracks");
    wrap.innerHTML=C.tracks.map((t,i)=>`<button class="mz-track jk-track" data-i="${i}">
      <span class="mz-eq"><i></i><i></i><i></i></span><span class="mz-tn">${t.name}</span></button>`).join("");
    wrap.querySelectorAll(".jk-track").forEach(b=>b.onclick=()=>toggleTrack(+b.getAttribute("data-i")));
    refreshJuke();
  }
  function refreshJuke(){
    const now=document.getElementById("jkNow");
    if(now) now.textContent = playing ? "Now playing · "+C.tracks[curTrack].name
                                      : "Pick a track to set the vibe.";
    inner.querySelectorAll(".jk-track").forEach((b,i)=>b.classList.toggle("on", i===curTrack&&playing));
    const sb=document.getElementById("jkStop"); if(sb) sb.style.visibility=playing?"visible":"hidden";
  }
  function jukeLoop(){
    try{ drawViz(document.getElementById("jkViz")); }catch(e){}
    jkRaf=requestAnimationFrame(jukeLoop);
  }

  /* ====================== BEAT PAD WINDOW ================================= */
  let bpRaf=0, bpClose=null, bpKey=null;
  let padCols=8, padRows=4, pattern=[], step=0, seqTimer=null, bpm=110, padPlaying=false;
  let bpSayUntil=0, bpSayText="", bpT=0, bpLastT=0;

  // pentatonic-ish notes per row (Hz) — top bright down to low
  const NOTES=[ [523.25,587.33,659.25,783.99,880,1046.5],
                [392,440,493.88,587.33,659.25,783.99],
                [261.63,293.66,329.63,392,440,523.25],
                [130.81,146.83,164.81,196,220,261.63] ];

  function openBeatpad(opts){
    bpClose=opts&&opts.onClose;
    ensureAC();
    inner.innerHTML=beatpadShell();
    host.classList.remove("hidden"); requestAnimationFrame(()=>host.classList.add("in"));
    duckForPad();                                  // fade the jukebox music out
    buildPad(); wireBeat();
    bpSay("Welcome to the booth. Tap out something filthy. 🎛");
    bpLastT=0; bpRaf=requestAnimationFrame(beatLoop);
  }
  function closeBeatpad(){
    stopPad();
    unduckAfterPad();                              // fade the jukebox music back in
    host.classList.remove("in"); setTimeout(()=>{ host.classList.add("hidden"); inner.innerHTML=""; },350);
    cancelAnimationFrame(bpRaf); bpRaf=0;
    if(bpKey){ window.removeEventListener("keydown", bpKey); bpKey=null; }
    const fn=bpClose; bpClose=null; if(fn) fn();
  }
  function beatpadShell(){
    return `<div class="mz-wrap bp-wrap">
      <button class="chess-x" id="bpClose">✕</button>
      <div class="mz-head">
        <div class="mz-djs">
          <div class="mz-dj"><canvas id="mzPortA" width="64" height="64"></canvas><span>Alex</span></div>
          <div class="mz-dj"><canvas id="mzPortD" width="64" height="64"></canvas><span>DJ</span></div>
        </div>
        <div class="mz-title"><div class="mz-kick">BEAT PAD</div><div class="mz-say" id="mzSay"></div></div>
      </div>
      <canvas id="mzViz" class="mz-viz" width="720" height="104"></canvas>
      <div class="mz-pad">
        <div class="mz-sub">Tap a beat <span class="mz-hint">click cells · space to run</span></div>
        <div class="mz-grid" id="mzGrid"></div>
        <div class="mz-padctl">
          <button class="ctl-btn" id="mzPlay">▶ Run</button>
          <button class="ctl-btn ghost" id="mzClear">Clear</button>
          <label class="mz-bpm">BPM <input type="range" id="mzBpm" min="70" max="160" value="110"></label>
        </div>
      </div>
    </div>`;
  }

  function buildPad(){
    pattern=Array.from({length:padRows},()=>Array(padCols).fill(false));
    const g=document.getElementById("mzGrid");
    g.style.gridTemplateColumns=`repeat(${padCols},1fr)`;
    g.innerHTML="";
    for(let r=0;r<padRows;r++)for(let c=0;c<padCols;c++){
      const cell=document.createElement("button");
      cell.className="pad-cell"; cell.dataset.r=r; cell.dataset.c=c;
      cell.onclick=()=>{ pattern[r][c]=!pattern[r][c]; cell.classList.toggle("on",pattern[r][c]);
        if(pattern[r][c]) blip(NOTES[r][2],0.12); };
      g.appendChild(cell);
    }
  }
  function stepClass(){
    const g=document.getElementById("mzGrid"); if(!g) return;
    g.querySelectorAll(".pad-cell").forEach(c=>c.classList.toggle("col",+c.dataset.c===step));
  }
  function blip(freq,dur){
    ensureAC();
    const o=ac.createOscillator(), gain=ac.createGain();
    o.type="triangle"; o.frequency.value=freq;
    gain.gain.setValueAtTime(0.0001,ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22,ac.currentTime+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+(dur||0.18));
    o.connect(gain); gain.connect(analyser);
    o.start(); o.stop(ac.currentTime+(dur||0.18));
  }
  function runPad(){
    ensureAC();
    if(padPlaying){ stopPad(); return; }
    padPlaying=true; step=0;
    const b=document.getElementById("mzPlay"); if(b) b.textContent="■ Stop";
    const tick=()=>{
      for(let r=0;r<padRows;r++) if(pattern[r][step]) blip(NOTES[r][step%6],0.16);
      stepClass();
      step=(step+1)%padCols;
      seqTimer=setTimeout(tick, (60/bpm)*1000/2);
    };
    tick();
    bpSay("Now we're cooking. 🔥");
  }
  function stopPad(){
    padPlaying=false; if(seqTimer)clearTimeout(seqTimer); seqTimer=null;
    const b=document.getElementById("mzPlay"); if(b) b.textContent="▶ Run";
    const g=document.getElementById("mzGrid"); if(g)g.querySelectorAll(".pad-cell").forEach(c=>c.classList.remove("col"));
  }
  function wireBeat(){
    document.getElementById("bpClose").onclick=closeBeatpad;
    document.getElementById("mzPlay").onclick=runPad;
    document.getElementById("mzClear").onclick=()=>buildPad();
    document.getElementById("mzBpm").oninput=(e)=>{ bpm=+e.target.value; };
    bpKey=(e)=>{
      const tag=(e.target&&e.target.tagName)||"";
      if(e.key==="Escape"){ closeBeatpad(); return; }
      if((e.key===" "||e.code==="Space") && tag!=="INPUT"){ e.preventDefault(); runPad(); }
    };
    window.addEventListener("keydown", bpKey);
  }

  function bpSay(t){ bpSayText=t; bpSayUntil=performance.now()+3200; }
  function beatLoop(){
    try{
      const now=performance.now();
      if(!bpLastT) bpLastT=now; const dt=Math.min(0.05,(now-bpLastT)/1000); bpLastT=now; bpT+=dt;
      const f=Math.floor(bpT*(padPlaying?12:5));
      const pA=document.getElementById("mzPortA"), pD=document.getElementById("mzPortD");
      if(pA) SPRITES.drawPortraitFrame(pA.getContext("2d"),"port_Alex", padPlaying?f:0,64,64);
      if(pD) SPRITES.drawPortraitFrame(pD.getContext("2d"),"port_DJ", padPlaying?f+3:0,64,64);
      const se=document.getElementById("mzSay"); if(se) se.textContent = now<bpSayUntil?bpSayText:"";
      drawViz(document.getElementById("mzViz"));
    }catch(err){ console.error("beat loop", err); }
    bpRaf=requestAnimationFrame(beatLoop);
  }

  return {
    openJukebox, openBeatpad, closeJukebox, closeBeatpad,
    isOpen:()=>!host.classList.contains("hidden"),
    isPlaying, isAudible, level, setMuted, stop
  };
})();
