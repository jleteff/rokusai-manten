/* App Store safety tools: report a player, block a player, delete your account. */
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");

exports.callables = (db, player) => ({
  // Reports land in the "reports" collection (Firebase console → Firestore) for the owner to review.
  report: onCall(async (req) => {
    const uid = player(req), d = req.data || {};
    if (typeof d.target !== "string" || d.target === uid) throw new HttpsError("invalid-argument", "Pick someone to report.");
    const reason = ["chat", "cheating", "name", "photo", "other"].indexOf(d.reason) > -1 ? d.reason : "other";
    await db.collection("reports").add({ by: uid, target: d.target, reason: reason, room: typeof d.room === "string" ? d.room.slice(0, 8) : null,
      note: typeof d.note === "string" ? d.note.slice(0, 500) : "", targetName: typeof d.name === "string" ? d.name.slice(0, 40) : "", at: Date.now(), status: "open" });
    return { ok: true };
  }),
  // Blocked players' chat is hidden for you on every device.
  block: onCall(async (req) => {
    const uid = player(req), d = req.data || {};
    if (typeof d.target !== "string" || d.target === uid) throw new HttpsError("invalid-argument", "Pick someone.");
    const ref = db.doc("users/" + uid);
    await db.runTransaction(async (tx) => {
      const s = await tx.get(ref); if (!s.exists) throw new HttpsError("failed-precondition", "Profile not ready.");
      const list = (s.data().blocked || []).filter((x) => x !== d.target);
      if (d.on !== false) list.push(d.target);
      tx.update(ref, { blocked: list.slice(-200) });
    });
    return { ok: true };
  }),
  // Deletes the profile, coins and items, then the sign-in account itself. Purchases stay with Apple/Google.
  deleteAccount: onCall(async (req) => {
    const uid = req.auth && req.auth.uid;   // works even before the email is confirmed
    if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
    await db.doc("users/" + uid).delete();
    await getAuth().deleteUser(uid);
    return { ok: true };
  })
});
