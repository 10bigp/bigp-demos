// Diagnostic : indique seulement si les réglages existent (jamais leurs valeurs).
const L = require("./_lib.js");
module.exports = async (req, res) => {
  const noms = Object.keys(process.env).filter((n) => /RESEND|KV_|REDIS|UPSTASH/.test(n)).sort();
  let redis_ok = false; try { redis_ok = (await L.redis(["PING"])) === "PONG"; } catch {}
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ resend_cle_presente: !!process.env.RESEND_API_KEY, redis_configure: !!L.redisConf(), redis_repond: redis_ok, variables_trouvees: noms });
};
