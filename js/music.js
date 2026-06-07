/* ============================================================
   MUSIC — jukebox + tap beat pad + visualizer (Alex & DJ)
   ============================================================ */
window.MUSIC = (function(){
  const C=window.CONTENT;
  const host=document.getElementById("activity");
  const inner=document.getElementById("activityInner");
  let raf=0, onClose=null, audio=null, ac=null, analyser=null, srcNode=null, data=null;
  let curTrack=-1, vctx=null, playing=false;
  let padCols=8, padRows=4, pattern=[], step=0, seqTimer=null, bpm=110, padPlaying=false;
  let oscMap=null;

  // pentatonic-ish notes per row (Hz)
  const NOTES=[ [523.25,587.33,659.25,783.99,880,1046.5], // top bright
               [392,440,493.88,587.33,659.25,783.99],
               [261.63,293.66,329.63,392,440,523.25],
               [130.81,146.83,164.81,196,220,261.63] ]; // low

  function open(opts){
    onClose=opts&&opts.onClose;
    inner.innerHTML=shell();
    host.classList.remove("hidden"); requestAnimationFrame(()=>host.classList.add("in"));
    vctx=document.getElementById("mzViz").getContext("2d");
    buildTracks(); buildPad(); wire();
    say("Welcome to the booth. Pick a track or tap out a beat. 🎧");
    loop();
  }
  function close(){
    stopTrack(); stopPad();
    host.classList.remove("in"); setTimeout(()=>{host.classList.add("hidden");inner.innerHTML="";},350);
    cancelAnimationFrame(raf); raf=0;
    const fn=onClose; if(fn) fn();
  }

  function shell(){
    return `<div class="mz-wrap">
      <button class="chess-x" id="mzClose">✕</button>
      <div class="mz-head">
        <div class="mz-djs">
          <div class="mz-dj"><canvas id="mzPortA" width="64" height="64"></canvas><span>Alex</span></div>
          <div class="mz-dj"><canvas id="mzPortD" width="64" height="64"></canvas><span>DJ</span></div>
        </div>
        <div class="mz-title"><div class="mz-kick">THE STUDIO</div><div class="mz-say" id="mzSay"></div></div>
      </div>
      <canvas id="mzViz" class="mz-viz" width="720" height="120"></canvas>
      <div class="mz-cols">
        <div class="mz-juke">
          <div class="mz-sub">Jukebox</div>
          <div class="mz-tracks" id="mzTracks"></div>
        </div>
        <div class="mz-pad">
          <div class="mz-sub">Beat Pad <span class="mz-hint">tap cells · space to run</span></div>
          <div class="mz-grid" id="mzGrid"></div>
          <div class="mz-padctl">
            <button class="ctl-btn" id="mzPlay">▶ Run</button>
            <button class="ctl-btn ghost" id="mzClear">Clear</button>
            <label class="mz-bpm">BPM <input type="range" id="mzBpm" min="70" max="160" value="110"></label>
          </div>
        </div>
      </div>
    </div>`;
  }

  function ensureAC(){ if(!ac){ ac=new (window.AudioContext||window.webkitAudioContext)();
    analyser=ac.createAnalyser(); analyser.fftSize=128; data=new Uint8Array(analyser.frequencyBinCount);
    analyser.connect(ac.destination);} if(ac.state==="suspended") ac.resume(); }

  // ---- jukebox ----
  function buildTracks(){
    const wrap=document.getElementById("mzTracks");
    wrap.innerHTML=C.tracks.map((t,i)=>`<button class="mz-track" data-i="${i}">
      <span class="mz-eq"><i></i><i></i><i></i></span><span class="mz-tn">${t.name}</span></button>`).join("");
    wrap.querySelectorAll(".mz-track").forEach(b=>b.onclick=()=>playTrack(+b.getAttribute("data-i")));
  }
  function playTrack(i){
    ensureAC();
    if(curTrack===i && playing){ stopTrack(); return; }
    stopTrack();
    curTrack=i; const t=C.tracks[i];
    audio=new Audio(t.file); audio.crossOrigin="anonymous"; audio.loop=true;
    try{ srcNode=ac.createMediaElementSource(audio); srcNode.connect(analyser);}catch(e){ /* fallback */ audio.connect&&0; }
    audio.play().then(()=>{playing=true; markTracks();}).catch(()=>{ playing=true; markTracks(); });
    say(pick(["Nice pick.","This one slaps.","Ryan's favorite, this.","Turn it up."]));
  }
  function stopTrack(){ if(audio){ audio.pause(); audio.currentTime=0; } playing=false; markTracks(); }
  function markTracks(){ inner.querySelectorAll(".mz-track").forEach((b,i)=>b.classList.toggle("on", i===curTrack&&playing)); }

  // ---- beat pad ----
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
    document.getElementById("mzPlay").textContent="■ Stop";
    const tick=()=>{
      for(let r=0;r<padRows;r++) if(pattern[r][step]) blip(NOTES[r][step%6],0.16);
      stepClass();
      step=(step+1)%padCols;
      seqTimer=setTimeout(tick, (60/bpm)*1000/2);
    };
    tick();
    say("Now we're cooking. 🔥");
  }
  function stopPad(){ padPlaying=false; if(seqTimer)clearTimeout(seqTimer); seqTimer=null;
    const b=document.getElementById("mzPlay"); if(b)b.textContent="▶ Run";
    const g=document.getElementById("mzGrid"); if(g)g.querySelectorAll(".pad-cell").forEach(c=>c.classList.remove("col")); }

  function wire(){
    document.getElementById("mzClose").onclick=close;
    document.getElementById("mzPlay").onclick=runPad;
    document.getElementById("mzClear").onclick=()=>{ buildPad(); };
    document.getElementById("mzBpm").oninput=(e)=>{ bpm=+e.target.value; };
  }

  let sayUntil=0, sayText="", pa=0,pd=0,pt=0;
  function pick(a){return a[Math.floor(Math.random()*a.length)];}
  function say(t){ sayText=t; sayUntil=performance.now()+3000; }

  function drawViz(){
    if(!vctx) return;
    const W=720,H=120; vctx.clearRect(0,0,W,H);
    let arr;
    if(analyser && (playing||padPlaying)){ analyser.getByteFrequencyData(data); arr=data; }
    const n=32, bw=W/n;
    for(let i=0;i<n;i++){
      let v;
      if(arr){ v=arr[i%arr.length]/255; }
      else { v=0.12+0.10*Math.abs(Math.sin(performance.now()/600+i*0.5)); }
      const h=Math.max(3,v*H);
      const hue= (200 + i*4)%360;
      vctx.fillStyle=`hsl(${hue} 70% ${40+v*25}%)`;
      vctx.fillRect(i*bw+2, H-h, bw-4, h);
    }
  }

  function loop(){
    try{
    const now=performance.now();
    pt+=1/60;
    const active = playing||padPlaying;
    const f=Math.floor(pt*(active?12:5));
    const pA=document.getElementById("mzPortA"), pD=document.getElementById("mzPortD");
    if(pA) SPRITES.drawPortraitFrame(pA.getContext("2d"),"port_Alex", active?f:0,64,64);
    if(pD) SPRITES.drawPortraitFrame(pD.getContext("2d"),"port_DJ", active?f+3:0,64,64);
    const se=document.getElementById("mzSay");
    if(se){ se.textContent = now<sayUntil?sayText:""; }
    drawViz();
    }catch(err){ console.error("music loop", err); }
    raf=requestAnimationFrame(loop);
  }

  return { open, close, isOpen:()=>!host.classList.contains("hidden") };
})();
