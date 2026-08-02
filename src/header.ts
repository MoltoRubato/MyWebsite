/* ============================================================
   HEADER — nav panels, room map (fast travel), sound toggle.
   The GAME instance is injected via init() rather than reached
   through a global, so the dependency is explicit.
   ============================================================ */
import { CONTENT as C } from "./content";
import { ROOMS } from "./world";
import * as P from "./progress";
import { cheer } from "./fx";
import type { GameApi, PanelKey, RoomKey } from "./core/types";

const header = document.getElementById("siteHeader") as HTMLElement;
const panel = document.getElementById("panel") as HTMLElement;
const panelInner = document.getElementById("panelInner") as HTMLElement;
const scrim = document.getElementById("panelScrim") as HTMLElement;
const panelClose = document.getElementById("panelClose") as HTMLElement;
const mapModal = document.getElementById("mapModal") as HTMLElement;
const mapGrid = document.getElementById("mapGrid") as HTMLElement;
const mapClose = document.getElementById("mapClose") as HTMLElement;

let game: GameApi | null = null;

export function reveal(): void {
  header.classList.remove("hidden");
  requestAnimationFrame(() => header.classList.add("in"));
}

// ---------- content panels ----------
// crisp inline icons (tint with currentColor)
const ICON: Record<string, string> = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm.7 2L12 12l7.3-5H4.7zM19 8.2l-6.4 4.4a1 1 0 0 1-1.2 0L5 8.2V17h14V8.2z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.4 10.6a14 14 0 0 0 6 6l2-2a1 1 0 0 1 1-.25 10.6 10.6 0 0 0 3.3.53 1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A16 16 0 0 1 4 4a1 1 0 0 1 1-1h3.3a1 1 0 0 1 1 1 10.6 10.6 0 0 0 .53 3.3 1 1 0 0 1-.25 1l-2 2z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.94 5a1.94 1.94 0 1 1-3.88 0 1.94 1.94 0 0 1 3.88 0zM3.3 8.4h3.3V21H3.3V8.4zM9.4 8.4h3.16v1.72h.05c.44-.83 1.52-1.72 3.13-1.72 3.34 0 3.96 2.2 3.96 5.06V21h-3.3v-5.78c0-1.38-.03-3.15-1.92-3.15-1.92 0-2.22 1.5-2.22 3.05V21H9.4V8.4z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c2.67 0 2.99.01 4.04.06 1.05.05 1.77.22 2.4.46.64.25 1.18.58 1.72 1.12.54.54.87 1.08 1.12 1.72.24.63.41 1.35.46 2.4.05 1.05.06 1.37.06 4.04s-.01 2.99-.06 4.04c-.05 1.05-.22 1.77-.46 2.4-.25.64-.58 1.18-1.12 1.72-.54.54-1.08.87-1.72 1.12-.63.24-1.35.41-2.4.46-1.05.05-1.37.06-4.04.06s-2.99-.01-4.04-.06c-1.05-.05-1.77-.22-2.4-.46a4.8 4.8 0 0 1-1.72-1.12 4.8 4.8 0 0 1-1.12-1.72c-.24-.63-.41-1.35-.46-2.4C2.21 14.99 2.2 14.67 2.2 12s.01-2.99.06-4.04c.05-1.05.22-1.77.46-2.4.25-.64.58-1.18 1.12-1.72.54-.54 1.08-.87 1.72-1.12.63-.24 1.35-.41 2.4-.46C9.01 2.21 9.33 2.2 12 2.2zm0 1.8c-2.62 0-2.93.01-3.96.06-.96.04-1.48.2-1.82.34-.46.18-.79.39-1.13.74-.35.34-.56.67-.74 1.13-.13.34-.3.86-.34 1.82C4.01 9.07 4 9.38 4 12s.01 2.93.06 3.96c.04.96.2 1.48.34 1.82.18.46.39.79.74 1.13.34.35.67.56 1.13.74.34.13.86.3 1.82.34 1.03.05 1.34.06 3.96.06s2.93-.01 3.96-.06c.96-.04 1.48-.2 1.82-.34.46-.18.79-.39 1.13-.74.35-.34.56-.67.74-1.13.13-.34.3-.86.34-1.82.05-1.03.06-1.34.06-3.96s-.01-2.93-.06-3.96c-.04-.96-.2-1.48-.34-1.82a3 3 0 0 0-.74-1.13 3 3 0 0 0-1.13-.74c-.34-.13-.86-.3-1.82-.34C14.93 4.01 14.62 4 12 4zm0 3.06a4.94 4.94 0 1 1 0 9.88 4.94 4.94 0 0 1 0-9.88zm0 1.8a3.14 3.14 0 1 0 0 6.28 3.14 3.14 0 0 0 0-6.28zm5.13-2.96a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3z"/></svg>',
};

