/**
 * t324 自測：loadGame 拆 soul top-up；扭蛋／店鋪／事件／同場禁重複靜態＋模擬核
 */
const fs = require("fs");
const path = require("path");
const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const dataJs = fs.readFileSync(path.join(root, "data.js"), "utf8");
const dataJson = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
const L = dataJson.i18n || dataJson.strings || dataJson;
let fail = 0;
const rows = [];
function ok(name, cond) {
  if (!cond) { console.error("FAIL:", name); fail++; rows.push({ name, pass: false }); }
  else { console.log("OK:", name); rows.push({ name, pass: true }); }
}

/* ---- 0) cache / syntax markers ---- */
ok("index ?v=t324-1 (css+app)", /\?v=t324-1/.test(idx) && /styles\.css\?v=t324-1/.test(idx) && /app\.js\?v=t324-1/.test(idx));
ok("SOUL_START = 260", /const SOUL_START = 260/.test(app));
ok("abandonLife 仍 SOUL_START", /state\.soul = SOUL_START/.test(app));
ok("state 初始 soul: SOUL_START", /soul:\s*SOUL_START/.test(app));

/* ---- 1) top-up 已拆 ---- */
ok("loadGame 無 soul<SOUL_START 補 260", !/\(state\.soul\s*\|\s*0\)\s*<\s*SOUL_START\)\s*state\.soul\s*=\s*SOUL_START/.test(app));
ok("loadGame 註解 t324 唔再 top-up", /t324[^\n]*唔再 top-up/.test(app));
ok("loadGame 跟舊值 Math.max(0, num(data.soul, SOUL_START))", /state\.soul = Math\.max\(0, num\(data\.soul, SOUL_START\) \| 0\)/.test(app));

/* 模擬 num／load 行為：soul=10 唔升到 260 */
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function loadSoul(dataSoul) {
  return Math.max(0, num(dataSoul, 260) | 0);
}
ok("模擬 load soul=10 → 10（唔 top-up）", loadSoul(10) === 10);
ok("模擬 load soul=0 → 0", loadSoul(0) === 0);
ok("模擬 load 缺欄 → 260", loadSoul(undefined) === 260);
ok("模擬 load soul=300 → 300", loadSoul(300) === 300);

