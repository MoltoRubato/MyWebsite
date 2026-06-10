/* ============================================================
   Activity base — the shared lifecycle for the full-screen overlay
   activities (chess, music, workout, pool). Previously each module
   re-implemented the same #activity show/hide transition and the same
   requestAnimationFrame dt-loop; this centralises both, byte-for-byte.
   ============================================================ */

const host = document.getElementById("activity") as HTMLElement;
const inner = document.getElementById("activityInner") as HTMLElement;

/** Mount `html` into the activity host and play the open transition. */
export function openOverlay(html: string): void {
  inner.innerHTML = html;
  host.classList.remove("hidden");
  requestAnimationFrame(() => host.classList.add("in"));
}

/** Play the close transition, then hide and clear the host (350ms). */
export function closeOverlay(): void {
  host.classList.remove("in");
  setTimeout(() => {
    host.classList.add("hidden");
    inner.innerHTML = "";
  }, 350);
}

/** TRUE while any activity overlay is mounted (all share the one host). */
export function isOverlayOpen(): boolean {
  return !host.classList.contains("hidden");
}

/** The activity content element, for querying freshly-mounted shell nodes. */
export function overlayInner(): HTMLElement {
  return inner;
}

export interface LoopHandle {
  stop(): void;
}

/**
 * Drive `step` once per animation frame with a clamped delta-time (<= 0.05s),
 * exactly as the original activity loops did. Returns a handle to stop it.
 */
export function startLoop(step: (dt: number) => void): LoopHandle {
  let raf = 0;
  let lastT = 0;
  const tick = (): void => {
    const now = performance.now();
    if (!lastT) lastT = now;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    step(dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop(): void {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
