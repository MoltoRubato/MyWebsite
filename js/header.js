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

  // ---------- room map ----------
  function openMap(){
    const cur = window.GAME ? GAME.currentRoom() : "lounge";
    const layout = [
      [null,"gym",null],
      ["game","lounge","music"],
      [null,null,null]
    ];
    mapGrid.innerHTML="";
    layout.forEach(row=>row.forEach(key=>{
      const cell=document.createElement("div");
      if(!key){ cell.className="map-cell empty"; mapGrid.appendChild(cell); return; }
      const r=WORLD.ROOMS[key];
      cell.className="map-cell on"+(key===cur?" here":"");
      cell.innerHTML=`<div class="mc-ic">${r.mapIcon}</div><div>${r.label.replace('The ','')}</div>`+(key===cur?'<div class="here-tag">HERE</div>':'');
      if(key!==cur) cell.onclick=()=>{ closeMap(); if(window.GAME) GAME.travelTo(key); };
      mapGrid.appendChild(cell);
    }));
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
