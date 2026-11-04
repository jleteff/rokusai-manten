/* 六賽万点 server. Every game move goes through `move`, so dice are rolled here (crypto), not on phones,
 * and only this code can change scores, turns or coins. The database rules block phones from doing it. */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");
const Core = require("./game-core.js");
const Economy = require("./economy.js");
const Safety = require("./safety.js");
const Purchases = require("./purchases.js");

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const AUTO_FIRST = 20000, AUTO_NEXT = 5000, FARKLE_WAIT = 7000, SKIP_WAIT = 10000, GRACE = 1500;
const rollDie = () => crypto.randomInt(1, 7);

// Only signed-in, email-confirmed accounts can play.
function player(req) {
  const a = req.auth;
  if (!a) throw new HttpsError("unauthenticated", "Sign in first.");
  const t = a.token || {};
  if ((t.firebase && t.firebase.sign_in_provider) !== "password" || t.email_verified !== true) throw new HttpsError("permission-denied", "Confirm your email first.");
  return a.uid;
}
const need = (ok, msg) => { if (!ok) throw new HttpsError("failed-precondition", msg || "That move isn't allowed right now."); };
const validCode = c => typeof c === "string" && /^[A-Z0-9]{3,8}$/.test(c);

exports.move = onCall({ enforceAppCheck: false }, async (req) => {
  const uid = player(req);
  const d = req.data || {}, action = d.action;
  if (!validCode(d.code)) throw new HttpsError("invalid-argument", "Bad table code.");
  const roomRef = db.doc("rooms/" + d.code);
  await db.runTransaction(async (tx) => {
    const [snap, ps] = await Promise.all([tx.get(roomRef), tx.get(roomRef.collection("players"))]);
    if (!snap.exists) throw new HttpsError("not-found", "No such table.");
    const r = snap.data(), players = {};
    ps.docs.forEach((x) => { players[x.id] = x.data(); });
    // Tests only: in the local emulator, a room can carry preset dice. Never active on the real server.
    const preset = process.env.FUNCTIONS_EMULATOR === "true" && Array.isArray(r.testDice) ? r.testDice.slice() : null;
    const roll = preset ? () => (preset.length ? preset.shift() : rollDie()) : rollDie;
    const core = Core.make({ rollDie: roll, nameOf: (id) => (players[id] && players[id].name) || "Someone" });
    const now = Date.now(), isHost = r.host === uid, playing = r.status === "play";
    const cur = playing && r.order ? r.order[r.turn] : null, mine = cur === uid, seated = playing && r.order.indexOf(uid) > -1;
    const since = now - (r.movedAt || 0), onTarget = playing && !r.rolloff && ((r.scores || {})[cur] || 0) === r.target;
    let patch = null, removed = null;
    switch (action) {
      case "roll":
        need(mine && r.phase === "roll" && !onTarget);
        patch = core.rollFrom(r, r.held, 0, r.log || [], []); patch.auto = null;
        break;
      case "keep": {
        need(mine && r.phase === "choose");
        const idxs = Array.isArray(d.idxs) ? d.idxs : [];
        need(idxs.length > 0 && idxs.length <= 6 && idxs.every((i) => Number.isInteger(i) && i >= 0 && i < 6 && !r.held[i]) && new Set(idxs).size === idxs.length, "Pick dice that are still on the table.");
        const forced = r.forced || [];
        if (forced.length) need(forced.length === idxs.length && forced.every((i) => idxs.indexOf(i) > -1), "Every scoring die has to be kept.");
        patch = core.keepPatch(r, idxs, d.kind === "bank" ? "bank" : "roll");
        need(patch, "Those dice can't be kept that way.");
        if (patch.auto === undefined) patch.auto = null;
        break;
      }
      case "pass":   // after a 撃沈, or a player already sitting on the target
        need(playing && (r.phase === "farkle" || (r.phase === "roll" && onTarget)));
        need(mine || (isHost && since >= FARKLE_WAIT - GRACE) || (seated && since >= FARKLE_WAIT * 2));
        patch = core.passPatch(r, "auto");
        break;
      case "auto": { // the player went quiet: play one move for them
        need(playing && (r.phase === "roll" || r.phase === "choose") && !onTarget);
        const wait = r.auto === cur ? AUTO_NEXT : AUTO_FIRST;
        need(since >= wait - GRACE && (mine || isHost || (seated && since >= wait + 5000)), "Not yet.");
        patch = core.autoPatch(r);
        need(patch);
        break;
      }
      case "skip":
        need(isHost && playing && since >= SKIP_WAIT, "Give them a few more seconds.");
        patch = core.passPatch(r, "skip");
        break;
      case "start": {
        need(isHost && r.status === "lobby");
        const ids = Object.keys(players).filter((id) => !players[id].bot && (r.banned || []).indexOf(id) < 0)
          .sort((a, b) => (players[a].joined || 0) - (players[b].joined || 0));
        need(ids.length > 0);
        patch = core.startPatch(ids, r.lastWinner);
        patch.gameId = crypto.randomUUID();
        break;
      }
      case "again":
        need(isHost && r.status === "done");
        patch = core.againPatch(r);
        break;
      case "letin":
        need(isHost && playing && players[d.id] && !players[d.id].bot && r.order.indexOf(d.id) < 0 && (r.banned || []).indexOf(d.id) < 0);
        patch = core.letInPatch(r, d.id);
        break;
      case "remove":
        need(isHost && typeof d.id === "string" && d.id !== uid && players[d.id]);
        patch = core.removePatch(r, d.id);
        patch.banned = FieldValue.arrayUnion(d.id);
        removed = d.id;
        break;
      default:
        throw new HttpsError("invalid-argument", "Unknown move.");
    }
    patch.movedAt = now;
    if (preset) patch.testDice = preset;
    if (patch.status === "done" && r.status === "play") await Economy.awardGame(tx, db, r, patch, players);
    tx.update(roomRef, patch);
    if (removed) tx.delete(roomRef.collection("players").doc(removed));
  });
  return { ok: true };
});

Object.assign(exports, Economy.callables(db, player), Safety.callables(db, player), Purchases.callables(db, player));
