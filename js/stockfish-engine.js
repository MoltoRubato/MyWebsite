/* ============================================================
   STOCKFISH BRIDGE — drives the official Stockfish WASM build
   (assets/engine/stockfish.wasm.js) in a Web Worker over UCI.
   Single-threaded build: no SharedArrayBuffer / COOP-COEP needed,
   so it runs on plain static hosting (GitHub Pages, etc.).
   Async by nature; CHESS falls back to the built-in engine if the
   worker can't load (e.g. opened via file://).
   ============================================================ */
window.SFENGINE = (function(){
  const SRC = "assets/engine/stockfish.wasm.js";
  let worker=null, dead=false, readyP=null, bootResolve=null, bootTimer=0;
  let pending=null;          // { resolve, id }
  let reqId=0;

  function onLine(line){
    if(typeof line!=="string") return;
    if(line==="readyok"){
      if(bootResolve){ clearTimeout(bootTimer); const r=bootResolve; bootResolve=null; r(true); }
      return;
    }
    if(pending && line.lastIndexOf("bestmove",0)===0){
      const mv=line.split(/\s+/)[1];
      const p=pending; pending=null;
      p.resolve(mv && mv!=="(none)" ? mv : null);
    }
  }

  // Lazily boot the worker. Resolves true once the engine answers `readyok`,
  // false if the worker can't be created or doesn't respond in time.
  function init(){
    if(readyP) return readyP;
    readyP = new Promise((resolve)=>{
      if(typeof Worker==="undefined"){ dead=true; return resolve(false); }
      try{ worker=new Worker(SRC); }
      catch(e){ dead=true; return resolve(false); }
      bootResolve=resolve;
      bootTimer=setTimeout(()=>{ if(bootResolve){ dead=true; const r=bootResolve; bootResolve=null; r(false); } }, 12000);
      worker.onmessage=(e)=>{ const d=e.data; onLine(typeof d==="string"?d:(d&&d.line)); };
      worker.onerror=()=>{ if(bootResolve){ clearTimeout(bootTimer); dead=true; const r=bootResolve; bootResolve=null; r(false); }
                           else { dead=true; } };
      worker.postMessage("uci");
      worker.postMessage("isready");
    });
    return readyP;
  }

  // Resolve to a UCI bestmove string ("e2e4") for a FEN, or null on failure.
  // opts: { skill:0..20, movetime:ms }. One search at a time.
  function bestMove(fen, opts){
    if(dead || !worker) return Promise.resolve(null);
    return new Promise((resolve)=>{
      if(pending){ const p=pending; pending=null; p.resolve(null); }   // cancel a stale one
      const id=++reqId; pending={ resolve, id };
      const skill=(opts && opts.skill!=null) ? opts.skill : 20;
      const mt=(opts && opts.movetime) || 500;
      worker.postMessage("setoption name Skill Level value "+skill);
      worker.postMessage("position fen "+fen);
      worker.postMessage("go movetime "+mt);
      // safety net: never hang the turn if the engine goes quiet
      setTimeout(()=>{ if(pending && pending.id===id){ const p=pending; pending=null; p.resolve(null); } }, mt+5000);
    });
  }

  function newGame(){ if(worker && !dead){ try{ worker.postMessage("ucinewgame"); }catch(_){} } }

  return { init, ready:init, bestMove, newGame, isDead:()=>dead };
})();
