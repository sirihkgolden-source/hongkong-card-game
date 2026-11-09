#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const data = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
let fail = 0;
function ok(c, m) { if (!c) { console.error("FAIL", m); fail++; } else console.log("OK", m); }

const pack = data.story_packs.find((p) => p.id === "guard_baoan");
ok(!!pack, "pack exists");
ok(pack.engine === "accident", "engine accident");
ok(pack.no_life_age === true, "no_life_age");
ok(Array.isArray(pack.accident_chain) && pack.accident_chain.length === 29, "29 chain nodes");
ok(!pack.office_interval_years, "no office interval");
ok(!pack.baoan_retire_age, "no retire age");

const evs = data.events.filter((e) => e.story_pack_id === "guard_baoan");
ok(evs.length >= 32, "events >=32 got " + evs.length);
const mains = pack.accident_chain.filter((id) => id.includes("_M"));
const trans = pack.accident_chain.filter((id) => id.includes("_T"));
ok(mains.length === 20, "20 mains");
ok(trans.length === 9, "9 trans");

for (const id of pack.accident_chain) {
  const e = data.events.find((x) => x.id === id);
  ok(!!e, "node " + id);
  if (!e) continue;
  ok(Array.isArray(e.accident_choices) && e.accident_choices.length >= 1, id + " choices");
  (e.accident_choices || []).forEach((c, i) => {
    const d = c.hidden_delta || {};
    ["pressure", "boss", "procedure", "favor", "renqing", "gold_run"].forEach((k) => {
      ok(Object.prototype.hasOwnProperty.call(d, k), id + " c" + i + " has " + k);
    });
    ok(Object.prototype.hasOwnProperty.call(d, "flag_noted"), id + " c" + i + " flag_noted");
  });
}

const banned = ["廣播通知", "外賣员", "報管", "小區", "視頻監控"];
const blob = JSON.stringify(evs);
banned.forEach((b) => ok(!blob.includes(b), "no banned phrase " + b));
ok(blob.includes("報告管理處"), "uses 報告管理處");
ok(blob.includes("外賣騎手") || blob.includes("送餐員"), "uses 外賣騎手/送餐員");
ok(blob.includes("閉路"), "uses 閉路");
// 「先放行再登記」只可作錯誤選項，不可無代價正解
const wrongOnly = evs.every((e) => !(e.accident_choices || []).some((c) => {
  const t = (c.text || "") + (c.outcome || "");
  return /先放行再/.test(t) && !(c.hidden_delta && (c.hidden_delta.flag_noted || (c.hidden_delta.boss | 0) < 0 || (c.hidden_delta.procedure | 0) < 0));
}));
ok(wrongOnly, "先放行再登記 only as punished choice");

ok(data.fighters.filter((f) => f.pack_only === "guard_baoan").length === 34, "34 battle cards");
ok(data.skills.filter((s) => s.pack_only === "guard_baoan").length === 12, "12 skills");
ok(data.equipment.filter((e) => e.pack_only === "guard_baoan").length === 12, "12 equip");
ok(data.enemies.filter((e) => String(e.id).startsWith("E_GB")).length === 5, "5 enemies");

const arts = []
  .concat(data.fighters.filter((f) => f.pack_only === "guard_baoan").map((f) => f.art))
  .concat(data.skills.filter((s) => s.pack_only === "guard_baoan").map((s) => s.art))
  .concat(data.equipment.filter((e) => e.pack_only === "guard_baoan").map((e) => e.art));
arts.forEach((a) => ok(fs.existsSync(path.join(root, a)), "art " + a));
ok(fs.existsSync(path.join(root, pack.cover)), "cover");
ok(fs.existsSync(path.join(root, pack.portrait)), "portrait");

const shop = pack.accident_shop || [];
ok(shop.length === 9, "9 shop items");
ok(shop.find((s) => s.id === "shop_coffee" && s.price === 3), "coffee 3");
ok(shop.find((s) => s.id === "shop_colleague" && s.need_renqing === 1), "colleague renqing");

ok((pack.roster_duties || []).length >= 15, "duties pool");
ok(data.guard_baoan_meta.clear_soul_first === 20, "clear 20");
ok(data.guard_baoan_meta.clear_soul_replay === 5, "clear 5");

const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
ok(app.includes("function viewGbPrep"), "viewGbPrep");
ok(app.includes("applyHiddenDelta"), "applyHiddenDelta");
ok(app.includes("gbOnBattleEnd"), "gbOnBattleEnd");
ok(app.includes("stair_jump") || app.includes("gbStair"), "stair");
ok(app.includes("viewGbWheel"), "wheel");
ok(app.includes("viewGbWelfare"), "welfare");
ok(app.includes("viewGbDuties"), "duties");
ok(app.includes("pack.engine === \"accident\""), "age gate");
ok(!/if \(pack\.id === \"guard_baoan\"\) return 7/.test(app), "no hardcoded baoan interval 7");

const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
ok(/t45\d-/.test(idx), "cache bust");
// t451 locks
const appSrc = fs.readFileSync(path.join(root, "app.js"), "utf8");
ok(appSrc.includes("lead: 5, life: 60") || /lead:\s*5,\s*life:\s*60/.test(appSrc), "default lead5 life60");
ok(appSrc.includes("function effectiveLead"), "effectiveLead");
ok(appSrc.includes("function effectiveLife"), "effectiveLife");
ok(appSrc.includes("gbBattlePickCap"), "gbBattlePickCap");
ok(!/lifeHudHtml[\s\S]{0,800}chip gold/.test(appSrc.replace(/\n/g, " ")), "no gold chip in lifeHud");
ok(!/viewHome[\s\S]{0,1200}金幣 \$\{/.test(appSrc), "home has no gold template");

console.log(fail ? `\n${fail} failures` : "\nALL PASS");
process.exit(fail ? 1 : 0);
