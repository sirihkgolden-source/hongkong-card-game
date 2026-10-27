/**
 * t320 自測：機身真扭蛋輪廓＋結果卡說明綁定＋SOUL_START 260；保 t319 規則
 */
const fs = require("fs");
const path = require("path");
const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
const idx = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
let fail = 0;
function ok(name, cond) {
  if (!cond) { console.error("FAIL:", name); fail++; }
  else console.log("OK:", name);
}

// Keep t319
ok("返回永遠可撳路徑仍在", /btn-gacha-back[\s\S]{0,120}removeAttribute\("disabled"\)/.test(app));
ok("不足 toast", /toast\("魂焰不足"\)/.test(app));
ok("reveal/result 藏機", /phase-result \.gacha-machine[\s\S]{0,80}display:\s*none/.test(css));
ok("單 15／十 135／pity 20／40", /gachaPriceSingle = 15/.test(app) && /gachaPriceTen = 135/.test(app) && /GACHA_PITY_RARE = 20/.test(app) && /GACHA_PITY_EPIC = 40/.test(app));

// Machine silhouette
ok("半球罩 gm-dome-glass border-radius 50%", /gm-dome-glass[\s\S]{0,200}border-radius:\s*50%/.test(css));
ok("燈箱 廟街扭蛋／NEON", /廟街扭蛋/.test(app) && /gm-neon-en/.test(app) && /NEON/.test(app));
ok("粗轉扭 ring+handle+hub", /gm-knob-ring/.test(app) && /gm-knob-handle/.test(css) && /gm-knob-hub/.test(css));
ok("出蛋槽／門", /gm-chute-door/.test(css) && /出蛋口/.test(app));
ok("密蛋 ≥24", (css.match(/\.gm-ball\.b\d+/g) || []).length >= 24);
ok("機身窄高 width min(248", /width:\s*min\(248px/.test(css));
ok("禁舊扁 sign-only 作主角（改 lightbox）", /gm-lightbox/.test(css) && !/class=\\"gm-sign\\"/.test(app));

// Card help
ok("gacha-card data-id／data-kind／data-gacha-help", /data-gacha-help=\\"1\\"/.test(app) && /data-kind=\\"/.test(app));
ok("wireGachaCardHelp + showHelpTip", /function wireGachaCardHelp/.test(app) && /wireGachaCardHelp\(stage\)/.test(app));
ok("跟 kind 開說明", /gachaResultHelpText/.test(app) && /fighterHelpText/.test(app) && /skillHelpText/.test(app) && /equipHelpText/.test(app));
ok("hint 點擊查看說明", /點擊查看說明/.test(app));
ok("help-tip z-index ≥500", /help-tip[\s\S]{0,80}z-index:\s*500/.test(css));

// Soul 260
ok("SOUL_START = 260", /const SOUL_START = 260/.test(app));
ok("state 初始用 SOUL_START", /soul:\s*SOUL_START/.test(app));
ok("abandonLife 用 SOUL_START", /state\.soul = SOUL_START/.test(app));
ok("load 缺欄用 SOUL_START（唔洗有值）", /num\(data\.soul,\s*SOUL_START\)/.test(app));
ok("唔再寫死 soul: 30／soul = 30", !/\bsoul:\s*30\b/.test(app) && !/state\.soul\s*=\s*30\b/.test(app));

ok("index ?v=t320-1", /\?v=t320-1/.test(idx));

if (fail) { console.error("\nTOTAL FAIL", fail); process.exit(1); }
console.log("\nALL PASS");
