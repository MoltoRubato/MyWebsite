/* ============================================================
   HEADER — nav panels, room map (fast travel), sound toggle
   ============================================================ */
window.HEADER = (function(){
  const C = window.CONTENT;
  const header = document.getElementById("siteHeader");
  const panel = document.getElementById("panel");
  const panelInner = document.getElementById("panelInner");
  const scrim = document.getElementById("panelScrim");
  const panelClose = document.getElementById("panelClose");
  const mapModal = document.getElementById("mapModal");
  const mapGrid = document.getElementById("mapGrid");
  const mapClose = document.getElementById("mapClose");

  function reveal(){ header.classList.remove("hidden"); requestAnimationFrame(()=>header.classList.add("in")); }

  // ---------- content panels ----------
  function itemsHTML(data){
    let h = `<div class="pn-kicker">${data.kicker}</div><h2 class="pn-title">${data.title}</h2>`;
    if (data.lead) h += `<p class="pn-lead">${data.lead}</p>`;
    (data.items||[]).forEach((it,i)=>{
      const tags = it.tags ? `<div class="pn-tags">${it.tags.map(t=>`<span class="pn-tag">${t}</span>`).join("")}</div>` : "";
      h += `<div class="pn-item" style="animation-delay:${0.18+i*0.07}s">
        <div class="meta">${it.meta||""}</div>
        <h4>${it.h}</h4><p>${it.p}</p>${tags}</div>`;
    });
    return h;
  }
  function contactHTML(){
    const c=C.contact, o=C.owner;
    return `<div class="pn-kicker">${c.kicker}</div><h2 class="pn-title">${c.title}</h2>
      <p class="pn-lead">${c.lead}</p>
      <div class="pn-contact">
        <a class="pn-cbtn" href="mailto:${o.email}"><span class="cb-ic">✉</span><span>Email<small>${o.email}</small></span></a>
        <a class="pn-cbtn" href="${o.linkedin}" target="_blank" rel="noopener"><span class="cb-ic">in</span><span>LinkedIn<small>kerui-huang</small></span></a>
        <a class="pn-cbtn" href="assets/Ryan_Huang_Resume.pdf" target="_blank" rel="noopener"><span class="cb-ic">⬇</span><span>Résumé<small>PDF download</small></span></a>
        <a class="pn-cbtn" href="https://${o.site}" target="_blank" rel="noopener"><span class="cb-ic">◎</span><span>Website<small>${o.site}</small></span></a>
      </div>`;
  }

  function openPanel(kind){
    let html="";
    if (kind==="about") html=itemsHTML(C.about);
    else if (kind==="experience") html=itemsHTML(C.experience);
    else if (kind==="projects") html=itemsHTML(C.projects);
    else if (kind==="contact") html=contactHTML();
    panelInner.innerHTML=html; panelInner.scrollTop=0;
    panel.classList.remove("hidden"); scrim.classList.remove("hidden");
    requestAnimationFrame(()=>{ panel.classList.add("in"); scrim.classList.add("in"); });
    // reveal item bars
    requestAnimationFrame(()=>{
      setTimeout(()=>panelInner.querySelectorAll(".pn-item").forEach(el=>el.classList.add("seen")), 250);
    });
    if (window.GAME) GAME.pause(true);
  }
  function closePanel(){
    panel.classList.remove("in"); scrim.classList.remove("in");
    setTimeout(()=>{ panel.classList.add("hidden"); scrim.classList.add("hidden"); }, 480);
    if (window.GAME) GAME.pause(false);
  }

  // ---------- room map (dollhouse floor plan) ----------
  // Per-room map metadata: short name, accent colour, and a crisp inline glyph.
  const MAP_META = {
    lounge: { name:"Lounge",        accent:"#d79a47",
      icon:'<svg viewBox="0 0 24 24"><path d="M20 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 0 0-2 2v5a1 1 0 0 0 1 1h1v2h2v-2h12v2h2v-2h1a1 1 0 0 0 1-1v-5a2 2 0 0 0-2-2m-3.5 1A1.5 1.5 0 0 0 15 10.5V12H9v-1.5A1.5 1.5 0 0 0 7.5 9H6V6h12v3z"/></svg>' },
    gym: { name:"Gym",              accent:"#d2574a",
      icon:'<svg viewBox="0 0 24 24"><path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/></svg>' },
    game: { name:"Game Room",       accent:"#4f9e6a",
      icon:'<svg viewBox="0 0 24 24"><path d="M21.58 16.09 20.5 8.43A4 4 0 0 0 16.53 5H7.47a4 4 0 0 0-3.97 3.43l-1.08 7.66a2.5 2.5 0 0 0 4.5 1.79L8.5 16h7l1.55 1.88a2.5 2.5 0 0 0 4.53-1.79M11 11H9v2H7v-2H5V9h2V7h2v2h2zm4.5-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2m2.5 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2"/></svg>' },
    music: { name:"Music Studio",   accent:"#5b8fd6",
      icon:'<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>' }
  };

  function openMap(){
    const cur = window.GAME ? GAME.currentRoom() : "lounge";
    mapGrid.innerHTML = "";
    // doorway connectors — every door runs through the lounge hub
    ["gym","game","music"].forEach(k=>{
      const link = document.createElement("div");
      link.className = "map-link l-"+k;
      link.innerHTML = '<span class="ml-jamb"></span><span class="ml-jamb"></span>';
      mapGrid.appendChild(link);
    });
    // room cards, positioned by CSS into their true spatial layout
    Object.keys(WORLD.ROOMS).forEach(key=>{
      const m = MAP_META[key], here = key===cur;
      const card = document.createElement(here ? "div" : "button");
      card.className = "map-room r-"+key+(here ? " here" : "");
      card.style.setProperty("--rc", m.accent);
      card.innerHTML =
        '<span class="mr-frame">'+
          '<img class="mr-thumb" src="assets/maps/'+key+'.png" alt="" draggable="false">'+
          (here
            ? '<span class="mr-here">You’re here</span>'
            : '<span class="mr-go">Enter<span class="mr-arrow">→</span></span>')+
        '</span>'+
        '<span class="mr-plate"><span class="mr-ic">'+m.icon+'</span><span class="mr-name">'+m.name+'</span></span>';
      if(!here){
        card.type = "button";
        card.setAttribute("aria-label", "Travel to "+m.name);
        card.addEventListener("click", ()=>{ closeMap(); if(window.GAME) GAME.travelTo(key); });
      } else {
        card.setAttribute("aria-current", "true");
      }
      mapGrid.appendChild(card);
    });
    mapModal.classList.remove("hidden");
    requestAnimationFrame(()=>mapModal.classList.add("in"));
    if (window.GAME) GAME.pause(true);
  }
  function closeMap(){
    mapModal.classList.remove("in");
    setTimeout(()=>mapModal.classList.add("hidden"),300);
    if (window.GAME) GAME.pause(false);
  }

  // ---------- wiring ----------
  function init(){
    document.querySelectorAll("[data-nav]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const k=btn.getAttribute("data-nav");
        if(["about","experience","projects","contact"].includes(k)) openPanel(k);
        else if(k==="map") openMap();
        else if(k==="sound" && window.GAME) GAME.toggleSound(btn);
        else if(k==="home" && window.GAME) GAME.travelTo("lounge");
      });
    });
    panelClose.addEventListener("click",closePanel);
    scrim.addEventListener("click",closePanel);
    mapClose.addEventListener("click",closeMap);
    document.addEventListener("keydown",(e)=>{
      if(e.key==="Escape"){ closePanel(); closeMap(); }
    });
  }

  return { reveal, init, openPanel, openMap, closePanel, closeMap };
})();
