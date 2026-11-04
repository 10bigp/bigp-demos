// POST : demande d'inscription → mail de confirmation (double opt-in). Aucun contact créé à ce stade.
const L = require("./_lib.js");

function cors(req, res, cl) {
  const o = req.headers.origin;
  if (o && cl && (cl.origines || []).includes(o)) { res.setHeader("Access-Control-Allow-Origin", o); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  const b = req.body || {};
  const slug = String(b.client || req.query.client || "");
  const cl = L.CLIENTS[slug];
  cors(req, res, cl);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).send("Méthode non autorisée");
  const json = (req.headers.accept || "").includes("application/json");
  const repondre = (code, msg) => json ? res.status(code).json({ ok: code < 300, message: msg })
    : res.status(code).setHeader("Content-Type", "text/html; charset=utf-8").send(L.page(cl, code < 300 ? "Vérifiez votre boîte mail" : "Inscription impossible", `<p>${L.esc(msg)}</p>`));

  if (!cl) return repondre(400, "Formulaire mal configuré.");
  const email = String(b.email || "").trim().toLowerCase();
  // Anti-robots : champ piège invisible + délai minimal de remplissage
  if (b.site_web) return repondre(200, "Un e-mail de confirmation vient de vous être envoyé.");
  const t = Number(b.t || 0);
  if (t && Date.now() - t < 2500) return repondre(200, "Un e-mail de confirmation vient de vous être envoyé.");
  if (!L.emailValide(email)) return repondre(400, "Adresse e-mail invalide.");
  if (!(b.consentement === "oui" || b.consentement === true || b.consentement === "on")) return repondre(400, "Merci de cocher la case de consentement.");

  try {
    if (L.redisConf()) {
      const k = "rl:" + L.ipHash(req) + ":" + new Date().toISOString().slice(0, 13);
      const n = await L.redis(["INCR", k]); if (n === 1) await L.redis(["EXPIRE", k, 3600]);
      if (n > 8) return repondre(429, "Trop de demandes, réessayez plus tard.");
    }
    const tok = L.signer({ e: email, c: slug, ts: Date.now(), v: L.VERSION_CONSENTEMENT });
    const lien = `${L.BASE}/api/confirmer?t=${encodeURIComponent(tok)}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#222">
${cl.logo ? `<img src="${L.esc(cl.logo)}" alt="${L.esc(cl.nom)}" style="max-height:50px;margin:16px 0">` : ""}
<p>Bonjour,</p><p>Vous avez demandé à recevoir la newsletter mensuelle de <b>${L.esc(cl.nom)}</b>. Pour confirmer votre inscription, cliquez sur le bouton ci-dessous :</p>
<p style="margin:28px 0"><a href="${lien}" style="background:${L.esc(cl.couleur)};color:${L.esc(cl.couleur_texte_bouton || "#fff")};padding:14px 22px;text-decoration:none;border-radius:4px;display:inline-block">Confirmer mon inscription</a></p>
<p style="font-size:13px;color:#666">Ce lien est valable 7 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement ce message : vous ne serez pas inscrit.</p></div>`;
    const r = await L.resend("POST", "/emails", {
      from: cl.from, to: [email], reply_to: cl.reply_to || undefined,
      subject: `Confirmez votre inscription à la newsletter de ${cl.nom}`, html,
      text: `Confirmez votre inscription à la newsletter de ${cl.nom} : ${lien}\nLien valable 7 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
    });
    if (!r.ok) { console.error("envoi confirmation", r.status, JSON.stringify(r.data)); return repondre(502, "Le service est momentanément indisponible, réessayez plus tard."); }
    if (L.redisConf()) await L.redis(["HINCRBY", "inscriptions:" + slug + ":" + new Date().toISOString().slice(0, 7), "demandes", 1]);
    return repondre(200, "Un e-mail de confirmation vient de vous être envoyé. Cliquez sur le lien qu'il contient pour valider votre inscription.");
  } catch (e) { console.error(e); return repondre(500, "Une erreur est survenue, réessayez plus tard."); }
};