/* ---- 2) 扭蛋主圖 ---- */
const machinePath = path.join(root, "assets/gacha/machine-ref.webp");
ok("assets/gacha/machine-ref.webp 存在", fs.existsSync(machinePath) && fs.statSync(machinePath).size > 1000);
ok("viewGacha 引用 machine-ref.webp", /assets\/gacha\/machine-ref\.webp/.test(app));
ok("gm-art img 標籤", /class=\\"gm-art\\"/.test(app) || /class=\"gm-art\"/.test(app));

/* ---- 3) 價錢／不足／可扣到 0 ---- */
ok("單抽 15", /gachaPriceSingle = 15/.test(app));
ok("十連 135", /gachaPriceTen = 135/.test(app));
ok("toast 膠幣不足", /toast\("膠幣不足"\)/.test(app));
ok("pullGacha reason 膠幣不足", /reason:\s*"膠幣不足"/.test(app));
ok("扣費後可歸零路徑（soul - cost）", /state\.soul = \(state\.soul \| 0\) - cost/.test(app));

const gachaPriceSingle = 15, gachaPriceTen = 135;
function simPull(soul, count) {
  const cost = (count === 10) ? gachaPriceTen : gachaPriceSingle * (count === 1 ? 1 : count);
  if ((soul | 0) < cost) return { ok: false, reason: "膠幣不足", soul, cost: 0 };
  return { ok: true, soul: (soul | 0) - cost, cost };
}
ok("模擬單抽 260→245", (() => { const r = simPull(260, 1); return r.ok && r.soul === 245 && r.cost === 15; })());
ok("模擬十連 260→125", (() => { const r = simPull(260, 10); return r.ok && r.soul === 125 && r.cost === 135; })());
ok("模擬 soul=10 單抽失敗＋文案", (() => { const r = simPull(10, 1); return !r.ok && r.reason === "膠幣不足" && r.soul === 10; })());
ok("模擬 soul=15 單抽→0", (() => { const r = simPull(15, 1); return r.ok && r.soul === 0; })());
ok("模擬 soul=135 十連→0", (() => { const r = simPull(135, 10); return r.ok && r.soul === 0; })());
ok("模擬 load(10) 後仍可保持 10（唔補）再失敗抽", (() => {
  let s = loadSoul(10);
  const r = simPull(s, 1);
  return s === 10 && !r.ok && r.reason === "膠幣不足";
})());

/* ---- 4) 新卡★1／複本升星／★5 退 15 ---- */
ok("albumMarkNewCardStar1", /function albumMarkNewCardStar1/.test(app));
ok("新卡 applyGachaGrant → albumMarkNewCardStar1", /albumMarkNewCardStar1\(kind, id\)/.test(app));
ok("複本升星 flag starup", /flag:\s*"starup"/.test(app) && /升星至★/.test(app));
ok("★5 退 15 膠幣文案", /已滿星，退回 " \+ refund \+ " 膠幣/.test(app) || /已滿星，退回 .+ 膠幣/.test(app));
ok("refund = gachaPriceSingle", /const refund = gachaPriceSingle/.test(app));

/* ---- 5) 返回可撳／結果卡 help ---- */
ok("返回 removeAttribute disabled", /btn-gacha-back[\s\S]{0,160}removeAttribute\("disabled"\)/.test(app));
ok("結果卡 data-gacha-help", /data-gacha-help=\\"1\\"/.test(app) || /data-gacha-help=\"1\"/.test(app));
ok("gachaResultHelpText／kind help", /gachaResultHelpText/.test(app) && /fighterHelpText/.test(app) && /skillHelpText/.test(app) && /equipHelpText/.test(app));
ok("wire 結果卡 click help", /data-gacha-help[\s\S]{0,200}forEach|querySelectorAll\("\.gacha-card\[data-gacha-help/.test(app));

/* ---- 6) 玩家字 膠幣／ui.resource ---- */
const uiRes = (dataJson.i18n && dataJson.i18n["ui.resource"])
  || (typeof L["ui.resource"] === "string" ? L["ui.resource"] : null)
  || (/"ui\.resource":\s*"膠幣"/.test(dataJs) ? "膠幣" : null);
ok("data ui.resource 膠幣", /"ui\.resource":\s*"膠幣"/.test(dataJs) && /"ui\.resource":\s*"膠幣"/.test(JSON.stringify(dataJson)));
ok("app 用 L[ui.resource]||膠幣", /L\["ui\.resource"\] \|\| "膠幣"/.test(app));
ok("價文案含 膠幣", /gachaPriceSingle \+ " 膠幣/.test(app) && /gachaPriceTen \+ " 膠幣/.test(app));

/* ---- 7) 權重 ---- */
ok("GACHA_WEIGHTS 70/20/8/2", /GACHA_WEIGHTS = \{ "普通": 70, "稀有": 20, "史詩": 8, "最高級": 2 \}/.test(app));
ok("GACHA_KIND_WEIGHTS 65/20/15", /fighters: 65, skills: 20, gear: 15/.test(app));

/* ---- 8) 店鋪四選一 ---- */
ok("shopPriceForRarity 存在", /function shopPriceForRarity/.test(app));
ok("viewShop 存在", /function viewShop\(root\)/.test(app));
ok("buildShopOffers／四選", /function buildShopOffers|buildShopOffers\(/.test(app));

/* ---- 9) card_trade／star_up ---- */
ok("app 事件 card_trade／star_up", /card_trade/.test(app) && /star_up/.test(app));
ok("data 事件 category card_trade", /"category":\s*"card_trade"/.test(dataJs));
ok("data 事件 category star_up", /"category":\s*"star_up"/.test(dataJs));
ok("data event defs id card_trade／star_up", /"id":\s*"card_trade"/.test(dataJs) && /"id":\s*"star_up"/.test(dataJs));

/* ---- 10) skillFieldTaken／同場禁重複 ---- */
ok("skillFieldTaken 定義", /function skillFieldTaken\(sid, exceptFid\)/.test(app));
ok("claimSkill 用 skillFieldTaken 擋", /if \(skillFieldTaken\(sid, fid\)\) return/.test(app));
ok("reconcileTeamSkillUniqueness", /function reconcileTeamSkillUniqueness/.test(app));

/* ---- write report json ---- */
const report = {
  ticket: "t324",
  when: new Date().toISOString(),
  fail,
  pass: rows.filter((r) => r.pass).length,
  total: rows.length,
  rows,
};
fs.writeFileSync(path.join(root, "_selftest_t324_report.json"), JSON.stringify(report, null, 2));
if (fail) { console.error("TOTAL FAIL", fail, "/", rows.length); process.exit(1); }
console.log("ALL PASS", rows.length);