// Split a (trusted, content.ts-authored) heading into per-letter spans so CSS
// can stagger them. Screen readers get the plain string via aria-label.
// Spaces become their own span (white-space:pre) — flex parents like .pj-link
// drop whitespace-only text nodes, which would glue the words together.
function lettersHTML(text: string): string {
  return [...text]
    .map((ch, i) => (ch === " " ? `<span class="ltr-sp"> </span>` : `<span class="ltr" style="--i:${i}">${ch}</span>`))
    .join("");
}

function panelHead(title?: string, lead?: string): string {
  let h = "";
  if (title) h += `<h2 class="pn-title" aria-label="${title}">${lettersHTML(title)}</h2>`;
  if (lead) h += `<p class="pn-lead">${lead}</p>`;
  return h;
}

function aboutHTML(): string {
  const a = C.about;
  const facts = (a.facts || []).map((f) => `<div class="ab-fact"><dt>${f.label}</dt><dd>${f.value}</dd></div>`).join("");
  const skills = (a.skills || []).map((s, i) => `<li class="pn-tag" style="--d:${0.28 + i * 0.022}s">${s}</li>`).join("");
  return `
      <div class="ab-hero">
        <span class="ab-photo"><img src="${a.photo}" alt="Portrait of ${a.name}" width="132" height="132" loading="lazy" draggable="false"></span>
        <div class="ab-id">
          <h2 class="ab-name" aria-label="${a.name}">${lettersHTML(a.name)}</h2>
          <p class="ab-role">${a.role}</p>
          <p class="ab-loc">${a.location}</p>
        </div>
      </div>
      <p class="ab-tagline">${a.lead}</p>
      <p class="ab-bio">${a.bio}</p>
      <dl class="ab-facts">${facts}</dl>
      ${skills ? `<div class="ab-skills"><span class="ab-skills-h">Toolkit</span><ul class="pn-tags">${skills}</ul></div>` : ""}`;
}

function experienceHTML(): string {
  const e = C.experience;
  const rows = (e.items || []).map((it, i) => `
      <li class="xp-row" style="--d:${0.06 + i * 0.05}s${it.accent ? `;--pc:${it.accent}` : ""}">
        <span class="xp-logo"><img src="${it.logo}" alt="${it.company} logo" loading="lazy" draggable="false"></span>
        <div class="xp-body">
          <div class="xp-line"><h3 class="xp-role" aria-label="${it.role}">${lettersHTML(it.role)}</h3><span class="xp-period">${it.period}</span></div>
          <div class="xp-company">${it.company}</div>
          <p class="xp-desc">${it.p}</p>
        </div>
      </li>`).join("");
  return panelHead(e.title) + `<ol class="xp-list">${rows}</ol>`;
}

function projectsHTML(): string {
  const p = C.projects;
  const ext = 'target="_blank" rel="noopener"';
  const rows = (p.items || []).map((it, i) => {
    const title = it.link
      ? `<h3 class="pj-title"><a class="pj-link" href="${it.link}" ${ext} aria-label="${it.h}">${lettersHTML(it.h)}<span class="pj-ext" aria-hidden="true">↗</span></a></h3>`
      : `<h3 class="pj-title" aria-label="${it.h}">${lettersHTML(it.h)}</h3>`;
    const mark = it.logo
      ? `<span class="pj-logo"><img src="${it.logo}" alt="" loading="lazy" draggable="false"></span>`
      : `<span class="pj-logo pj-logo--glyph" aria-hidden="true">${it.h.charAt(0)}</span>`;
    return `
      <li class="pj-row" style="--d:${0.06 + i * 0.045}s${it.accent ? `;--pc:${it.accent}` : ""}">
        <span class="pj-num">${String(i + 1).padStart(2, "0")}</span>
        ${mark}
        <div class="pj-body">${title}<p class="pj-desc">${it.p}</p></div>
      </li>`;
  }).join("");
  return panelHead(p.title, p.lead) + `<ol class="pj-list">${rows}</ol>`;
}

