/* ============================================================
   SCHEMATIC — abstract top-down floor-plan renderer for the map.
   Sparse "minimap" style, inspired by Enter the Gungeon: each room is
   a flat, accent-tinted floor with a crisp wall outline + door gaps,
   and furniture is reduced to simple abstract footprints — no detail.
   The point is to read the SHAPE of the room and how it connects, not
   to depict the furniture. The accent colour tints the floor so rooms
   stay identifiable; everything else stays a clean schematic.
   Self-contained Canvas2D; no images. Call SCHEMATIC.draw(ctx, key, room).
     room = { view:{x,y,w,h}, accent:"#hex", depth:[...], doors:[...], spawn:{x,y,face} }
   ============================================================ */
window.SCHEMATIC = (function(){
function drawRoom(ctx, roomKey, room) {
  if (!ctx || !room || !room.view) return;
  ctx.imageSmoothingEnabled = false;

  var V = room.view;
  var W = Math.max(1, V.w || 1), H = Math.max(1, V.h || 1);
  var ox = V.x || 0, oy = V.y || 0;
  var accent = (typeof room.accent === "string" && room.accent) ? room.accent : "#cf9a4f";
  var depth = Array.isArray(room.depth) ? room.depth : [];
  var doors = Array.isArray(room.doors) ? room.doors : [];

  // ---- helpers -------------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function T(wx, wy) { return [wx - ox, wy - oy]; } // world -> canvas

  function hx(c) {
    c = (c || "#000000").replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var n = parseInt(c, 16);
    if (isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgb(o) { return "rgb(" + (o.r | 0) + "," + (o.g | 0) + "," + (o.b | 0) + ")"; }
  function rgba(o, a) { return "rgba(" + (o.r | 0) + "," + (o.g | 0) + "," + (o.b | 0) + "," + a + ")"; }
  function mix(a, b, t) { return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }; }
  function lighten(c, t) { return mix(c, { r: 255, g: 255, b: 255 }, t); }
  function darken(c, t) { return mix(c, { r: 0, g: 0, b: 0 }, t); }
  function str(c) { return rgb(c); }

  function rr(x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + r);
    ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    ctx.closePath();
  }
  function fillRR(x, y, w, h, r, fill) { rr(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
  function strokeRR(x, y, w, h, r, s, lw) { rr(x, y, w, h, r); ctx.strokeStyle = s; ctx.lineWidth = lw || 1; ctx.stroke(); }
  function disc(cx, cy, rad, fill) { ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, rad), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function ring(cx, cy, rad, s, lw) { ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.5, rad), 0, Math.PI * 2); ctx.strokeStyle = s; ctx.lineWidth = lw || 1; ctx.stroke(); }
  function ellip(cx, cy, rx, ry, fill, a) {
    ctx.save(); if (a != null) ctx.globalAlpha = a;
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }

  // ---- palette: a muted slate tinted by the room accent (minimap feel) -----
  var acc = hx(accent);
  var slate = { r: 0x3c, g: 0x45, b: 0x53 };          // cool neutral base
  var floor = mix(slate, acc, 0.36);                   // flat, accent-tinted floor
  var floorLite = lighten(floor, 0.14);
  var floorDark = darken(floor, 0.34);
  var wallCol = darken(floor, 0.50);                   // outline / wall ring
  var wallLite = lighten(floor, 0.26);
  // furniture footprints — a clean mid-dark tone, faintly pulled toward the
  // room accent so each room's shapes feel like they belong to its colour.
  var objCol = mix(darken(floor, 0.22), acc, 0.10);
  var objLite = lighten(objCol, 0.34);
  var objLine = darken(objCol, 0.40);

  var inset = 3;
  var ix = inset, iy = inset, iw = W - inset * 2, ih = H - inset * 2;
  var rad = 10;

  // =========================================================================
  // 1) FLOOR — one flat fill, a soft vignette, a hairline bevel. No texture.
  // =========================================================================
  ctx.save();
  fillRR(ix, iy, iw, ih, rad, str(floor));
  rr(ix, iy, iw, ih, rad); ctx.clip();

  var g = ctx.createRadialGradient(W * 0.5, H * 0.42, 8, W * 0.5, H * 0.55, Math.max(W, H) * 0.72);
  g.addColorStop(0, rgba(floorLite, 0.40));
  g.addColorStop(1, rgba(floorDark, 0.0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // faint sunken-floor bevel: bright top edge, shaded bottom edge
  ctx.fillStyle = rgba(floorLite, 0.4); ctx.fillRect(ix, iy, iw, 1);
  ctx.fillStyle = rgba(floorDark, 0.5); ctx.fillRect(ix, iy + ih - 2, iw, 2);

  // whisper-faint tile grid — reads as a schematic, never as a texture
  var tile = 72;
  ctx.strokeStyle = rgba(floorDark, 0.11); ctx.lineWidth = 1;
  for (var gx = ix + tile; gx < ix + iw; gx += tile) {
    ctx.beginPath(); ctx.moveTo(gx + 0.5, iy); ctx.lineTo(gx + 0.5, iy + ih); ctx.stroke();
  }
  for (var gy = iy + tile; gy < iy + ih; gy += tile) {
    ctx.beginPath(); ctx.moveTo(ix, gy + 0.5); ctx.lineTo(ix + iw, gy + 0.5); ctx.stroke();
  }
  ctx.restore();

  // a clean inset frame line just inside the wall — tidies the room edge
  strokeRR(ix + 3, iy + 3, iw - 6, ih - 6, Math.max(2, rad - 3), rgba(floorLite, 0.22), 1);

  // =========================================================================
  // 2) WALL ENVELOPE with door GAPS — this is what reads as the room "shape"
  // =========================================================================
  var gaps = { top: [], bottom: [], left: [], right: [] };
  for (var d = 0; d < doors.length; d++) {
    var dr = doors[d]; if (!dr) continue;
    var c = T(dr.x, dr.y);
    var dcx = c[0], dcy = c[1], dw = dr.w || 0, dh = dr.h || 0;
    var mcx = dcx + dw / 2, mcy = dcy + dh / 2;
    var dTop = mcy, dBot = H - mcy, dLeft = mcx, dRight = W - mcx;
    var mn = Math.min(dTop, dBot, dLeft, dRight);
    var pad = 2;
    if (mn === dTop) gaps.top.push([clamp(dcx - pad, 0, W), clamp(dcx + dw + pad, 0, W)]);
    else if (mn === dBot) gaps.bottom.push([clamp(dcx - pad, 0, W), clamp(dcx + dw + pad, 0, W)]);
    else if (mn === dLeft) gaps.left.push([clamp(dcy - pad, 0, H), clamp(dcy + dh + pad, 0, H)]);
    else gaps.right.push([clamp(dcy - pad, 0, H), clamp(dcy + dh + pad, 0, H)]);
  }
  function drawWallEdge(orient, fixed, a0, a1, gapList, thick) {
    var segs = [[a0, a1]];
    for (var i = 0; i < gapList.length; i++) {
      var ng = gapList[i], out = [];
      for (var j = 0; j < segs.length; j++) {
        var s = segs[j];
        if (ng[1] <= s[0] || ng[0] >= s[1]) { out.push(s); continue; }
        if (ng[0] > s[0]) out.push([s[0], ng[0]]);
        if (ng[1] < s[1]) out.push([ng[1], s[1]]);
      }
      segs = out;
    }
    for (var k = 0; k < segs.length; k++) {
      var s2 = segs[k]; if (s2[1] - s2[0] <= 0.5) continue;
      if (orient === "h") {
        ctx.fillStyle = str(wallCol); ctx.fillRect(s2[0], fixed, s2[1] - s2[0], thick);
        ctx.fillStyle = rgba(wallLite, 0.55); ctx.fillRect(s2[0], fixed, s2[1] - s2[0], 1);
      } else {
        ctx.fillStyle = str(wallCol); ctx.fillRect(fixed, s2[0], thick, s2[1] - s2[0]);
        ctx.fillStyle = rgba(wallLite, 0.55); ctx.fillRect(fixed, s2[0], 1, s2[1] - s2[0]);
      }
    }
  }
  var WT = 4;
  drawWallEdge("h", iy, ix, ix + iw, gaps.top, WT);
  drawWallEdge("h", iy + ih - WT, ix, ix + iw, gaps.bottom, WT);
  drawWallEdge("v", ix, iy, iy + ih, gaps.left, WT);
  drawWallEdge("v", ix + iw - WT, iy, iy + ih, gaps.right, WT);

  // door openings — a slim accent threshold along the wall, so exits read
  // without a big bar (the Lounge's side doors are tall, so fill the rect
  // brightly would draw a glowing column — a thin line tracks the opening).
  for (var dd = 0; dd < doors.length; dd++) {
    var d2 = doors[dd]; if (!d2) continue;
    var cc = T(d2.x, d2.y);
    var dx2 = cc[0], dy2 = cc[1], dw2 = d2.w || 6, dh2 = d2.h || 6;
    var mx2 = dx2 + dw2 / 2, my2 = dy2 + dh2 / 2;
    var thr = rgba(lighten(acc, 0.35), 0.5);
    if (Math.min(my2, H - my2) <= Math.min(mx2, W - mx2)) {
      fillRR(dx2 + 2, my2 - 1.5, Math.max(3, dw2 - 4), 3, 1.5, thr); // top/bottom wall
    } else {
      fillRR(mx2 - 1.5, dy2 + 2, 3, Math.max(3, dh2 - 4), 1.5, thr); // left/right wall
    }
  }

  // =========================================================================
  // 3) FURNITURE — abstract footprints only. Big things = flat blocks,
  //    small round things = dots, mats = faint floor decals. No detail.
  // =========================================================================
  var items = depth.slice().map(function (it, i) { return { it: it, i: i }; });
  items.sort(function (a, b) {
    var ay = (a.it.baseY != null ? a.it.baseY : (a.it.y || 0) + (a.it.h || 0));
    var bY = (b.it.baseY != null ? b.it.baseY : (b.it.y || 0) + (b.it.h || 0));
    return ay - bY;
  });

  function lab(it) { return (it.label || "").toLowerCase(); }
  function has(it) {
    var L = lab(it);
    for (var i = 1; i < arguments.length; i++) if (L.indexOf(arguments[i]) >= 0) return true;
    return false;
  }

  // soft contact shadow — keeps blocks sitting on the floor without detail
  function shadow(x, y, w, h, r) {
    rr(x + 1.5, y + 2.5, w, h, r); ctx.fillStyle = rgba({ r: 0, g: 0, b: 0 }, 0.18); ctx.fill();
  }

  // a clean abstract footprint: soft shadow, flat fill, a gentle top sheen,
  // crisp outline. Generous corner radius — no bevels, no detail.
  function block(x, y, w, h) {
    var r = Math.max(3, Math.min(9, Math.min(w, h) * 0.34));
    shadow(x, y, w, h, r);
    fillRR(x, y, w, h, r, str(objCol));
    ctx.save(); rr(x, y, w, h, r); ctx.clip();
    var lg = ctx.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, rgba(objLite, 0.5));
    lg.addColorStop(0.55, rgba(objLite, 0));
    ctx.fillStyle = lg; ctx.fillRect(x, y, w, h);
    ctx.restore();
    strokeRR(x, y, w, h, r, str(objLine), 1.25);
  }

  // a clean abstract dot: soft shadow, flat fill, gentle sheen, crisp ring
  function dot(cx, cy, rad) {
    ellip(cx, cy + rad * 0.5, rad, rad * 0.64, rgba({ r: 0, g: 0, b: 0 }, 1), 0.15);
    disc(cx, cy, rad, str(objCol));
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.clip();
    var lg = ctx.createLinearGradient(0, cy - rad, 0, cy + rad);
    lg.addColorStop(0, rgba(objLite, 0.55));
    lg.addColorStop(0.6, rgba(objLite, 0));
    ctx.fillStyle = lg; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    ctx.restore();
    ring(cx, cy, rad, str(objLine), 1.25);
  }

  for (var n = 0; n < items.length; n++) {
    var it = items[n].it; if (!it) continue;
    var p = T(it.x || 0, it.y || 0);
    var x = p[0], y = p[1], w = Math.max(4, it.w || 6), h = Math.max(4, it.h || 6);
    var cx = x + w / 2, cy = y + h / 2;

    // rugs / mats — a soft accent-tinted decal flush on the floor, no block
    if (has(it, "rug") || (has(it, "mat") && !has(it, "bench"))) {
      ellip(cx, cy, w * 0.52, h * 0.56, rgba(mix(floorLite, acc, 0.25), 1), 0.14);
      continue;
    }

    // small round props — a single clean dot
    var roundish = has(it, "ball", "plant", "decor", "stool", "hook", "mic", "vase", "flower");
    if (roundish && Math.max(w, h) <= 58) {
      dot(cx, cy, Math.min(w, h) * 0.46);
      continue;
    }

    // everything else — a flat abstract block
    block(x, y, w, h);
  }

  // =========================================================================
  // 4) door light spill — a subtle warm bloom at each opening, drawn last
  // =========================================================================
  ctx.save();
  rr(ix, iy, iw, ih, rad); ctx.clip();
  for (var df = 0; df < doors.length; df++) {
    var dz = doors[df]; if (!dz) continue;
    var cz = T(dz.x, dz.y);
    var gcx = cz[0] + (dz.w || 6) / 2, gcy = cz[1] + (dz.h || 6) / 2;
    var sp = Math.min(dz.w || 6, dz.h || 6) * 1.15 + 10; // glow on the door's narrow span, not a spotlight
    var rg = ctx.createRadialGradient(gcx, gcy, 1, gcx, gcy, sp);
    rg.addColorStop(0, rgba(lighten(acc, 0.4), 0.18));
    rg.addColorStop(1, rgba(acc, 0));
    ctx.fillStyle = rg; ctx.beginPath();
    ctx.arc(gcx, gcy, sp, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
  return { draw: drawRoom };
})();
