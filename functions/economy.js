/* Coins (小判 Koban), XP, levels, daily rewards and the cosmetics shop. Server only: phones can read
 * users/{uid} but never write it, so nobody can hand themselves coins or items. */
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const Cat = require("./catalog.js");
const R = Cat.REWARDS;

const today = (t) => new Date(t || Date.now()).toISOString().slice(0, 10);   // UTC day
const yesterday = () => today(Date.now() - 86400000);

function freshProfile(name) {
  return { name: name || "Player", coins: R.starter, xp: 0, level: 1, owned: Cat.FREE.slice(), equipped: Object.assign({}, Cat.DEFAULTS),
    stats: { games: 0, wins: 0 }, daily: { last: "", streak: 0 }, games: { day: "", n: 0 }, created: Date.now() };
}
const isVip = (p) => !!(p.vip && p.vip.until > Date.now());

// Called inside the move transaction when a game ends. All reads happen before any write.
exports.awardGame = async (tx, db, r, patch, players) => {
  const humans = (r.order || []).filter((id) => players[id] && !players[id].bot);
  patch.rewards = {};
  if (humans.length < R.minPlayers) { patch.rewardNote = "practice"; return; }
  const refs = humans.map((id) => db.doc("users/" + id));
  const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
  const day = today();
  humans.forEach((id, k) => {
    const p = snaps[k].exists ? snaps[k].data() : freshProfile(players[id].name);
    const won = patch.winner === id;
    const counted = p.games && p.games.day === day ? p.games.n : 0;
    let coins = 0, xp = 0;
    if (counted < R.dailyGames) {
      coins = R.play.coins + (won ? R.win.coins : 0);
      xp = R.play.xp + (won ? R.win.xp : 0);
      if (isVip(p)) coins *= 2;
    }
    const newXp = (p.xp || 0) + xp, level = Cat.levelFor(newXp), up = Math.max(0, level - (p.level || 1));
    coins += up * R.levelUp;
    const stats = Object.assign({ games: 0, wins: 0 }, p.stats);
    stats.games++; if (won) stats.wins++;
    const next = Object.assign({}, p, { name: players[id].name || p.name, coins: (p.coins || 0) + coins, xp: newXp, level: level, stats: stats, games: { day: day, n: counted + 1 } });
    if (p.season) next.season = Object.assign({}, p.season, { xp: (p.season.xp || 0) + xp });
    tx.set(refs[k], next);
    patch.rewards[id] = { coins: coins, xp: xp, level: level, up: up, capped: counted >= R.dailyGames };
  });
};

exports.callables = (db, player) => {
  const withProfile = (uid, name, fn) => db.runTransaction(async (tx) => {
    const ref = db.doc("users/" + uid), snap = await tx.get(ref);
    const p = snap.exists ? snap.data() : freshProfile(name);
    const out = fn(p) || {};
    tx.set(ref, p);
    return out;
  });
  const nameOf = (req) => (req.auth.token && req.auth.token.name) || "Player";
  return {
    // Make sure the profile exists (new accounts get starter coins) and keep the display name current.
    profile: onCall(async (req) => {
      const uid = player(req);
      return withProfile(uid, nameOf(req), (p) => { if (req.auth.token.name) p.name = req.auth.token.name; return { ok: true }; });
    }),
    // Once per UTC day. Streak days 1-7 pay more; missing a day starts over.
    claimDaily: onCall(async (req) => {
      const uid = player(req);
      return withProfile(uid, nameOf(req), (p) => {
        const d = p.daily || { last: "", streak: 0 };
        if (d.last === today()) throw new HttpsError("failed-precondition", "Already claimed today.");
        const streak = d.last === yesterday() ? (d.streak || 0) + 1 : 1;
        let coins = R.daily[Math.min(streak, R.daily.length) - 1];
        if (isVip(p)) coins *= 2;
        p.daily = { last: today(), streak: streak };
        p.coins = (p.coins || 0) + coins;
        return { coins: coins, streak: streak };
      });
    }),
    buyItem: onCall(async (req) => {
      const uid = player(req), it = Cat.byId[(req.data || {}).id];
      if (!it || it.only || !(it.price > 0)) throw new HttpsError("invalid-argument", "That item isn't for sale.");
      return withProfile(uid, nameOf(req), (p) => {
        if ((p.owned || []).indexOf(it.id) > -1) throw new HttpsError("already-exists", "You already own it.");
        if ((p.level || 1) < (it.level || 1)) throw new HttpsError("failed-precondition", "Reach level " + it.level + " first.");
        if ((p.coins || 0) < it.price) throw new HttpsError("failed-precondition", "Not enough coins.");
        p.coins -= it.price;
        p.owned = (p.owned || []).concat([it.id]);
        p.equipped = Object.assign({}, Cat.DEFAULTS, p.equipped); p.equipped[it.slot] = it.id;
        return { ok: true };
      });
    }),
    equip: onCall(async (req) => {
      const uid = player(req), it = Cat.byId[(req.data || {}).id];
      if (!it) throw new HttpsError("invalid-argument", "Unknown item.");
      return withProfile(uid, nameOf(req), (p) => {
        if ((p.owned || []).indexOf(it.id) < 0) throw new HttpsError("failed-precondition", "You don't own that.");
        p.equipped = Object.assign({}, Cat.DEFAULTS, p.equipped); p.equipped[it.slot] = it.id;
        return { ok: true };
      });
    })
  };
};
