#!/usr/bin/env node
/**
 * 建立三語內容：
 * - 現有字串 → 廣東話 overlay（口語粵語）
 * - 轉寫繁體書面 → 主庫（預設）
 * - 簡體執行時由繁體書面轉
 * 不改數值欄位。可重跑：若已有 i18n.content.yue，先還原粵語再重算。
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA_JSON = path.join(ROOT, "data.json");
const DATA_JS = path.join(ROOT, "data.js");

const TEXT_KEYS = new Set([
  "name", "desc", "flavor", "blurb", "basic", "skill", "skill_effect",
  "rarity_slang", "tod", "stage", "reward_blurb", "title", "text", "outcome",
  "prompt", "caption", "life_summary", "voice_line", "tag", "label",
  "summary", "hint", "note", "detail", "line", "subtitle", "body",
  "option", "choice_text", "result", "ending_title", "ending_blurb",
  "pack_blurb", "intro", "outro", "toast", "help", "rule",
]);

/** 片語遮罩：轉換前暫代，轉換後還原（保留港味專名／技能名） */
const PHRASE_SHIELDS = [
  "加底唔該",
  "飛踢收工",
  "港鐵逼爆",
  "通宵的士",
  "通宵士多",
  "隧道巴士",
  "巴士總站",
  "巴士司機帽",
  "咪表",
  "咪錶",
];

const TW_TO_HK = [
  [/計程車/g, "的士"],
  [/出租車/g, "的士"],
  [/公車(?!司)/g, "巴士"],
  [/捷運/g, "港鐵"],
  [/超商/g, "便利店"],
  [/便利商店/g, "便利店"],
  [/下班(?!車)/g, "收工"],
  [/軟體/g, "軟件"],
  [/訊息/g, "消息"],
  [/視頻/g, "影片"],
];

const YUE_TO_WRITTEN = [
  [/點解/g, "為什麼"],
  [/點樣/g, "怎樣"],
  [/做咩/g, "做什麼"],
  [/咩事/g, "什麼事"],
  [/嘅嘢/g, "的東西"],
  [/呢啲/g, "這些"],
  [/嗰啲/g, "那些"],
  [/呢個/g, "這個"],
  [/嗰個/g, "那個"],
  [/呢條/g, "這條"],
  [/呢套/g, "這套"],
  [/呢度/g, "這裡"],
  [/呢轉/g, "這回"],
  [/邊度/g, "哪裡"],
  [/邊個/g, "哪個"],
  [/好似/g, "好像"],
  [/咁樣/g, "這樣"],
  [/噉樣/g, "這樣"],
  [/睇嚟/g, "看來"],
  [/而家/g, "現在"],
  [/返屋企/g, "回家"],
  [/屋企/g, "家裡"],
  [/返轉頭/g, "回頭"],
  [/收工嗰陣/g, "收工時"],
  [/嗰陣/g, "那時"],
  [/嗰晚/g, "那晚"],
  [/嗰日/g, "那天"],
  [/嗰下/g, "那一下"],
  [/嗰刻/g, "那一刻"],
  [/嗰聲/g, "那一聲"],
  [/唔好意思/g, "有點不好意思"],
  [/唔該謝/g, "謝謝"],
  [/唔該/g, "請"],
  [/唔使/g, "不用"],
  [/唔好/g, "不要"],
  [/唔會/g, "不會"],
  [/唔係/g, "不是"],
  [/唔知/g, "不知道"],
  [/唔夠/g, "不夠"],
  [/唔止/g, "不止"],
  [/唔單止/g, "不單"],
  [/唔掂/g, "不行"],
  [/唔記得/g, "不記得"],
  [/唔應該/g, "不應該"],
  [/唔用/g, "不用"],
  [/唔多講/g, "不多說"],
  [/唔報/g, "不報"],
  [/唔留/g, "不留"],
  [/唔怕/g, "不怕"],
  [/走唔甩/g, "走不了"],
  [/換唔換/g, "換不換"],
  [/追唔上/g, "追不上"],
  [/可唔可以/g, "可不可以"],
  [/得唔得/g, "可不可以"],
  [/冇人/g, "沒有人"],
  [/冇嘢/g, "沒有東西"],
  [/冇喊/g, "沒有哭"],
  [/冇/g, "沒有"],
  [/係咪/g, "是否"],
  [/同埋/g, "以及"],
  [/仲有/g, "還有"],
  [/仲係/g, "還是"],
  [/傾偈/g, "聊天"],
  [/搞掂/g, "辦妥"],
  [/執生/g, "自行應變"],
  [/我哋/g, "我們"],
  [/你哋/g, "你們"],
  [/佢哋/g, "他們"],
  [/喺度/g, "在這裡"],
  [/落嚟/g, "下來"],
  [/出嚟/g, "出來"],
  [/返嚟/g, "回來"],
  [/笑住講/g, "笑着說"],
  [/笑住/g, "笑着"],
  [/照住/g, "照着"],
  [/倒住/g, "倒着"],
  [/舉住/g, "舉着"],
  [/抽住/g, "抽着"],
  [/托住/g, "托着"],
  [/圍住/g, "圍着"],
  [/坐住/g, "坐着"],
  [/望住/g, "望着"],
  [/叫緊/g, "叫着"],
  [/流緊/g, "流着"],
  [/開緊/g, "開着"],
  [/冒住/g, "冒着"],
  [/歪埋/g, "歪了"],
  [/企得穩/g, "站得穩"],
  [/企喺度/g, "站在這裡"],
  [/只係企/g, "只是站"],
  [/企穩/g, "站穩"],
  [/企/g, "站"],
  [/女仔/g, "女孩"],
  [/男仔/g, "男孩"],
  [/後生仔/g, "年輕人"],
  [/後生/g, "年輕人"],
  [/細路/g, "小孩"],
  [/成條街/g, "整條街"],
  [/成場/g, "全場"],
  [/停低/g, "停下"],
  [/我識/g, "我認識"],
  [/佢/g, "他"],
  [/喺/g, "在"],
  [/咗/g, "了"],
  [/嚟/g, "來"],
  [/畀(?![面])/g, "給"],
  [/仲(?!裁|介|夏)/g, "還"],
  [/咁/g, "這麼"],
  [/噉/g, "這樣"],
  [/啲/g, "些"],
  [/嘢/g, "東西"],
  [/嘅/g, "的"],
  [/係(?![數])/g, "是"],
  [/唔/g, "不"],
  [/㗎/g, ""],
  [/喎/g, ""],
  [/噃/g, ""],
  [/囉/g, ""],
  [/咋/g, ""],
  [/咩/g, "什麼"],
  [/嗰/g, "那"],
  [/講(?=[：:「"'])/g, "說"],
  [/講：/g, "說："],
  [/啦(?=[。！？\s」』]|$)/g, ""],
  [/喇(?=[。！？\s」』]|$)/g, ""],
];

function applyPairs(s, pairs) {
  let out = s;
  for (const [re, to] of pairs) out = out.replace(re, to);
  return out;
}

function shield(s) {
  let out = s;
  const map = [];
  PHRASE_SHIELDS.forEach((phrase, i) => {
    if (out.indexOf(phrase) === -1) return;
    const token = `\uE000${i}\uE001`;
    map.push([token, phrase]);
    out = out.split(phrase).join(token);
  });
  return { out, map };
}

function unshield(s, map) {
  let out = s;
  for (const [token, phrase] of map) out = out.split(token).join(phrase);
  return out;
}

function toWritten(s) {
  if (typeof s !== "string" || !s) return s;
  const { out: masked, map } = shield(s);
  let out = masked;
  out = applyPairs(out, TW_TO_HK);
  out = applyPairs(out, YUE_TO_WRITTEN);
  out = unshield(out, map);
  out = out.replace(/[ ]{2,}/g, " ");
  out = out.replace(/。。+/g, "。");
  out = out.replace(/，。/g, "。");
  return out;
}

function pathKey(pathParts, node, key) {
  // Prefer id-based segment when parent array element has id
  return pathParts.concat(key).join(".");
}

function walkCollect(node, pathParts, bag) {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      const seg = (v && typeof v === "object" && v.id) ? ("id:" + v.id) : String(i);
      walkCollect(v, pathParts.concat(seg), bag);
    });
    return;
  }
  if (typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "i18n") continue;
    const p = pathParts.concat(k);
    if (typeof v === "string" && TEXT_KEYS.has(k) && /[\u4e00-\u9fff]/.test(v)) {
      bag.push({ path: pathKey(pathParts, node, k), key: k, value: v, parent: node });
    } else if (v && typeof v === "object") {
      walkCollect(v, p, bag);
    }
  }
}

