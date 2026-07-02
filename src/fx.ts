/* ============================================================
   FX — site-wide pixel-particle flourishes. One fixed overlay
   layer, document-level delegation (hover sparkles on text,
   bursts on clicks), Web Animations API for the flight so
   there's no per-frame JS. Each element can carry its own
   palette via --fx-color (set from the per-item accents in
   ui.css). Skips itself entirely under prefers-reduced-motion.
   ============================================================ */

const GOLD = "#e7a33e", GOLD_D = "#d59a37", CREAM = "#efe2c2";
const MAX_LIVE = 170; // hard cap on particles in flight
const HOVER_COOLDOWN = 320; // ms per element

// anything that should shed sparkles when the pointer wanders over it
const HOVER_SEL = [
  ".pn-title", ".ab-name", ".pn-lead", ".ab-tagline", ".ab-fact",
  ".hd-link", ".hd-logo", ".load-enter",
  ".pj-row", ".xp-row", ".ct-link", ".pn-tag", ".tr-row.got", ".tr-stat",
  ".ab-photo", ".map-room", ".map-title", ".gb-tab", ".dlg-choice",
].join(",");
const CLICK_SEL = "button,a";

let layer: HTMLElement | null = null;
let live = 0;
const lastSparkle = new WeakMap<Element, number>();

function palette(el: Element): string[] {
  const c = getComputedStyle(el).getPropertyValue("--fx-color").trim();
  return c ? [c, c, CREAM] : [GOLD, GOLD_D, CREAM];
}

/** Fire `n` pixel squares outward from (x, y) — viewport coords. */
export function burst(x: number, y: number, colors: string[], n: number, force: number): void {
  if (!layer) return;
  for (let i = 0; i < n && live < MAX_LIVE; i++) {
    const p = document.createElement("i");
    const size = Math.random() < 0.35 ? 4 : 3;
    p.className = "fx-p";
    p.style.width = p.style.height = size + "px";
    p.style.background = colors[i % colors.length];
    p.style.left = x + "px";
    p.style.top = y + "px";
    layer.appendChild(p);
    live++;
    const ang = Math.random() * Math.PI * 2;
    const dist = (0.35 + Math.random() * 0.65) * force;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist * 0.7 - force * 0.3; // bias upward…
    p.animate(
      [
        { transform: "translate(0,0)", opacity: 1 },
        { transform: `translate(${dx}px,${dy + force * 0.6}px)`, opacity: 0 }, // …then fall
      ],
      { duration: 420 + Math.random() * 360, easing: "cubic-bezier(.22,1,.36,1)" },
    ).onfinish = () => {
      p.remove();
      live--;
    };
  }
}

function sparkle(el: Element): void {
  const now = performance.now();
  if ((lastSparkle.get(el) ?? 0) > now) return;
  lastSparkle.set(el, now + HOVER_COOLDOWN);
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const colors = palette(el);
  const n = 5 + ((Math.random() * 4) | 0);
  for (let i = 0; i < n; i++) {
    burst(r.left + Math.random() * r.width, r.top + Math.random() * Math.max(6, r.height * 0.6), [colors[i % colors.length]], 1, 24);
  }
}

/** Celebration burst from an element's top edge (e.g. a window opening). */
export function cheer(el: Element): void {
  const r = el.getBoundingClientRect();
  if (!r.width || !layer) return;
  const colors = palette(el);
  burst(r.left + r.width * 0.28, r.top + 6, colors, 8, 52);
  burst(r.left + r.width * 0.72, r.top + 6, colors, 8, 52);
}

export function initFX(): void {
  if (layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  layer = document.createElement("div");
  layer.id = "fxLayer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
  document.addEventListener(
    "pointerover",
    (e) => {
      const el = (e.target as Element | null)?.closest?.(HOVER_SEL);
      if (el) sparkle(el);
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as Element | null)?.closest?.(CLICK_SEL);
      if (el) burst(e.clientX, e.clientY, palette(el), 10, 46);
    },
    { passive: true },
  );
  // hidden tabs suspend WAAPI onfinish — flush so the cap can't wedge shut
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && layer) {
      layer.replaceChildren();
      live = 0;
    }
  });
}
