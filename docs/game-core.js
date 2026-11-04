/* 六賽万点 game rules, shared by the web page (window.RokuCore) and the Cloud Functions server (require).
 * Everything here is pure: it takes a room and returns the Firestore update for the next state.
 * The server is the only one allowed to apply these updates; phones use the same code to show hints.
 * env.rollDie() returns 1-6 (the server uses crypto), env.nameOf(id) returns a player's name for the log. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RokuCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  function make(env) {
  var rollDie = env.rollDie, nameOf = env.nameOf;
  var MIN_ENTRY = 1000;
  var THREE_PAIRS = 1500, STRAIGHT = 2500, SMALL_STRAIGHT = 700, FULL_HOUSE = 1500, TWO_TRIPLETS = 2500;
  // Three of a kind = number x 100 (three 1s = 1,000). Each extra matching die adds 100.
  function kindScore(v, c) { return (v === 1 ? 1000 : v * 100) + 100 * (c - 3); }
  function counts(vals) { var c = [0, 0, 0, 0, 0, 0, 0]; vals.forEach(function (v) { c[v]++; }); return c; }
  // Scores a chosen set of dice from one throw. valid = every chosen die contributes to the score.
  // bonus = numbers whose triple was already kept this turn: each further die of that number is worth 100.
  function scoreSel(vals, bonus) {
    bonus = bonus || [];
    if (!vals.length) return { score: 0, valid: false };
    var c = counts(vals), n = vals.length, score = 0, v, w;
    var best = { score: 0, valid: false };
    function offer(sc) { if (sc > best.score) best = { score: sc, valid: true }; }
    function single(k) { return bonus.indexOf(k) > -1 || k === 1 ? 100 : k === 5 ? 50 : 0; }
    if (n === 6 && c.slice(1).every(function (x) { return x === 1; })) offer(STRAIGHT);
    if (n === 6 && c.slice(1).filter(function (x) { return x === 2; }).length === 3) offer(THREE_PAIRS);
    if (n === 6 && c.slice(1).filter(function (x) { return x === 3; }).length === 2) offer(TWO_TRIPLETS);
    var plain = true;
    for (v = 1; v <= 6; v++) {
      if (!c[v]) continue;
      var sc = Math.max(c[v] >= 3 ? kindScore(v, c[v]) : 0, single(v) * c[v]);
      if (sc <= 0) { plain = false; break; }
      score += sc;
    }
    if (plain) offer(score);
    // Five-dice straight (1-2-3-4-5 or 2-3-4-5-6). A leftover sixth die counts only if it scores on its own.
    if (n === 5 || n === 6) {
      [1, 2].forEach(function (lo) {
        var left = c.slice(), k, ok = true, extra = 0;
        for (k = lo; k < lo + 5; k++) { if (!left[k]) ok = false; else left[k]--; }
        if (!ok) return;
        for (k = 1; k <= 6; k++) {
          if (!left[k]) continue;
          if (left[k] === 1 && single(k) > 0) extra += single(k); else ok = false;
        }
        if (ok) offer(SMALL_STRAIGHT + extra);
      });
    }
    // Full house: three of a kind plus a pair (the pair does not have to score on its own).
    // A leftover sixth die counts only if it is a 1 or a 5.
    if (n === 5 || n === 6) {
      for (v = 1; v <= 6; v++) {
        if (c[v] < 3) continue;
        for (w = 1; w <= 6; w++) {
          if (c[w] < 2 || (w === v && c[v] < 5)) continue;   // five of a kind is a triple plus a pair
          var left = c.slice(); left[v] -= 3; left[w] -= 2;
          var extra = 0, ok = true, k;
          for (k = 1; k <= 6; k++) {
            if (!left[k]) continue;
            if (left[k] === 1 && single(k) > 0) extra += single(k);
            else ok = false;
          }
          if (ok) offer(FULL_HOUSE + extra);
        }
      }
    }
    return best;
  }
  function hasScore(vals, bonus) {
    var c = counts(vals), v;
    if (c[1] || c[5]) return true;
    if ((bonus || []).some(function (b) { return c[b] > 0; })) return true;
    for (v = 2; v <= 6; v++) if (c[v] >= 3) return true;   // also covers full houses and two triplets
    if (vals.length === 6) {
      if (c.slice(1).every(function (x) { return x === 1; })) return true;
      if (c.slice(1).filter(function (x) { return x === 2; }).length === 3) return true;
    }
    return false;
  }
  // mode "best": highest score, and on a tie keep fewer dice so more stay in play.
  // mode "all": every die that can score (the most dice), used by the 9,000+ must-keep rule.
  function pickSet(dice, held, bonus, mode, cap) {
    var free = [], i, m, best = null;
    for (i = 0; i < 6; i++) if (!held[i]) free.push(i);
    for (m = 1; m < (1 << free.length); m++) {
      var idxs = free.filter(function (_, k) { return m & (1 << k); });
      var sc = scoreSel(idxs.map(function (j) { return dice[j]; }), bonus);
      if (!sc.valid || sc.score <= 0 || (cap !== undefined && sc.score > cap)) continue;
      var better = !best || (mode === "all"
        ? (idxs.length > best.idxs.length || (idxs.length === best.idxs.length && sc.score > best.score))
        : mode === "min" ? (sc.score < best.score || (sc.score === best.score && idxs.length < best.idxs.length))
        : (sc.score > best.score || (sc.score === best.score && idxs.length < best.idxs.length)));
      if (better) best = { score: sc.score, idxs: idxs };
    }
    return best || { score: 0, idxs: [] };
  }
  // Never pick more than what's left to reach the target this turn.
  function roomLeft(r) { var cur = r.order[r.turn]; return r.target - ((r.scores && r.scores[cur]) || 0) - (r.turnScore || 0); }
  function bestSel(r) { return pickSet(r.dice, r.held, r.bonus, "best", r.rolloff ? undefined : roomLeft(r)).idxs; }
  // Within 1,000 of the target (9,000 when playing to 10,000), every scoring die must be kept.
  // From 2,000 below the target (8,000 when playing to 10,000), show what each player needs to go out.
  function needToGoOut(r, id) {
    var sc = (r.scores && r.scores[id]) || 0;
    return sc >= r.target - 2000 && sc < r.target ? r.target - sc : 0;
  }
  function pointsLeft(r, id) { var sc = (r.scores && r.scores[id]) || 0; return sc < r.target ? r.target - sc : 0; }
  function lockMode(r, id) { return ((r.scores && r.scores[id]) || 0) >= r.target - 1000; }
  function pushLog(r, line) { return (r.log || []).concat([line]).slice(-8); }
  var FRESH_TURN = { dice: [], held: [false, false, false, false, false, false], turnScore: 0, phase: "roll", bonus: [], pick: [], pickRoll: -1, forced: [], bust: null, auto: null };
  function endTurn(r, scores, log) {
    if (r.rolloff) return rolloffNext(r, scores, log);
    var n = r.order.length, cur = r.order[r.turn], k, idx, id;
    // Final round: once anyone sits on exactly the target, every other player gets one last turn.
    // finalDone remembers who has had it, so the round always ends, even if a turn was skipped.
    var hit = r.order.filter(function (x) { return (scores[x] || 0) === r.target; });
    if (hit.length) {
      var finalists = (r.finalists || []).filter(function (x) { return hit.indexOf(x) > -1; });
      hit.forEach(function (x) { if (finalists.indexOf(x) < 0) finalists.push(x); });
      var done = (r.finalDone || []).slice(); if (done.indexOf(cur) < 0) done.push(cur);
      for (k = 1; k <= n; k++) {
        idx = (r.turn + k) % n; id = r.order[idx];
        if (done.indexOf(id) < 0 && hit.indexOf(id) < 0)
          return Object.assign({ scores: scores, finalFrom: r.finalFrom >= 0 ? r.finalFrom : r.turn, finalists: finalists, finalDone: done, turn: idx, log: log }, FRESH_TURN);
      }
      return finishFinalRound(Object.assign({}, r, { finalists: finalists }), scores, log);
    }
    return Object.assign({ scores: scores, finalFrom: -1, finalists: [], finalDone: [], turn: (r.turn + 1) % n, log: log }, FRESH_TURN);
  }
  // One player hit the target: they win. Several: 決戦 (Kessen), a roll-off.
  function finishFinalRound(r, scores, log) {
    var f = r.finalists || [];
    if (f.length <= 1) return { status: "done", phase: "done", winner: f[0], winHow: "exact", scores: scores, turnScore: 0, auto: null, finalFrom: -1, finalDone: [],
      log: pushLog({ log: log }, { k: "exact", name: nameOf(f[0]), t: r.target }) };
    return Object.assign({ scores: scores, finalFrom: -1, finalDone: [], turn: r.order.indexOf(f[0]), rolloff: { players: f.slice(), i: 0, round: 1, results: {} },
      log: pushLog({ log: log }, { k: "kessen", names: f.map(nameOf).join(", ") }) }, FRESH_TURN);
  }
  function rolloffNext(r, scores, log) {
    var ro = r.rolloff, i = ro.i + 1, res = ro.results || {};
    if (i < ro.players.length) return Object.assign({ scores: scores, turn: r.order.indexOf(ro.players[i]), "rolloff.i": i, log: log }, FRESH_TURN);
    var best = Math.max.apply(null, ro.players.map(function (id) { return res[id] || 0; }));
    var top = ro.players.filter(function (id) { return (res[id] || 0) === best; });
    if (top.length === 1) return { status: "done", phase: "done", winner: top[0], winHow: "kessen", scores: scores, turnScore: 0, auto: null,
      log: pushLog({ log: log }, { k: "kwin", name: nameOf(top[0]), n: best }) };
    return Object.assign({ scores: scores, turn: r.order.indexOf(top[0]), rolloff: { players: top, i: 0, round: (ro.round || 1) + 1, results: {} },
      log: pushLog({ log: log }, { k: "kagain", names: top.map(nameOf).join(", "), n: best }) }, FRESH_TURN);
  }
  function rollFrom(r, held, turnScore, log, bonus) {
    bonus = bonus || [];
    var h = held.slice(), hot = false, i;
    // Hot dice is a fresh throw of all six, so earlier triples stop counting as "extra dice worth 100".
    if (h.every(Boolean)) { h = [false, false, false, false, false, false]; hot = true; bonus = []; }
    var dice = r.dice.length ? r.dice.slice() : [1, 1, 1, 1, 1, 1];
    var free = [];
    for (i = 0; i < 6; i++) if (!h[i]) { dice[i] = rollDie(); free.push(dice[i]); }
    var who = nameOf(r.order[r.turn]), rid = (r.rollId || 0) + 1;
    if (free.length === 6 && free.every(function (x) { return x === free[0]; })) {
      // Six of anything in one throw wins the game on the spot.
      return { status: "done", phase: "done", winner: r.order[r.turn], winHow: "six", dice: dice, held: h, turnScore: 0, rollId: rid, pick: [], pickRoll: -1,
        log: pushLog({ log: log }, { k: "six", name: who, v: free[0] }) };
    }
    if (!hasScore(free, bonus)) {
      var sunk = { dice: dice, held: h, turnScore: 0, phase: "farkle", rollId: rid, pick: [], pickRoll: -1, forced: [], bust: null, log: pushLog({ log: log }, { k: r.rolloff ? "ksunk" : "farkle", name: who, n: turnScore }) };
      if (r.rolloff) sunk["rolloff.results." + r.order[r.turn]] = turnScore;
      return sunk;
    }
    var cur = r.order[r.turn], forced = [];
    if (r.rolloff) {
      // 決戦: no target and no must-keep rule, just roll until 撃沈.
    } else if (lockMode(r, cur)) {
      // 9,000+ rule: every scoring die is kept. If that goes over the target, it's a bust.
      var f = pickSet(dice, h, bonus, "all");
      if ((r.scores[cur] || 0) + turnScore + f.score > r.target) {
        return { dice: dice, held: h, turnScore: 0, phase: "farkle", bust: "over", rollId: rid, forced: f.idxs, pick: [], pickRoll: -1,
          log: pushLog({ log: log }, { k: "over", name: who, n: f.score, t: r.target }) };
      }
      forced = f.idxs;
    } else {
      // Going over the target ends the turn: if even the smallest legal keep is too much, it's a bust.
      var least = pickSet(dice, h, bonus, "min");
      if ((r.scores[cur] || 0) + turnScore + least.score > r.target) {
        return { dice: dice, held: h, turnScore: 0, phase: "farkle", bust: "over", rollId: rid, forced: least.idxs, pick: [], pickRoll: -1,
          log: pushLog({ log: log }, { k: "over", name: who, n: least.score, t: r.target }) };
      }
    }
    return { dice: dice, held: h, turnScore: turnScore, phase: "choose", rollId: rid, bonus: bonus, pick: [], pickRoll: -1, forced: forced, bust: null, log: hot ? pushLog({ log: log }, { k: "hot", name: who }) : log };
  }
  function keepPatch(r, idxs, kind) {
    var keptVals = idxs.map(function (i) { return r.dice[i]; }), s = scoreSel(keptVals, r.bonus);
    if (!s.valid || s.score <= 0) return null;
    // Any triple kept now makes further dice of that number worth 100 for the rest of the turn.
    var bonus = (r.bonus || []).slice(), kc = counts(keptVals);
    for (var bv = 1; bv <= 6; bv++) if (kc[bv] >= 3 && bonus.indexOf(bv) < 0) bonus.push(bv);
    var held = r.held.slice(); idxs.forEach(function (i) { held[i] = true; });
    var cur = r.order[r.turn], total = r.turnScore + s.score, me = nameOf(cur);
    if (r.rolloff) return kind === "bank" ? null : rollFrom(r, held, total, r.log || [], bonus);   // 決戦: no banking
    if ((r.scores[cur] || 0) + total > r.target) return null;   // can't keep dice that go over the target
    if (kind !== "bank") return rollFrom(r, held, total, r.log || [], bonus);
    if (!(r.scores[cur] > 0) && total < MIN_ENTRY) return null;
    var newScore = (r.scores[cur] || 0) + total;
    if (newScore > r.target) return null;   // must land exactly on the target
    var scores = Object.assign({}, r.scores); scores[cur] = newScore;
    var log = pushLog(r, { k: "bank", name: me, n: total });
    if (newScore === r.target) {
      // Hitting the target starts the final round (or joins it): everyone else gets one more turn.
      var first = !(r.finalFrom >= 0);
      var r2 = Object.assign({}, r, { finalFrom: first ? r.turn : r.finalFrom, finalists: (r.finalists || []).concat([cur]) });
      return endTurn(r2, scores, pushLog({ log: log }, { k: first ? "final" : "reach", name: me, t: r.target }));
    }
    return endTurn(r, scores, log);
  }

  // ---------- table actions (server only) ----------
  // A new game: the last winner rolls first, everyone else keeps their place.
  function startPatch(ids, lastWinner) {
    ids = ids.slice();
    var w = ids.indexOf(lastWinner);
    if (w > 0) ids = ids.slice(w).concat(ids.slice(0, w));
    var scores = {}; ids.forEach(function (x) { scores[x] = 0; });
    return Object.assign({ status: "play", order: ids, scores: scores, turn: 0, rollId: 0, finalFrom: -1, finalists: [], finalDone: [], rolloff: null,
      winner: null, winHow: null, log: [{ k: w > -1 ? "startw" : "start", name: nameOf(ids[0]) }] }, FRESH_TURN);
  }
  function againPatch(r) {
    return { status: "lobby", phase: "roll", dice: [], winner: null, lastWinner: r.winner || null, finalFrom: -1, finalists: [], finalDone: [], rolloff: null, log: [], auto: null };
  }
  function letInPatch(r, id) {
    var p = { order: r.order.concat([id]), log: pushLog(r, { k: "sat", names: nameOf(id) }) };
    p["scores." + id] = 0;
    return p;
  }
  // The host removes a player mid-game: out of the turn order; if it was their turn, it moves on.
  function removePatch(r, id) {
    var name = nameOf(id), patch = {};
    if (r.status !== "play" || !r.order || r.order.indexOf(id) < 0) return patch;
    var idx = r.order.indexOf(id), order = r.order.filter(function (x) { return x !== id; });
    var scores = Object.assign({}, r.scores); delete scores[id];
    var log = pushLog(r, { k: "removed", name: name });
    var ro = r.rolloff ? Object.assign({}, r.rolloff, { players: r.rolloff.players.filter(function (x) { return x !== id; }) }) : null;
    if (!order.length) return { status: "lobby", order: [], log: [] };
    if (idx === r.turn) {
      var ri = ro ? r.rolloff.players.indexOf(id) : -1;
      if (ro) ro.i = ri - 1;
      var r2 = Object.assign({}, r, { finalDone: (r.finalDone || []).concat([id]), rolloff: ro });
      var p2 = endTurn(r2, scores, log);
      if (p2.turn !== undefined) p2.turn = order.indexOf(r.order[p2.turn]);
      if (ro && !p2.rolloff && p2.status !== "done") p2["rolloff.players"] = ro.players;
      return Object.assign(p2, { order: order, scores: scores });
    }
    patch = { order: order, scores: scores, log: log, turn: idx < r.turn ? r.turn - 1 : r.turn,
      finalists: (r.finalists || []).filter(function (x) { return x !== id; }), finalDone: (r.finalDone || []).filter(function (x) { return x !== id; }) };
    if (ro) { var pos = r.rolloff.players.indexOf(id); if (pos > -1 && pos < ro.i) ro.i--; patch.rolloff = ro; }
    return patch;
  }
  // Auto-play one move for whoever's turn it is: roll, then keep the best (or must-keep) dice and bank when allowed.
  function autoPatch(r) {
    var cur = r.order[r.turn];
    var base = r.auto === cur ? r : Object.assign({}, r, { log: pushLog(r, { k: "auto", name: nameOf(cur) }) });
    var patch = null;
    if (r.phase === "roll") patch = rollFrom(base, r.held, 0, base.log, []);
    else if (r.phase === "choose") {
      var idxs = (r.forced && r.forced.length) ? r.forced.slice() : bestSel(r);
      patch = keepPatch(base, idxs, "bank") || keepPatch(base, idxs, "roll");
    }
    if (patch && patch.turn === undefined && patch.status !== "done") patch.auto = cur;   // still this player's turn
    return patch;
  }
  function passPatch(r, reason) {
    var log = reason === "auto" ? (r.log || []) : pushLog(r, { k: reason === "skip" ? "skip" : "pass", name: nameOf(r.order[r.turn]) });
    return endTurn(r, r.scores, log);
  }

  return {
    MIN_ENTRY: MIN_ENTRY, THREE_PAIRS: THREE_PAIRS, STRAIGHT: STRAIGHT, SMALL_STRAIGHT: SMALL_STRAIGHT, FULL_HOUSE: FULL_HOUSE, TWO_TRIPLETS: TWO_TRIPLETS,
    kindScore: kindScore, counts: counts, scoreSel: scoreSel, hasScore: hasScore, pickSet: pickSet, roomLeft: roomLeft, bestSel: bestSel,
    needToGoOut: needToGoOut, pointsLeft: pointsLeft, lockMode: lockMode, pushLog: pushLog, FRESH_TURN: FRESH_TURN,
    endTurn: endTurn, finishFinalRound: finishFinalRound, rolloffNext: rolloffNext, rollFrom: rollFrom, keepPatch: keepPatch,
    startPatch: startPatch, againPatch: againPatch, letInPatch: letInPatch, removePatch: removePatch, autoPatch: autoPatch, passPatch: passPatch
  };
  }
  return { make: make };
});
