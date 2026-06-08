/* ============================================================
   SPRITES — character + portrait drawing
   Character sheet: 32x64 frames. Row 1 = idle, Row 2 = walk.
   Direction columns: left@0, up@6, right@12, down@18 (6 frames each).
   ============================================================ */
window.SPRITES = (function(){
  const A = window.ASSETS;
  const FW = A.CHAR_FW, FH = A.CHAR_FH;

  // Draw a character sprite.
  //  key   : ASSETS key, e.g. "char_Player"
  //  cx,cy : center-bottom anchor in canvas px (feet point)
  //  dir   : 'left'|'up'|'right'|'down'
  //  moving: bool -> walk row vs idle row
  //  frame : animation frame counter (int, will be mod'd)
  //  scale : draw scale (default 1; sprites are 32x64 source)
  function drawChar(ctx, key, cx, cy, dir, moving, frame, scale){
    const img = A.get(key);
    if (!img || !img.complete || !img.naturalWidth) return;
    scale = scale || 1;
    const row = moving ? A.ROW_WALK : A.ROW_IDLE;
    const col0 = A.DIR_COL[dir] != null ? A.DIR_COL[dir] : A.DIR_COL.down;
    const f = ((frame % A.DIR_FRAMES) + A.DIR_FRAMES) % A.DIR_FRAMES;
    const sx = (col0 + f) * FW;
    const sy = row * FH;
    const dw = FW * scale, dh = FH * scale;
    const dx = Math.round(cx - dw/2);
    const dy = Math.round(cy - dh);
    ctx.drawImage(img, sx, sy, FW, FH, dx, dy, dw, dh);
  }

  // soft shadow ellipse under feet
  function drawShadow(ctx, cx, cy, w, scale){
    scale = scale || 1;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(cx, cy-2, (w*0.42)*scale, (5)*scale, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // --- pets (cat/dog) -------------------------------------------------------
  // Each pet has its own spritesheet (NOT the 32x64 char layout): row 0 = idle,
  // row 1 = being petted. The cat's petting frames span two sheet rows, so its
  // frame->source mapping is listed explicitly (cross-row).
  const PET = {
    dog: { img:"pet_dog", fw:230, fh:340,
           idle:  { frames:4, y:0   },
           petted:{ frames:4, y:340 } },
    cat: { img:"pet_cat", fw:425, fh:325,
           idle:  { frames:2, y:0 },
           // frames 0-1 on the row at y=325, frames 2-3 on the row at y=650
           petted:{ frames:4, cross:[[0,325],[1,325],[0,650],[1,650]] } }
  };
  // Draw a pet centered on (cx) with feet at (cy), filling w x h canvas px.
  function drawPet(ctx, kind, cx, cy, state, frame, w, h){
    const cfg = PET[kind]; if(!cfg) return;
    const img = A.get(cfg.img);
    if(!img || !img.complete || !img.naturalWidth) return;
    const a = cfg[state] || cfg.idle;
    const f = ((frame % a.frames) + a.frames) % a.frames;
    let sx, sy;
    if(a.cross){ const c=a.cross[f]; sx=c[0]*cfg.fw; sy=c[1]; }
    else { sx = f*cfg.fw; sy = a.y; }
    const dx = Math.round(cx - w/2), dy = Math.round(cy - h);
    ctx.drawImage(img, sx, sy, cfg.fw, cfg.fh, dx, dy, w, h);
  }

  // Draw one talking-portrait frame into a 64x64 (or scaled) canvas ctx.
  function drawPortraitFrame(ctx, key, frame, dw, dh){
    const img = A.get(key);
    if (!img || !img.complete || !img.naturalWidth) return;
    const cols = A.PORT_COLS, total = A.PORT_FRAMES;
    const f = ((frame % total) + total) % total;
    const sx = (f % cols) * A.PORT_FW;
    const sy = Math.floor(f / cols) * A.PORT_FH;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,dw,dh);
    ctx.drawImage(img, sx, sy, A.PORT_FW, A.PORT_FH, 0, 0, dw, dh);
  }

  return { drawChar, drawShadow, drawPet, drawPortraitFrame, FW, FH };
})();
