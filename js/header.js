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
  // crisp inline icons (tint with currentColor)
  const ICON = {
    mail:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm.7 2L12 12l7.3-5H4.7zM19 8.2l-6.4 4.4a1 1 0 0 1-1.2 0L5 8.2V17h14V8.2z"/></svg>',
    phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 10.6a14 14 0 0 0 6 6l2-2a1 1 0 0 1 1-.25 10.6 10.6 0 0 0 3.3.53 1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A16 16 0 0 1 4 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 10.6 10.6 0 0 0 .53 3.3 1 1 0 0 1-.25 1l-2 2z"/></svg>',
    linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.3 8.4h3.3V21H3.3V8.4zM9.4 8.4h3.16v1.72h.05c.44-.83 1.52-1.72 3.13-1.72 3.34 0 3.96 2.2 3.96 5.06V21h-3.3v-5.78c0-1.38-.03-3.15-1.92-3.15-1.92 0-2.22 1.5-2.22 3.05V21H9.4V8.4z"/></svg>',
    instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c2.67 0 2.99.01 4.04.06 1.05.05 1.77.22 2.4.46.64.25 1.18.58 1.72 1.12.54.54.87 1.08 1.12 1.72.24.63.41 1.35.46 2.4.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.05 1.05-.22 1.77-.46 2.4-.25.64-.58 1.18-1.12 1.72-.54.54-1.08.87-1.72 1.12-.63.24-1.35.41-2.4.46-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-1.05-.05-1.77-.22-2.4-.46a4.8 4.8 0 0 1-1.72-1.12 4.8 4.8 0 0 1-1.12-1.72c-.24-.63-.41-1.35-.46-2.4C2.21 14.99 2.2 14.67 2.2 12s.01-2.99.06-4.04c.05-1.05.22-1.77.46-2.4.25-.64.58-1.18 1.12-1.72.54-.54 1.08-.87 1.72-1.12.63-.24 1.35-.41 2.4-.46C9.01 2.21 9.33 2.2 12 2.2zm0 1.8c-2.62 0-2.93.01-3.96.06-.96.04-1.48.2-1.82.34-.46.18-.79.39-1.13.74-.35.34-.56.67-.74 1.13-.13.34-.3.86-.34 1.82C4.01 9.07 4 9.38 4 12s.01 2.93.06 3.96c.04.96.2 1.48.34 1.82.18.46.39.79.74 1.13.34.35.67.56 1.13.74.34.13.86.3 1.82.34 1.03.05 1.34.06 3.96.06s2.93-.01 3.96-.06c.96-.04 1.48-.2 1.82-.34.46-.18.79-.39 1.13-.74.35-.34.56-.67.74-1.13.13-.34.3-.86.34-1.82.05-1.03.06-1.34.06-3.96s-.01-2.93-.06-3.96c-.04-.96-.2-1.48-.34-1.82a3 3 0 0 0-.74-1.13 3 3 0 0 0-1.13-.74c-.34-.13-.86-.3-1.82-.34C14.93 4.01 14.62 4 12 4zm0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28zm5.13-2.96a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3z"/></svg>'
  };

  function panelHead(kicker, title, lead){
    let h = `<div class="pn-kicker">${kicker}</div>`;
    if (title) h += `<h2 class="pn-title">${title}</h2>`;
    if (lead) h += `<p class="pn-lead">${lead}</p>`;
    return h;
  }

  function aboutHTML(){
    const a = C.about;
    const facts = (a.facts||[]).map(f=>
      `<div class="ab-fact"><dt>${f.label}</dt><dd>${f.value}</dd></div>`).join("");
    const skills = (a.skills||[]).map(s=>`<li class="pn-tag">${s}</li>`).join("");
    return `
      <div class="ab-hero">
        <span class="ab-photo"><img src="${a.photo}" alt="Portrait of ${a.name}" width="132" height="132" loading="lazy" draggable="false"></span>
        <div class="ab-id">
          <div class="pn-kicker">${a.kicker}</div>
          <h2 class="ab-name">${a.name}</h2>
          <p class="ab-role">${a.role}</p>
          <p class="ab-loc">${a.location}</p>
        </div>
      </div>
      <p class="ab-tagline">${a.lead}</p>
      <p class="ab-bio">${a.bio}</p>
      <dl class="ab-facts">${facts}</dl>
      ${skills?`<div class="ab-skills"><span class="ab-skills-h">Toolkit</span><ul class="pn-tags">${skills}</ul></div>`:""}`;
  }

  function experienceHTML(){
    const e = C.experience;
    const rows = (e.items||[]).map((it,i)=>`
      <li class="xp-row" style="--d:${0.06+i*0.05}s">
        <span class="xp-logo"><img src="${it.logo}" alt="${it.company} logo" loading="lazy" draggable="false"></span>
        <div class="xp-body">
          <div class="xp-line"><h3 class="xp-role">${it.role}</h3><span class="xp-period">${it.period}</span></div>
          <div class="xp-company">${it.company}</div>
          <p class="xp-desc">${it.p}</p>
        </div>
      </li>`).join("");
    return panelHead(e.kicker, e.title, e.lead) + `<ol class="xp-list">${rows}</ol>`;
  }

  function projectsHTML(){
    const p = C.projects;
    const ext='target="_blank" rel="noopener"';
    const rows = (p.items||[]).map((it,i)=>{
      const title = it.link
        ? `<h3 class="pj-title"><a class="pj-link" href="${it.link}" ${ext}>${it.h}<span class="pj-ext" aria-hidden="true">↗</span></a></h3>`
        : `<h3 class="pj-title">${it.h}</h3>`;
      return `
      <li class="pj-row" style="--d:${0.06+i*0.045}s">
        <span class="pj-num">${String(i+1).padStart(2,"0")}</span>
        <div class="pj-body">${title}<p class="pj-desc">${it.p}</p></div>
      </li>`;
    }).join("");
    return panelHead(p.kicker, p.title, p.lead) + `<ol class="pj-list">${rows}</ol>`;
  }

  function contactHTML(){
    const c=C.contact, o=C.owner;
    const ext='target="_blank" rel="noopener"';
    const rows = [
      {ic:"mail",      label:"Email",     val:o.email,         href:"mailto:"+o.email},
      {ic:"phone",     label:"Phone",     val:o.phoneDisplay,  href:"tel:"+o.phoneIntl},
      {ic:"linkedin",  label:"LinkedIn",  val:"kerui-huang",   href:o.linkedin, ext:true},
      {ic:"instagram", label:"Instagram", val:"@itsryianx",    href:o.instagram, ext:true}
    ].map((r,i)=>`
      <li class="ct-row" style="--d:${0.06+i*0.05}s">
        <a class="ct-link" href="${r.href}" ${r.ext?ext:""}>
          <span class="ct-ic">${ICON[r.ic]}</span>
          <span class="ct-text"><span class="ct-label">${r.label}</span><span class="ct-val">${r.val}</span></span>
          <span class="ct-go" aria-hidden="true">→</span>
        </a>
      </li>`).join("");
    return panelHead(c.kicker, c.title, c.lead) + `<ul class="ct-list">${rows}</ul>`;
  }

  const RENDER = { about:aboutHTML, experience:experienceHTML, projects:projectsHTML, contact:contactHTML };
  let panelHideTimer = null;

  function openPanel(kind){
    const render = RENDER[kind]; if(!render) return;
    if (panelHideTimer){ clearTimeout(panelHideTimer); panelHideTimer = null; }
    panelInner.innerHTML = render();
    panelInner.scrollTop = 0;
    panel.setAttribute("aria-hidden","false");
    panel.setAttribute("aria-label", (C[kind] && C[kind].kicker) || "Section");
    panel.classList.remove("hidden"); scrim.classList.remove("hidden");
    requestAnimationFrame(()=>{ panel.classList.add("in"); scrim.classList.add("in"); });
    if (window.GAME) GAME.pause(true);
  }
  function closePanel(){
    if (panel.classList.contains("hidden")) return;
    panel.classList.remove("in"); scrim.classList.remove("in");
    panel.setAttribute("aria-hidden","true");
    if (panelHideTimer) clearTimeout(panelHideTimer);
    panelHideTimer = setTimeout(()=>{ panel.classList.add("hidden"); scrim.classList.add("hidden"); panelHideTimer = null; }, 360);
    if (window.GAME) GAME.pause(false);
  }

  // ---------- room map (dollhouse floor plan) ----------
  // Per-room map metadata: short name, accent colour, and a crisp inline glyph.
  const MAP_META = {
    lounge: { name:"Lounge",        accent:"#dcb83f",
      icon:'<svg viewBox="0 0 24 24"><path d="M20 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 0 0-2 2v5a1 1 0 0 0 1 1h1v2h2v-2h12v2h2v-2h1a1 1 0 0 0 1-1v-5a2 2 0 0 0-2-2m-3.5 1A1.5 1.5 0 0 0 15 10.5V12H9v-1.5A1.5 1.5 0 0 0 7.5 9H6V6h12v3z"/></svg>' },
    gym: { name:"Gym",              accent:"#93ab5f",
      icon:'<svg viewBox="0 0 24 24"><rect x="2" y="8" width="3" height="8" rx="1"/><rect x="5" y="9.5" width="2" height="5" rx="1"/><rect x="7.5" y="11" width="9" height="2" rx="1"/><rect x="17" y="9.5" width="2" height="5" rx="1"/><rect x="19" y="8" width="3" height="8" rx="1"/></svg>' },
    game: { name:"Game Room",       accent:"#7fa3cf",
      icon:'<svg viewBox="0 0 24 24"><path d="M21.58 16.09 20.5 8.43A4 4 0 0 0 16.53 5H7.47a4 4 0 0 0-3.97 3.43l-1.08 7.66a2.5 2.5 0 0 0 4.5 1.79L8.5 16h7l1.55 1.88a2.5 2.5 0 0 0 4.53-1.79M11 11H9v2H7v-2H5V9h2V7h2v2h2zm4.5-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2m2.5 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2"/></svg>' },
    music: { name:"Music Studio",   accent:"#c95a4f",
      icon:'<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>' }
  };

  function openMap(){
    // the opening cinematic owns the player until it finishes — don't let the
    // map (and its fast-travel) interrupt it, or the walk-in carries into the next room
    if(window.GAME && GAME.isIntro && GAME.isIntro()) return;
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
          '<img class="mr-thumb" src="assets/maps/'+key+'.png?v=3" alt="" draggable="false">'+
          (here ? '<span class="mr-here">You’re here</span>' : '')+
          '<span class="mr-label">'+
            '<span class="mr-ic">'+m.icon+'</span>'+
            '<span class="mr-name">'+m.name+'</span>'+
            (here ? '' : '<span class="mr-arrow" aria-hidden="true">→</span>')+
          '</span>'+
        '</span>';
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

  // ---------- mobile nav dropdown ----------
  function setMenu(open){
    header.classList.toggle("nav-open", open);
    const b = header.querySelector(".hd-burger");
    if(b) b.setAttribute("aria-expanded", open ? "true" : "false");
  }

  // ---------- wiring ----------
  function init(){
    document.querySelectorAll("[data-nav]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const k=btn.getAttribute("data-nav");
        if(k==="menu"){ setMenu(!header.classList.contains("nav-open")); return; }
        if(["about","experience","projects","contact"].includes(k)){ openPanel(k); setMenu(false); }
        else if(k==="map"){ openMap(); setMenu(false); }
        else if(k==="sound" && window.GAME) GAME.toggleSound(btn);
        else if(k==="home" && window.GAME){ GAME.travelTo("lounge"); setMenu(false); }
      });
    });
    panelClose.addEventListener("click",closePanel);
    scrim.addEventListener("click",closePanel);
    panel.addEventListener("click",(e)=>{ if(e.target===panel) closePanel(); });
    mapClose.addEventListener("click",closeMap);
    // tapping anywhere outside the header dismisses the open mobile nav
    document.addEventListener("pointerdown",(e)=>{
      if(header.classList.contains("nav-open") && !header.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown",(e)=>{
      if(e.key==="Escape"){ closePanel(); closeMap(); setMenu(false); }
    });
  }

  return { reveal, init, openPanel, openMap, closePanel, closeMap };
})();