function contactHTML(): string {
  const c = C.contact, o = C.owner;
  const ext = 'target="_blank" rel="noopener"';
  const rows = [
    { ic: "mail", label: "Email", val: o.email, href: "mailto:" + o.email, pc: "#e7a33e" },
    { ic: "phone", label: "Phone", val: o.phoneDisplay, href: "tel:" + o.phoneIntl, pc: "#69b06a" },
    { ic: "linkedin", label: "LinkedIn", val: "kerui-huang", href: o.linkedin, ext: true, pc: "#3d7dc4" },
    { ic: "instagram", label: "Instagram", val: "@itsryianx", href: o.instagram, ext: true, pc: "#d6449b" },
  ].map((r, i) => `
      <li class="ct-row" style="--d:${0.06 + i * 0.05}s;--pc:${r.pc}">
        <a class="ct-link" href="${r.href}" ${r.ext ? ext : ""}>
          <span class="ct-ic">${ICON[r.ic]}</span>
          <span class="ct-text"><span class="ct-label">${r.label}</span><span class="ct-val">${r.val}</span></span>
          <span class="ct-go" aria-hidden="true">→</span>
        </a>
      </li>`).join("");
  return panelHead(c.title, c.lead) + `<ul class="ct-list">${rows}</ul>`;
}

// ---------- trophies (stats + achievements from src/progress.ts) ----------
// Same crisp inline-SVG recipe as ICON above; per-achievement pick with a
// trophy fallback. All text content comes from code, never from the visitor.
const BADGE: Record<string, string> = {
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12v2h3v4a4 4 0 0 1-4 4h-.35A6 6 0 0 1 13 15.92V18h3v2l1 2H7l1-2v-2h3v-2.08A6 6 0 0 1 7.35 12H7a4 4 0 0 1-4-4V4h3V2zm13 4h-1v3.5c0 .17 0 .34-.02.5H18a2 2 0 0 0 2-2V6zM5 6h1v4H6a2 2 0 0 1-2-2V6h1z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.5 12h-15L3 7zm3.2 10h11.6l.7-5.6-2.6 2.3L12 8l-3.9 5.7-2.6-2.3.7 5.6z"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z"/></svg>',
  paw: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 3.8c1.2 0 2.1 1.3 2.1 2.9S9.6 9.6 8.4 9.6 6.3 8.3 6.3 6.7s.9-2.9 2.1-2.9zm7.2 0c1.2 0 2.1 1.3 2.1 2.9s-.9 2.9-2.1 2.9-2.1-1.3-2.1-2.9.9-2.9 2.1-2.9zM3.6 9.2c1.1 0 2 1.1 2 2.5s-.9 2.5-2 2.5-2-1.1-2-2.5.9-2.5 2-2.5zm16.8 0c1.1 0 2 1.1 2 2.5s-.9 2.5-2 2.5-2-1.1-2-2.5.9-2.5 2-2.5zM12 11c2.6 0 6 3.2 6 5.9 0 1.6-1.1 2.6-2.6 2.6-1.1 0-2.2-.5-3.4-.5s-2.3.5-3.4.5c-1.5 0-2.6-1-2.6-2.6C6 14.2 9.4 11 12 11z"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>',
  skull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.1 6.6 5 8.1V22h2v-2.5h1.5V22h1V19.5H14V22h2v-2.9c2.9-1.5 5-4.5 5-8.1a9 9 0 0 0-9-9zM8.5 13.5A2 2 0 1 1 10.5 11.5a2 2 0 0 1-2 2zm7 0a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/></svg>',
};
const ACH_BADGE: Record<string, string> = {
  "drod-slayer": "crown", "card-shark": "crown", "trick-artist": "star", "combo-machine": "star",
  "good-human": "paw", "resident-dj": "note", "open-mic": "note", "producer": "note",
  "bankrupt": "skull", "humbled": "skull", "warned-you": "skull",
};
// per-badge hue for unlocked rows (hover tint, badge color, particles)
const BADGE_COLOR: Record<string, string> = {
  trophy: "#d59a37", crown: "#e7a33e", star: "#5fb0c9", paw: "#e58aa6", note: "#b07acb", skull: "#c94f4f",
};

