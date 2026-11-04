/* 六賽万点 shop catalog and progression numbers, shared by the page (window.RokuCatalog) and the server.
 * Cosmetic only: nothing here changes the odds. Prices are in Koban (小判) coins. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RokuCatalog = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // slot: dice | felt | frame | fx. price: coins (0 = free). level: needed to buy. only: "founder" | "vip" | "season" (not sold for coins).
  var items = [
    { id: "classic", slot: "dice", name: "Classic Ivory", ar: "عاجي كلاسيكي", price: 0, look: { a: "#fffaea", b: "#e2d9bd", pip: "#15130f", edge: "#a99f7f" } },
    { id: "crimson", slot: "dice", name: "Crimson", ar: "قرمزي", price: 150, look: { a: "#e04848", b: "#8e1b1b", pip: "#fff6ec", edge: "#5e1010" } },
    { id: "jade", slot: "dice", name: "Jade", ar: "يشم", price: 300, look: { a: "#6fd0a0", b: "#1f7a52", pip: "#f4fff8", edge: "#145238" } },
    { id: "obsidian", slot: "dice", name: "Obsidian", ar: "سبج", price: 300, look: { a: "#45454f", b: "#0e0e12", pip: "#e3b74e", edge: "#000000" } },
    { id: "sakura", slot: "dice", name: "Sakura", ar: "ساكورا", price: 450, level: 3, look: { a: "#ffe1ea", b: "#f39ab8", pip: "#7a1f3d", edge: "#b8617f" } },
    { id: "marble", slot: "dice", name: "Marble", ar: "رخام", price: 450, level: 3, look: { a: "#ffffff", b: "#c9ced4", pip: "#2b2f36", edge: "#8d939b", vein: 1 } },
    { id: "neon", slot: "dice", name: "Neon", ar: "نيون", price: 600, level: 5, look: { a: "#231540", b: "#0b0618", pip: "#39ffb6", edge: "#39ffb6", glow: "#39ffb6" } },
    { id: "royal", slot: "dice", name: "Royal Gold", ar: "ذهب ملكي", price: 1000, level: 8, look: { a: "#ffe9a3", b: "#c9952b", pip: "#3a2408", edge: "#7d5a14", glow: "#ffd76a" } },
    { id: "founder", slot: "dice", name: "Founder's Gold", ar: "ذهب المؤسسين", only: "founder", look: { a: "#fff4c9", b: "#d4a017", pip: "#8b0000", edge: "#7a5508", glow: "#ffcf40" } },
    { id: "vip", slot: "dice", name: "VIP Onyx", ar: "أونيكس VIP", only: "vip", look: { a: "#2a2a2a", b: "#050505", pip: "#e3b74e", edge: "#e3b74e", glow: "#e3b74e" } },
    { id: "koi", slot: "dice", name: "Koi (Season 1)", ar: "كوي (الموسم ١)", only: "season", look: { a: "#fff7ee", b: "#ffd2b0", pip: "#e2471b", edge: "#c26a3a" } },

    { id: "green", slot: "felt", name: "Casino Green", ar: "أخضر الكازينو", price: 0, look: { hi: "#1a8458", mid: "#0f6142", lo: "#0a442e" } },
    { id: "royalblue", slot: "felt", name: "Royal Blue", ar: "أزرق ملكي", price: 200, look: { hi: "#2e6bd6", mid: "#1e4fa8", lo: "#13306a" } },
    { id: "velvet", slot: "felt", name: "Crimson Velvet", ar: "مخمل قرمزي", price: 200, look: { hi: "#b42a3d", mid: "#8a1c2b", lo: "#5a1019" } },
    { id: "midnight", slot: "felt", name: "Midnight", ar: "منتصف الليل", price: 400, level: 4, look: { hi: "#2a3556", mid: "#1b2238", lo: "#0d1120" } },
    { id: "silk", slot: "felt", name: "Sakura Silk", ar: "حرير ساكورا", price: 500, level: 6, look: { hi: "#d27b9c", mid: "#b4567a", lo: "#7d3552" } },
    { id: "founderfelt", slot: "felt", name: "Founder's Emerald", ar: "زمرد المؤسسين", only: "founder", look: { hi: "#1f9a66", mid: "#0c6b45", lo: "#043a24", trim: "#e3b74e" } },

    { id: "none", slot: "frame", name: "No frame", ar: "بدون إطار", price: 0, look: {} },
    { id: "bronze", slot: "frame", name: "Bronze", ar: "برونزي", price: 150, look: { c: "#cd7f32" } },
    { id: "silver", slot: "frame", name: "Silver", ar: "فضي", price: 400, level: 3, look: { c: "#d7dde3" } },
    { id: "gold", slot: "frame", name: "Gold", ar: "ذهبي", price: 900, level: 6, look: { c: "#e3b74e", glow: 1 } },
    { id: "founderframe", slot: "frame", name: "Founder", ar: "المؤسس", only: "founder", look: { c: "#ffcf40", c2: "#8b0000", glow: 1 } },
    { id: "vipframe", slot: "frame", name: "VIP", ar: "VIP", only: "vip", look: { c: "#b48cff", c2: "#e3b74e", glow: 1 } },
    { id: "samurai", slot: "frame", name: "Samurai (Season 1)", ar: "ساموراي (الموسم ١)", only: "season", look: { c: "#e2471b", c2: "#111111", glow: 1 } },

    { id: "nofx", slot: "fx", name: "No effect", ar: "بدون تأثير", price: 0, look: {} },
    { id: "sparks", slot: "fx", name: "Golden Sparks", ar: "شرارات ذهبية", price: 500, level: 2, look: { c: "#ffd76a" } },
    { id: "fire", slot: "fx", name: "Fire Roll", ar: "رمية نارية", price: 800, level: 5, look: { c: "#ff6a1a" } },
    { id: "lightning", slot: "fx", name: "Lightning", ar: "برق", price: 1000, level: 8, look: { c: "#8fd3ff" } }
  ];
  var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
  var DEFAULTS = { dice: "classic", felt: "green", frame: "none", fx: "nofx" };
  var FREE = items.filter(function (it) { return it.price === 0 && !it.only; }).map(function (it) { return it.id; });

  // Progression. Level L needs 50 * L * (L - 1) XP in total: 0, 100, 300, 600, 1000, 1500…
  function xpFor(level) { return 50 * level * (level - 1); }
  function levelFor(xp) { var L = 1; while (xpFor(L + 1) <= xp) L++; return L; }
  var REWARDS = {
    play: { coins: 20, xp: 50 }, win: { coins: 60, xp: 100 },
    levelUp: 100,            // coins per level gained
    dailyGames: 15,          // games per day that earn rewards
    minPlayers: 2,           // solo tables earn nothing
    starter: 250,            // coins for a new account
    daily: [50, 75, 100, 125, 150, 200, 300]   // login streak day 1..7+
  };
  return { items: items, byId: byId, DEFAULTS: DEFAULTS, FREE: FREE, xpFor: xpFor, levelFor: levelFor, REWARDS: REWARDS };
});
