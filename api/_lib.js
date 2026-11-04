const crypto = require("crypto");
const CLIENTS = require("./_clients.js");

const BASE = process.env.PUBLIC_BASE_URL || "https://bigp-demos.vercel.app";
const VERSION_CONSENTEMENT = "2026-11-04-v1";

function secret() {
  if (process.env.INSCRIPTION_SECRET) return process.env.INSCRIPTION_SECRET;
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY manquante");
  return crypto.createHash("sha256").update("bigp-inscription:" + process.env.RESEND_API_KEY).digest("hex");
}
const b64u = (s) => Buffer.from(s).toString("base64url");
function signer(obj) {
  const p = b64u(JSON.stringify(obj));
  const sig = crypto.createHmac("sha256", secret()).update(p).digest("base64url");
  return p + "." + sig;
}
function verifier(tok) {
  if (!tok || typeof tok !== "string" || !tok.includes(".")) return null;
  const [p, sig] = tok.split(".");
  const att = crypto.createHmac("sha256", secret()).update(p).digest("base64url");
  if (sig.length !== att.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(att))) return null;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()); } catch { return null; }
}

// Redis REST (Upstash via Vercel). Facultatif : sans base, le compteur et la limite ne font rien.
function redisConf() {
  const env = process.env;
  let url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  let token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) { // variables préfixées par Vercel (ex. STORAGE_KV_REST_API_URL)
    const k = Object.keys(env).find((n) => /(KV_REST_API_URL|REDIS_REST_URL)$/.test(n));
    if (k) { url = env[k]; token = env[k.replace(/URL$/, "TOKEN")]; }
  }
  return url && token ? { url, token } : null;
}
async function redis(cmd) {
  const c = redisConf(); if (!c) return null;
  const r = await fetch(c.url, { method: "POST", headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error("redis " + r.status);
  return (await r.json()).result;
}

async function resend(method, path, body) {
  const r = await fetch("https://api.resend.com" + path, {
    method, headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, data };
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const emailValide = (e) => typeof e === "string" && e.length <= 254 && /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[a-z]{2,}$/i.test(e);
const ipHash = (req) => crypto.createHash("sha256").update((req.headers["x-forwarded-for"] || "").split(",")[0] + secret().slice(0, 8)).digest("hex").slice(0, 16);

function page(cl, titre, corps) {
  const c = cl || { nom: "", couleur: "#1d4f91", logo: "" };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titre)}</title>
<style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f5f5f3;color:#222}main{max-width:480px;margin:48px auto;padding:32px 24px;background:#fff;border-top:4px solid ${esc(c.couleur)};border-radius:6px}
img{max-height:56px;max-width:220px;display:block;margin-bottom:24px}h1{font-size:22px;margin:0 0 12px}p{line-height:1.55}button{background:${esc(c.couleur)};color:${esc(c.couleur_texte_bouton || "#fff")};border:0;padding:14px 22px;font-size:16px;border-radius:4px;cursor:pointer}</style></head>
<body><main>${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.nom)}">` : ""}<h1>${esc(titre)}</h1>${corps}</main></body></html>`;
}

module.exports = { CLIENTS, BASE, VERSION_CONSENTEMENT, signer, verifier, redis, redisConf, resend, esc, emailValide, ipHash, page };
