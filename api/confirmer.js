// GET : page avec un bouton (les antivirus de messagerie qui « cliquent » les liens ne confirment donc rien).
// POST : confirmation réelle → contact ajouté au segment du client + preuve du consentement enregistrée.
const L = require("./_lib.js");
const SEPT_JOURS = 7 * 24 * 3600 * 1000;

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const tok = String((req.method === "POST" ? (req.body || {}).t : req.query.t) || "");
  let d = null; try { d = L.verifier(tok); } catch (e) { console.error(e); }
  const cl = d && L.CLIENTS[d.c];
  if (!d || !cl) return res.status(400).send(L.page(null, "Lien invalide", "<p>Ce lien de confirmation n'est pas valide.</p>"));
  if (Date.now() - d.ts > SEPT_JOURS) return res.status(410).send(L.page(cl, "Lien expiré", `<p>Ce lien a expiré. Vous pouvez refaire une demande d'inscription sur le site de ${L.esc(cl.nom)}.</p>`));

  if (req.method !== "POST") {
    return res.status(200).send(L.page(cl, "Confirmer votre inscription",
      `<p>Vous allez recevoir chaque mois la newsletter de <b>${L.esc(cl.nom)}</b> à l'adresse <b>${L.esc(d.e)}</b>.</p>
<form method="post" action="/api/confirmer"><input type="hidden" name="t" value="${L.esc(tok)}"><button type="submit">Je confirme mon inscription</button></form>
<p style="font-size:13px;color:#666;margin-top:24px">Désinscription possible à tout moment grâce au lien présent dans chaque newsletter.</p>`));
  }

  try {
    const g = await L.resend("GET", "/contacts/" + encodeURIComponent(d.e));
    if (g.ok && g.data && g.data.id) {
      // Nouvelle demande explicite et confirmée : la personne se réabonne elle-même.
      if (g.data.unsubscribed) await L.resend("PATCH", "/contacts/" + g.data.id, { unsubscribed: false });
      const s = await L.resend("POST", `/contacts/${g.data.id}/segments/${cl.segment_id}`);
      if (!s.ok && s.status !== 409) throw new Error("segment " + s.status + " " + JSON.stringify(s.data));
    } else {
      const c = await L.resend("POST", "/contacts", { email: d.e, unsubscribed: false, segments: [{ id: cl.segment_id }] });
      if (!c.ok) throw new Error("contact " + c.status + " " + JSON.stringify(c.data));
    }
    if (L.redisConf()) {
      const preuve = { email: d.e, client: d.c, demande_le: new Date(d.ts).toISOString(), confirme_le: new Date().toISOString(),
        source: "formulaire site (double opt-in)", version_texte: d.v };
      await L.redis(["HSET", "consentements:" + d.c, d.e, JSON.stringify(preuve)]);
      await L.redis(["HINCRBY", "inscriptions:" + d.c + ":" + new Date().toISOString().slice(0, 7), "confirmees", 1]);
    }
    return res.status(200).send(L.page(cl, "Inscription confirmée ✓", `<p>Merci ! Vous recevrez la prochaine newsletter de ${L.esc(cl.nom)}.</p>${cl.site ? `<p><a href="${L.esc(cl.site)}">Retour au site</a></p>` : ""}`));
  } catch (e) {
    console.error(e);
    return res.status(502).send(L.page(cl, "Un souci technique", "<p>Votre confirmation n'a pas pu être enregistrée. Réessayez dans quelques minutes en recliquant sur le lien reçu par e-mail.</p>"));
  }
};
