(() => {
  "use strict";

  /**
   * 香江 Card Game · 三語 i18n
   * 廣東話｜繁體字（預設書面）｜簡體字
   * 文案單一 source of truth：UI 表＋ data 主庫（繁體書面）＋ data.i18n.content.yue
   */

  const LANG_KEY = "hkcg-lang";
  const LANGS = ["yue", "zh-Hant", "zh-Hans"];
  const LABELS = {
    yue: "廣東話",
    "zh-Hant": "繁體字",
    "zh-Hans": "簡體字",
  };
  const DEFAULT_LANG = "zh-Hant";

  /**
   * 僅遮罩「轉簡後會變成非港用詞」的危險項。
   * 的士／巴士／士多／膠幣等 t2s 後仍是港詞（或正確簡體），唔使遮。
   */
  /** 本包／香港專名：簡體轉換時保護，避免被改成內地壓縮詞 */
  const HK_TERM_SHIELDS = [
    "屋苑", "屋邨", "管理處", "外賣騎手", "送餐員", "閉路電視", "告示欄",
    "海嵐峰", "李步岸", "畢好彩", "麥峰", "邱得根", "報告管理處", "走火通道",
    "秩序", "護盾", "證據", "膠幣", "殘頁", "跳樓梯",
  ];

  /** UI 鍵表：繁體書面為準；廣東話改語體；簡體多由轉換生成，必要時覆寫 */
  const UI_HANT = {
    "ui.start": "開始",
    "ui.confirm": "確認",
    "ui.cancel": "取消／返回",
    "ui.fight": "入故事",
    "ui.pause": "暫停",
    "ui.speed2": "加速・兩倍",
    "ui.win": "這場勝利！",
    "ui.lose": "這場未能取勝",
    "ui.resource": "膠幣",
    "ui.atk": "攻",
    "ui.spd": "速",
    "ui.forfeit": "放棄",
    "ui.event_pick": "今次遭遇",
    "ui.rarity_common": "街招卡",
    "ui.rarity_rare": "靚牌",
    "ui.rarity_epic": "勁牌",
    "ui.rarity_legend": "鎮場王牌",
    "ui.inspect_basic": "首通",
    "ui.inspect_skill": "自帶技",
    "ui.inspect_flavor": "卡面文案",
    "ui.equip": "配技",
    "ui.next_year": "繼續",
    "ui.age_up": "繼續",
    "ui.battle_win": "這場勝利！",
    "ui.battle_lose": "這場未能取勝",
    "ui.life_win": "本世過關",
    "ui.life_lose": "謀生艱難。本世完結",
    "ui.language": "語言",
    "ui.settings": "設定",
    "ui.more": "更多",
    "ui.back": "返回",
    "ui.gold": "金幣",
    "ui.fame": "聲望",
    "ui.battle_speed": "戰鬥速度",
    "ui.battle_speed_hint": "下一場戰鬥沿用這個速度。",
    "ui.sfx": "戰鬥音效",
    "ui.sfx_hint": "出手時的短音。關掉之後仍然會打。",
    "ui.attrs_bar": "頂欄六維",
    "ui.attrs_hint": "收起之後，頂欄只留一顆六維按鈕。",
    "ui.on": "開",
    "ui.off": "關",
    "ui.collapse": "收起",
    "ui.expand": "展開",
    "ui.speed_1": "一倍",
    "ui.speed_2": "兩倍",
    "ui.speed_4": "四倍",
    "ui.forum": "討論區",
    "ui.email": "電郵",
    "ui.forum_link": "高登 NW 台",
    "ui.lang_hint": "即時套用，並記住你的選擇。",
    "ui.more_blurb": "語言與其他設定。與此處「設定」共用同一偏好。",
    "ui.open_settings": "開啟設定",
    "ui.tab_book": "卡冊",
    "ui.tab_life": "今世",
    "ui.tab_teahouse": "茶記",
    "ui.tab_jobs": "差事",
    "ui.tab_more": "更多",
    "ui.hint_rules": "查看規則",
    "ui.load_fail": "載入資料失敗。請用本機伺服器打開，或確認 data.js 存在。",
    "ui.soul_short": "膠幣不足",
    "attr.str": "力量",
    "attr.agi": "敏捷",
    "attr.intel": "智力",
    "attr.luck": "幸運",
    "attr.lead": "統率",
    "attr.life": "壽命",
    "dock.allies": "盟友",
    "dock.adv": "奇遇技",
    "dock.battle": "戰鬥技",
    "dock.gear": "裝備",
    "dock.item": "道具",
    "dock.fame": "聲望",
    "dock.settings": "設定",
    "help.tab-more": "更多：語言與設定。",
    "rarity.普通": "普通",
    "rarity.稀有": "稀有",
    "rarity.史詩": "史詩",
    "rarity.最高級": "最高級",
  };

  const UI_YUE = Object.assign({}, UI_HANT, {
    "ui.battle_speed_hint": "下一場戰鬥會沿用呢個速度。",
    "ui.sfx_hint": "出手嗰陣嘅短音。關掉之後一樣會打。",
    "ui.attrs_hint": "收起之後，頂欄淨係留一粒六維掣。",
    "ui.lang_hint": "即時生效，同埋會記住你嘅選擇。",
    "ui.more_blurb": "語言同其他設定。同「設定」共用同一個偏好。",
    "ui.load_fail": "載入資料失敗。請用本機伺服器打開，或者確認 data.js 存在。",
    "ui.soul_short": "膠幣唔夠",
    "ui.life_lose": "揾食艱難。今世完結",
    "help.tab-more": "更多：語言同設定。",
  });

  function makeHansPack(hantPack, t2sFn) {
    const out = Object.create(null);
    Object.keys(hantPack).forEach((k) => {
      out[k] = t2sFn(hantPack[k]);
    });
    // 顯示名固定（三語選單標籤本身唔跟語體變字）
    out["ui.language"] = "语言";
    return out;
  }

  let _lang = DEFAULT_LANG;
  let _t2s = null;
  let _yueOverlay = null;
  let _pathCache = new WeakMap();
  let _onChange = null;
  let _hantSnap = null; // path -> 繁體書面原文（單一 source of truth）

  const CONTENT_TEXT_KEYS = {
    name: 1, desc: 1, flavor: 1, blurb: 1, basic: 1, skill: 1, skill_effect: 1,
    rarity_slang: 1, tod: 1, stage: 1, reward_blurb: 1, title: 1, text: 1, outcome: 1,
    prompt: 1, caption: 1, life_summary: 1, voice_line: 1, tag: 1, label: 1,
    summary: 1, hint: 1, note: 1, detail: 1, line: 1, subtitle: 1, body: 1,
    option: 1, choice_text: 1, result: 1, ending_title: 1, ending_blurb: 1,
    pack_blurb: 1, intro: 1, outro: 1, toast: 1, help: 1, rule: 1,
  };

  function normalizeLang(v) {
    const s = String(v || "").trim();
    if (s === "yue" || s === "zh-Hant" || s === "zh-Hans") return s;
    // 容錯舊值／別名
    if (s === "zh_HK" || s === "zh-HK" || s === "cantonese") return "yue";
    if (s === "zh_TW" || s === "zh-TW" || s === "hant" || s === "traditional") return "zh-Hant";
    if (s === "zh_CN" || s === "zh-CN" || s === "hans" || s === "simplified") return "zh-Hans";
    return DEFAULT_LANG;
  }

  function readStoredLang() {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return DEFAULT_LANG;
      return normalizeLang(localStorage.getItem(LANG_KEY));
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function writeStoredLang(lang) {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return;
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
  }

  function ensureT2S() {
    if (_t2s) return _t2s;
    if (typeof zhconver !== "undefined" && typeof zhconver.t2s === "function") {
      _t2s = (s) => zhconver.t2s(String(s || ""));
    } else {
      _t2s = (s) => String(s || "");
    }
    return _t2s;
  }

  function toHans(text) {
    if (!text || typeof text !== "string") return text;
    const t2s = ensureT2S();
    let masked = text;
    const map = [];
    HK_TERM_SHIELDS.forEach((term, i) => {
      if (masked.indexOf(term) === -1) return;
      const token = `\uE100${i}\uE101`;
      map.push([token, term]);
      masked = masked.split(term).join(token);
    });
    let out = t2s(masked);
    for (const [token, term] of map) {
      // 專名保持香港用字（多數簡繁同形；若被轉亦還原繁體專名字形）
      out = out.split(token).join(term);
      out = out.split(t2s(token)).join(term);
    }
    return out;
  }

  function uiPack() {
    if (_lang === "yue") return UI_YUE;
    if (_lang === "zh-Hans") return makeHansPack(UI_HANT, toHans);
    return UI_HANT;
  }

  function t(key, fallback) {
    const pack = uiPack();
    if (key && Object.prototype.hasOwnProperty.call(pack, key) && pack[key] != null && pack[key] !== "") {
      return pack[key];
    }
    // 兼容舊 DATA.locale
    try {
      const loc = (window.HK_SLICE_DATA && window.HK_SLICE_DATA.locale) || {};
      if (loc[key] != null && loc[key] !== "" && typeof loc[key] === "string") {
        return _lang === "zh-Hans" ? toHans(loc[key]) : loc[key];
      }
    } catch (_) {}
    if (fallback != null && fallback !== "") {
      return _lang === "zh-Hans" ? toHans(String(fallback)) : String(fallback);
    }
    // 缺 key：玩家面唔露 key；退回繁中表或空字
    if (UI_HANT[key]) {
      return _lang === "zh-Hans" ? toHans(UI_HANT[key]) : UI_HANT[key];
    }
    return "";
  }

  /** 以繁體書面短句為準的短語轉換（硬編碼 UI 漸進遷移） */
  function tp(hantPhrase) {
    if (hantPhrase == null) return "";
    const s = String(hantPhrase);
    if (_lang === "zh-Hant") return s;
    if (_lang === "zh-Hans") return toHans(s);
    // 廣東話：有專門覆寫先用，否則維持書面（避免亂轉）
    const hit = Object.keys(UI_YUE).find((k) => UI_HANT[k] === s);
    if (hit) return UI_YUE[hit];
    return s;
  }

  function getLang() { return _lang; }

  function langLabel(id) {
    const k = normalizeLang(id);
    return LABELS[k] || LABELS[DEFAULT_LANG];
  }

  function walkContentStrings(fn) {
    const data = window.HK_SLICE_DATA;
    if (!data) return;

    function walk(node, parts) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach((v, i) => {
          const seg = (v && typeof v === "object" && v.id) ? ("id:" + v.id) : String(i);
          walk(v, parts.concat(seg));
        });
        return;
      }
      Object.keys(node).forEach((k) => {
        if (k === "i18n") return;
        const v = node[k];
        const p = parts.concat(k);
        if (typeof v === "string" && CONTENT_TEXT_KEYS[k] && /[\u4e00-\u9fff]/.test(v)) {
          fn(node, k, p.join("."), v);
        } else if (v && typeof v === "object") {
          walk(v, p);
        }
      });
    }
    walk(data, []);
  }

  function ensureHantSnap() {
    if (_hantSnap) return _hantSnap;
    _hantSnap = Object.create(null);
    // 若當前已是粵語／簡體套用狀態，優先用已存書面；否則把現值當書面
    walkContentStrings((node, key, path, value) => {
      _hantSnap[path] = value;
    });
    return _hantSnap;
  }

  /**
   * 把 data 可見文案套成當前語言（唔改數值）。
   * 主庫／snapshot＝繁體書面；粵語讀 overlay；簡體由書面轉。
   */
  function applyContentLang(lang) {
    const L = normalizeLang(lang || _lang);
    const snap = ensureHantSnap();
    const yue = yueOverlay();
    walkContentStrings((node, key, path) => {
      const hant = Object.prototype.hasOwnProperty.call(snap, path) ? snap[path] : node[key];
      if (L === "yue") {
        node[key] = Object.prototype.hasOwnProperty.call(yue, path) ? yue[path] : hant;
      } else if (L === "zh-Hans") {
        node[key] = toHans(hant);
      } else {
        node[key] = hant;
      }
    });
  }

  function setLang(next, opts) {
    const lang = normalizeLang(next);
    const prev = _lang;
    _lang = lang;
    writeStoredLang(lang);
    try {
      document.documentElement.lang =
        lang === "zh-Hans" ? "zh-Hans" : "zh-Hant";
      document.documentElement.dataset.lang = lang;
    } catch (_) {}
    try { applyContentLang(lang); } catch (_) {}
    if (opts && opts.silent) return lang;
    if (prev !== lang && typeof _onChange === "function") {
      try { _onChange(lang, prev); } catch (_) {}
    }
    return lang;
  }

  function onChange(fn) { _onChange = fn; }

  function yueOverlay() {
    if (_yueOverlay) return _yueOverlay;
    try {
      const raw = window.HK_SLICE_DATA && window.HK_SLICE_DATA.i18n && window.HK_SLICE_DATA.i18n.content && window.HK_SLICE_DATA.i18n.content.yue;
      _yueOverlay = raw && typeof raw === "object" ? raw : Object.create(null);
    } catch (_) {
      _yueOverlay = Object.create(null);
    }
    return _yueOverlay;
  }

  /** 依物件引用還原 data 路徑（與 build-i18n-content 一致） */
  function ensurePathIndex() {
    const data = window.HK_SLICE_DATA;
    if (!data) return;
    if (_pathCache.has(data)) return;
    const map = new WeakMap();

    function walk(node, parts) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach((v, i) => {
          const seg = (v && typeof v === "object" && v.id) ? ("id:" + v.id) : String(i);
          walk(v, parts.concat(seg));
        });
        return;
      }
      map.set(node, parts.join("."));
      Object.keys(node).forEach((k) => {
        if (k === "i18n") return;
        const v = node[k];
        if (v && typeof v === "object") walk(v, parts.concat(k));
      });
    }
    walk(data, []);
    _pathCache.set(data, map);
  }

  function fieldPath(obj, field) {
    ensurePathIndex();
    const data = window.HK_SLICE_DATA;
    const map = data ? _pathCache.get(data) : null;
    const base = map && map.get(obj);
    if (base) return base + "." + field;
    if (obj && obj.id) {
      // 後備：常見頂層集合
      const kinds = ["fighters", "enemies", "events", "skills", "equipment", "story_packs", "fates", "factions"];
      for (let i = 0; i < kinds.length; i++) {
        const arr = data && data[kinds[i]];
        if (Array.isArray(arr) && arr.indexOf(obj) >= 0) {
          return kinds[i] + ".id:" + obj.id + "." + field;
        }
      }
    }
    return null;
  }

  /**
   * 讀取內容欄位（單一 source：主庫繁體書面；粵語 overlay；簡體轉換）
   * 唔會改動原始 data。
   */
  function tf(obj, field, explicitPath) {
    if (!obj) return "";
    const raw = obj[field];
    if (raw == null) return "";
    if (typeof raw !== "string") return raw;
    if (_lang === "zh-Hant") return raw;
    if (_lang === "yue") {
      const p = explicitPath || fieldPath(obj, field);
      const over = p ? yueOverlay()[p] : null;
      return over != null ? over : raw;
    }
    // zh-Hans
    return toHans(raw);
  }

  /** 任意動態字串（toast／拼接）：按當前語體處理 */
  function ts(text) {
    if (text == null) return "";
    const s = String(text);
    if (_lang === "zh-Hant" || _lang === "yue") return s;
    return toHans(s);
  }

  function langPickerHtml(selected) {
    const cur = selected || _lang;
    return LANGS.map((id) => {
      const on = id === cur ? " on" : "";
      return `<button type="button" class="set-pick${on}" data-set-lang="${id}">${LABELS[id]}</button>`;
    }).join("");
  }

  // boot：讀偏好；內容套用延後到 data.js 已載入後（init）
  _lang = readStoredLang();
  try {
    document.documentElement.dataset.lang = _lang;
    document.documentElement.lang = _lang === "zh-Hans" ? "zh-Hans" : "zh-Hant";
  } catch (_) {}

  function init() {
    ensureHantSnap();
    applyContentLang(_lang);
  }

  window.HK_I18N = {
    LANG_KEY,
    LANGS,
    LABELS,
    DEFAULT_LANG,
    t,
    tp,
    ts,
    tf,
    getLang,
    setLang,
    langLabel,
    onChange,
    langPickerHtml,
    toHans,
    normalizeLang,
    applyContentLang,
    init,
  };
})();

