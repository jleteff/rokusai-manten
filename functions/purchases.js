/* In-app purchases (Apple / Google through RevenueCat) and the Season Pass.
 * Purchases are granted only here, on the server, once per store transaction. Two ways in:
 *   - rcWebhook: RevenueCat calls it right after a purchase or renewal.
 *   - syncPurchases: the app calls it after buying or "Restore purchases", and it asks RevenueCat directly.
 * Secrets (set once with the Firebase CLI): RC_WEBHOOK_AUTH (the webhook's Authorization value) and RC_API_KEY (RevenueCat secret API key). */
const { HttpsError, onCall, onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const Cat = require("./catalog.js");
const Economy = require("./economy.js");

const RC_WEBHOOK_AUTH = defineSecret("RC_WEBHOOK_AUTH");
const RC_API_KEY = defineSecret("RC_API_KEY");
const validUid = (u) => typeof u === "string" && /^[A-Za-z0-9]{20,40}$/.test(u);

function seasonFor(p, se) { return p.season && p.season.id === se.id ? p.season : { id: se.id, xp: 0, premium: false, claimed: [] }; }

// Give one purchase to one player. txn makes it idempotent: the same store transaction never pays out twice.
async function applyPurchase(db, uid, productId, txn, expiresMs) {
  const prod = Cat.PRODUCTS[productId];
  if (!prod || !validUid(uid) || !txn) return "ignored";
  const ref = db.doc("users/" + uid), mark = db.doc("users/" + uid + "/purchases/" + String(txn).replace(/\//g, "_"));
  return db.runTransaction(async (tx) => {
    const [snap, seen] = await Promise.all([tx.get(ref), tx.get(mark)]);
    const p = snap.exists ? snap.data() : Economy.freshProfile("Player");
    if (prod.kind === "vip") {   // renewals carry a new expiry; always take the latest
      p.vip = { until: Math.max((p.vip && p.vip.until) || 0, expiresMs || 0), product: productId };
      tx.set(ref, p); tx.set(mark, { product: productId, at: Date.now(), expires: expiresMs || 0 });
      return "vip";
    }
    if (seen.exists) return "already";
    if (prod.kind === "coins") p.coins = (p.coins || 0) + prod.coins;
    if (prod.kind === "founder" && !p.founder) {
      p.founder = true; p.coins = (p.coins || 0) + prod.coins;
      p.owned = Array.from(new Set((p.owned || []).concat(prod.items)));
      p.equipped = Object.assign({}, Cat.DEFAULTS, p.equipped, { dice: "founder", frame: "founderframe" });
    }
    if (prod.kind === "season") {
      const se = Cat.SEASONS.find((x) => x.id === prod.season);
      if (se) { p.season = seasonFor(p, se); p.season.premium = true; }
    }
    tx.set(ref, p); tx.set(mark, { product: productId, at: Date.now() });
    return prod.kind;
  });
}

exports.applyPurchase = applyPurchase;

exports.callables = (db, player) => ({
  rcWebhook: onRequest({ secrets: [RC_WEBHOOK_AUTH] }, async (req, res) => {
    if (req.method !== "POST" || req.get("Authorization") !== RC_WEBHOOK_AUTH.value()) { res.status(401).send("no"); return; }
    const e = (req.body && req.body.event) || {};
    const pay = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE", "UNCANCELLATION"];
    let result = "ignored";
    if (pay.indexOf(e.type) > -1) result = await applyPurchase(db, e.app_user_id, e.product_id, e.transaction_id || e.id, e.expiration_at_ms);
    res.status(200).json({ ok: true, result: result });
  }),
  // Ask RevenueCat what this player owns and grant anything not yet given (also powers "Restore purchases").
  syncPurchases: onCall({ secrets: [RC_API_KEY] }, async (req) => {
    const uid = player(req);
    const r = await fetch("https://api.revenuecat.com/v1/subscribers/" + encodeURIComponent(uid), { headers: { Authorization: "Bearer " + RC_API_KEY.value() } });
    if (!r.ok) throw new HttpsError("unavailable", "Couldn't reach the store. Try again.");
    const sub = ((await r.json()) || {}).subscriber || {};
    const out = [];
    for (const [pid, list] of Object.entries(sub.non_subscriptions || {})) for (const t of list) out.push(await applyPurchase(db, uid, pid, t.store_transaction_id || t.id));
    for (const [pid, s] of Object.entries(sub.subscriptions || {})) {
      const exp = s.expires_date ? Date.parse(s.expires_date) : 0;
      if (exp > Date.now()) out.push(await applyPurchase(db, uid, pid, "sub-" + pid + "-" + exp, exp));
    }
    return { granted: out.filter((x) => x !== "already" && x !== "ignored").length };
  }),
  // Season Pass tiers: free track for everyone, premium track with the pass.
  claimTier: onCall(async (req) => {
    const uid = player(req), d = req.data || {}, se = Cat.activeSeason();
    if (!se) throw new HttpsError("failed-precondition", "No season is running right now.");
    const tier = Cat.seasonTiers(se).find((t) => t.n === d.n), track = d.track === "prem" ? "prem" : "free";
    if (!tier) throw new HttpsError("invalid-argument", "Unknown tier.");
    const ref = db.doc("users/" + uid);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref); if (!snap.exists) throw new HttpsError("failed-precondition", "Profile not ready.");
      const p = snap.data(), s = seasonFor(p, se), key = track + tier.n, reward = tier[track];
      if ((s.xp || 0) < tier.xp) throw new HttpsError("failed-precondition", "Play more to reach this tier.");
      if (track === "prem" && !s.premium) throw new HttpsError("failed-precondition", "This reward needs the Season Pass.");
      if ((s.claimed || []).indexOf(key) > -1) throw new HttpsError("already-exists", "Already claimed.");
      if (!reward.item && !reward.coins) throw new HttpsError("failed-precondition", "Nothing to claim here.");
      s.claimed = (s.claimed || []).concat([key]);
      if (reward.coins) p.coins = (p.coins || 0) + reward.coins;
      if (reward.item) p.owned = Array.from(new Set((p.owned || []).concat([reward.item])));
      p.season = s;
      tx.set(ref, p);
      return { coins: reward.coins || 0, item: reward.item || null };
    });
  })
});