function restoreYueIfPresent(data) {
  const yue = data.i18n && data.i18n.content && data.i18n.content.yue;
  if (!yue || typeof yue !== "object") return 0;
  let n = 0;
  const bag = [];
  walkCollect(data, [], bag);
  const byPath = Object.create(null);
  bag.forEach((it) => { byPath[it.path] = it; });
  for (const [p, original] of Object.entries(yue)) {
    const it = byPath[p];
    if (it && typeof original === "string") {
      it.parent[it.key] = original;
      n++;
    }
  }
  return n;
}

function main() {
  const data = JSON.parse(fs.readFileSync(DATA_JSON, "utf8"));
  const restored = restoreYueIfPresent(data);

  const bag = [];
  walkCollect(data, [], bag);

  const yueOverlay = Object.create(null);
  let changed = 0;
  let same = 0;

  for (const item of bag) {
    const written = toWritten(item.value);
    if (written !== item.value) {
      yueOverlay[item.path] = item.value;
      item.parent[item.key] = written;
      changed++;
    } else {
      same++;
    }
  }

  let twFixed = 0;
  for (const item of bag) {
    const cur = item.parent[item.key];
    const fixed = applyPairs(cur, TW_TO_HK);
    if (fixed !== cur) {
      item.parent[item.key] = fixed;
      twFixed++;
    }
  }

  if (!data.i18n) data.i18n = {};
  data.i18n.defaultLang = "zh-Hant";
  data.i18n.labels = {
    yue: "廣東話",
    "zh-Hant": "繁體字",
    "zh-Hans": "簡體字",
  };
  data.i18n.content = data.i18n.content || {};
  data.i18n.content.yue = yueOverlay;

  data.locale = Object.assign({}, data.locale || {}, {
    "ui.start": "開始",
    "ui.confirm": "確認",
    "ui.cancel": "取消／返回",
    "ui.resource": "膠幣",
    "ui.language": "語言",
    "ui.settings": "設定",
    "ui.more": "更多",
  });

  const json = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(DATA_JSON, json);
  fs.writeFileSync(DATA_JS, "window.HK_SLICE_DATA = " + json);

  console.log(JSON.stringify({
    restored,
    textFields: bag.length,
    rewrittenToHant: changed,
    unchanged: same,
    yueOverlayKeys: Object.keys(yueOverlay).length,
    twFixed,
    sample: {
      c21: (data.fighters.find((f) => f.id === "C21") || {}).flavor,
      ev04: (data.events.find((e) => e.id === "EV04") || {}).desc,
      yueC21: yueOverlay["fighters.id:C21.flavor"],
    },
  }, null, 2));
}

main();
