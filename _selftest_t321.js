/**
 * t321 自測：玩家可見資源名 魂焰→膠幣；內部 state.soul／價錢／補滿 260 不變
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const dataJs = fs.readFileSync(path.join(__dirname, "data.js"), "utf8");
const dataJson = fs.readFileSync(path.join(__dirname, "data.json"), "utf8");
const idx = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
let fail = 0;
function ok(name, cond) {
  if (!cond) { console.error("FAIL:", name); fail++; }
  else console.log("OK:", name);
}

ok("ui.resource 膠幣 (data.js)", /"ui\.resource":\s*"膠幣"/.test(dataJs));
ok("ui.resource 膠幣 (data.json)", /"ui\.resource":\s*"膠幣"/.test(dataJson));
ok("data.js 玩家字無 魂焰", !/魂焰/.test(dataJs));
ok("data.json 玩家字無 魂焰", !/魂焰/.test(dataJson));
ok("toast 膠幣不足", /toast\("膠幣不足"\)/.test(app));
ok("reason 膠幣不足", /reason:\s*"膠幣不足"/.test(app));
ok("fallback || \"膠幣\"", /\|\|\s*"膠幣"/.test(app));
ok("滿星退回 膠幣", /退回 .+ 膠幣/.test(app));
ok("投入膠幣 hint", /投入膠幣/.test(app));
ok("扭蛋價文案 膠幣", /gachaPriceSingle \+ " 膠幣/.test(app) && /gachaPriceTen \+ " 膠幣/.test(app) && /單次 .+ 膠幣 · 十連/.test(app));
ok("價錢仍 15／135", /gachaPriceSingle = 15/.test(app) && /gachaPriceTen = 135/.test(app));
ok("SOUL_START = 260", /const SOUL_START = 260/.test(app));
ok("loadGame 補滿 soul < SOUL_START", /\(state\.soul \| 0\) < SOUL_START\) state\.soul = SOUL_START/.test(app));
ok("內部 state.soul 仍在", /state\.soul/.test(app));
ok("index ?v=t321-1", /\?v=t321-1/.test(idx));

// app.js 剩餘 魂焰 只准註解
const playerHits = [];
app.split("\n").forEach((line, i) => {
  if (!line.includes("魂焰")) return;
  const t = line.trim();
  const isComment = t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("/**");
  if (!isComment) playerHits.push(i + 1);
});
ok("app.js 玩家字無 魂焰（剩餘僅註解）", playerHits.length === 0);

if (fail) { console.error("\nTOTAL FAIL", fail); process.exit(1); }
console.log("\nALL PASS");
