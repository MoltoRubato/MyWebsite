/* ============================================================
   Cloudflare Pages Function — /api/guestbook
   GET  -> { entries: Entry[] }  (approved only, newest first, max 50)
   POST -> { name<=20, msg<=80, website:"" (honeypot) }
           lands in KV key "pending" until the owner approves it
           at /admin/guestbook (see functions/admin/guestbook.ts).
   Storage: KV key "entries" (approved, capped 200) + "pending"
   (awaiting approval, capped 100).
   OWNER SETUP (one-time, dashboard): create a KV namespace and
   bind it to this Pages project as `GUESTBOOK` — see README.
   Optional notification env vars: NTFY_TOPIC, or
   RESEND_API_KEY + GUESTBOOK_NOTIFY_EMAIL; GUESTBOOK_ADMIN_KEY
   unlocks the admin page and is linked in notifications.
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
  NTFY_TOPIC?: string;
  RESEND_API_KEY?: string;
  GUESTBOOK_NOTIFY_EMAIL?: string;
}
interface PagesContext {
  request: Request;
  env: Env;
  waitUntil(p: Promise<unknown>): void;
}
interface Entry {
  name: string;
  msg: string;
  ts: number;
}
interface PendingEntry extends Entry {
  id: string;
}

const NAME_MAX = 20;
const MSG_MAX = 80;
const PENDING_KEEP = 100; // pending cap; approved cap lives in the admin function
const RL_TTL = 600; // one signature per IP per 10 minutes

// URL spam + a small profanity net. The client renders via textContent, so
// this is about keeping the book pleasant, not about XSS.
const BLOCK = /(https?:\/\/|www\.|\.com\b|\.net\b|\.ru\b|\.xyz\b|fuck|shit|cunt|nigg|fagg|bitch|porn)/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestGet(ctx: PagesContext): Promise<Response> {
  if (!ctx.env.GUESTBOOK) return json({ error: "guestbook not configured" }, 503);
  const raw = await ctx.env.GUESTBOOK.get("entries");
  let entries: Entry[] = [];
  try {
    entries = raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    entries = [];
  }
  return json({ entries: entries.slice(0, 50) });
}

export async function onRequestPost(ctx: PagesContext): Promise<Response> {
  const kv = ctx.env.GUESTBOOK;
  if (!kv) return json({ error: "guestbook not configured" }, 503);
  const req = ctx.request;
  if (!(req.headers.get("Content-Type") || "").includes("application/json")) return json({ error: "bad content type" }, 415);
  const text = await req.text();
  if (text.length > 2048) return json({ error: "too large" }, 413);
  let body: { name?: unknown; msg?: unknown; website?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return json({ error: "bad json" }, 400);
  }
  // honeypot: pretend success, store nothing — don't tip the bot off
  if (typeof body.website === "string" && body.website.length > 0) return json({ ok: true });

  // per-IP rate limit
  const ip = req.headers.get("CF-Connecting-IP") || "anon";
  const rlKey = `rl:${ip}`;
  if (await kv.get(rlKey)) return json({ error: "one signature per visit" }, 429);

  const clean = (s: unknown, max: number): string =>
    String(typeof s === "string" ? s : "")
      .replace(/[\u0000-\u001f\u007f<>]/g, "")
      .trim()
      .slice(0, max);
  const name = clean(body.name, NAME_MAX);
  const msg = clean(body.msg, MSG_MAX);
  if (!name || !msg) return json({ error: "name and message required" }, 422);
  if (BLOCK.test(name) || BLOCK.test(msg)) return json({ error: "keep it cozy — no links, no bile" }, 422);

  const raw = await kv.get("pending");
  let pending: PendingEntry[] = [];
  try {
    pending = raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    pending = [];
  }
  const entry: PendingEntry = { id: crypto.randomUUID(), name, msg, ts: Date.now() };
  pending.unshift(entry);
  await kv.put("pending", JSON.stringify(pending.slice(0, PENDING_KEEP)));
  await kv.put(rlKey, "1", { expirationTtl: RL_TTL });
  ctx.waitUntil(notifyOwner(ctx.env, new URL(req.url).origin, entry));
  return json({ ok: true, pending: true }, 201);
}

/* ---------------- owner notification (fire-and-forget) ---------------- */
async function notifyOwner(env: Env, origin: string, e: PendingEntry): Promise<void> {
  const adminUrl = `${origin}/admin/guestbook?key=${encodeURIComponent(env.GUESTBOOK_ADMIN_KEY || "")}`;
  if (env.NTFY_TOPIC) {
    try {
      await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
        method: "POST",
        headers: { Title: "New guestbook entry", Tags: "memo", Click: adminUrl },
        body: `${e.name}: ${e.msg}`,
      });
    } catch {
      /* notification failure never fails the submit */
    }
  }
  if (env.RESEND_API_KEY && env.GUESTBOOK_NOTIFY_EMAIL) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Guestbook <onboarding@resend.dev>",
          to: env.GUESTBOOK_NOTIFY_EMAIL,
          subject: "New guestbook entry pending approval",
          text: `${e.name}: ${e.msg}\n\nApprove or reject: ${adminUrl}`,
        }),
      });
    } catch {
      /* ditto */
    }
  }
}