function trophiesHTML(): string {
  const p = P.get();
  const n = (k: Parameters<typeof P.num>[0]): number => P.num(k);
  const roomsSeen = (["lounge", "gym", "game", "music"] as const).filter((r) => P.hasFlag(`room_${r}`)).length;
  const petsSeen = (p.flags["pet_Mimi"] ? 1 : 0) + (p.flags["pet_Batman"] ? 1 : 0);
  // Stats only appear once they have something to say — no wall of zeros.
  const rows: { k: string; v: string; show: boolean }[] = [
    { k: "Rooms explored", v: roomsSeen + "/4", show: true },
    { k: "Chess record", v: `${n("chessWins")}W–${n("chessLosses")}L–${n("chessDraws")}D`, show: n("chessWins") + n("chessLosses") + n("chessDraws") > 0 },
    { k: "8-ball wins", v: String(n("poolWins")), show: n("poolWins") + n("poolLosses") > 0 },
    { k: "Trick-shot stars", v: n("trickshotStars") + "/24", show: n("trickshotStars") > 0 },
    { k: "Best combo score", v: String(n("gymBest")), show: n("gymBest") > 0 },
    { k: "Rack stars", v: n("rackStars") + "/3", show: n("rackStars") > 0 },
    { k: "Poker chips (peak)", v: String(n("pokerChips")), show: n("pokerHands") > 0 },
    { k: "Poker hands", v: String(n("pokerHands")), show: n("pokerHands") > 0 },
    { k: "Piano notes", v: String(n("pianoNotes")), show: n("pianoNotes") > 0 },
    { k: "Beats downloaded", v: String(n("beatsDownloaded")), show: n("beatsDownloaded") > 0 },
    { k: "Tracks spun", v: P.flagCount("track_") + "/18", show: n("tracksPlayed") > 0 },
    { k: "Pets befriended", v: petsSeen + "/2", show: n("petsGiven") > 0 },
    { k: "Guestbook", v: P.hasFlag("guestbookSigned") ? "Signed ✓" : "—", show: true },
  ];
  const stats = rows.filter((r) => r.show).map((r) => `<div class="tr-stat"><dt>${r.k}</dt><dd>${r.v}</dd></div>`).join("");
  const all = P.achievements();
  const got = all.filter((a) => a.unlocked).length;
  const items = all
    .map(({ def, unlocked }, i) => {
      const kind = ACH_BADGE[def.id] || "trophy";
      const icon = BADGE[kind];
      const title = !unlocked && def.hidden ? "???" : def.title;
      const desc = !unlocked && def.hidden ? "Keep poking around…" : def.desc;
      return `
      <li class="tr-row ${unlocked ? "got" : "locked"}" style="--d:${0.06 + i * 0.035}s;--pc:${BADGE_COLOR[kind]}">
        <span class="tr-badge">${icon}</span>
        <div class="tr-body"><h3 class="tr-name">${title}</h3><p class="tr-desc">${desc}</p></div>
        ${unlocked ? '<span class="tr-tick" aria-hidden="true">✓</span>' : ""}
      </li>`;
    })
    .join("");
  return (
    panelHead("Trophy Shelf", "Everything you've poked, played, and petted in Ryan's place.") +
    `<section class="tr-summary" aria-label="Trophy progress">
       <dl class="tr-stats">${stats}</dl>
       <div class="tr-count">${got}/${all.length} unlocked</div>
       <div class="tr-bar" role="presentation"><span style="--p:${all.length ? got / all.length : 0}"></span></div>
     </section>
     <ol class="tr-list">${items}</ol>`
  );
}

