// Chiffres anonymes pour le rapport mensuel : clics par bien d'une édition + inscriptions du mois.
// /api/stats?c=<client>&e=<AAAA-MM>
const L = require("./_lib.js");
module.exports = async (req, res) => {
  const c = String(req.query.c || ""), e = String(req.query.e || "");
  if (!L.CLIENTS[c] || !/^\d{4}-\d{2}$/.test(e)) return res.status(400).json({ ok: false, erreur: "paramètres" });
  if (!L.redisConf()) return res.status(200).json({ ok: false, erreur: "base de comptage non configurée" });
  const toObj = (a) => { const o = {}; for (let i = 0; a && i < a.length; i += 2) o[a[i]] = Number(a[i + 1]); return o; };
  const clics = toObj(await L.redis(["HGETALL", `clics:${c}:${e}`]));
  const insc = toObj(await L.redis(["HGETALL", `inscriptions:${c}:${e}`]));
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: true, client: c, edition: e, clics_par_bien: clics, total_clics: Object.values(clics).reduce((a, x) => a + x, 0), inscriptions: insc, genere_le: new Date().toISOString() });
};
