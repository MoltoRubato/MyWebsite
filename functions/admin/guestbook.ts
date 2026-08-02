/* ============================================================
   Cloudflare Pages Function — /admin/guestbook
   Owner-only moderation queue for the guestbook.
   GET  ?key=<GUESTBOOK_ADMIN_KEY> -> HTML page listing pending
        entries with Approve / Reject buttons.
   POST { action: "approve"|"reject", id } (key in JSON body or
        X-Admin-Key header) -> moves/removes the pending entry.
   If GUESTBOOK_ADMIN_KEY is unset the route plays dead (404).
   Read-modify-write on KV is fine at this traffic level.
   ============================================================ */

// Minimal local declarations so the root tsc (DOM lib) checks this file
// without pulling in @cloudflare/workers-types.
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  GUESTBOOK?: KVNamespace;
  GUESTBOOK_ADMIN_KEY?: string;
}
interface PagesContext {
  request: Request;
  env: Env;
}
interface Entry {
  name: string;
  msg: string;
  ts: number;
}
interface PendingEntry extends Entry {
  id: string;
}

const KEEP = 200; // approved-entries cap (matches /api/guestbook)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// This page renders untrusted visitor text — escape everything.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readPending(kv: KVNamespace): Promise<PendingEntry[]> {
  const raw = await kv.get("pending");
  try {
    return raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  const adminKey = ctx.env.GUESTBOOK_ADMIN_KEY;
  if (!adminKey) return new Response("Not found", { status: 404 });
  const url = new URL(ctx.request.url);
  if (url.searchParams.get("key") !== adminKey) return new Response("Forbidden", { status: 403 });
  if (!ctx.env.GUESTBOOK) return new Response("guestbook not configured", { status: 503 });

  const pending = await readPending(ctx.env.GUESTBOOK);
  const rows = pending
    .map(
      (e) => `<li class="row" data-id="${esc(e.id)}">
        <div class="meta"><b>${esc(e.name)}</b><time>${esc(new Date(e.ts).toLocaleString("en-GB", { timeZone: "UTC" }))} UTC</time></div>
        <p>${esc(e.msg)}</p>
        <div class="btns">
          <button class="ok" data-act="approve">Approve</button>
          <button class="no" data-act="reject">Reject</button>
        </div>
      </li>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Guestbook — pending</title>
<style>
  body{margin:0;padding:24px;background:#efe2c2;color:#4a3526;
    font-family:'Silkscreen','Courier New',monospace;font-size:14px}
  h1{font-size:18px;margin:0 0 4px;color:#7a4b2b}
  .count{margin:0 0 18px;font-size:12px;opacity:.8}
  ul{list-style:none;margin:0;padding:0;max-width:560px}
  .row{background:#f7eed8;border:2px solid #7a4b2b;border-radius:10px;
    padding:12px 14px;margin-bottom:12px}
  .meta{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
  .meta b{color:#7a4b2b;overflow-wrap:anywhere}
  .meta time{font-size:11px;opacity:.7;flex:none}
  .row p{margin:6px 0 10px;overflow-wrap:anywhere;line-height:1.45}
  .btns{display:flex;gap:8px}
  button{font:inherit;font-size:12px;padding:6px 14px;border-radius:8px;
    border:2px solid #7a4b2b;cursor:pointer}
  button:disabled{opacity:.5;cursor:default}
  .ok{background:#e7a33e;color:#3a2410}
  .no{background:#f7eed8;color:#7a4b2b}
  .empty{max-width:560px;padding:24px;text-align:center;border:2px dashed #7a4b2b;
    border-radius:10px;opacity:.75}
</style></head><body>
<h1>Guestbook — pending entries</h1>
<p class="count" id="count">${pending.length} awaiting approval</p>
${pending.length ? `<ul id="list">${rows}</ul>` : ""}
<div class="empty" id="empty"${pending.length ? " hidden" : ""}>Nothing pending. The desk is clear.</div>
<script>
  var KEY = ${JSON.stringify(adminKey)};
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-act]");
    if (!btn) return;
    var row = btn.closest(".row");
    row.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    fetch(location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": KEY },
      body: JSON.stringify({ action: btn.dataset.act, id: row.dataset.id }),
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) throw new Error("nope");
      row.remove();
      document.getElementById("count").textContent = d.remaining + " awaiting approval";
      if (d.remaining === 0) document.getElementById("empty").hidden = false;
    }).catch(function () {
      row.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      alert("That didn't stick — reload and try again.");
    });
  });
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  const adminKey = ctx.env.GUESTBOOK_ADMIN_KEY;
  if (!adminKey) return new Response("Not found", { status: 404 });
  const kv = ctx.env.GUESTBOOK;
  if (!kv) return json({ error: "guestbook not configured" }, 503);

  let body: { action?: unknown; id?: unknown; key?: unknown };
  try {
    body = (await ctx.request.json()) as typeof body;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const key = ctx.request.headers.get("X-Admin-Key") || (typeof body.key === "string" ? body.key : "");
  if (key !== adminKey) return json({ error: "forbidden" }, 403);

  const action = body.action;
  const id = body.id;
  if ((action !== "approve" && action !== "reject") || typeof id !== "string") {
    return json({ error: "bad request" }, 400);
  }

  const pending = await readPending(kv);
  const idx = pending.findIndex((e) => e.id === id);
  if (idx === -1) return json({ error: "unknown id" }, 404);
  const [entry] = pending.splice(idx, 1);

  if (action === "approve") {
    const raw = await kv.get("entries");
    let entries: Entry[] = [];
    try {
      entries = raw ? (JSON.parse(raw) as Entry[]) : [];
    } catch {
      entries = [];
    }
    // approved entries keep their original signing time
    entries.unshift({ name: entry.name, msg: entry.msg, ts: entry.ts });
    await kv.put("entries", JSON.stringify(entries.slice(0, KEEP)));
  }
  await kv.put("pending", JSON.stringify(pending));
  return json({ ok: true, remaining: pending.length });
}