const RENDER: Record<PanelKey, () => string> = { about: aboutHTML, experience: experienceHTML, projects: projectsHTML, contact: contactHTML, trophies: trophiesHTML };
// The trophies panel has no Content entry, so kickers live here, not on C.
const PANEL_KICKER: Record<PanelKey, string> = { about: "About", experience: "Experience", projects: "Projects", contact: "Contact", trophies: "Trophies" };
let panelHideTimer: ReturnType<typeof setTimeout> | null = null;

// bottom-edge fade: shown only while there is more content below the fold
function updatePanelFade(): void {
  const more = panelInner.scrollHeight - panelInner.clientHeight > 4 &&
    panelInner.scrollTop + panelInner.clientHeight < panelInner.scrollHeight - 4;
  panel.classList.toggle("has-more", more);
}

export function openPanel(kind: PanelKey): void {
  const render = RENDER[kind];
  if (!render) return;
  if (panelHideTimer) {
    clearTimeout(panelHideTimer);
    panelHideTimer = null;
  }
  panelInner.innerHTML = render();
  panelInner.scrollTop = 0;
  requestAnimationFrame(updatePanelFade);
  panel.setAttribute("aria-hidden", "false");
  panel.setAttribute("aria-label", PANEL_KICKER[kind] || "Section");
  panel.classList.remove("hidden");
  scrim.classList.remove("hidden");
  requestAnimationFrame(() => {
    panel.classList.add("in");
    scrim.classList.add("in");
  });
  // confetti off the top corners once the card has landed
  setTimeout(() => cheer(panel.querySelector(".panel-card")!), 250);
  game?.pause(true);
}
export function closePanel(): void {
  if (panel.classList.contains("hidden")) return;
  panel.classList.remove("in");
  scrim.classList.remove("in");
  panel.setAttribute("aria-hidden", "true");
  if (panelHideTimer) clearTimeout(panelHideTimer);
  panelHideTimer = setTimeout(() => {
    panel.classList.add("hidden");
    scrim.classList.add("hidden");
    panelHideTimer = null;
  }, 360);
  game?.pause(false);
}

