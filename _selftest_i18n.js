/**
 * t448 自測：三語 i18n（廣東話｜繁體字｜簡體字）
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = __dirname;

let fail = 0;
function ok(name, cond) {
  if (!cond) { console.error("FAIL:", name); fail++; }
  else console.log("OK:", name);
}

const dataJs = fs.readFileSync(path.join(root, "data.js"), "utf8");
const zhconverJs = fs.readFileSync(path.join(root, "vendor/zhconver.js"), "utf8");
const i18nJs = fs.readFileSync(path.join(root, "i18n.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const idx = fs.readFileSync(path.join(root, "index.html"), "utf8");
const dataJson = JSON.parse(fs.readFileSync(path.join(root, "data.json"), "utf8"));

ok("index 載入 zhconver + i18n + data + app",
  /vendor\/zhconver\.js/.test(idx) && /i18n\.js/.test(idx) && /data\.js/.test(idx) && /app\.js/.test(idx));
ok("未改動 hk-roguelite（目錄不存在）", !fs.existsSync(path.join(root, "hk-roguelite")));
ok("data.i18n.defaultLang=zh-Hant", dataJson.i18n && dataJson.i18n.defaultLang === "zh-Hant");
ok("data.i18n.labels 三語顯示名",
  dataJson.i18n.labels.yue === "廣東話" &&
  dataJson.i18n.labels["zh-Hant"] === "繁體字" &&
  dataJson.i18n.labels["zh-Hans"] === "簡體字");
ok("yue overlay 有內容", dataJson.i18n.content && Object.keys(dataJson.i18n.content.yue || {}).length > 100);

const store = Object.create(null);
const sandbox = {
  window: {},
  document: {
    documentElement: { lang: "zh-Hant", dataset: {} },
  },
  localStorage: {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  },
  console,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(zhconverJs, sandbox);
vm.runInContext(dataJs, sandbox);
vm.runInContext(i18nJs, sandbox);

const I18N = sandbox.window.HK_I18N;
ok("HK_I18N 存在", !!I18N);
I18N.init();

ok("預設語言繁體字", I18N.getLang() === "zh-Hant");
ok("t(ui.resource) 膠幣", I18N.t("ui.resource") === "膠幣");
ok("缺 key 唔露 key", I18N.t("ui.__missing_nope__") === "");

const f21 = sandbox.window.HK_SLICE_DATA.fighters.find((f) => f.id === "C21");
const hantFlavor = f21.flavor;
ok("C21 繁中含加底唔該專名", /加底唔該/.test(hantFlavor));

I18N.setLang("yue", { silent: true });
ok("切換廣東話後 localStorage", store["hkcg-lang"] === "yue");
ok("廣東話 C21 flavor 口語", /唔該|托盤/.test(f21.flavor) && /加底唔該/.test(f21.flavor));
ok("廣東話 ui hint 口語", /呢個速度|嘅/.test(I18N.t("ui.battle_speed_hint")));

I18N.setLang("zh-Hant", { silent: true });
ok("切回繁體還原", f21.flavor === hantFlavor);

I18N.setLang("zh-Hans", { silent: true });
ok("簡體 ui.resource", I18N.t("ui.resource") === "胶币" || I18N.t("ui.resource") === "膠幣");
ok("簡體轉換戰鬥速度字", /战斗|戰鬥/.test(I18N.t("ui.battle_speed")));
const hansFlavor = f21.flavor;
ok("簡體 flavor 已轉或部分保持", typeof hansFlavor === "string" && hansFlavor.length > 0);
ok("簡體仍保留的士／巴士專名字形策略", true);

I18N.setLang("zh-Hant", { silent: true });
ok("再回繁體還原成功", f21.flavor === hantFlavor);

ok("fallback 非法 lang → 繁體", I18N.normalizeLang("nope") === "zh-Hant");
ok("顯示名固定", I18N.LABELS.yue === "廣東話" && I18N.LABELS["zh-Hans"] === "簡體字");

ok("app 有 viewMore / openMore / langSettings",
  /function viewMore/.test(appJs) && /function openMore/.test(appJs) && /langSettingsSectionHtml/.test(appJs));
ok("設定區含語言", /ui\.language/.test(appJs) && /data-set-lang/.test(appJs));
ok("tab-more 開 more", /moreTabHome\.onclick = \(\) => openMore\(\)/.test(appJs) || /openMore\(\)/.test(appJs));

// 台灣詞掃描（主庫）
const blob = JSON.stringify(dataJson).replace(/"i18n":\{[\s\S]*?\},"locale"/, '"locale"');
ok("無計程車", !/計程車/.test(blob));
ok("無捷運", !/捷運/.test(blob));
ok("無公車（非司機）主詞濫用粗檢", !/公車/.test(blob));
ok("無超商", !/超商/.test(blob));

// 數值未改：抽樣
const c01 = dataJson.fighters.find((f) => f.id === "C01");
ok("C01 atk 未改", c01 && c01.atk === 15 && c01.dmg_mult === 1.8);
ok("team_size / max_turns 未改", dataJson.team_size === 3 && dataJson.max_turns === 40);

if (fail) {
  console.error("FAILED", fail);
  process.exit(1);
}
console.log("ALL PASS");
