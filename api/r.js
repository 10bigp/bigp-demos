// Compteur de clics ANONYME : on compte le clic par bien, sans savoir qui a cliqué, puis on redirige.
// /api/r?c=<client>&e=<AAAA-MM>&b=<ref-bien>&u=<url encodée>
const L = require("./_lib.js");
const ROBOTS = /bot|crawl|spider|preview|scanner|curl|wget|python|httpclient|proofpoint|mimecast|barracuda|safelinks|urldefense/i;

module.exports = async (req, res) => {
  const { c, e, b, u } = req.query;
  const cl = L.CLIENTS[String(c || "")];
  let cible = null;
  try { cible = new URL(String(u || "")); } catch {}
  const ok = cl && cible && cible.protocol === "https:" && (cl.hotes_liens || []).includes(cible.hostname);
  if (!ok) return res.status(400).send("Lien invalide");
  const ua = req.headers["user-agent"] || "";
  if (req.method === "GET" && !ROBOTS.test(ua) && /^\d{4}-\d{2}$/.test(String(e || "")) && /^[\w.-]{1,40}$/.test(String(b || ""))) {
    try { await L.redis(["HINCRBY", `clics:${c}:${e}`, String(b), 1]); } catch (err) { console.error(err); }
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  return res.redirect(302, cible.toString());
};
