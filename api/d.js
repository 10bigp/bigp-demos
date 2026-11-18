// Lien de démo personnel d'une agence prospectée : /api/d?p=<id-prospect>
// <id-prospect> = identifiant aléatoire (8 caractères), jamais le nom ni l'adresse de l'agence.
// À chaque clic d'un vrai navigateur : Redis (premier clic, dernier clic, nombre de clics) + Notion
// (« Démo ouverte le » sur la ligne dont « Id démo » = p), puis redirection vers la démo.
// La redirection marche toujours, même si Redis ou Notion ne répondent pas.
// Réglages (variables d'environnement Vercel, jamais dans le dépôt) : NOTION_TOKEN_DEMO (obligatoire pour Notion),
// NOTION_PROSPECTS_DS (facultatif, identifiant de la base « Agences Contactées »).
const L = require("./_lib.js");
// Même filtre que r.js : les scanners de sécurité des boîtes mail ouvrent les liens, ils ne comptent pas.
const ROBOTS = /bot|crawl|spider|preview|scanner|curl|wget|python|httpclient|proofpoint|mimecast|barracuda|safelinks|urldefense/i;
const CIBLE = "/demo/exemple/";
const ID_OK = /^[A-Za-z0-9]{6,16}$/;
const NOTION_DS = process.env.NOTION_PROSPECTS_DS || "a958e521-93f2-4163-a7e2-906a14ba8d5f";
const NOTION_API = process.env.NOTION_API_BASE || "https://api.notion.com"; // modifiable pour les tests locaux
const DELAI_MS = 2500;
const DOUZE_MOIS = 365 * 24 * 3600;

function vraiNavigateur(req) {
  const ua = req.headers["user-agent"] || "";
  // En plus du filtre de r.js : un navigateur envoie toujours une langue, la plupart des scanners non.
  return req.method === "GET" && ua.length > 0 && !ROBOTS.test(ua) && !!req.headers["accept-language"];
}

async function noterRedis(p, maintenant) {
  if (!L.redisConf()) return;
  const k = "demo:" + p;
  await L.redis(["HSETNX", k, "premier_clic", maintenant]);
  await L.redis(["HSET", k, "dernier_clic", maintenant]);
  await L.redis(["HINCRBY", k, "clics", 1]);
  await L.redis(["EXPIRE", k, DOUZE_MOIS]); // conservation : 12 mois après le dernier clic
}

async function notion(method, path, body) {
  const r = await fetch(NOTION_API + path, {
    method,
    headers: { Authorization: "Bearer " + process.env.NOTION_TOKEN_DEMO, "Notion-Version": "2025-09-03", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DELAI_MS)
  });
  if (!r.ok) throw new Error("notion " + r.status);
  return r.json();
}

async function noterNotion(p, maintenant) {
  if (!process.env.NOTION_TOKEN_DEMO) return;
  const q = await notion("POST", `/v1/data_sources/${NOTION_DS}/query`, {
    filter: { property: "Id démo", rich_text: { equals: p } }, page_size: 2
  });
  const pages = (q.results || []);
  if (pages.length !== 1) { console.error("d.js : " + pages.length + " ligne(s) Notion pour cet id"); return; }
  await notion("PATCH", `/v1/pages/${pages[0].id}`, {
    properties: { "Démo ouverte le": { date: { start: maintenant } } }
  });
}

module.exports = async (req, res) => {
  const p = String((req.query && req.query.p) || "");
  if (ID_OK.test(p) && vraiNavigateur(req)) {
    const maintenant = new Date().toISOString();
    const res2 = await Promise.allSettled([noterRedis(p, maintenant), noterNotion(p, maintenant)]);
    res2.forEach((r) => { if (r.status === "rejected") console.error(r.reason); });
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.redirect(302, CIBLE);
};