// ---------- room map (dollhouse floor plan) ----------
interface MapMeta {
  name: string;
  accent: string;
  icon: string;
}
const MAP_META: Record<RoomKey, MapMeta> = {
  lounge: { name: "Lounge", accent: "#dcb83f", icon: '<svg viewBox="0 0 24 24"><path d="M20 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2a2 2 0 0 0-2 2v5a1 1 0 0 0 1 1h1v2h2v-2h12v2h2v-2h1a1 1 0 0 0 1-1v-5a2 2 0 0 0-2-2m-3.5 1A1.5 1.5 0 0 0 15 10.5V12H9v-1.5A1.5 1.5 0 0 0 7.5 9H6V6h12v3z"/></svg>' },
  gym: { name: "Gym", accent: "#93ab5f", icon: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="3" height="8" rx="1"/><rect x="5" y="9.5" width="2" height="5" rx="1"/><rect x="7.5" y="11" width="9" height="2" rx="1"/><rect x="17" y="9.5" width="2" height="5" rx="1"/><rect x="19" y="8" width="3" height="8" rx="1"/></svg>' },
  game: { name: "Game Room", accent: "#7fa3cf", icon: '<svg viewBox="0 0 24 24"><path d="M21.58 16.09 20.5 8.43A4 4 0 0 0 16.53 5H7.47a4 4 0 0 0-3.97 3.43l-1.08 7.66a2.5 2.5 0 0 0 4.5 1.79L8.5 16h7l1.55 1.88a2.5 2.5 0 0 0 4.53-1.79M11 11H9v2H7v-2H5V9h2V7h2v2h2zm4.5-1a1 1 0 1 1 0-2 1 1 0 0 1 0 2m2.5 3a1 1 0 1 1 0-2 1 1 0 0 1 0 2"/></svg>' },
  music: { name: "Music Studio", accent: "#c95a4f", icon: '<svg viewBox="0 0 24 24"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z"/></svg>' },
};

export function openMap(): void {
  // the opening cinematic owns the player until it finishes — don't let the
  // map (and its fast-travel) interrupt it.
  if (game?.isIntro()) return;
  const cur = game ? game.currentRoom() : "lounge";
  mapGrid.innerHTML = "";
  // doorway connectors — every door runs through the lounge hub
  (["gym", "game", "music"] as const).forEach((k) => {
    const link = document.createElement("div");
    link.className = "map-link l-" + k;
    link.innerHTML = '<span class="ml-jamb"></span><span class="ml-jamb"></span>';
    mapGrid.appendChild(link);
  });
  // room cards, positioned by CSS into their true spatial layout
  (Object.keys(ROOMS) as RoomKey[]).forEach((key) => {
    const m = MAP_META[key], here = key === cur;
    const card = document.createElement(here ? "div" : "button");
    card.className = "map-room r-" + key + (here ? " here" : "");
    card.style.setProperty("--rc", m.accent);
    card.innerHTML =
      '<span class="mr-frame">' +
      '<img class="mr-thumb" src="assets/maps/' + key + '.png?v=3" alt="" draggable="false">' +
      (here ? '<span class="mr-here">You’re here</span>' : "") +
      '<span class="mr-label">' +
      '<span class="mr-ic">' + m.icon + "</span>" +
      '<span class="mr-name">' + m.name + "</span>" +
      (here ? "" : '<span class="mr-arrow" aria-hidden="true">→</span>') +
      "</span>" +
      "</span>";
    if (!here) {
      (card as HTMLButtonElement).type = "button";
      card.setAttribute("aria-label", "Travel to " + m.name);
      card.addEventListener("click", () => {
        closeMap();
        game?.travelTo(key);
      });
    } else {
      card.setAttribute("aria-current", "true");
    }
    mapGrid.appendChild(card);
  });
  mapModal.classList.remove("hidden");
  requestAnimationFrame(() => mapModal.classList.add("in"));
  game?.pause(true);
}
export function closeMap(): void {
  mapModal.classList.remove("in");
  setTimeout(() => mapModal.classList.add("hidden"), 300);
  game?.pause(false);
}

// ---------- mobile nav dropdown ----------
function setMenu(open: boolean): void {
  header.classList.toggle("nav-open", open);
  const b = header.querySelector(".hd-burger");
  if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
}

// ---------- wiring ----------
export function init(g: GameApi): void {
  game = g;
  // per-letter spans on the nav labels so hover can ripple through them;
  // the button keeps a plain aria-label for screen readers.
  document.querySelectorAll<HTMLElement>(".hd-link > span").forEach((sp) => {
    const label = sp.textContent || "";
    const btn = sp.parentElement;
    if (btn && !btn.getAttribute("aria-label")) btn.setAttribute("aria-label", label);
    sp.setAttribute("aria-hidden", "true");
    sp.innerHTML = lettersHTML(label);
  });
  panelInner.addEventListener("scroll", updatePanelFade, { passive: true });
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-nav");
      if (k === "menu") {
        setMenu(!header.classList.contains("nav-open"));
        return;
      }
      if (k === "about" || k === "experience" || k === "projects" || k === "contact" || k === "trophies") {
        openPanel(k);
        setMenu(false);
      } else if (k === "map") {
        openMap();
        setMenu(false);
      } else if (k === "sound") {
        game?.toggleSound(btn);
      } else if (k === "home") {
        game?.travelTo("lounge");
        setMenu(false);
      }
    });
  });
  panelClose.addEventListener("click", closePanel);
  scrim.addEventListener("click", closePanel);
  panel.addEventListener("click", (e) => {
    if (e.target === panel) closePanel();
  });
  mapClose.addEventListener("click", closeMap);
  // tapping anywhere outside the header dismisses the open mobile nav
  document.addEventListener("pointerdown", (e) => {
    if (header.classList.contains("nav-open") && !header.contains(e.target as Node)) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanel();
      closeMap();
      setMenu(false);
    }
  });
}
