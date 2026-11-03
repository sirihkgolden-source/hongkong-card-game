(() => {
  "use strict";

  const DATA = window.HK_SLICE_DATA;
  if (!DATA) {
    document.getElementById("screen").innerHTML =
      "<p class='soft-panel'>載入資料失敗。請用本機伺服器打開，或確認 data.js 存在。</p>";
    return;
  }

  const TEAM_SIZE = DATA.team_size || 3;
  /** 開局／新人生／重置預設魂焰（讀舊檔唔洗現有值） */
  const SOUL_START = 260;
  const MAX_TURNS = DATA.max_turns || 40;
  /** 今世可帶入人生嘅技能卡上限 */
  const LIFE_SKILLS_CAP = 10;
  const L = DATA.locale || {};

  document.addEventListener("error", (ev) => {
    const img = ev.target;
    if (!img || img.tagName !== "IMG") return;
    if (img.dataset.artFallback === "1") return;
    // t358：扭蛋機主視覺唔可以退到「卡名生成」佔位圖（會變成一個「廟」字圓圈）
    // 載入失敗就顯示純 CSS 示意機，至少仍然係一部扭蛋機
    if (img.classList && img.classList.contains("gm-art")) {
      img.dataset.artFallback = "1";
      const machine = img.closest && img.closest(".gacha-machine");
      if (machine) machine.classList.add("gm-art-failed");
      return;
    }
    img.dataset.artFallback = "1";
    // 戰鬥卡／技能／裝備原圖未齊：退到「按卡名生成」嘅霓虹圖，比共用灰圖好辨識
    const name = img.dataset.cardName || img.getAttribute("alt") || "";
    const kind = img.dataset.cardKind || "";
    if (name && kind !== "scene") {
      img.src = cardGlyphDataUrl(name, kind);
      return;
    }
    img.src = "assets/ui/card-fallback.svg";
  }, true);

  /* ---------- 卡片專屬佔位圖（無原檔時用；按名字定色／紋樣，離線生成 SVG） ---------- */
  const _cardGlyphCache = Object.create(null);

  function cardGlyphHash(str) {
    let h = 2166136261;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** 回傳 data:image/svg+xml URL；同一個名字結果穩定 */
  function cardGlyphDataUrl(name, kind) {
    const key = String(kind || "") + "|" + String(name || "");
    if (_cardGlyphCache[key]) return _cardGlyphCache[key];
    const h = cardGlyphHash(key);
    const hues = [330, 195, 45, 265, 160, 15];
    const hue = hues[h % hues.length];
    const hue2 = (hue + 45 + (h % 60)) % 360;
    const glyph = String(name || "").trim().slice(0, 1) || "卡";
    const safe = glyph.replace(/[<>&"']/g, "");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 320" width="240" height="320">` +
        `<defs>` +
          `<linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">` +
            `<stop offset="0" stop-color="hsl(${hue} 72% 26%)"/>` +
            `<stop offset="0.55" stop-color="hsl(${hue2} 70% 15%)"/>` +
            `<stop offset="1" stop-color="#0b0612"/>` +
          `</linearGradient>` +
          `<radialGradient id="s" cx="0.5" cy="0.42" r="0.58">` +
            `<stop offset="0" stop-color="hsl(${hue} 95% 62%)" stop-opacity="0.55"/>` +
            `<stop offset="1" stop-color="hsl(${hue} 95% 50%)" stop-opacity="0"/>` +
          `</radialGradient>` +
        `</defs>` +
        `<rect width="240" height="320" fill="url(#g)"/>` +
        `<rect width="240" height="320" fill="url(#s)"/>` +
        `<g stroke="hsl(${hue} 90% 70%)" stroke-opacity="0.22" stroke-width="2">` +
          `<path d="M-20 240 L120 60 L260 240"/>` +
          `<path d="M-20 280 L120 110 L260 280"/>` +
        `</g>` +
        `<circle cx="120" cy="140" r="62" fill="none" stroke="hsl(${hue} 92% 66%)" stroke-width="4" stroke-opacity="0.85"/>` +
        `<circle cx="120" cy="140" r="50" fill="#0b0612" fill-opacity="0.55"/>` +
        `<text x="120" y="140" text-anchor="middle" dominant-baseline="central" ` +
          `font-family="'Microsoft JhengHei','PingFang TC',sans-serif" font-size="64" font-weight="900" ` +
          `fill="hsl(${hue} 96% 82%)">${safe}</text>` +
        `<rect x="0" y="286" width="240" height="34" fill="#07040e" fill-opacity="0.78"/>` +
        `<text x="120" y="308" text-anchor="middle" font-family="'Microsoft JhengHei','PingFang TC',sans-serif" ` +
          `font-size="19" font-weight="800" fill="#ffe9a8">${String(name || "").replace(/[<>&"']/g, "").slice(0, 8)}</text>` +
        `<rect x="3" y="3" width="234" height="314" fill="none" stroke="#0a0610" stroke-width="6"/>` +
      `</svg>`;
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    _cardGlyphCache[key] = url;
    return url;
  }

  /** 極簡港式身世 stub（prep 後揀一次；四揀一 2增益＋2減益；微調六維） */
  /*
   * t386：身世卡只講「你係邊個、喺邊度大」，唔講任何數值。
   * `blurb` 保留舊文案作內部記錄（help／debug 用），`flavor` 係卡面唯一顯示的文字。
   */
  const ORIGINS = [
    { id: "tea_apprentice", name: "茶記學徒", kind: "buff", blurb: "幸運＋2 · 軟事件膠幣＋10%",
      flavor: "由洗碗開始，聽盡半條街嘅是非。伙記教你：有啲嘢聽咗，要當冇聽過。",
      bonus_soul: 0.1, attrs: { luck: 2 }, art: "assets/events/ev-yum-cha.jpg" },
    { id: "walled_kid", name: "城寨細路", kind: "buff", blurb: "力量＋2 · 開戰物攻再＋1",
      flavor: "天台、樓梯、後巷都係你屋企。打交唔使理由，但要有個講法。",
      bonus_atk: 1, attrs: { str: 2 }, art: "assets/events/ev-alley-wake.jpg" },
    { id: "rooftop_youth", name: "天台夜青", kind: "debuff", blurb: "敏捷－2 · 壽命－5 · 夜夜熬夜傷身",
      flavor: "夜晚先係你嘅日頭。日頭嘅事，你一路都跟唔上。",
      attrs: { agi: -2, life: -5 }, art: "assets/events/ev-rooftop-night.jpg" },
    { id: "paper_stall_kid", name: "報紙檔細路", kind: "debuff", blurb: "幸運－1 · 統率－1 · 街邊叫賣沒有人聽",
      flavor: "由細叫到大，練到聲都沙。但冇人記得你賣過咩。",
      attrs: { luck: -1, lead: -1 }, art: "assets/events/ev-mtr-crowd.jpg" },
  ];
  const originById = Object.fromEntries(ORIGINS.map((o) => [o.id, o]));

  /** 30 種港式人生命運（data.fates；Y1–Y3 四揀一） */
  const FATES = (DATA.fates && DATA.fates.length) ? DATA.fates : [];
  const fateById = Object.fromEntries(FATES.map((f) => [f.id, f]));

  /** 故事包＝可選模組；人生四揀一骨架永遠在 */
  function storyPacksList() {
    return (DATA.story_packs && DATA.story_packs.length) ? DATA.story_packs : [];
  }
  function storyPackById(id) {
    if (!id) return null;
    return storyPacksList().find((p) => p.id === id) || null;
  }
  /** 預設故事包：打工仔輓歌（可用時優先；否則退回第一個可用包） */
  const DEFAULT_STORY_PACK_ID = "office_ballad";

  function ensureActiveStoryPack() {
    const packs = storyPacksList();
    const available = packs.filter((p) => p.status === "available");
    if (state.activeStoryPackId && storyPackById(state.activeStoryPackId)) {
      const cur = storyPackById(state.activeStoryPackId);
      if (cur && cur.status === "available") return state.activeStoryPackId;
    }
    const preferred = storyPackById(DEFAULT_STORY_PACK_ID);
    if (preferred && preferred.status === "available") {
      state.activeStoryPackId = preferred.id;
    } else if (available.length >= 1) {
      state.activeStoryPackId = available[0].id;
    } else {
      state.activeStoryPackId = null;
    }
    return state.activeStoryPackId;
  }
  function packBoostEventIds(pack) {
    const ids = new Set();
    if (!pack) return ids;
    (pack.event_ids || []).forEach((id) => ids.add(id));
    (DATA.events || []).forEach((e) => {
      if (e.story_pack_id === pack.id) ids.add(e.id);
      if (pack.legacy_pack && e.pack === pack.legacy_pack) ids.add(e.id);
    });
    return ids;
  }

  /**
   * 人生六維溫和 demo 預設（身世可 ±）。
   * t368：壽命 70 → 100，配合新敵方曲線（飽和式成長 + 防禦上限），
   * 實測可令玩家中位數達到 84 歲、38% 能活到 100 歲。
   */
  function defaultAttrs() {
    return { str: 12, agi: 10, intel: 8, luck: 8, lead: 8, life: 100 };
  }

  /**
   * t367 經濟修復（A）：戰鬥勝利基礎金幣。
   * 修復前全 85 個事件只有 3 個有 reward_gold（總和 21），
   * 而復活一張卡要 20–60 金幣 → 復活／強化機制在實戰中完全用唔到。
   * 現在每場勝利都有基礎金幣，宿敵戰加倍，令「打贏 → 有錢 → 復活／強化」循環成立。
   */
  const BATTLE_WIN_GOLD = 12;
  const BOSS_WIN_GOLD_MULT = 2;
  function victoryGoldFor(ev) {
    const boss = ev && ev.category === "special_battle";
    return BATTLE_WIN_GOLD * (boss ? BOSS_WIN_GOLD_MULT : 1) + ((ev && ev.reward_gold) | 0);
  }

  /**
   * t369：通用故事鏈引擎（tale chain）。
   *
   * 背景：原本只有「打工仔輓歌」有分支鏈，其餘 5 個故事包只是純文字氣氛模組
   * （最弱的兩個連 beats 都冇）。現在建立通用引擎，令所有故事包都具備：
   *   1. 多步分支（每步 2–3 個選擇）
   *   2. **角色關係追蹤**（bond：對每個角色的關係值，影響後續對白與結局）
   *   3. 弧線狀態（arc：角色由初始狀態變化，例如「由懷疑 → 信任」）
   *   4. 選擇後果揭示（沿用 office 的 reveal 語意）
   *
   * 與 office 引擎的分別：
   *   - 不綁死單一 pack（officePack 硬編碼 office_ballad）
   *   - 有 bond／arc，能表達「角色弧線」
   *   - 結局由「bond 總和 + route 分數」共同決定
   */
  function talePackById(packId) {
    const p = storyPackById(packId);
    return (p && Array.isArray(p.tale_chain) && p.tale_chain.length) ? p : null;
  }

  function isTaleNodeEvent(ev) {
    return !!(ev && ev.tale_node);
  }

  function taleNodeById(id) {
    if (!id) return null;
    return (DATA.events || []).find((e) => e.id === id && e.tale_node) || null;
  }

  /** 取目前 active 故事包（若係 tale 包） */
  function activeTalePack() {
    const id = state.activeStoryPackId;
    if (!id) return null;
    return talePackById(id);
  }

  function taleStartNode(pack) {
    const p = pack || activeTalePack();
    if (!p) return null;
    for (const id of p.tale_chain) {
      const n = taleNodeById(id);
      if (n) return n;
    }
    return null;
  }

  /** 開一條新故事鏈 */
  function taleBeginRun(packId) {
    const pack = talePackById(packId) || activeTalePack();
    if (!pack) return null;
    if (state.taleRun && state.taleRun.packId === pack.id) return state.taleRun;
    const first = taleStartNode(pack);
    if (!first) return null;
    state.taleRun = {
      packId: pack.id,
      nodeId: first.id,
      step: 1,
      startAge: (pack.tale_start_age | 0) || 16,
      route: {},
      bond: {},        // characterId -> 關係值（-3..+3）
      arc: {},         // characterId -> 目前弧線階段 key
      chosen: [],
      reveals: [],     // 每步的立即後果
      reveal: null,
    };
    return state.taleRun;
  }

  function taleAge(run) {
    const r = run || state.taleRun;
    if (!r) return 16;
    const pack = talePackById(r.packId);
    const per = (pack && pack.tale_age_per_step) || 1;
    return (r.startAge | 0) + Math.max(0, (r.step | 0) - 1) * per;
  }

  /** 角色出場時，由 bond 決定要用邊一句對白（弧線核心） */
  function taleLineForCharacter(ch, run) {
    const r = run || state.taleRun;
    if (!ch || !r) return "";
    const b = (r.bond[ch.id] | 0);
    const stages = ch.arc_lines;
    if (!stages) return ch.line || "";
    if (b >= 2) return stages.warm || stages.neutral || "";
    if (b <= -2) return stages.cold || stages.neutral || "";
    return stages.neutral || "";
  }

  /** 角色關係標籤（顯示給玩家看） */
  function taleBondLabel(b) {
    const v = b | 0;
    if (v >= 3) return "生死之交";
    if (v >= 2) return "信得過";
    if (v >= 1) return "有傾有講";
    if (v === 0) return "點頭之交";
    if (v >= -1) return "有啲芥蒂";
    if (v >= -2) return "面阻阻";
    return "反目";
  }

  /** 套用一個選擇 */
  function taleApplyChoice(choiceIdx) {
    const run = state.taleRun;
    if (!run) return null;
    const node = taleNodeById(run.nodeId);
    if (!node) return null;
    const choices = Array.isArray(node.tale_choices) ? node.tale_choices : [];
    const pick = choices[choiceIdx | 0];
    if (!pick) return null;

    // 路線分數
    const delta = pick.delta || {};
    Object.keys(delta).forEach((k) => {
      run.route[k] = (run.route[k] | 0) + (delta[k] | 0);
    });
    // 角色關係
    const bond = pick.bond || {};
    Object.keys(bond).forEach((cid) => {
      run.bond[cid] = Math.max(-3, Math.min(3, (run.bond[cid] | 0) + (bond[cid] | 0)));
    });
    // 弧線階段推進
    if (pick.arc && typeof pick.arc === "object") {
      Object.keys(pick.arc).forEach((cid) => { run.arc[cid] = pick.arc[cid]; });
    }

    run.chosen.push({
      nodeId: node.id,
      nodeName: node.name,
      choiceIdx: choiceIdx | 0,
      text: pick.text || "",
      bondNote: pick.bond_note || "",
    });

    // 立即後果（顯示俾玩家）
    run.reveal = {
      nodeName: node.name || "",
      choiceText: pick.text || "",
      outcome: pick.outcome || "",
      bondNote: pick.bond_note || "",
    };
    return run.reveal;
  }

  /** 推進到下一節點；最後一步算結局 */
  function taleAdvanceAfterChoice() {
    const run = state.taleRun;
    if (!run) return;
    const pack = talePackById(run.packId);
    const chain = (pack && pack.tale_chain) || [];
    const idx = chain.indexOf(run.nodeId);
    const isLast = idx >= 0 ? idx >= chain.length - 1 : true;

    if (!isLast) {
      const next = taleNodeById(chain[idx + 1]);
      if (next) {
        run.nodeId = next.id;
        run.step = (run.step | 0) + 1;
        return;
      }
    }
    // 走完：算結局
    const ending = taleResolveEnding(pack, run);
    if (ending) {
      if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
      state.lifeFlags["tale_ending_" + pack.id + "_" + ending.id] = 1;
      state.taleEndAge = taleAge(run);
      state.taleEndingId = ending.id;
      state.selectedEvent = ending.event || null;
      state.taleRun = null;
      state.softNote = "";
      state.screen = ending.event ? "soft" : "events";
      return;
    }
    state.taleRun = null;
    state.screen = "events";
  }

  /**
   * 結局判定：關係門檻 → 路線**比例** → priority。
   *
   * t369b 修正二：原本用累加分數比較 route，但某個 route（例如 care）在選擇表出現
   * 7–8 次、其他只 1–2 次，令帶該 route 的結局必然勝出（實測 5 條路線都得同一結局）。
   * 現改為**比例**：該 route 分數 ÷ 該 route 在整條鏈的總可得分數。
   * 這樣「玩家有幾投入呢條路線」才算數，唔會被出現次數支配。
   */
  function taleRouteTotals(pack) {
    if (!pack.__routeTotals) {
      const tot = {};
      (pack.tale_chain || []).forEach((nid) => {
        const n = taleNodeById(nid);
        if (!n) return;
        // 每個節點：每條 route 取該節點「最高可得分」
        const perNode = {};
        (n.tale_choices || []).forEach((c) => {
          const d = (c && c.delta) || {};
          Object.keys(d).forEach((k) => {
            perNode[k] = Math.max(perNode[k] | 0, d[k] | 0);
          });
        });
        Object.keys(perNode).forEach((k) => {
          tot[k] = (tot[k] | 0) + perNode[k];
        });
      });
      pack.__routeTotals = tot;
    }
    return pack.__routeTotals;
  }

  function taleResolveEnding(pack, run) {
    if (!pack || !Array.isArray(pack.tale_endings)) return null;
    const bonds = run.bond || {};
    const routes = run.route || {};
    const totalBond = Object.keys(bonds).reduce((a, k) => a + (bonds[k] | 0), 0);
    const routeTotals = taleRouteTotals(pack);

    // 1) 硬性門檻：唔滿足直接淘汰
    const eligible = pack.tale_endings.filter((e) => {
      if (typeof e.min_bond === "number" && totalBond < e.min_bond) return false;
      if (typeof e.max_bond === "number" && totalBond > e.max_bond) return false;
      if (e.require_bond && typeof e.require_bond === "object") {
        const ok = Object.keys(e.require_bond).every(
          (cid) => (bonds[cid] | 0) >= (e.require_bond[cid] | 0)
        );
        if (!ok) return false;
      }
      return true;
    });

    // 2) 路線比例 + 關係強度 + priority
    let best = null;
    let bestScore = -Infinity;
    (eligible.length ? eligible : pack.tale_endings).forEach((e) => {
      let score = 0;
      if (e.route) {
        const got = routes[e.route] | 0;
        const total = routeTotals[e.route] | 0;
        // 0..40：路線只是其中一個維度，唔可以壓過關係
        score += total > 0 ? (got / total) * 40 : 0;
      }
      // 關係強度：門檻型結局（min_bond／max_bond／require_bond）本身就係關係結局，
      // 要俾足夠基礎分，否則永遠輸給任何帶 route 的結局。
      if (e.min_bond != null || e.max_bond != null || e.require_bond) {
        score += 30;                       // 關係型結局基礎分
        score += Math.abs(totalBond) * 1.5; // 關係越極端越強
      } else {
        score += totalBond * 0.3;
      }
      score -= e.priority | 0;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    });
    if (!best) return null;
    const ev = best.event_id
      ? (DATA.events || []).find((x) => x.id === best.event_id) || null
      : null;
    return { id: best.id, label: best.label, blurb: best.blurb, event: ev };
  }

  /* ---------- t364 故事包分支鏈（打工仔輓歌） ---------- */
  /** 分支路線 key → 中文（唔向外顯示分數，只內部計） */
  const OFFICE_ROUTE_KEYS = ["rich", "biz", "flat", "street", "scam"];
  const OFFICE_ROUTE_LABEL = {
    rich: "穩打穩紮",
    biz: "做生意",
    flat: "上樓成家",
    street: "搏到盡",
    scam: "博快錢",
  };
  /** 結局 id ↔ 路線 key */
  const OFFICE_ENDING_BY_ROUTE = {
    rich: "rich",
    biz: "biz_fail",
    flat: "flat",
    street: "street",
    scam: "scam",
  };

  function officePack() {
    return storyPackById("office_ballad") || null;
  }

  function isOfficeChainEvent(ev) {
    return !!(ev && ev.office_node);
  }

  function officeNodeById(id) {
    if (!id) return null;
    return (DATA.events || []).find((e) => e.id === id && e.office_node) || null;
  }

  /*
   * t384：職種分岔（修「第 1 步揀茶記，但之後全部寫字樓」）。
   *
   * 第 1 步三個選項帶 `track`（office／tea／deal），之後第 2–6 步每個節點有
   * `track_variants[track] = { name, desc, dialogue, office_choices }`。
   * 三個變體的 route 權重完全一致（由腳本按原本第 i 個選擇複製），
   * 所以五個結局的可達比例不變。
   */
  const OFFICE_TRACK_LABELS = { office: "寫字樓信差", tea: "茶記樓面", deal: "親戚買賣" };

  /** 由已走過嘅選擇找回職種（第一個帶 track 的選擇） */
  function officeTrackOf(run) {
    const r = run || state.officeRun;
    if (!r) return null;
    const hit = (r.chosen || []).find((c) => c && c.track);
    return hit ? hit.track : null;
  }

  /**
   * 取出「當前職種」的節點內容。
   * 冇變體 → 原樣返回；有變體但未揀職種 → 用第一個變體（寫字樓）頂住。
   */
  function officeNodeView(node, run) {
    if (!node || !node.track_variants) return node;
    const track = officeTrackOf(run) || "office";
    const v = node.track_variants[track] || node.track_variants.office;
    if (!v) return node;
    return Object.assign({}, node, {
      name: v.name || node.name,
      desc: v.desc || node.desc,
      dialogue: Array.isArray(v.dialogue) ? v.dialogue : node.dialogue,
      office_choices: Array.isArray(v.office_choices) ? v.office_choices : node.office_choices,
    });
  }

  function officeEndingEvent(routeKey) {
    const endingId = OFFICE_ENDING_BY_ROUTE[routeKey];
    if (!endingId) return null;
    return (DATA.events || []).find((e) => e.office_ending === endingId) || null;
  }

  function officeEmptyRoute() {
    const r = {};
    OFFICE_ROUTE_KEYS.forEach((k) => { r[k] = 0; });
    return r;
  }

  /** 起始節點：故事包第一個 office_node */
  function officeStartNode() {
    const pack = officePack();
    if (!pack) return null;
    const chain = Array.isArray(pack.office_chain) ? pack.office_chain : [];
    for (const id of chain) {
      const n = officeNodeById(id);
      if (n) return n;
    }
    return officeNodeById(pack.office_entry) || null;
  }

  /** 開一條新分支鏈 */
  function officeBeginRun() {
    const first = officeStartNode();
    if (!first) return null;
    // 已經在鏈中：唔重設（避免重入時年齡／歷程被洗走）
    if (state.officeRun && state.officeRun.packId === "office_ballad") {
      return state.officeRun;
    }
    // t365：分支鏈用自己嘅年齡（18 歲入職 → 27 歲），唔改 state.age。
    // 原因：呢個包係獨立故事模組，唔應該消耗／污染人生 run 的歲數（曾造成累積到 70 歲直接「壽命到限」）。
    state.officeRun = {
      packId: "office_ballad",
      nodeId: first.id,
      step: 1,
      startAge: 18,
      route: officeEmptyRoute(),
      chosen: [],
      /** 上一步選擇要顯示的隱藏後果（選完才揭示） */
      reveal: null,
    };
    return state.officeRun;
  }

  /** 分支鏈內的年齡（唔影響 state.age） */
  function officeAge(run) {
    const r = run || state.officeRun;
    if (!r) return 18;
    return (r.startAge | 0) + Math.max(0, (r.step | 0) - 1);
  }

  /**
   * 套用一個選擇：
   *  - route 分數累加（隱藏，唔顯示畀玩家）
   *  - 記錄 chosen，供結果頁回顧
   *  - reveal 記住「剛剛揭示了什麼」，下次進入節點時顯示
   */
  function officeApplyChoice(choiceIdx) {
    const run = state.officeRun;
    if (!run) return null;
    const node = officeNodeView(officeNodeById(run.nodeId), run);
    if (!node) return null;
    const choices = Array.isArray(node.office_choices) ? node.office_choices : [];
    const pick = choices[choiceIdx | 0];
    if (!pick) return null;

    // 累加分數（隱藏）
    const delta = pick.delta || {};
    OFFICE_ROUTE_KEYS.forEach((k) => {
      run.route[k] = (run.route[k] | 0) + (delta[k] | 0);
    });
    run.chosen.push({
      nodeId: node.id,
      nodeName: node.name,
      choiceIdx: choiceIdx | 0,
      text: pick.text || "",
      // t384：記住職種（第 1 步的選擇），之後每一步都按佢揀變體
      track: pick.track || null,
      // t406：記住該選擇的專屬後果，供回顧時顯示
      outcome: String(pick.outcome || "").trim(),
    });
    /*
     * t406：選後揭示改為「專屬後果文」。
     *
     * 舊行為：粉紅一句「你行近咗「穩打穩紮」呢條路」——抽象、同具體選擇無關，
     * 而且玩家唔知實際發生咩事。
     *
     * 新行為：用 `pick.outcome`（每個選擇專屬寫好，2–4 句），
     * 講角色／金錢／處境的具體變化。唔再顯示抽象路線。
     */
    run.reveal = {
      nodeName: node.name || "",
      choiceText: pick.text || "",
      outcome: String(pick.outcome || "").trim(),
      step: run.step | 0,
    };
    /*
     * t406：四拍流程的階段。
     *   "intro"   進場短敘（desc）
     *   "dialogue" 對白逐句
     *   "choose"   選擇
     *   "outcome"  專屬後果文（選後，唔可以即刻跳下一節）
     */
    run.phase = "outcome";
    return run.reveal;
  }

  /**
   * 由 delta 生成「隱藏後果」提示。
   * 只講方向（例如「更似做生意嘅路」），永不顯示 +2／-1 之類數字，
   * 避免玩家當成數值遊戲；也符合「沒有獎賞和升級」的設定。
   */
  function officeChoiceHint(delta) {
    if (!delta || typeof delta !== "object") return "";
    let bestKey = "";
    let bestVal = 0;
    OFFICE_ROUTE_KEYS.forEach((k) => {
      const v = delta[k] | 0;
      if (v > bestVal) {
        bestVal = v;
        bestKey = k;
      }
    });
    if (!bestKey || bestVal <= 0) return "呢一步，冇特別改變。";
    return "你行近咗「" + (OFFICE_ROUTE_LABEL[bestKey] || "") + "」呢條路。";
  }

  /** 由 route 分數決定結局 key；同分則依固定優先次序（避免隨機） */
  function officeResolveRoute(route) {
    const r = route || {};
    let bestKey = OFFICE_ROUTE_KEYS[0];
    let bestVal = -Infinity;
    OFFICE_ROUTE_KEYS.forEach((k) => {
      const v = r[k] | 0;
      if (v > bestVal) {
        bestVal = v;
        bestKey = k;
      }
    });
    return bestKey;
  }

  /** 抵達最後節點：算出結局事件 */
  function officeFinishRun() {
    const run = state.officeRun;
    if (!run) return null;
    const routeKey = officeResolveRoute(run.route);
    const endingEv = officeEndingEvent(routeKey);
    return { routeKey, endingEv };
  }

  /** 六維公開名（UI 禁顯示 str／agi 等 key；t260） */
  const ATTR_LABEL = { str: "力量", agi: "敏捷", intel: "智力", luck: "幸運", lead: "統率", life: "壽命" };
  function formatAttrsDelta(delta) {
    if (!delta || typeof delta !== "object") return [];
    const bits = [];
    Object.keys(delta).forEach((k) => {
      const v = delta[k] | 0;
      if (!v) return;
      const name = ATTR_LABEL[k] || k;
      bits.push(`${name}${v > 0 ? "+" : ""}${v}`);
    });
    return bits;
  }

  const state = {
    screen: "title",
    year: 1,
    /** 顯示歲數；預設 10 歲入世；結算 +1；year ≈ age - 9 */
    age: 10,
    lv: 1,
    xp: 0,
    xpToNext: 10,
    attrs: defaultAttrs(),
    gold: 0,
    soul: SOUL_START,
    /** 聲望：每日差事／任務賺取；只可在茶記買特殊卡；跨世保留 */
    fame: 0,
    /** 茶記已換過的特殊卡 id（唔可以重複買） */
    teaShopBought: [],
    /** 茶記：正在看詳情的特殊卡 id */
    teaDetailId: null,
    /** 茶記：兌換後待顯示的提示字 */
    teaPendingNote: "",
    selectedEvent: null,
    /** 今世戰鬥卡口袋名單（prep 放入；唔等於當場出戰） */
    team: [...(DATA.default_team || [])].slice(0, TEAM_SIZE),
    /** 本場出戰位（最多 TEAM_SIZE）。有上次打贏的配置就沿用，唔使日日再揀 */
    deploy: [],
    /** 上次戰鬥勝利時的出戰位（槽位對齊；陣亡／離隊的下次自動空出） */
    lastWinDeploy: [],
    /** 本場開打時的出戰位，只在打贏後寫入 lastWinDeploy */
    battleFieldSnapshot: null,
    /** 遇敵畫面：沿用上次上場但有空位時的提示字（玩家自行決定補位） */
    deployHint: "",
    /** 送卡事件：{ eventId, kind, offers, takenIdx, note, rewardApplied } */
    cardGift: null,
    /** t366：裝備強化攤 { done: null|{id,star} } */
    gearUpgrade: null,
    /** t366：戰鬥卡練功 { done: null|{id,lv,xp} } */
    fighterTrain: null,
    /** t366：復活陣亡卡 { done: null|{id,name} } */
    fighterRevive: null,
    /** 盟主卡池抽敵：同一場遇敵沿用名單 */
    enemyRosterKey: "",
    enemyRosterCache: null,
    /** 盟友面板：按下時記住原本畫面，返回時回到該畫面 */
    alliesReturnScreen: null,
    /** fighterId -> skillId[]（裝備中；同 ID 技能受帳號張數限制，demo 預設 1 張＝全隊唯一） */
    loadout: {},
    /** fighterId -> true：呢張卡今世已做過預設裝技；之後唔再 auto-fill（保留 null 格＝卸下） */
    loadoutInited: {},
    /** fighterIds 今世陣亡（關卡／戰鬥 hp 歸零）——不可再部署 */
    deadFighters: [],
    /** skillIds 跟陣亡出戰卡陪葬——不可再裝備 */
    burnedSkills: [],
    /** 非教學期出戰卡死光 → 今世結束 */
    lifeWiped: false,
    /** account-level gear slots — itemId|null; bonuses apply to ALL battle cards */
    accountGear: { head: null, body: null, main: null, off: null, charm: null, feet: null },
    /** itemId -> star (1..max_star); 帳號級，跨今世保留 */
    equipStars: {},
    equipFocus: null,
    equipSlot: null,
    battlesThisLife: 0,
    /** 今世帶入人生嘅技能卡 id[]（去重；上限 LIFE_SKILLS_CAP）；null＝未種子 */
    lifeSkills: null,
    /** prep：揀卡 modal（"fighters"|"skills"|"gear"|null） */
    prepPickKind: null,
    /** prep 揀卡 modal 搜尋字串 */
    prepPickQuery: "",
    /** prep 裝備 modal：聚焦槽（head/body/…） */
    prepGearFocusSlot: null,
    /** 今世是否已「準備出發」（帶入裝備／口袋／技能）；每世一次，遇敵唔再彈大介面 */
    lifePrepped: false,
    /** 今世身世 id（origin screen 揀） */
    originId: null,
    /** events 畫面：遇敵確認彈窗 */
    eventConfirmOpen: false,
    /** encounter：選擇出戰卡 modal 正開嘅 slot index（0..TEAM_SIZE-1）或 null */
    selectAllySlot: null,
    /** encounter：戰鬥卡詳情／裝技正睇邊張（fighter id） */
    fighterDetailId: null,
    /** encounter 詳情窗：正揀技能要裝入邊格（loadout index）或 null */
    detailSkillPick: null,
    /** 卡冊戰鬥卡頁（保留；新 UI 以 scroll 為主） */
    albumPage: 0,
    /** 卡冊 tab：fighters | skills | gear */
    albumTab: "fighters",
    /** 卡冊搜尋字 */
    albumQuery: "",
    /** 卡冊稀有度篩選（null=全部；循環 stub） */
    albumFilterRarity: null,
    /** 卡冊詳情 modal */
    albumDetailId: null,
    albumDetailKind: null,
    /** 帳號收藏張數 id→count（demo seed） */
    cardCounts: {},
    /** demo 收藏種子版號；唔同／缺則 albumEnsureState 重種子 5+5+5 */
    demoSeedVersion: null,
    /** 戰鬥卡／技能卡星級（裝備用 equipStars）；帳號級跨人生 */
    fighterStars: {},
    skillStars: {},
    /** 戰鬥卡等級／卡經驗（帳號級，跟 cardCounts／album；跨人生） */
    fighterLevels: {},
    fighterXp: {},
    /** 本世人生命運已揀 id */
    fatePicks: [],
    /** 0..2 做咗幾次命運（滿 3 先入一般遭遇） */
    fateYearIndex: 0,
    /** 本輪四揀一 offer ids */
    fateOffer: [],
    /** 今世戰鬥暫存加成（命運 temp） */
    fateBattleBonus: { atk: 0, def: 0, hp: 0 },
    /** 本年遭遇四揀一（event ids）；換年重抽 */
    yearEventOffer: [],
    yearEventYear: 0,
    /** soft 結算附加說明（商店／特殊／換技） */
    softNote: "",
    /** 人生店鋪四選一（唔入存檔；買完／離開即清） */
    shop: null,
    /** soft 無獎（離開店／交換／升星未買）→ 唔發事件魂焰／經驗／金幣 */
    shopLeftEmpty: false,
    /** 交換卡流程（唔入存檔）{ phase:"give"|"take", giveId, offers } */
    trade: null,
    /** 升星事件流程（唔入存檔）{ focusId } */
    starUp: null,
    /** 今世旗標（小遊戲破關等；人生重置時清空） */
    lifeFlags: {},
    /** 今世勢力好感 0–5（廟街義氣／城寨兄弟；人生重置清空） */
    factions: {},
    /** 勢力支線選擇結果（唔入存檔；選完結算用） */
    factionChoiceResult: null,
    /** 小遊戲進行中／結果（唔入存檔） */
    minigame: null,
    /**
     * t390：戰鬥卡殘頁（跨世累積，跟帳號）
     * { [cardId]: 張數 }；滿 shardNeed 可換指定戰鬥卡
     */
    cardShards: {},
    /**
     * t365 故事包分支鏈（唔入存檔；離開即清）
     * { packId, nodeId, step, startAge, route: {rich,biz,flat,street,scam}, chosen: [...] }
     */
    officeRun: null,
    /** 分支結局達成時的分支年齡（只供結局面顯示） */
    officeEndAge: 0,
    /**
     * t369 通用故事鏈（任何故事包可用）
     * { packId, nodeId, step, startAge, route:{}, bond:{cid:val}, arc:{cid:stage}, chosen:[], reveal }
     * bond 記錄玩家與每個角色的關係（-3..+3），是角色弧線的核心。
     */
    taleRun: null,
    taleEndAge: 0,
    taleEndingId: null,
    /** 每日任務：dateKey／progress／claimed（換日 reset；跨世保留） */
    daily: null,
    /** 跨世帳號統計（每日任務用） */
    accountStats: { maxAgeReached: 0, equipStarsTotal: 0 },
    battle: null,
    lastResult: null,
    /** 戰中未結算：刷新視作敗（唔准安全撤退重打） */
    pendingDefeat: null,
    speed: 1,
    /** 可選故事包（模組）；唔取代非線性人生骨架 */
    activeStoryPackId: null,
    /** 玩家有冇主動揀過故事包 */
    storyPackUserPicked: false,
    /** 故事包詳情頁正睇邊包 */
    storyPackDetailId: null,
    /** 魂焰扭蛋保底（帳號級跨世；persist） */
    gachaPityRare: 0,
    gachaPityEpic: 0,
    /** 最近一次扭蛋結果（唔入存檔） */
    gachaResults: [],
    /** 離開扭蛋機返回邊個 screen */
    gachaReturnScreen: null,
    /** 結果區：false＝蛋殼、true＝已開蛋見卡（相容；以 gachaPhase 為準） */
    gachaReveal: false,
    /** 扭蛋演出階段：idle → coin → spin → egg_out → crack → reveal → result */
    gachaPhase: "idle",
    /**
     * t379：六維收摺（頂欄資訊分層）。
     * true = 收起六維（只顯示「六維」掣），false = 展開。
     * 預設收起：玩家多數時間只關心膠幣／金幣，六維可隨時點開。
     */
    attrsCollapsed: true,
  };

  /* 茶記特殊卡同屬戰鬥卡；合併入同一批卡池，卡冊／選卡／戰鬥都認得 */
  (function mergeTeaShopFighters() {
    const list = Array.isArray(DATA.tea_shop_cards) ? DATA.tea_shop_cards : [];
    if (!list.length) return;
    const have = new Set((DATA.fighters || []).map((f) => f && f.id));
    list.forEach((c) => {
      if (!c || !c.id || have.has(c.id)) return;
      DATA.fighters.push(c);
      have.add(c.id);
    });
  })();

  const fighterById = Object.fromEntries(DATA.fighters.map((f) => [f.id, f]));

  /*
   * t391：殘頁專屬卡（`shard_only: true`）唔可以從任何普通卡池掉落。
   *
   * 佢只可以經「戰鬥卡殘頁 ×10」兌換得到。所有隨機來源
   * （扭蛋／店鋪／送卡／抽卡／換卡／戰鬥掉落／事件獎勵）都要用
   * `poolFighters()` 而唔係直接讀 DATA.fighters。
   */
  function isShardOnlyFighter(f) {
    return !!(f && f.shard_only);
  }
  /** 普通卡池：排除殘頁專屬卡 */
  function poolFighters() {
    return (DATA.fighters || []).filter((f) => f && f.id && !isShardOnlyFighter(f));
  }
  const enemyById = Object.fromEntries(DATA.enemies.map((e) => [e.id, e]));
  const skillById = Object.fromEntries((DATA.skills || []).map((s) => [s.id, s]));
  /** Resolve art for fighter basic/innate: skill name match in DATA.skills, else fighter card art. */
  function skillArtByName(name) {
    const n = String(name || "");
    if (!n) return null;
    const sk = (DATA.skills || []).find((s) => s && s.name === n);
    return (sk && sk.art) || null;
  }
  function fixedSlotIcoHtml(skillName, fighterArt) {
    const art = skillArtByName(skillName) || fighterArt || null;
    return art ? `<img src="${esc(art)}" alt="" />` : "技";
  }
  /** Compact skill-slot row for battle-card tips / inspect (reuse .fd-skill look). */
  function battleCardSkillSlotsHtml(opts) {
    opts = opts || {};
    const basic = opts.basic || "普通攻擊";
    const skill = opts.skill || "";
    const skillCd = opts.skillCd;
    const skillEffect = opts.skillEffect || "";
    const artFallback = opts.artFallback || null;
    const equipped = Array.isArray(opts.equipped) ? opts.equipped : [];
    const bpTag = opts.basicPowerTag || basicPowerTagLabel(opts);
    const slots = [];
    const helpBasic = `「${basic}」\n${bpTag}（首通）\n基本出手。`;
    slots.push(`<div class="bc-skill fd-skill fixed" role="button" tabindex="0" data-ci-skill-help="1" data-help-text="${helpTextAttr(helpBasic)}" title="${esc(bpTag)}">
      <span class="fds-ico">${fixedSlotIcoHtml(basic, artFallback)}</span>
      <span class="fds-name">${esc(basic)}</span>
      <span class="fds-tag">${esc(bpTag)}</span>
    </div>`);
    if (skill) {
      const innSrc = opts.combatSpec
        ? opts.combatSpec
        : {
            power: opts.power,
            basic_power: opts.basic_power,
            dmg_mult: opts.dmg_mult,
            splash_mult: opts.splash_mult,
            heal_mult: opts.heal_mult,
            support: opts.support,
            passive: opts.passive,
            skill_cd: skillCd,
            cd: skillCd,
          };
      const innTag = opts.innatePowerTag || innatePowerTagLabel(innSrc);
      const cdBit =
        skillCd != null && skillCd !== ""
          ? innTag === "自帶"
            ? ` CD${skillCd}`
            : `｜CD ${skillCd}`
          : "";
      const innSummary = opts.combatSpec
        ? skillCombatSummary(
            Object.assign({}, opts.combatSpec, {
              power: resolveInnatePower(
                Object.assign({}, opts.combatSpec, {
                  basic_power: opts.basic_power != null ? opts.basic_power : opts.combatSpec.basic_power,
                })
              ),
            })
          )
        : "";
      const helpInn = `「${skill}」\n${innTag}${skillCd != null ? "｜CD " + skillCd : ""}\n${skillEffect ? "效果：" + skillEffect : "自帶技"}${innSummary ? "\n結算：" + innSummary : ""}`.trim();
      slots.push(`<div class="bc-skill fd-skill fixed innate" role="button" tabindex="0" data-ci-skill-help="1" data-help-text="${helpTextAttr(helpInn)}" title="${esc(skill)}">
        <span class="fds-ico">${fixedSlotIcoHtml(skill, artFallback)}</span>
        <span class="fds-name">${esc(skill)}</span>
        <span class="fds-tag">${esc(innTag)}${cdBit}</span>
      </div>`);
    }
    for (const sk of equipped) {
      if (!sk || !sk.name) continue;
      const ico = sk.art
        ? `<img src="${esc(sk.art)}" alt="" />`
        : fixedSlotIcoHtml(sk.name, artFallback);
      const helpEq = skillHelpText(sk.id && skillById[sk.id] ? skillById[sk.id] : sk);
      slots.push(`<div class="bc-skill fd-skill filled" role="button" tabindex="0" data-ci-skill-help="1" data-help-text="${helpTextAttr(helpEq)}" title="${esc(sk.name)}">
        <span class="fds-ico">${ico}</span>
        <span class="fds-name">${esc(sk.name)}</span>
        <span class="fds-tag">裝備</span>
      </div>`);
    }
    return `<div class="bc-skills" aria-label="技能欄">${slots.join("")}</div>`;
  }
  function fighterEquippedForHelp(fid) {
    return loadoutIds(fid)
      .map((sid) => skillById[sid])
      .filter(Boolean)
      .map((sk) => ({
        name: sk.name,
        art: sk.art || skillArtByName(sk.name) || null,
        cd: sk.cd,
      }));
  }
  function fighterHelpRichHtml(f, opts) {
    opts = opts || {};
    if (!f) return null;
    if (opts.dead || (opts.checkDead && isDeadFighter(f.id))) return null;
    const bits = [];
    if (opts.preview) {
      const pv = opts.preview;
      bits.push(`攻${pv.atk ?? "?"}`, `速${pv.spd ?? "?"}`, `血${pv.hp ?? "?"}`);
      if (pv.def != null) bits.push(`物防${pv.def}`);
      if (pv.matk != null) bits.push(`魔攻${pv.matk}`);
    } else {
      bits.push(`攻${f.atk ?? "?"}`, `速${f.spd ?? "?"}`);
      if (f.hp != null) bits.push(`血${f.hp}`);
      if (f.def != null) bits.push(`防${f.def}`);
    }
    const tags = (f.tags || []).join("、") || "";
    const rare = f.rarity_slang || f.rarity || "?";
    const blurb = f.flavor || f.blurb || "";
    const lv = (opts.preview && opts.preview.level) ? opts.preview.level : fighterLevelOf(f.id);
    const star = albumFighterStar(f.id);
    const head = [
      `<div class="ht-title">「${esc(f.name || "")}」</div>`,
      `<div class="ht-line">Lv.${lv}｜★${star}｜${esc(rare)}｜${esc(bits.join(" "))}</div>`,
    ];
    if (tags) head.push(`<div class="ht-line">主題：${esc(tags)}</div>`);
    const equipped = opts.skipEquip ? [] : fighterEquippedForHelp(f.id);
    const slots = battleCardSkillSlotsHtml({
      basic: f.basic || "普通攻擊",
      skill: f.skill || "",
      skillCd: f.skill_cd,
      skillEffect: f.skill_effect || "",
      artFallback: f.art,
      equipped,
      basic_power: f.basic_power,
      basicPowerTag: basicPowerTagLabel(f),
      power: f.power,
      dmg_mult: f.dmg_mult,
      splash_mult: f.splash_mult,
      heal_mult: f.heal_mult,
      support: f.support,
      passive: f.passive,
      combatSpec: {
        dmg_mult: f.dmg_mult,
        hits: f.hits,
        target: f.target,
        power: resolveInnatePower(f),
        splash_mult: f.splash_mult,
        heal_mult: f.heal_mult,
        support: f.support,
        passive: f.passive,
        execute_hp_pct: f.execute_hp_pct,
        execute_mult: f.execute_mult,
        hit_scales: f.hit_scales,
        basic_power: f.basic_power,
        cd: f.skill_cd,
      },
      innatePowerTag: innatePowerTagLabel(f),
    });
    const flavor = blurb ? `<div class="ht-flavor">${esc(blurb)}</div>` : "";
    return `<div class="ht-rich">${head.join("")}${slots}${flavor}</div>`;
  }
  /** 敵方單位定義：可能係舊 enemy 定義，或卡池戰鬥卡（defId 為 C 開頭） */
  function enemyUnitDef(unit) {
    if (!unit) return null;
    const key = unit.defId || unit.id || "";
    if (fighterById[key]) return fighterById[key];
    if (enemyById[key]) return enemyById[key];
    // fallback：由 unit 自己（卡池卡會帶齊 skill/flavor/rarity）
    return unit;
  }

  function enemyHelpRichHtml(e) {
    if (!e) return null;
    const def = enemyUnitDef(e) || e;
    const name = e.name || def.name || "敵方";
    const atk = e.atk != null ? e.atk : def.atk;
    const spd = e.spd != null ? e.spd : def.spd;
    const hp = e.maxHp != null ? e.maxHp : (e.hp != null ? e.hp : def.hp);
    const basic = e.basic || def.basic || "首通";
    const skill = e.skill || def.skill || "自帶技";
    const skillCd = e.skill_cd != null ? e.skill_cd : (def.skill_cd != null ? def.skill_cd : 3);
    const skillEffect = e.skill_effect || def.skill_effect || "";
    const flavor =
      def.flavor ||
      def.blurb ||
      def.notes ||
      e.flavor ||
      e.blurb ||
      "後巷殘影——一擊就要記低。";
    const rare = def.rarity_slang || def.rarity || "敵方";
    const art = e.art || def.art || null;
    const head = [
      `<div class="ht-title">「${esc(name)}」</div>`,
      `<div class="ht-line">${esc(rare)}｜攻${atk ?? "?"} 速${spd ?? "?"} 血${hp ?? "?"}</div>`,
    ];
    const bpSrc = {
      basic_power: e.basic_power != null ? e.basic_power : def.basic_power,
      power: e.power != null ? e.power : def.power,
      dmg_mult: e.dmg_mult != null ? e.dmg_mult : def.dmg_mult,
      splash_mult: e.splash_mult != null ? e.splash_mult : def.splash_mult,
      heal_mult: e.heal_mult != null ? e.heal_mult : def.heal_mult,
      support: e.support != null ? e.support : def.support,
      passive: e.passive != null ? e.passive : def.passive,
    };
    const slots = battleCardSkillSlotsHtml({
      basic,
      skill,
      skillCd,
      skillEffect,
      artFallback: art,
      equipped: [],
      basic_power: bpSrc.basic_power,
      basicPowerTag: basicPowerTagLabel(bpSrc),
      power: bpSrc.power,
      dmg_mult: bpSrc.dmg_mult,
      splash_mult: bpSrc.splash_mult,
      heal_mult: bpSrc.heal_mult,
      support: bpSrc.support,
      passive: bpSrc.passive,
      innatePowerTag: innatePowerTagLabel(bpSrc),
    });
    const flavorHtml = flavor ? `<div class="ht-flavor">${esc(flavor)}</div>` : "";
    return `<div class="ht-rich">${head.join("")}${slots}${flavorHtml}</div>`;
  }
  const MAX_YEARS = (DATA.slice && DATA.slice.max_years) || 4;
  const DEFAULT_EQUIP_FILL = (DATA.slice && DATA.slice.default_equip_fill) || 3;

  function raritySlots(f) {
    if (!f) return 4;
    if (f.slots) return f.slots;
    const map = { 普通: 4, 稀有: 5, 史詩: 6, 最高級: 7 };
    return map[f.rarity] || 4;
  }

  function skillTagsOf(s) {
    if (!s) return [];
    if (s.tags && s.tags.length) return s.tags;
    return s.tag ? [s.tag] : ["通用"];
  }

  function skillCompatible(fighter, skill) {
    return !!(fighter && skill);
  }

  function isDeadFighter(id) {
    return state.deadFighters.includes(id);
  }

  function isBurnedSkill(id) {
    return !!(id && state.burnedSkills.includes(id));
  }

  /**
   * 結算掃描：陣亡出戰卡＋當下裝配技能今世鎖定；生還者下局滿血重建。
   * opts.permanent===false → 教學期暫時 KO：唔鎖死、唔燒技、唔踢出口袋（下局可再出戰）。
   */
  function lockDeadFromBattle(b, opts) {
    const permanent = !(opts && opts.permanent === false);
    const newlyDead = [];
    if (!b || !Array.isArray(b.players)) return newlyDead;
    for (const p of b.players) {
      if (p.alive) continue;
      const fid = p.id;
      newlyDead.push(fid);
      if (!permanent) continue;
      if (!state.deadFighters.includes(fid)) {
        state.deadFighters.push(fid);
      }
      const skills = state.loadout[fid] || [];
      skills.forEach((sid) => {
        if (sid && !state.burnedSkills.includes(sid)) state.burnedSkills.push(sid);
      });
      state.team = state.team.filter((id) => id !== fid);
      state.deploy = (state.deploy || []).filter((id) => id !== fid);
      delete state.loadout[fid];
      if (state.loadoutInited) delete state.loadoutInited[fid];
      if (state.equipFocus === fid) {
        state.equipFocus = state.team[0] || null;
        state.equipSlot = null;
      }
    }
    return newlyDead;
  }

  function ensureLoadoutShape() {
    state.team.forEach((fid) => {
      if (!Array.isArray(state.loadout[fid])) state.loadout[fid] = [];
      const f = fighterById[fid];
      const cap = raritySlots(f);
      if (state.loadout[fid].length > cap) state.loadout[fid] = state.loadout[fid].slice(0, cap);
    });
    // drop loadouts for fighters not on team
    Object.keys(state.loadout).forEach((fid) => {
      if (!state.team.includes(fid)) {
        delete state.loadout[fid];
        if (state.loadoutInited) delete state.loadoutInited[fid];
      }
    });
    Object.keys(state.loadoutInited || {}).forEach((fid) => {
      if (!state.team.includes(fid)) delete state.loadoutInited[fid];
    });
  }

  /** 帳號持有張數（跟 album cardCounts；demo 種子後多數為 0／1） */
  function skillOwnedCopies(sid) {
    if (!sid) return 0;
    return albumCardCount(sid);
  }

  /** 而家已裝喺幾張出戰卡（可排除某 fid） */
  function skillEquipCount(sid, exceptFid) {
    let n = 0;
    Object.keys(state.loadout || {}).forEach((fid) => {
      if (exceptFid && fid === exceptFid) return;
      (state.loadout[fid] || []).forEach((s) => {
        if (s === sid) n += 1;
      });
    });
    return n;
  }

  function skillFreeCopies(sid, exceptFid) {
    return Math.max(0, skillOwnedCopies(sid) - skillEquipCount(sid, exceptFid));
  }

  /** 同場（其他出戰卡）是否已裝此 skillId；t316：即使有複本亦不可分裝 */
  function skillFieldTaken(sid, exceptFid) {
    return skillEquipCount(sid, exceptFid) > 0;
  }

  /** 回傳第一張已裝此技能的出戰卡名稱（排除 exceptFid）；沒有則 null */
  function skillEquippedOnName(sid, exceptFid) {
    if (!sid) return null;
    for (const fid of state.team || []) {
      if (exceptFid && fid === exceptFid) continue;
      if (isDeadFighter(fid)) continue;
      const arr = state.loadout[fid] || [];
      if (arr.indexOf(sid) >= 0) {
        const f = fighterById[fid];
        return (f && f.name) || String(fid);
      }
    }
    return null;
  }

  /** 同場同一 skillId 最多 1 份（唔理 owned）；多餘清 null（保留先遇到嘅出戰卡） */
  function reconcileTeamSkillUniqueness() {
    const used = Object.create(null);
    (state.team || []).forEach((fid) => {
      if (isDeadFighter(fid)) return;
      const arr = state.loadout[fid];
      if (!Array.isArray(arr)) return;
      state.loadout[fid] = arr.map((sid) => {
        if (!sid || isBurnedSkill(sid)) return null;
        used[sid] = (used[sid] || 0) + 1;
        return used[sid] <= 1 ? sid : null;
      });
    });
  }

  /** 裝上技能：同場其他出戰卡已有此 sid 則不可再裝（不再自動轉移）；必須在 lifeSkills */
  function claimSkillForFighter(fid, sid, slot) {
    if (!fid || !sid) return;
    ensureLifeSkills();
    if (!(state.lifeSkills || []).includes(sid)) return;
    const f = fighterById[fid];
    if (!f) return;
    // t316：同場禁重複技能（即使持有複本亦不可分裝；唔轉移）
    if (skillFieldTaken(sid, fid)) return;
    const cap = raritySlots(f);
    const display = Array.from({ length: cap }, (_, i) => (state.loadout[fid] || [])[i] || null);
    for (let i = 0; i < display.length; i++) {
      if (display[i] === sid) display[i] = null;
    }
    const target = slot != null ? slot : display.findIndex((x) => !x);
    if (target < 0 || target >= cap) {
      state.loadout[fid] = display;
      return;
    }
    display[target] = sid;
    state.loadout[fid] = display;
  }

  /** Auto-fill：同場同一 skillId 最多 1（t316）；只由 lifeSkills 池揀。
   *  loadoutInited[fid]：已初始化後唔再 auto-fill（保留 null 格，卸下先得）。
   *  force:true 可重種子並保持／設 inited。 */
  function ensureDefaultLoadout(force) {
    ensureLifeSkills();
    pruneLoadoutToLifeSkills();
    ensureLoadoutShape();
    reconcileTeamSkillUniqueness();
    if (!state.loadoutInited || typeof state.loadoutInited !== "object") state.loadoutInited = {};
    Object.keys(state.loadoutInited).forEach((fid) => {
      if (!(state.team || []).includes(fid)) delete state.loadoutInited[fid];
    });
    const teamUsed = Object.create(null);
    (state.team || []).forEach((fid) => {
      if (isDeadFighter(fid)) return;
      (state.loadout[fid] || []).forEach((sid) => {
        if (sid) teamUsed[sid] = (teamUsed[sid] || 0) + 1;
      });
    });
    state.team.forEach((fid) => {
      if (isDeadFighter(fid)) return;
      const f = fighterById[fid];
      const fullCap = raritySlots(f);

      // 已初始化＋非 force：只清 burned，保留 null 洞（唔 collapse、唔 auto-fill）
      if (!force && state.loadoutInited[fid]) {
        const prev = state.loadout[fid] || [];
        state.loadout[fid] = Array.from({ length: fullCap }, (_, i) => {
          const sid = prev[i] || null;
          return sid && !isBurnedSkill(sid) ? sid : null;
        });
        return;
      }

      // 填充路徑（force 或未 inited）
      const cur = (state.loadout[fid] || []).filter((sid) => sid && !isBurnedSkill(sid));
      if (!force && cur.length) {
        state.loadout[fid] = cur;
        cur.forEach((sid) => {
          teamUsed[sid] = teamUsed[sid] || 0;
        });
        state.loadoutInited[fid] = true;
        return;
      }
      const cap = Math.min(fullCap, DEFAULT_EQUIP_FILL);
      const pick = [];
      const localUsed = new Set();
      for (const s of openPocketSkills()) {
        if (pick.length >= cap) break;
        if (localUsed.has(s.id) || isBurnedSkill(s.id)) continue;
        if (!skillCompatible(f, s)) continue;
        // t316：同場同一 skillId 最多 1（唔理 owned 複本）
        const used = teamUsed[s.id] || 0;
        if (used >= 1) continue;
        if (skillOwnedCopies(s.id) <= 0) continue;
        pick.push(s.id);
        localUsed.add(s.id);
        teamUsed[s.id] = used + 1;
      }
      state.loadout[fid] = pick;
      state.loadoutInited[fid] = true;
    });
  }

  function shuffleCopy(arr) {
    const a = arr.slice();
    shuffleInPlace(a);
    return a;
  }

  const COMMERCE_CATEGORIES = {
    shop_equip: 1,
    shop_fighter: 1,
    shop_skill: 1,
    card_trade: 1,
    star_up: 1,
    // t366：新增三類養成事件
    gear_upgrade: 1,   // 裝備強化（直接＋星，唔燒同名卡）
    fighter_train: 1,  // 戰鬥卡練功（＋卡經驗／等級）
    fighter_revive: 1, // 復活陣亡戰鬥卡
  };

  /** 送卡事件：免費三選一（唔收金幣、唔換走己卡） */
  const GIFT_CATEGORIES = { card_gift: 1, card_draw: 1 };

  function isCommerceEvent(ev) {
    return !!(ev && COMMERCE_CATEGORIES[ev.category]);
  }

  /**
   * 出街頭 3 個自由年唔出商店／買賣。
   * 之後亦要金幣夠最平一件（普通 15）先出，避免袋裡冇錢就遇到檔口。
   */
  function commerceEventsAllowed(year) {
    if (freeEncounterYear(year) < 4) return false;
    return (state.gold | 0) >= 15;
  }

  /**
   * 每年四揀一：
   * - 自由年>=5 && 自由年%5===0 → 全從 special_battle（宿敵）池抽 4（不足則重複）
   *   （命運 Y1–3 唔計入自由年；曆年4＝自由年1）
   * - 否則從非 special_battle 池抽 4，盡量類型唔重複（每 category 最多 1，再填滿）
   * 回傳 4 個 event 物件；同年緩存於 state.yearEventOffer
   */
  function rollYearEvents(year) {
    const y = Math.max(1, year | 0);
    const allowCommerce = commerceEventsAllowed(y);
    if ((state.yearEventYear | 0) === y && state.yearEventOffer && state.yearEventOffer.length === 4) {
      const cached = state.yearEventOffer
        .map((id) => (DATA.events || []).find((e) => e.id === id))
        .filter(Boolean);
      if (cached.length === 4 && (allowCommerce || !cached.some(isCommerceEvent))) {
        return cached;
      }
      state.yearEventOffer = [];
      state.yearEventYear = 0;
    }
    const all = DATA.events || [];
    let picked = [];
    if (isSpecialBattleYear(y)) {
      const pool = all.filter((e) => e.category === "special_battle" && !eventExcludedFromYearPool(e));
      const src = pool.length ? pool : all.filter((e) => e.battle && !eventExcludedFromYearPool(e));
      const sh = shuffleCopy(src);
      for (let i = 0; i < 4; i++) {
        picked.push(sh[i % Math.max(1, sh.length)]);
      }
    } else {
      const pool = all.filter((e) => e.category !== "special_battle" && eventFactionEligible(e) && !eventExcludedFromYearPool(e) && (allowCommerce || !isCommerceEvent(e)));
      const byCat = {};
      pool.forEach((e) => {
        const c = e.category || "adventure";
        if (!byCat[c]) byCat[c] = [];
        byCat[c].push(e);
      });
      const packId = ensureActiveStoryPack();
      const pack = storyPackById(packId);
      const boostIds = packBoostEventIds(pack);
      let cats = shuffleCopy(Object.keys(byCat));
      // 有 active 故事包時提高「主線」入四格機會，但仍只佔 1 格（類型唔重複）
      if (boostIds.size && byCat.main) {
        const mi = cats.indexOf("main");
        if (mi >= 0 && Math.random() < 0.75) {
          cats.splice(mi, 1);
          cats.unshift("main");
        }
      }
      const usedIds = new Set();
      // 先每類型最多 1——保證唔會 4 格全主線
      for (const c of cats) {
        if (picked.length >= 4) break;
        let cand = null;
        const shuffled = shuffleCopy(byCat[c] || []);
        if (c === "main" && boostIds.size) {
          cand = shuffled.find((e) => boostIds.has(e.id) && !usedIds.has(e.id))
            || shuffled.find((e) => !usedIds.has(e.id));
        } else {
          cand = shuffled.find((e) => !usedIds.has(e.id));
        }
        if (cand) {
          picked.push(cand);
          usedIds.add(cand.id);
        }
      }
      // 填滿：優先非 main，避免誤變直線劇
      const restPrefer = shuffleCopy(pool.filter((e) => !usedIds.has(e.id) && e.category !== "main"));
      const restMain = shuffleCopy(pool.filter((e) => !usedIds.has(e.id) && e.category === "main"));
      for (const e of restPrefer.concat(restMain)) {
        if (picked.length >= 4) break;
        picked.push(e);
        usedIds.add(e.id);
      }
      // 仍不足則允許重複（仍避開第 2+ 張 main）
      if (picked.length < 4 && pool.length) {
        const sh = shuffleCopy(pool.filter((e) => e.category !== "main"));
        const shAll = sh.length ? sh : shuffleCopy(pool);
        while (picked.length < 4) picked.push(shAll[picked.length % shAll.length]);
      }
      // fallback: year_pools
      if (picked.length < 4) {
        const pools = DATA.year_pools || {};
        const key = String(Math.min(y, MAX_YEARS));
        const ids = pools[key] || pools[String(MAX_YEARS)] || [];
        ids.forEach((id) => {
          if (picked.length >= 4) return;
          const ev = all.find((e) => e.id === id);
          if (ev) picked.push(ev);
        });
      }
      // 硬保險：四格唔可以全係 main
      const mainCount = picked.filter((e) => e && e.category === "main").length;
      if (mainCount >= 4) {
        const nonMain = shuffleCopy(pool.filter((e) => e.category !== "main"));
        for (let i = 1; i < picked.length && nonMain.length; i++) {
          if (picked[i].category === "main") {
            picked[i] = nonMain[(i - 1) % nonMain.length];
          }
        }
      }
    }
    // 自由遭遇年：機率注入 1 張小遊戲（教學期自由年亦可；宿敵年整池已係 special_battle，唔入呢度）
    if (!isSpecialBattleYear(y) && freeEncounterYear(y) >= 1) {
      const mgPool = all.filter((e) => e && e.category === "minigame");
      if (mgPool.length) {
        const already = picked.some((e) => e && e.category === "minigame");
        // demo-lite：約七成出現一格，方便驗收；唔覆蓋 main 優先
        if (!already && Math.random() < 0.7) {
          const mg = mgPool[Math.floor(Math.random() * mgPool.length)];
          let ri = picked.length ? picked.length - 1 : 0;
          for (let i = picked.length - 1; i >= 0; i--) {
            if (picked[i] && picked[i].category !== "main") {
              ri = i;
              break;
            }
          }
          if (picked.length) picked[ri] = mg;
          else picked.push(mg);
        }
      }
      // 勢力支線：注入 1 格（唔搶 main／唔覆蓋剛注入小遊戲；宿敵年唔出）
      // 有 eligible 回報卡（require_faction）→ 必出回報格；否則約六成抽介紹遭遇
      const facPool = all.filter((e) => e && e.category === "faction" && eventFactionEligible(e));
      if (facPool.length) {
        const alreadyF = picked.some((e) => e && e.category === "faction");
        const rewardFac = facPool.filter((e) => e.require_faction);
        const introFac = facPool.filter((e) => !e.require_faction);
        const forceReward = rewardFac.length > 0;
        if (!alreadyF && (forceReward || Math.random() < 0.65)) {
          const src = forceReward ? rewardFac : (introFac.length ? introFac : facPool);
          const fac = src[Math.floor(Math.random() * src.length)];
          let ri = picked.length ? picked.length - 1 : 0;
          for (let i = picked.length - 1; i >= 0; i--) {
            const c = picked[i] && picked[i].category;
            if (c && c !== "main" && c !== "minigame") {
              ri = i;
              break;
            }
          }
          if (picked.length) picked[ri] = fac;
          else picked.push(fac);
        }
      }
      // 交換卡／升星：自由年約四成注入 1 格（唔搶 main／minigame／faction；宿敵年唔出）
      const injectLifeSide = (cat, chance) => {
        const poolX = all.filter((e) => e && e.category === cat);
        if (!poolX.length) return;
        if (picked.some((e) => e && e.category === cat)) return;
        if (Math.random() >= chance) return;
        const pickX = poolX[Math.floor(Math.random() * poolX.length)];
        let ri = picked.length ? picked.length - 1 : 0;
        const protect = { main: 1, minigame: 1, faction: 1 };
        for (let i = picked.length - 1; i >= 0; i--) {
          const c = picked[i] && picked[i].category;
          if (c && !protect[c]) {
            ri = i;
            break;
          }
        }
        if (picked.length) picked[ri] = pickX;
        else picked.push(pickX);
      };
      if (allowCommerce) {
        injectLifeSide("card_trade", 0.4);
        injectLifeSide("star_up", 0.4);
        // t366：養成事件（裝備強化／戰鬥卡練功／復活）
        injectLifeSide("gear_upgrade", 0.45);
        injectLifeSide("fighter_train", 0.45);
        // 復活：只有「有陣亡卡」時才有意義，交畀 pick 時過濾
        injectLifeSide("fighter_revive", 0.5);
      }
      // 送卡：自由年約五成注入 1 格（免費、唔需要金幣，早期都出）
      injectLifeSide("card_gift", 0.5);
      // t366：抽卡事件（免費／低價抽，補充出戰卡池）
      injectLifeSide("card_draw", 0.4);
    }
    picked = picked.slice(0, 4);
    /*
     * t398：四選一插畫保證不重複（總導演：「選擇事件的背景圖，出現太多相同，
     * 改為事件 4 選 1 背景圖片不相同」）。
     *
     * 實測改前：3000 次抽牌中有 2000 次（66.7%）出現重複插畫，
     * 因為 126 個事件只有 5 張主圖輪替。
     *
     * 做法：對「插畫撞了」的卡，從同年可用事件中換一張**插畫未用過**的，
     * 並保持原本 category 不被破壞（避免把「主線」換成「送卡」）。
     * 若同 category 找不到，才放寬到任何 category。
     */
    picked = dedupeEventArt(picked, all);
    state.yearEventOffer = picked.map((e) => e.id);
    state.yearEventYear = y;
    return picked;
  }

  /**
   * t398：令陣列中的事件插畫互不相同。
   * @param {Array} list  已揀好的事件（通常 4 張）
   * @param {Array} pool  同年全部可選事件
   */
  function dedupeEventArt(list, pool) {
    const out = (list || []).slice();
    if (out.length < 2) return out;
    const poolAll = (pool || []).filter((e) => e && e.id);
    if (!poolAll.length) return out;

    const usedArt = new Set();
    const usedId = new Set(out.filter(Boolean).map((e) => e.id));

    for (let i = 0; i < out.length; i++) {
      const ev = out[i];
      if (!ev) continue;
      const art = ev.art || "";
      if (!art || !usedArt.has(art)) {
        if (art) usedArt.add(art);
        continue;
      }
      /*
       * 撞圖：先試同 category、插畫未用過嘅事件；
       * 再退一步試任何 category。
       */
      const candidates = poolAll.filter((c) => c && c.id && !usedId.has(c.id)
        && c.art && !usedArt.has(c.art));
      let pick = candidates.find((c) => c.category === ev.category) || null;
      if (!pick) {
        /* 唔好將「主線」換成雜類；其餘可以放寬 */
        const keepMain = ev.category === "main";
        pick = candidates.find((c) => !keepMain || c.category === "main") || null;
        if (!pick && !keepMain) pick = candidates[0] || null;
      }
      if (pick) {
        out[i] = pick;
        usedId.add(pick.id);
        usedArt.add(pick.art);
      } else {
        usedArt.add(art); /* 真係冇得換，就接受重複 */
      }
    }
    return out;
  }

  function eventsForYear(year) {
    return rollYearEvents(year);
  }

  const CATEGORY_PILL_CLASS = {
    special: "cat-special",
    main: "cat-main",
    side: "cat-side",
    shop_equip: "cat-shop",
    shop_fighter: "cat-shop",
    shop_skill: "cat-shop",
    trial: "cat-trial",
    adventure: "cat-adventure",
    skill_swap: "cat-swap",
    special_battle: "cat-sbattle",
    minigame: "cat-minigame",
    faction: "cat-faction",
    card_trade: "cat-trade",
    star_up: "cat-starup",
    card_gift: "cat-gift",
    // t366
    gear_upgrade: "cat-starup",
    fighter_train: "cat-gift",
    fighter_revive: "cat-gift",
    card_draw: "cat-gift",
  };
  function eventCategoryLabel(ev) {
    if (!ev) return "日常";
    if (ev.category === "special_battle") return ev.category_label || "宿敵";
    if (ev.category === "faction") {
      if (ev.faction_id) return factionName(ev.faction_id);
      return ev.category_label || "勢力";
    }
    return (ev.category_label || ev.type) || (ev.battle ? "遇敵" : "日常");
  }

  /** Asia/Hong_Kong YYYY-MM-DD */
  function hkDateKey(d) {
    const dt = d instanceof Date ? d : new Date();
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dt);
    } catch (e) {
      const off = 8 * 60;
      const local = new Date(dt.getTime() + (off - dt.getTimezoneOffset()) * 60000);
      return local.toISOString().slice(0, 10);
    }
  }

  function dailyMissionList() {
    return (DATA.daily_missions && DATA.daily_missions.length)
      ? DATA.daily_missions
      : [];
  }

  function ensureAccountStats() {
    if (!state.accountStats || typeof state.accountStats !== "object") {
      state.accountStats = { maxAgeReached: 0, equipStarsTotal: 0 };
    }
    if (typeof state.accountStats.maxAgeReached !== "number") state.accountStats.maxAgeReached = 0;
    if (typeof state.accountStats.equipStarsTotal !== "number") state.accountStats.equipStarsTotal = 0;
  }

  function blankDailyProgress() {
    const progress = {};
    const claimed = {};
    dailyMissionList().forEach((m) => {
      progress[m.id] = 0;
      claimed[m.id] = false;
    });
    return { progress, claimed };
  }

  function ensureDaily() {
    ensureAccountStats();
    const key = hkDateKey();
    const blank = blankDailyProgress();
    if (!state.daily || typeof state.daily !== "object" || state.daily.dateKey !== key) {
      state.daily = { dateKey: key, progress: blank.progress, claimed: blank.claimed };
    } else {
      dailyMissionList().forEach((m) => {
        if (typeof state.daily.progress[m.id] !== "number") state.daily.progress[m.id] = 0;
        if (typeof state.daily.claimed[m.id] !== "boolean") state.daily.claimed[m.id] = false;
      });
    }
    // 跨世／跨日：甲子影子跟 accountStats
    if ((state.accountStats.maxAgeReached | 0) >= 60) {
      const ageM = dailyMissionList().find((m) => m.type === "life_age60");
      if (ageM) {
        state.daily.progress[ageM.id] = Math.max(state.daily.progress[ageM.id] | 0, 1);
      }
    }
    return state.daily;
  }

  function bumpDailyByType(type, n) {
    ensureDaily();
    const add = Math.max(0, n | 0) || 1;
    dailyMissionList().forEach((m) => {
      if (m.type !== type) return;
      const cur = state.daily.progress[m.id] | 0;
      const tgt = Math.max(1, m.target | 0);
      state.daily.progress[m.id] = Math.min(tgt, cur + add);
    });
  }

  /** 事件完成進度：battleWin=true 戰鬥勝；soft=true soft／商店結算 */
  function trackEventMission(ev, opts) {
    if (!ev) return;
    ensureDaily();
    const o = opts || {};
    const cat = ev.category || "";
    if (o.battleWin) {
      bumpDailyByType("battle_win", 1);
      if (cat === "special_battle") bumpDailyByType("battle_nemesis", 1);
      // 普通戰：試煉／主線／支線／奇遇有戰（非宿敵）
      if (cat === "trial" || cat === "main" || cat === "side" || (ev.battle && cat === "adventure")) {
        bumpDailyByType("battle_normal", 1);
      }
      if (cat === "special" || cat === "special_battle") bumpDailyByType("battle_special", 1);
      if (cat === "adventure") bumpDailyByType("adventure", 1);
    }
    if (o.soft) {
      if (cat === "adventure") bumpDailyByType("adventure", 1);
      if (cat === "special") bumpDailyByType("battle_special", 1);
      if (cat === "shop_equip" || cat === "shop_fighter" || cat === "shop_skill") {
        bumpDailyByType("shop", 1);
      }
    }
  }

  function bumpEquipStar(n) {
    ensureAccountStats();
    ensureDaily();
    const add = Math.max(1, n | 0);
    state.accountStats.equipStarsTotal = (state.accountStats.equipStarsTotal | 0) + add;
    bumpDailyByType("equip_star", add);
  }

  function syncAgeMission() {
    ensureAccountStats();
    ensureDaily();
    const age = state.age | 0;
    if (age > (state.accountStats.maxAgeReached | 0)) {
      state.accountStats.maxAgeReached = age;
    }
    if (age >= 60 || (state.accountStats.maxAgeReached | 0) >= 60) {
      bumpDailyByType("life_age60", 1);
      const ageM = dailyMissionList().find((m) => m.type === "life_age60");
      if (ageM) state.daily.progress[ageM.id] = 1;
    }
  }

  /** 差事獎勵 → 聲望（金幣獎勵換算成聲望；膠幣、經驗、幸運照舊） */
  const MISSION_GOLD_TO_FAME = 0.5;

  function missionFameGain(m) {
    const r = (m && m.reward) || {};
    const base = (r.fame | 0);
    const fromGold = Math.round(((r.gold | 0) || 0) * MISSION_GOLD_TO_FAME);
    return base + fromGold;
  }

  function claimDailyMission(id) {
    ensureDaily();
    const m = dailyMissionList().find((x) => x.id === id);
    if (!m) return false;
    if (state.daily.claimed[id]) return false;
    const cur = state.daily.progress[id] | 0;
    if (cur < Math.max(1, m.target | 0)) return false;
    const r = m.reward || {};
    if (r.soul) state.soul = (state.soul | 0) + (r.soul | 0);
    const fameGain = missionFameGain(m);
    if (fameGain) state.fame = (state.fame | 0) + fameGain;
    if (r.xp) gainXp(r.xp | 0);
    if (r.luck_note) {
      if (!state.attrs) state.attrs = defaultAttrs();
      state.attrs.luck = (state.attrs.luck | 0) + 1;
    }
    state.daily.claimed[id] = true;
    return true;
  }

  function rewardBlurbOf(m) {
    const r = (m && m.reward) || {};
    const bits = [];
    if (r.soul) bits.push("膠幣+" + r.soul);
    const fame = missionFameGain(m);
    if (fame) bits.push("聲望+" + fame);
    if (r.xp) bits.push("經驗+" + r.xp);
    if (r.luck_note) bits.push("幸運＋1");
    return bits.join(" · ") || "—";
  }

  function applyEventAttrsDelta(ev) {
    if (!ev || !ev.attrs_delta || typeof ev.attrs_delta !== "object") return;
    if (!state.attrs) state.attrs = defaultAttrs();
    Object.keys(ev.attrs_delta).forEach((k) => {
      state.attrs[k] = (state.attrs[k] | 0) + (ev.attrs_delta[k] | 0);
    });
    if (state.team.length > pocketCap()) {
      state.team = state.team.slice(0, pocketCap());
    }
  }

  /**
   * 人生店鋪定價表（金幣）——t315
   * 普通／common=15｜稀有／rare=25｜史詩／epic=40｜最高級／legend=60｜無法辨識=20
   */
  const SHOP_PRICE_BY_RARITY = {
    common: 15,
    "普通": 15,
    rare: 25,
    "稀有": 25,
    epic: 40,
    "史詩": 40,
    legend: 60,
    "最高級": 60,
    "傳奇": 60,
  };
  const SHOP_PRICE_FALLBACK = 20;

  function shopPriceForRarity(rarity) {
    const key = String(rarity == null ? "" : rarity).trim();
    if (!key) return SHOP_PRICE_FALLBACK;
    if (SHOP_PRICE_BY_RARITY[key] != null) return SHOP_PRICE_BY_RARITY[key];
    const low = key.toLowerCase();
    if (SHOP_PRICE_BY_RARITY[low] != null) return SHOP_PRICE_BY_RARITY[low];
    return SHOP_PRICE_FALLBACK;
  }

  /** t364：與店鋪共用同一張表，唔再各自一套叫法 */
  function shopRarityLabel(rarity) {
    const label = rarityLabelAny(rarity);
    return label || "無法辨識";
  }

  /**
   * t364：全站唯一稀有度名稱表。
   * 以前分三套叫法（裝備說明「傳奇／稀有」、卡冊「最高級／史詩」、店鋪「最高級」），
   * 同一張卡在不同畫面有三個名，玩家對不上。現一律以 data.rarities 的官方名為準。
   */
  const RARITY_LABELS = { common: "普通", rare: "稀有", epic: "史詩", legend: "最高級" };
  const RARITY_ORDER = ["common", "rare", "epic", "legend"];

  /** 把任何寫法（id／官方名／舊別名）正規化成官方名；認不出就原樣回傳 */
  function rarityLabelAny(r) {
    const key = String(r == null ? "" : r).trim();
    if (!key) return "";
    if (RARITY_LABELS[key]) return RARITY_LABELS[key];
    if (RARITY_ORDER.indexOf(key) >= 0) return RARITY_LABELS[key];
    const low = key.toLowerCase();
    if (RARITY_LABELS[low]) return RARITY_LABELS[low];
    // 舊檔別名：傳奇＝最高級（t322 已拆 epic／legend，唔可以再混）
    if (low === "legend" || key === "傳奇") return RARITY_LABELS.legend;
    return key;
  }

  /** 由官方名／id 取英文 id（排序、class 用） */
  function rarityIdOf(r) {
    const label = rarityLabelAny(r);
    const hit = RARITY_ORDER.find((id) => RARITY_LABELS[id] === label);
    return hit || "common";
  }

  function shopTitleForCat(cat) {
    if (cat === "shop_equip") return "裝備店";
    if (cat === "shop_fighter") return "戰鬥卡店";
    if (cat === "shop_skill") return "技能店";
    return "店鋪";
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** 同類池抽最多 4 張不重複（優先未持有／未入口袋；有圖優先） */
  function buildShopOffers(cat) {
    ensureGearShape();
    albumEnsureState();
    const takeUnique = (ordered, n) => {
      const seen = new Set();
      const out = [];
      for (let i = 0; i < ordered.length; i++) {
        const it = ordered[i];
        if (!it || !it.id || seen.has(it.id)) continue;
        seen.add(it.id);
        out.push(it);
        if (out.length >= n) break;
      }
      return out;
    };

    if (cat === "shop_equip") {
      const items = equipItemList().filter((it) => it && it.id);
      let withArt = items.filter((it) => it.art && !String(it.art).includes("pending-manus"));
      if (!withArt.length) withArt = items.slice();
      const unowned = withArt.filter((it) => albumCardCount(it.id) <= 0);
      const owned = withArt.filter((it) => albumCardCount(it.id) > 0);
      const ordered = shuffleInPlace(unowned.slice()).concat(shuffleInPlace(owned.slice()));
      return takeUnique(ordered, 4).map((it) => ({
        id: it.id,
        name: it.name || it.id,
        art: it.art || "",
        rarity: it.rarity || "",
        price: shopPriceForRarity(it.rarity),
        kind: "equip",
        slot: it.slot || it.slot_id || null,
      }));
    }

    if (cat === "shop_fighter") {
      const inTeam = new Set(state.team || []);
      /* t391：商店唔賣殘頁專屬卡 */
      let withArt = poolFighters().filter(
        (f) => f && f.id && f.art && !String(f.art).includes("pending-manus")
      );
      if (!withArt.length) withArt = poolFighters();
      const notInTeam = withArt.filter((f) => !inTeam.has(f.id));
      const notOwned = withArt.filter((f) => albumCardCount(f.id) <= 0);
      const tier1 = notInTeam.filter((f) => albumCardCount(f.id) <= 0);
      const tier2 = notInTeam.filter((f) => albumCardCount(f.id) > 0);
      const tier3 = withArt.filter((f) => inTeam.has(f.id));
      const ordered = shuffleInPlace(tier1.slice())
        .concat(shuffleInPlace(tier2.slice()))
        .concat(shuffleInPlace(notOwned.filter((f) => inTeam.has(f.id)).slice()))
        .concat(shuffleInPlace(tier3.slice()));
      return takeUnique(ordered, 4).map((f) => ({
        id: f.id,
        name: f.name || f.id,
        art: f.art || "",
        rarity: f.rarity || "",
        price: shopPriceForRarity(f.rarity),
        kind: "fighter",
      }));
    }

    if (cat === "shop_skill") {
      ensureLifeSkills();
      const skills = (DATA.skills || []).filter((sk) => sk && sk.id);
      const inLife = new Set(state.lifeSkills || []);
      const notInLife = skills.filter((sk) => !inLife.has(sk.id));
      const notOwned = skills.filter((sk) => albumCardCount(sk.id) <= 0);
      const tier1 = notInLife.filter((sk) => albumCardCount(sk.id) <= 0);
      const tier2 = notInLife.filter((sk) => albumCardCount(sk.id) > 0);
      const tier3 = skills.filter((sk) => inLife.has(sk.id));
      const ordered = shuffleInPlace(tier1.slice())
        .concat(shuffleInPlace(tier2.slice()))
        .concat(shuffleInPlace(notOwned.filter((sk) => inLife.has(sk.id)).slice()))
        .concat(shuffleInPlace(tier3.slice()));
      return takeUnique(ordered, 4).map((sk) => ({
        id: sk.id,
        name: sk.name || sk.id,
        art: sk.art || "",
        rarity: sk.rarity || "",
        price: shopPriceForRarity(sk.rarity),
        kind: "skill",
      }));
    }
    return [];
  }

  /** 購入後入袋／裝槽（對齊舊 stub）；回傳補充說明（可空） */
  function grantShopItem(cat, offer) {
    ensureGearShape();
    albumEnsureState();
    const itemId = offer && offer.id;
    if (!itemId) return "";

    if (cat === "shop_equip") {
      const items = equipItemList();
      const pick = items.find((it) => it && it.id === itemId) || null;
      if (!pick) return "";
      albumGainOne("gear", pick.id);
      /*
       * t400：槽位已有裝備時亦要換上（人生中途冇其他地方可換）。
       * 舊行為只在「該槽空著」時才裝，否則只回「已入裝備收藏」 →
       * 玩家已有頭部裝備時，新頭部裝備永遠用唔到。
       */
      const slotId = offer.slot || pick.slot || pick.slot_id || null;
      const slotMeta = slotId ? GEAR_SLOTS.find((s) => s.id === slotId) : null;
      if (!slotMeta) return "已入裝備收藏（未對應槽位）";
      const prevId = state.accountGear[slotMeta.id];
      state.accountGear[slotMeta.id] = pick.id;
      if (prevId && prevId !== pick.id) {
        const prev = items.find((it) => it && it.id === prevId);
        return `已裝上${slotMeta.label}槽（換走「${(prev && prev.name) || prevId}」）`;
      }
      return `已裝上${slotMeta.label}槽`;
    }

    if (cat === "shop_fighter") {
      const cap = fighterPocketCap();
      const inTeam = new Set(state.team || []);
      const pick = (DATA.fighters || []).find((f) => f && f.id === itemId) || null;
      if (!pick) return "";
      albumGainOne("fighters", pick.id);
      if (!inTeam.has(pick.id) && (state.team || []).length < cap) {
        state.team.push(pick.id);
        if (!state.loadout[pick.id]) state.loadout[pick.id] = [];
        return "已加入戰鬥卡口袋";
      }
      if (inTeam.has(pick.id)) return "複本入卡冊";
      return `統率已滿（${cap}）——入卡冊`;
    }

    if (cat === "shop_skill") {
      ensureLifeSkills();
      const pick = (DATA.skills || []).find((sk) => sk && sk.id === itemId) || null;
      if (!pick) return "";
      const inLife = new Set(state.lifeSkills || []);
      albumGainOne("skills", pick.id);
      if (!inLife.has(pick.id) && (state.lifeSkills || []).length < LIFE_SKILLS_CAP) {
        state.lifeSkills.push(pick.id);
        return "已加入技能口袋";
      }
      if (inLife.has(pick.id)) return "複本入卡冊";
      return `技能口袋已滿（${LIFE_SKILLS_CAP}）——入卡冊`;
    }
    return "";
  }

  function buyShopOffer(offer) {
    if (!state.shop || state.shop.bought) return false;
    if (!offer || !offer.id) return false;
    const price = Math.max(0, offer.price | 0);
    if ((state.gold | 0) < price) return false;
    state.gold = (state.gold | 0) - price;
    const cat = state.shop.category;
    const extra = grantShopItem(cat, offer);
    state.softNote = `以 ${price} 金幣購入「${offer.name || offer.id}」` + (extra ? `（${extra}）` : "");
    state.shop.bought = true;
    state.shopLeftEmpty = false;
    state.shop = null;
    state.screen = "soft";
    return true;
  }

  function leaveShop() {
    state.softNote = "離開店鋪，未購買";
    state.shopLeftEmpty = true;
    state.shop = null;
    state.screen = "soft";
  }

  /** 換技 stub（skill_swap）；商店改走四選一金幣購買 */
  function applyShopOrSwapStub(ev) {
    ensureGearShape();
    albumEnsureState();
    const cat = ev && ev.category;
    if (cat === "skill_swap") {
      const fid = (state.team || [])[0];
      const skills = DATA.skills || [];
      if (!fid || !skills.length) {
        state.softNote = "換技：未有可換技能";
        return state.softNote;
      }
      ensureLifeSkills();
      if (!Array.isArray(state.loadout[fid])) state.loadout[fid] = [];
      const cur = state.loadout[fid];
      const pick = skills[Math.floor(Math.random() * skills.length)];
      albumGainOne("skills", pick.id);
      if (!(state.lifeSkills || []).includes(pick.id) && (state.lifeSkills || []).length < LIFE_SKILLS_CAP) {
        state.lifeSkills.push(pick.id);
      }
      if (cur.length) {
        const idx = Math.floor(Math.random() * cur.length);
        const oldId = cur[idx];
        cur[idx] = pick.id;
        const oldName = (skillById[oldId] && skillById[oldId].name) || oldId;
        state.softNote = `換技：${oldName} → ${pick.name}`;
      } else {
        cur.push(pick.id);
        state.softNote = `換技：裝上「${pick.name}」`;
      }
      return state.softNote;
    }
    return "";
  }

  function syncYearFromAge() {
    // year 1 = 10 歲；次要顯示「第 X 年」
    state.year = Math.max(1, (state.age | 0) - 9);
  }

  /**
   * 自由遭遇年數：命運 Y1–3 唔計；曆年 4＝自由年 1。
   * 命運未完（fateYearIndex<3）回傳 0。
   */
  function freeEncounterYear(year) {
    if ((state.fateYearIndex | 0) < 3) return 0;
    const y = year == null ? (state.year | 0) : (year | 0);
    return Math.max(1, y - 3);
  }

  /** 五年一劫：只睇自由年 ≥5 且 %5===0（身世／命運年唔觸發宿敵池） */
  function isSpecialBattleYear(year) {
    const fy = freeEncounterYear(year);
    return fy >= 5 && fy % 5 === 0;
  }

  /* ---------- 勢力／好感（今世；刻度 0–5） ---------- */
  const FACTION_FAVOR_MAX = 5;

  function factionMetaList() {
    return Array.isArray(DATA.factions) ? DATA.factions : [];
  }

  function factionById(id) {
    return factionMetaList().find((f) => f && f.id === id) || null;
  }

  function factionName(id) {
    const f = factionById(id);
    return (f && f.name) || id || "勢力";
  }

  function ensureFactionsState() {
    if (!state.factions || typeof state.factions !== "object") state.factions = {};
    factionMetaList().forEach((f) => {
      if (!f || !f.id) return;
      const cur = state.factions[f.id];
      if (cur == null || !Number.isFinite(Number(cur))) state.factions[f.id] = 0;
      else state.factions[f.id] = Math.max(0, Math.min(FACTION_FAVOR_MAX, Number(cur) | 0));
    });
    return state.factions;
  }

  function factionFavor(id) {
    ensureFactionsState();
    return state.factions[id] | 0;
  }

  /** 改好感並 clamp 0–5；回傳實際變化字串（例「廟街義氣＋1」）或空 */
  function adjustFactionFavor(id, delta) {
    ensureFactionsState();
    const before = state.factions[id] | 0;
    const next = Math.max(0, Math.min(FACTION_FAVOR_MAX, before + (delta | 0)));
    state.factions[id] = next;
    const diff = next - before;
    if (!diff) return delta ? `${factionName(id)}（已達上下限）` : "";
    return `${factionName(id)}${diff > 0 ? "＋" : "−"}${Math.abs(diff)}`;
  }

  function factionFavorLine() {
    ensureFactionsState();
    return factionMetaList()
      .map((f) => `${f.name} ${state.factions[f.id] | 0}/${FACTION_FAVOR_MAX}`)
      .join(" · ");
  }

  function eventFactionEligible(ev) {
    if (!ev) return false;
    if (ev.flag_on_complete) {
      if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
      if (state.lifeFlags[ev.flag_on_complete]) return false;
    }
    const rf = ev.require_faction;
    if (rf && rf.id) {
      if (factionFavor(rf.id) < (rf.min | 0)) return false;
    }
    return true;
  }

  /** 教學期／未畢業：命運中，或自由年尚未到第 4 年（畢業＝自由年第4年） */
  function inTutorialPeriod() {
    if ((state.fateYearIndex | 0) < 3) return true;
    return freeEncounterYear() < 4;
  }

  function hasUsableTeamFighter() {
    return (state.team || []).some((id) => id && !isDeadFighter(id));
  }

  function lifeOver() {
    const life = (state.attrs && state.attrs.life) | 0;
    return life > 0 && (state.age | 0) > life;
  }

  function lifeDoneFlag() {
    // 今世行到壽命，或出戰卡死光。唔再於第 15 年切斷。
    return lifeOver() || !!state.lifeWiped;
  }

  function lifeEndBlurb() {
    if (state.lifeWiped) return "出戰卡已死光——今世完結。";
    return "壽命已到——今世歲數上限。";
  }

  function lifeEndName() {
    if (state.lifeWiped) return "全軍覆沒";
    return "壽命到限";
  }

  /** 戰中刷新／讀檔：視作敗北結算（無 live battle → 唔 lockDead；教學期 soft） */
  function settlePendingDefeat() {
    const pd = state.pendingDefeat;
    if (!pd || typeof pd !== "object") return false;
    state.pendingDefeat = null;
    state.battle = null;
    const tutorialLoss = inTutorialPeriod();
    if (!tutorialLoss && !hasUsableTeamFighter()) {
      state.lifeWiped = true;
    }
    const evId = pd.eventId;
    let ev = null;
    if (evId) {
      ev = (DATA.events || []).find((e) => e && e.id === evId) || null;
    }
    state.lastResult = {
      win: false,
      reward: 0,
      enemyName: typeof pd.enemyName === "string" ? pd.enemyName : "",
      enemyArt: typeof pd.enemyArt === "string" ? pd.enemyArt : "",
      rewardBlurb: (typeof pd.rewardBlurb === "string" && pd.rewardBlurb)
        ? pd.rewardBlurb
        : ((ev && ev.reward_blurb) || ""),
      eventName: (typeof pd.eventName === "string" && pd.eventName)
        ? pd.eventName
        : ((ev && ev.name) || ""),
      yearBefore: pd.year != null ? (pd.year | 0) : (state.year | 0),
      deadNames: [],
      survivorHealed: false,
      softRevive: tutorialLoss,
      midBattleAbort: true,
    };
    state.battlesThisLife += 1;
    if (tutorialLoss) {
      state.selectedEvent = null;
      state.deploy = [];
    } else {
      advanceYear();
    }
    return true;
  }

  function ensureLifeDoneResult() {
    if (state.lastResult) return;
    state.lastResult = {
      win: false,
      reward: 0,
      rewardBlurb: lifeEndBlurb(),
      eventName: lifeEndName(),
      deadNames: [],
    };
  }

  /** boot／繼續：pendingDefeat 或 lifeDone／未認結果 → 強制 result */
  function shouldResumeToResult() {
    if (state.pendingDefeat) {
      settlePendingDefeat();
      return true;
    }
    if (lifeDoneFlag()) {
      ensureLifeDoneResult();
      return true;
    }
    if (state.lastResult) return true;
    return false;
  }

  function advanceYear() {
    state.age = (state.age | 0) + 1;
    syncYearFromAge();
    state.selectedEvent = null;
    state.yearEventOffer = [];
    state.yearEventYear = 0;
    state.softNote = "";
    syncAgeMission();
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  /** 從 30 排除本世已揀；本輪唔重複；不足 4 先允許重複未揀池 */
  /** 命運四揀一：保證 4 張、不重複（已揀過的優先避開） */
  const FATE_OFFER_SIZE = 4;

  function normalizeFateOffer(list) {
    const src = Array.isArray(list) ? list : [];
    const picked = new Set(state.fatePicks || []);
    const out = [];
    const used = new Set();
    const pushId = (id) => {
      if (!id || used.has(id) || !fateById[id]) return;
      used.add(id);
      out.push(id);
    };
    src.forEach(pushId);
    if (out.length >= FATE_OFFER_SIZE) return out.slice(0, FATE_OFFER_SIZE);
    const fresh = shuffleInPlace(FATES.filter((f) => f && f.id && !picked.has(f.id) && !used.has(f.id)));
    for (const f of fresh) {
      pushId(f.id);
      if (out.length >= FATE_OFFER_SIZE) break;
    }
    if (out.length < FATE_OFFER_SIZE) {
      const all = shuffleInPlace(FATES.filter((f) => f && f.id && !used.has(f.id)));
      for (const f of all) {
        pushId(f.id);
        if (out.length >= FATE_OFFER_SIZE) break;
      }
    }
    return out;
  }

  function rollFateOffer() {
    state.fateOffer = normalizeFateOffer([]);
    return state.fateOffer;
  }

  function ensureFateBattleBonus() {
    if (!state.fateBattleBonus || typeof state.fateBattleBonus !== "object") {
      state.fateBattleBonus = { atk: 0, def: 0, hp: 0 };
    }
    ["atk", "def", "hp"].forEach((k) => {
      if (typeof state.fateBattleBonus[k] !== "number") state.fateBattleBonus[k] = 0;
    });
  }

  function gainXp(amount) {
    let add = amount | 0;
    state.xp = Math.max(0, (state.xp | 0) + add);
    let guard = 0;
    while ((state.xp | 0) >= Math.max(1, state.xpToNext | 0) && guard < 50) {
      state.xp = (state.xp | 0) - Math.max(1, state.xpToNext | 0);
      state.lv = (state.lv | 0) + 1;
      state.xpToNext = (state.xpToNext | 0) + 5;
      guard++;
    }
  }

  function applyFate(fate) {
    if (!fate || !fate.effects) return;
    const fx = fate.effects;
    if (!state.attrs) state.attrs = defaultAttrs();
    if (fx.attrs && typeof fx.attrs === "object") {
      Object.keys(fx.attrs).forEach((k) => {
        state.attrs[k] = (state.attrs[k] | 0) + (fx.attrs[k] | 0);
      });
    }
    if (typeof fx.soul === "number") state.soul = Math.max(0, (state.soul | 0) + fx.soul);
    if (typeof fx.gold === "number") state.gold = Math.max(0, (state.gold | 0) + fx.gold);
    if (typeof fx.xp === "number") {
      if (fx.xp >= 0) gainXp(fx.xp);
      else state.xp = Math.max(0, (state.xp | 0) + fx.xp);
    }
    if (fx.temp && typeof fx.temp === "object") {
      ensureFateBattleBonus();
      ["atk", "def", "hp"].forEach((k) => {
        if (typeof fx.temp[k] === "number") {
          state.fateBattleBonus[k] = (state.fateBattleBonus[k] | 0) + (fx.temp[k] | 0);
        }
      });
    }
    // 統率變咗：口袋唔准超
    if (state.team.length > pocketCap()) {
      state.team = state.team.slice(0, pocketCap());
    }
  }


  function fateArt(f) {
    const id = (f && f.id) || "";
    const name = ((f && f.name) || "") + ((f && f.blurb) || "");
    const yum = /茶|燒味|月餅|飲茶|打書釘|圖書館|冷氣|聯婚|紅包|八達通|請食|請飲|芝麻|奶茶|漫畫/;
    const alley = /城寨|走廊|天台|球場|單車|太極|義工|惡犬|踢波|暑假工|地盤|元老|波衫|停電|蠟燭|探老人/;
    const mtr = /小巴|港鐵|急剎|交通|離島|渡/;
    const can = /颱風|感冒|掛波|夜校|罰企|渠|功課|避債|流星|算命/;
    if (yum.test(name)) return "assets/events/ev-yum-cha.jpg";
    if (mtr.test(name)) return "assets/events/ev-mtr-crowd.jpg";
    if (can.test(name)) return "assets/events/ev-expired-can.jpg";
    if (alley.test(name)) return "assets/events/ev-alley-wake.jpg";
    const n = parseInt(String(id).replace(/\D/g, ""), 10) || 0;
    const arts = [
      "assets/events/ev-alley-wake.jpg",
      "assets/events/ev-yum-cha.jpg",
      "assets/events/ev-mtr-crowd.jpg",
      "assets/events/ev-expired-can.jpg",
    ];
    return arts[n % 4];
  }

  function fateKindLabel(kind) {
    if (kind === "buff") return "增益";
    if (kind === "debuff") return "減益";
    return "混合";
  }

  /*
   * t386：命運卡面文案（純故事，不含結果）。
   *
   * 原本 30 張 blurb 幾乎全部寫死結果，例如
   *   「一腳鏟空，腳腕腫起——敏捷同血都打折。」
   *   「終於不必扶——敏捷直接＋2。」
   * 玩家當成數學題揀，唔再係「人生際遇」。現在一律改為只講發生咩事。
   * 若有 `flavor` 欄位就用它；否則用下面的對照表；再冇就用原名兜底。
   */
  const FATE_FLAVOR = {
    F01: "街坊見你經過，遞你一杯凍檸茶，唔收錢。",
    F02: "天台踢波，一腳鏟空，腳腕即刻腫起。",
    F03: "天井有人拍你肩膀，講咗句「有種」，然後走咗。",
    F04: "街市地上有個紅包，未開封，冇人認領。",
    F05: "功課簿跌落水渠，沖走咗。聽日要抄返。",
    F06: "夜校燈下，黑板上面嗰條數，忽然明晒。",
    F07: "掛波，屋企人唔准出街。全日留喺屋企，聽住窗外面啲鐵皮响。",
    F08: "遊樂場打機，打到最後一關，有人喺後面睇住你。",
    F09: "屋邨走廊，你踎低，等樓下嗰班人走。",
    F10: "廟街師傅睇你隻手，講咗幾句，你聽唔明，但佢笑得好開心。",
    F11: "小巴急剎，你撞到前面張椅背。",
    F12: "暑假去地盤搬磚，晒到成個人黑咗。",
    F13: "長輩迫你去飲聯婚酒，逐個逐個敬。",
    F14: "圖書館冷氣好凍，你溫咗成個下午。",
    F15: "球場上，你笠住隊友件波衫上陣。",
    F16: "被班主任點名，罰企喺課室外面。",
    F17: "屋企人買咗燒味飯，叫你食多啲。",
    F18: "旺角執到一張八達通，你交咗去客務中心。",
    F19: "幫街坊貼膠紙，由地下貼到三樓。",
    F20: "暑假感冒，發燒留家，邊都唔去得。",
    F21: "夜空有流星，你許咗個願，冇講俾人聽。",
    F22: "友儕放開手，你自己踩咗出去。",
    F23: "公園老人教你推手，講咗半個鐘。",
    F24: "漫畫咖啡廳，你打書釘打足一日。",
    F25: "屋邨停電，你點咗兩支蠟燭。",
    F26: "義工隊去老人院，你陪一個阿伯傾咗一個下午。",
    F27: "街口有隻惡犬，一路吠到你行過。",
    F28: "中秋，街坊派月餅，你分到兩個。",
    F29: "暑假去離島，晒到成個人黑實。",
    F30: "測驗肥佬，要補考。",
  };

  /** 命運卡面文字：純故事，永不提數值／好壞 */
  function fateFlavorText(f) {
    if (!f) return "";
    if (f.flavor) return String(f.flavor);
    if (FATE_FLAVOR[f.id]) return FATE_FLAVOR[f.id];
    // 兜底：用原名講一句，唔提效果
    return String(f.name || "");
  }

  function afterFateOrEventScreen() {
    if ((state.fateYearIndex | 0) < 3) {
      state.fateOffer = normalizeFateOffer(state.fateOffer);
      return "fate";
    }
    return "events";
  }


  /* ---------- Auto-save（localStorage；關遊戲後「繼續上次未完人生」） ---------- */
  const SAVE_KEY = "hkcg-demo-lite-save-v1";

  function persistSnapshot() {
    const cloneObj = (o, fallback) => {
      if (!o || typeof o !== "object") return fallback;
      try { return JSON.parse(JSON.stringify(o)); } catch (_) { return fallback; }
    };
    return {
      lifePrepped: !!state.lifePrepped,
      originId: state.originId || null,
      year: state.year | 0,
      age: state.age | 0,
      lv: state.lv | 0,
      xp: state.xp | 0,
      xpToNext: state.xpToNext | 0,
      attrs: cloneObj(state.attrs, defaultAttrs()),
      gold: state.gold | 0,
      soul: state.soul | 0,
      fame: state.fame | 0,
      teaShopBought: Array.isArray(state.teaShopBought) ? state.teaShopBought.slice() : [],
      battlesThisLife: state.battlesThisLife | 0,
      /** 戰鬥播放速度偏好（1／2／4）；跨戰鬥、跨重開保留 */
      battleSpeed: normalizeBattleSpeed(state.speed),
      team: Array.isArray(state.team) ? state.team.slice() : [],
      lastWinDeploy: Array.isArray(state.lastWinDeploy) ? state.lastWinDeploy.slice(0, TEAM_SIZE) : [],
      loadout: cloneObj(state.loadout, {}),
      loadoutInited: cloneObj(state.loadoutInited, {}),
      lifeSkills: Array.isArray(state.lifeSkills) ? state.lifeSkills.slice() : state.lifeSkills,
      deadFighters: Array.isArray(state.deadFighters) ? state.deadFighters.slice() : [],
      burnedSkills: Array.isArray(state.burnedSkills) ? state.burnedSkills.slice() : [],
      lifeWiped: !!state.lifeWiped,
      fatePicks: Array.isArray(state.fatePicks) ? state.fatePicks.slice() : [],
      fateYearIndex: state.fateYearIndex | 0,
      fateOffer: Array.isArray(state.fateOffer) ? state.fateOffer.slice() : [],
      fateBattleBonus: cloneObj(state.fateBattleBonus, { atk: 0, def: 0, hp: 0 }),
      yearEventOffer: Array.isArray(state.yearEventOffer) ? state.yearEventOffer.slice() : [],
      yearEventYear: state.yearEventYear | 0,
      softNote: typeof state.softNote === "string" ? state.softNote : "",
      lifeFlags: cloneObj(state.lifeFlags, {}),
      factions: cloneObj(state.factions, {}),
      activeStoryPackId: state.activeStoryPackId || null,
      /** 玩家有冇主動揀故事包（true 就唔會跟隨新預設） */
      storyPackUserPicked: !!state.storyPackUserPicked,
      cardCounts: cloneObj(state.cardCounts, {}),
      demoSeedVersion: state.demoSeedVersion,
      fighterStars: cloneObj(state.fighterStars, {}),
      skillStars: cloneObj(state.skillStars, {}),
      fighterLevels: cloneObj(state.fighterLevels, {}),
      fighterXp: cloneObj(state.fighterXp, {}),
      equipStars: cloneObj(state.equipStars, {}),
      /** t390：戰鬥卡殘頁（跨世累積） */
      cardShards: cloneObj(state.cardShards, {}),
      accountGear: cloneObj(state.accountGear, {}),
      accountStats: cloneObj(state.accountStats, { maxAgeReached: 0, equipStarsTotal: 0 }),
      daily: cloneObj(state.daily, null),
      pendingDefeat: cloneObj(state.pendingDefeat, null),
      lastResult: cloneObj(state.lastResult, null),
      gachaPityRare: Math.max(0, state.gachaPityRare | 0),
      gachaPityEpic: Math.max(0, state.gachaPityEpic | 0),
    };
  }

  function saveGame() {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return;
      localStorage.setItem(SAVE_KEY, JSON.stringify(persistSnapshot()));
    } catch (_) {
      /* quota / private mode — silent */
    }
  }

  /** Apply snapshot into state. Returns whether lifePrepped was true after load. */
  function loadGame() {
    try {
      if (typeof localStorage === "undefined" || !localStorage) return false;
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return false;

      const eventOk = Object.create(null);
      (DATA.events || []).forEach((e) => { if (e && e.id) eventOk[e.id] = true; });
      const itemOk = Object.create(null);
      (DATA.equipment || DATA.equip_items || []).forEach((it) => { if (it && it.id) itemOk[it.id] = true; });

      const num = (v, d) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : d;
      };

      state.lifePrepped = !!data.lifePrepped;
      state.originId = (data.originId && originById[data.originId]) ? data.originId : null;
      state.year = Math.max(1, num(data.year, 1) | 0);
      state.age = Math.max(1, num(data.age, 10) | 0);
      state.lv = Math.max(1, num(data.lv, 1) | 0);
      state.xp = Math.max(0, num(data.xp, 0) | 0);
      state.xpToNext = Math.max(1, num(data.xpToNext, 10) | 0);
      {
        const base = defaultAttrs();
        const a = (data.attrs && typeof data.attrs === "object") ? data.attrs : {};
        state.attrs = {
          str: num(a.str, base.str) | 0,
          agi: num(a.agi, base.agi) | 0,
          intel: num(a.intel, base.intel) | 0,
          luck: num(a.luck, base.luck) | 0,
          lead: num(a.lead, base.lead) | 0,
          life: num(a.life, base.life) | 0,
        };
      }
      state.gold = Math.max(0, num(data.gold, 0) | 0);
      /* t324：讀檔跟舊值（可花光／歸零）；缺欄先用 SOUL_START。唔再 top-up ≥260 */
      state.soul = Math.max(0, num(data.soul, SOUL_START) | 0);
      state.fame = Math.max(0, num(data.fame, 0) | 0);
      state.teaShopBought = (Array.isArray(data.teaShopBought) ? data.teaShopBought : [])
        .filter((id) => typeof id === "string" && id);
      state.battlesThisLife = Math.max(0, num(data.battlesThisLife, 0) | 0);
      state.speed = normalizeBattleSpeed(num(data.battleSpeed, 1));

      const teamIn = Array.isArray(data.team) ? data.team : [];
      state.team = teamIn.filter((id) => id && fighterById[id]).slice(0, Math.max(TEAM_SIZE, 25));
      if (!state.team.length) {
        state.team = [...(DATA.default_team || [])].slice(0, TEAM_SIZE);
      }
      {
        const remembered = Array.isArray(data.lastWinDeploy) ? data.lastWinDeploy : [];
        state.lastWinDeploy = [];
        for (let i = 0; i < TEAM_SIZE; i++) {
          const id = remembered[i] || null;
          state.lastWinDeploy[i] = (id && fighterById[id]) ? id : null;
        }
      }

      const loadIn = (data.loadout && typeof data.loadout === "object") ? data.loadout : {};
      const nextLoad = {};
      Object.keys(loadIn).forEach((fid) => {
        if (!fighterById[fid]) return;
        const arr = Array.isArray(loadIn[fid]) ? loadIn[fid] : [];
        nextLoad[fid] = arr.map((sid) => (sid && skillById[sid] ? sid : null));
      });
      state.loadout = nextLoad;

      const initIn = (data.loadoutInited && typeof data.loadoutInited === "object") ? data.loadoutInited : {};
      const nextInit = {};
      Object.keys(initIn).forEach((fid) => {
        if (fighterById[fid] && initIn[fid]) nextInit[fid] = true;
      });
      state.loadoutInited = nextInit;

      if (Array.isArray(data.lifeSkills)) {
        state.lifeSkills = data.lifeSkills.filter((id) => id && skillById[id]);
      } else if (data.lifeSkills === null) {
        state.lifeSkills = null;
      }

      state.deadFighters = (Array.isArray(data.deadFighters) ? data.deadFighters : [])
        .filter((id) => id && fighterById[id]);
      state.burnedSkills = (Array.isArray(data.burnedSkills) ? data.burnedSkills : [])
        .filter((id) => id && skillById[id]);
      state.lifeWiped = !!data.lifeWiped;

      state.fatePicks = (Array.isArray(data.fatePicks) ? data.fatePicks : [])
        .filter((id) => id && fateById[id]);
      state.fateYearIndex = Math.max(0, Math.min(3, num(data.fateYearIndex, 0) | 0));
      state.fateOffer = (state.fateYearIndex | 0) < 3
        ? normalizeFateOffer(
            (Array.isArray(data.fateOffer) ? data.fateOffer : []).filter((id) => id && fateById[id])
          )
        : (Array.isArray(data.fateOffer) ? data.fateOffer : []).filter((id) => id && fateById[id]);
      {
        const b = (data.fateBattleBonus && typeof data.fateBattleBonus === "object")
          ? data.fateBattleBonus : {};
        state.fateBattleBonus = {
          atk: num(b.atk, 0) | 0,
          def: num(b.def, 0) | 0,
          hp: num(b.hp, 0) | 0,
        };
      }
      state.yearEventOffer = (Array.isArray(data.yearEventOffer) ? data.yearEventOffer : [])
        .filter((id) => id && eventOk[id]);
      state.yearEventYear = Math.max(0, num(data.yearEventYear, 0) | 0);
      state.softNote = typeof data.softNote === "string" ? data.softNote : "";
      state.lifeFlags = (data.lifeFlags && typeof data.lifeFlags === "object") ? data.lifeFlags : {};
      state.factions = (data.factions && typeof data.factions === "object") ? data.factions : {};
      state.factionChoiceResult = null;
      state.minigame = null;
      state.activeStoryPackId = (data.activeStoryPackId && storyPackById(data.activeStoryPackId))
        ? data.activeStoryPackId : null;
      /* 舊存檔若仍停留在舊預設（初入香江）而玩家未主動改過，跟隨新預設打工仔輓歌 */
      if (data.activeStoryPackId && data.storyPackUserPicked !== true
          && data.activeStoryPackId !== DEFAULT_STORY_PACK_ID
          && storyPackById(DEFAULT_STORY_PACK_ID)
          && storyPackById(DEFAULT_STORY_PACK_ID).status === "available") {
        state.activeStoryPackId = DEFAULT_STORY_PACK_ID;
      }

      if (data.cardCounts && typeof data.cardCounts === "object") state.cardCounts = { ...data.cardCounts };
      if (data.demoSeedVersion != null) state.demoSeedVersion = data.demoSeedVersion;
      if (data.fighterStars && typeof data.fighterStars === "object") state.fighterStars = { ...data.fighterStars };
      if (data.skillStars && typeof data.skillStars === "object") state.skillStars = { ...data.skillStars };
      if (data.fighterLevels && typeof data.fighterLevels === "object") state.fighterLevels = { ...data.fighterLevels };
      if (data.fighterXp && typeof data.fighterXp === "object") state.fighterXp = { ...data.fighterXp };
      if (data.equipStars && typeof data.equipStars === "object") state.equipStars = { ...data.equipStars };
      /* t390：殘頁（只保留合法卡 id、正整數） */
      if (data.cardShards && typeof data.cardShards === "object") {
        const sh = {};
        Object.keys(data.cardShards).forEach((cid) => {
          if (!fighterById[cid]) return;
          const n = Math.max(0, data.cardShards[cid] | 0);
          if (n > 0) sh[cid] = Math.min(999, n);
        });
        state.cardShards = sh;
      }
      if (data.accountGear && typeof data.accountGear === "object") {
        const g = {};
        ["head", "body", "main", "off", "charm", "feet"].forEach((slot) => {
          const iid = data.accountGear[slot];
          g[slot] = (iid && itemOk[iid]) ? iid : null;
        });
        state.accountGear = g;
      }
      if (data.accountStats && typeof data.accountStats === "object") {
        state.accountStats = {
          maxAgeReached: Math.max(0, num(data.accountStats.maxAgeReached, 0) | 0),
          equipStarsTotal: Math.max(0, num(data.accountStats.equipStarsTotal, 0) | 0),
        };
      }
      if (data.daily && typeof data.daily === "object") {
        try { state.daily = JSON.parse(JSON.stringify(data.daily)); } catch (_) { state.daily = null; }
      }

      if (data.pendingDefeat && typeof data.pendingDefeat === "object") {
        const pd = data.pendingDefeat;
        state.pendingDefeat = {
          eventId: typeof pd.eventId === "string" ? pd.eventId : null,
          eventName: typeof pd.eventName === "string" ? pd.eventName : "",
          enemyName: typeof pd.enemyName === "string" ? pd.enemyName : "",
          enemyArt: typeof pd.enemyArt === "string" ? pd.enemyArt : "",
          rewardBlurb: typeof pd.rewardBlurb === "string" ? pd.rewardBlurb : "",
          year: Math.max(1, num(pd.year, state.year) | 0),
        };
      } else {
        state.pendingDefeat = null;
      }
      if (data.lastResult && typeof data.lastResult === "object") {
        try { state.lastResult = JSON.parse(JSON.stringify(data.lastResult)); } catch (_) { state.lastResult = null; }
      } else {
        state.lastResult = null;
      }

      state.gachaPityRare = Math.max(0, num(data.gachaPityRare, 0) | 0);
      state.gachaPityEpic = Math.max(0, num(data.gachaPityEpic, 0) | 0);
      state.gachaResults = [];
      state.gachaReturnScreen = null;
      state.gachaReveal = false;
      state.gachaPhase = "idle";

      /* clear ephemeral UI／live battle object；pendingDefeat／lastResult 由閘處理 */
      state.battle = null;
      state.selectedEvent = null;
      state.deploy = [];
      state.deployHint = "";
      state.eventConfirmOpen = false;
      state.selectAllySlot = null;
      state.fighterDetailId = null;
      state.detailSkillPick = null;
      state.prepPickKind = null;
      state.prepPickQuery = "";
      state.prepGearFocusSlot = null;
      state.albumDetailId = null;
      state.albumDetailKind = null;
      state.equipFocus = null;
      state.equipSlot = null;
      /* screen set by boot: home if lifePrepped */

      return !!state.lifePrepped;
    } catch (_) {
      return false;
    }
  }

  function wirePersistOnHide() {
    const flush = () => { try { saveGame(); } catch (_) {} };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }

  /** 結算今世／放棄今世：重置今世進度返外層 hub（accountGear 保留） */
  function abandonLife() {
    /*
     * t379：膠幣結算透明化（總導演：「統一放棄／結束分支同主存檔嘅膠幣結算，唔好隱形回滾」）。
     *
     * 原本：abandonLife() 直接 `state.soul = SOUL_START` → 今世賺到嘅膠幣**無聲消失**，
     * 玩家只會見到個數字突然變返 260，完全唔知發生咩事。
     * 現在：先計出「今世淨賺」並寫入 `state.lastSoulSettle`，
     * 由 UI 喺放棄前／結算頁明確顯示，然後才重置。
     */
    const soulNow = Math.max(0, state.soul | 0);
    state.lastSoulSettle = {
      before: soulNow,
      after: SOUL_START,
      delta: SOUL_START - soulNow,
      at: Date.now(),
    };
    state.year = 1;
    state.age = 10;
    state.lv = 1;
    state.xp = 0;
    state.xpToNext = 10;
    state.attrs = defaultAttrs();
    state.gold = 0;
    state.soul = SOUL_START;
    state.battlesThisLife = 0;
    state.selectedEvent = null;
    state.yearEventOffer = [];
    state.yearEventYear = 0;
    state.softNote = "";
    state.lifeFlags = {};
    state.factions = {};
    state.factionChoiceResult = null;
    state.minigame = null;
    state.battle = null;
    state.lastResult = null;
    state.pendingDefeat = null;
    state.lifePrepped = false;
    state.originId = null;
    state.fatePicks = [];
    state.fateYearIndex = 0;
    state.fateOffer = [];
    state.fateBattleBonus = { atk: 0, def: 0, hp: 0 };
    state.deploy = [];
    state.deployHint = "";
    state.lastWinDeploy = [];
    state.battleFieldSnapshot = null;
    state.cardGift = null;
    state.eventConfirmOpen = false;
    state.selectAllySlot = null;
    state.fighterDetailId = null;
    state.detailSkillPick = null;
    state.team = [...(DATA.default_team || [])].slice(0, TEAM_SIZE);
    state.loadout = {};
    state.loadoutInited = {};
    state.lifeSkills = null; /* 下世 ensureLifeSkills 再由已擁有技能種子 */
    state.prepPickKind = null;
    state.prepPickQuery = "";
    state.prepGearFocusSlot = null;
    state.deadFighters = [];
    state.burnedSkills = [];
    state.lifeWiped = false;
    state.equipFocus = null;
    state.equipSlot = null;
    /* accountGear persists — 同「清晒」 */
    ensureLifeSkills();
    ensureDefaultLoadout(true);
    state.screen = "home";
    saveGame(); /* lifePrepped false — Continue 不可用；account 仍保留 */
    render();
  }

  function endLife() {
    abandonLife();
  }

  /**
   * t379：放棄今世確認 —— 明確列出膠幣會點變，唔好靜靜清走。
   * 同時顯示今世淨賺，令玩家知道自己放低咗幾多。
   */
  function requestAbandonLife() {
    const soulNow = Math.max(0, state.soul | 0);
    const delta = SOUL_START - soulNow;
    const deltaTxt = delta > 0 ? `+${delta}` : (delta < 0 ? String(delta) : "±0");
    const msg =
      "確定放棄今世？\n\n" +
      `．今世膠幣：${soulNow} → 新一世 ${SOUL_START}（${deltaTxt}）\n` +
      "．戰鬥卡、技能、裝備收藏（卡冊）會保留\n" +
      "．今世進度（年份、六維、事件、勢力好感）會重置\n\n" +
      "放棄後會返主頁 hub。";
    if (!confirm(msg)) return;
    abandonLife();
  }

  const $ = (sel, el = document) => el.querySelector(sel);
  const screenEl = () => document.getElementById("screen");

  function fighterHp(f) {
    return (f.slots || 4) * 20 + 40;
  }

  /**
   * t368：敵方跟年加乘（改為「先陡後緩」）。
   *
   * 問題：玩家攻擊力在 Lv5★5 後永遠封頂（約 38 點），完全唔再成長；
   * 而敵方原本線性 += 0.065/年 無限上升 → 第 28 年（37 歲）必然打唔贏，
   * 實測 100% 死於全軍覆沒，中位數只有 25 歲，永遠去唔到 70／100 歲。
   *
   * 修法：改用「飽和曲線」——前期成長快（保持壓力），後期趨平（追得上玩家上限）。
   *   mult = 1 + GROWTH * (1 - e^(-(year-1)/K))
   *   - 前 10 年仍接近線性（玩家仍有升級空間）
   *   - 20 年後明顯放緩
   *   - 最終上限 = 1 + ENEMY_GROWTH_CAP（唔會無限升）
   */
  const ENEMY_GROWTH_CAP = 1.35;   // 最終額外倍率上限（mult 最多 2.35）
  const ENEMY_GROWTH_K = 14;       // 時間常數：越大越平緩

  /**
   * 宿敵倍率：1.35 → 1.05（t365 實測調校，每點 20 次平均）
   * 宿敵年本身已是高難事件，額外加成只需輕微。
   */
  const ENEMY_SPECIAL_MULT = 1.05;

  function enemyScaleMult() {
    const year = Math.max(1, (state.year | 0) || 1);
    const t = year - 1;
    // 飽和曲線：前期近似線性，後期趨於上限
    let m = 1 + ENEMY_GROWTH_CAP * (1 - Math.exp(-t / ENEMY_GROWTH_K));
    const ev = state.selectedEvent;
    if (ev && ev.category === "special_battle") m *= ENEMY_SPECIAL_MULT;
    return m;
  }

  /** 敵方出戰卡：一律由戰鬥卡池抽（同玩家共用同一批卡） */
  function enemyFighterPool() {
    /* t391：敵方亦唔會用殘頁專屬卡（保持稀有性） */
    const all = poolFighters();
    const withArt = all.filter((f) => f.art && !String(f.art).includes("pending-manus"));
    return withArt.length >= TEAM_SIZE ? withArt : all;
  }

  const ENEMY_RARITY_RANK = { 普通: 1, 稀有: 2, 史詩: 3, 最高級: 4 };

  /**
   * 敵方指定名單（仍然係卡池卡）：enemy 定義可帶 `lineup: [卡id…]`。
   * 主題戰鬥（例如招牌拆遷）用得到嘅卡，唔會變成年份隨機抽到一堆無關嘅普通卡。
   */
  function enemyLineupCards(primary) {
    const ids = (primary && Array.isArray(primary.lineup)) ? primary.lineup : [];
    if (!ids.length) return [];
    const inTeam = new Set(state.team || []);
    const out = [];
    ids.forEach((id) => {
      const f = fighterById[id];
      // 唔好出「自己打自己」：玩家口袋內的卡不入敵方指定名單
      if (f && !inTeam.has(id) && out.length < TEAM_SIZE) out.push(f);
    });
    return out;
  }

  /** 依年份調整敵方卡池強度；優先配合敵人主題標籤，並避開玩家口袋 */
  function pickEnemyFighterLineup(primary) {
    const fixed = enemyLineupCards(primary);
    if (fixed.length >= TEAM_SIZE) return fixed;

    const pool = enemyFighterPool();
    if (!pool.length) return fixed;
    const year = Math.max(1, state.year | 0);
    const maxRank = year <= 4 ? 1 : year <= 8 ? 2 : year <= 14 ? 3 : 4;
    const inTeam = new Set(state.team || []);
    const rankOf = (f) => ENEMY_RARITY_RANK[f.rarity] || 1;

    let cands = pool.filter((f) => rankOf(f) <= maxRank && !inTeam.has(f.id));
    if (cands.length < TEAM_SIZE) cands = pool.filter((f) => rankOf(f) <= maxRank);
    if (cands.length < TEAM_SIZE) cands = pool.filter((f) => !inTeam.has(f.id));
    if (cands.length < TEAM_SIZE) cands = pool.slice();

    const tags = new Set(((primary && primary.tags) || []).concat(primary && primary.event_type ? [primary.event_type] : []));
    const taken = new Set(fixed.map((f) => f.id));
    const scored = cands
      .filter((f) => !taken.has(f.id))
      .map((f) => {
        const own = (f.tags || []).filter((t) => tags.has(t)).length;
        return { f, score: own * 10 + Math.random() * 6 };
      });
    scored.sort((a, b) => b.score - a.score);
    const need = Math.max(0, TEAM_SIZE - fixed.length);
    return fixed.concat(scored.slice(0, need).map((x) => x.f));
  }

  /** 同一場遇敵的敵方名單快取：確認視窗、編隊預覽、實際開打都用同一組 */
  function encounterEnemyRoster(ev) {
    if (!ev || !ev.battle) return [];
    const key = (ev.id || "") + "|" + (ev.battle || "") + "|" + (state.year | 0) + "|" + (state.age | 0);
    if (state.enemyRosterKey === key && Array.isArray(state.enemyRosterCache) && state.enemyRosterCache.length) {
      // 回傳副本，避免預覽改動影響開打
      return state.enemyRosterCache.map((u) => Object.assign({}, u, { statuses: [], hp: u.maxHp }));
    }
    const roster = buildEnemyRoster(ev.battle);
    state.enemyRosterKey = key;
    state.enemyRosterCache = roster.map((u) => Object.assign({}, u));
    return roster.map((u) => Object.assign({}, u, { statuses: [], hp: u.maxHp }));
  }

  /** Demo encounter roster：敵方直接由戰鬥卡池出戰，數值跟年份縮放。 */
  /**
   * t365：敵方防禦常數。
   * 修 P0 不公平：敵方單位一直冇 def／mdef 欄位，而 calcDamage 會讀
   * `(target.def|0)||0` → 敵方永遠 0 防、玩家白扣 10–14 點，
   * 令第 1 年敵方 10 攻只打出 1 傷（減傷 90%）。
   * 現在敵方同玩家一樣有物防／魔防，並隨年份溫和成長。
   */
  const ENEMY_DEF_BASE = 7;          // 第 1 年基礎防
  const ENEMY_DEF_CAP = 18;          // t368：防禦上限（原本無上限，第 60 年會升到 37，
                                     //         令玩家固定 37 攻擊力完全打唔穿）
  const ENEMY_DEF_PER_YEAR = 0.5;    // 每年 +0.5

  /**
   * t365：敵方攻擊整體係數。
   * 敵方卡池 atk 只有 8–16（與玩家卡同源），但玩家有 力量12＋裝備攻＋Lv＋★ 疊加，
   * 玩家防禦亦會由裝備升到 19。結果敵方 raw atk 28 對上防 19 只打出 9 傷（32%），
   * 後期反而唔痛。這裡給敵方一個攻擊係數補回差距。
   */
  const ENEMY_ATK_SCALE = 0.85;

  /**
   * t365：敵方攻擊下限補償。
   * 玩家防禦幾乎唔成長（agi 固定 10 → 物防 10），而 calcDamage 係「每點防減 1 傷，下限 1」，
   * 所以敵方低攻時會被完全吃掉：第 1 年敵攻 10–11 對玩家防 10 → 只打出 1 傷（保留 10%）。
   * 這令「新手無敵」——不是因為數值高，而是因為減傷公式喺低攻區吃掉一切。
   *
   * 補償設計：只在早期補，且隨年份遞減（玩家防禦靠裝備補回時就唔需要）。
   * 曲線：第 1 年 +6、第 5 年 +4.2、第 10 年 +2、第 15 年後 0
   */
  const ENEMY_ATK_PIERCE_BASE = 5;
  const ENEMY_ATK_PIERCE_DECAY = 0.4; // 每年遞減

  function enemyAtkPierce() {
    const year = Math.max(1, (state.year | 0) || 1);
    return Math.max(0, ENEMY_ATK_PIERCE_BASE - (year - 1) * ENEMY_ATK_PIERCE_DECAY);
  }

  function enemyDefenceValue() {
    const year = Math.max(1, (state.year | 0) || 1);
    // t368：改用飽和曲線並加上硬上限，避免後期防禦高過玩家攻擊力
    const raw = ENEMY_DEF_BASE + (year - 1) * ENEMY_DEF_PER_YEAR;
    const soft = ENEMY_DEF_BASE + (ENEMY_DEF_CAP - ENEMY_DEF_BASE) * (1 - Math.exp(-(year - 1) / 18));
    return Math.max(0, Math.round(Math.min(raw, soft, ENEMY_DEF_CAP)));
  }

  function buildEnemyRoster(primaryId) {
    const primary = enemyById[primaryId];
    if (!primary) return [];

    const lineup = pickEnemyFighterLineup(primary);
    const mult = enemyScaleMult();
    // 敵方用卡池卡，數值略收（唔好高過同等玩家卡太多）
    const statScale = mult * 0.92;
    const defence = enemyDefenceValue();
    const pierce = enemyAtkPierce();

    return lineup.map((f, idx) => {
      const hp = Math.max(1, Math.round(fighterHp(f) * statScale));
      // t365：加上攻擊係數與穿透補償，避免低年份被玩家固定防禦完全吃掉
      const atk = Math.max(1, Math.round(((f.atk | 0) || 10) * statScale * ENEMY_ATK_SCALE + pierce));
      const spd = Math.max(
        1,
        Math.round(((f.spd | 0) || 10) * (1 + Math.max(0, ((state.year | 0) - 1) * 0.02)))
      );
      return {
        side: "enemy",
        id: primaryId + "_" + f.id + "_" + idx,
        defId: f.id,
        name: f.name,
        atk,
        spd,
        def: defence,
        mdef: defence,
        basic: f.basic || "首擊",
        skill: f.skill || "自帶技",
        skill_cd: f.skill_cd || 4,
        skill_effect: f.skill_effect || "",
        art: f.art,
        basic_power: fighterBasicPower(f),
        // 技能結算規格：跟玩家同一套（群攻／治療／斬殺都會生效）
        dmg_mult: f.dmg_mult,
        hits: f.hits,
        target: f.target,
        power: f.power,
        splash_mult: f.splash_mult,
        heal_mult: f.heal_mult,
        support: f.support,
        passive: f.passive,
        execute_hp_pct: f.execute_hp_pct,
        execute_mult: f.execute_mult,
        hit_scales: f.hit_scales,
        tags: f.tags || [],
        rarity: f.rarity || "",
        rarity_slang: f.rarity_slang || "",
        flavor: f.flavor || f.blurb || "",
        maxHp: hp,
        hp,
        turnsTaken: 0,
        skillCursor: 0,
        statuses: [],
        alive: true,
        _scaleMult: mult,
      };
    });
  }

  function pickLowestHp(units) {
    const alive = units.filter((u) => u.alive);
    if (!alive.length) return null;
    alive.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.spd - c.spd);
    return alive[0];
  }


  /* ---------- Battle status (buff / debuff) ---------- */
  const STATUS_DEFS = {
    atk_up:   { key: "atk_up",   name: "攻↑", icon: "⚔", kind: "buff",   turns: 2 },
    atk_down: { key: "atk_down", name: "攻↓", icon: "⬇", kind: "debuff", turns: 2 },
    spd_up:   { key: "spd_up",   name: "速↑", icon: "💨", kind: "buff",   turns: 2 },
    spd_down: { key: "spd_down", name: "速↓", icon: "🐌", kind: "debuff", turns: 2 },
    shield:   { key: "shield",   name: "護",  icon: "🛡", kind: "buff",   turns: 1 },
    stun:     { key: "stun",     name: "暈",  icon: "💫", kind: "debuff", turns: 1 },
    regen:    { key: "regen",    name: "癒",  icon: "💚", kind: "buff",   turns: 2 },
    oil:      { key: "oil",      name: "油",  icon: "🛢", kind: "debuff", turns: 2 },
  };

  function ensureStatuses(u) {
    if (!u) return [];
    if (!Array.isArray(u.statuses)) u.statuses = [];
    return u.statuses;
  }

  function applyStatus(unit, key, turnsOverride) {
    if (!unit || !unit.alive) return;
    const def = STATUS_DEFS[key];
    if (!def) return;
    const turns = turnsOverride != null ? turnsOverride : def.turns;
    ensureStatuses(unit);
    const existing = unit.statuses.find((s) => s.key === key);
    if (existing) {
      existing.turns = Math.max(existing.turns || 0, turns);
      existing.stacks = (existing.stacks || 1) + 1;
    } else {
      unit.statuses.push({
        id: key + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        key: def.key,
        name: def.name,
        icon: def.icon,
        kind: def.kind,
        turns,
        stacks: 1,
      });
    }
  }

  function hasStatus(unit, key) {
    return !!(unit && unit.statuses && unit.statuses.some((s) => s.key === key && s.turns > 0));
  }

  function removeStatus(unit, key) {
    if (!unit || !unit.statuses) return;
    unit.statuses = unit.statuses.filter((s) => s.key !== key);
  }

  function effectiveSpd(u) {
    let s = u.spd || 1;
    if (hasStatus(u, "spd_up")) s += 2;
    if (hasStatus(u, "spd_down")) s = Math.max(1, s - 2);
    return s;
  }

  function calcDamage(attacker, target, baseDmg, power) {
    let dmg = baseDmg;
    if (hasStatus(attacker, "atk_up")) dmg = Math.round(dmg * 1.15);
    if (hasStatus(attacker, "atk_down")) dmg = Math.round(dmg * 0.85);
    if (hasStatus(target, "shield")) dmg = Math.round(dmg * 0.7);
    if (hasStatus(target, "oil")) dmg = Math.round(dmg * 1.1);
    // 物防／魔防：每點減 1 傷；魔攻技扣 mdef，其餘扣 def
    const flatDef =
      power === "magic"
        ? (target && (target.mdef | 0)) || 0
        : (target && (target.def | 0)) || 0;
    /*
     * t365：防禦減傷上限 75%。
     * 原本純 flat「每點防減 1 傷、下限 1」有結構缺陷：
     * 低倍率技能（例如 dmg_mult 0.7）在低攻單位手上，經防御後必然見底變 1 傷，
     * 令敵方技能普攻都只打 1 點（實測：敵攻 15 × 0.7 = 10，減玩家防 10 → 0 → 下限 1）。
     * 現在防禦最多減掉 75%，保證至少 25% 穿透，雙方都唔會被「完全免疫」。
     */
    const maxReduction = Math.floor(dmg * 0.75);
    const reduction = Math.min(flatDef, maxReduction);
    dmg = dmg - reduction;
    return Math.max(1, dmg);
  }

  function statusRowHtml(u, sidePrefix) {
    const list = (u.statuses || []).filter((s) => s.turns > 0);
    const icons = list
      .map(
        (s) =>
          `<span class="st-icon ${esc(s.kind)}" title="${esc(s.name)}（剩 ${s.turns} 回合）">${s.icon}<i class="st-turns">${s.turns}</i></span>`
      )
      .join("");
    return `<div class="status-row" id="st-${sidePrefix}-${esc(u.id)}">${icons}</div>`;
  }

  function renderStatusRowInto(row, u) {
    if (!row) return;
    const list = (u.statuses || []).filter((s) => s.turns > 0);
    row.innerHTML = list
      .map(
        (s) =>
          `<span class="st-icon ${esc(s.kind)}" title="${esc(s.name)}（剩 ${s.turns} 回合）">${s.icon}<i class="st-turns">${s.turns}</i></span>`
      )
      .join("");
  }

  function updateStatusRows() {
    const b = state.battle;
    if (!b || state.screen !== "battle") return;
    b.enemies.forEach((e) => {
      renderStatusRowInto(document.getElementById("st-e-" + e.id), e);
    });
    b.players.forEach((p) => {
      renderStatusRowInto(document.getElementById("st-p-" + p.id), p);
    });
  }

  function tickStatusesAtTurnStart() {
    const b = state.battle;
    if (!b) return;
    [...b.players, ...b.enemies].forEach((u) => {
      if (!u.alive) return;
      ensureStatuses(u);
      if (hasStatus(u, "regen")) {
        const heal = Math.max(1, Math.round(u.maxHp * 0.08));
        u.hp = Math.min(u.maxHp, u.hp + heal);
      }
      u.statuses = u.statuses
        .map((s) => Object.assign({}, s, { turns: (s.turns || 0) - 1 }))
        .filter((s) => s.turns > 0);
    });
  }

  function inferStatusMaps(text) {
    const t = String(text || "");
    const out = [];
    if (/防護|減傷|萬年船|護盾/.test(t)) out.push({ key: "shield", target: "self" });
    if (/回復|開心|治療|回血|癒合/.test(t)) out.push({ key: "regen", target: "self" });
    if (/出餐|成隊.*攻|全隊.*攻|攻＋|攻\+/.test(t)) {
      out.push({ key: "atk_up", target: /成隊|全體|全隊|全檯/.test(t) ? "ally" : "self" });
    }
    if (/機動|速＋|速\+|出餐/.test(t) && !/速−|速\-/.test(t)) {
      out.push({ key: "spd_up", target: /成隊|全體|全隊|全檯/.test(t) ? "ally" : "self" });
    }
    if (/椒鹽|速−|速\-|減速/.test(t)) out.push({ key: "spd_down", target: "enemies" });
    if (/暈|Miss.*代價|Miss 則自己暈/.test(t)) out.push({ key: "stun", target: "self" });
    if (/油星|抹油|群攻|群傷/.test(t)) out.push({ key: "oil", target: "enemies" });
    if (/命中率/.test(t) && /敵/.test(t)) out.push({ key: "atk_down", target: "enemies" });
    return out;
  }

  function applyMappedStatuses(actor, target, mappings) {
    const b = state.battle;
    if (!b || !mappings || !mappings.length) return;
    const allies = actor.side === "player" ? b.players : b.enemies;
    const foes = actor.side === "player" ? b.enemies : b.players;
    mappings.forEach((m) => {
      const applyOne = (u) => {
        applyStatus(u, m.key, m.turns);
        if (m.key === "regen" && u.alive) {
          const heal = Math.max(1, Math.round(u.maxHp * 0.08));
          u.hp = Math.min(u.maxHp, u.hp + heal);
        }
      };
      if (m.target === "self") applyOne(actor);
      else if (m.target === "ally") allies.filter((u) => u.alive).forEach(applyOne);
      else if (m.target === "enemy" && target) applyOne(target);
      else if (m.target === "enemies") foes.filter((u) => u.alive).forEach(applyOne);
    });
  }

  function applySkillStatuses(actor, target, moveName, useSkill, effectText) {
    if (!useSkill || !actor) return;
    const text = (effectText || "") + " " + (moveName || "");
    let mappings = inferStatusMaps(text);
    if (!mappings.length) {
      // 純傷招：令狀態常出現 — 目標攻↓ 1 回
      if (target && target.alive && Math.random() < 0.6) {
        applyStatus(target, "atk_down", 1);
      }
    } else {
      applyMappedStatuses(actor, target, mappings);
    }
    // 敵方放 skill 偶發玩家 debuff（demo 要見到狀態圖）
    if (actor.side === "enemy") {
      const victim = target && target.alive ? target : pickLowestHp(state.battle.players);
      if (victim && Math.random() < 0.7) {
        applyStatus(victim, Math.random() < 0.5 ? "spd_down" : "atk_down", 2);
      }
    }
  }

  function statusesInspectHtml(unit) {
    const list = (unit.statuses || []).filter((s) => s.turns > 0);
    if (!list.length) return "";
    const items = list
      .map(
        (s) =>
          `<span class="ci-st ${esc(s.kind)}" title="${esc(s.name)}">${s.icon} ${esc(s.name)} · ${s.turns}回</span>`
      )
      .join("");
    return `<div class="ci-section"><div class="ci-label">狀態</div><div class="ci-statuses">${items}</div></div>`;
  }

  const BATTLE_LP_MS = 420;

  function wireBattleInspect(el, getUnit) {
    if (!el || el.dataset.battleInspectBound === "1") return;
    el.dataset.battleInspectBound = "1";
    let timer = null;
    let armed = false;
    let shown = false;
    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    el.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      armed = true;
      shown = false;
      clearTimer();
      timer = setTimeout(() => {
        if (!armed) return;
        shown = true;
        helpBlockClickUntil = Date.now() + 450;
        const unit = typeof getUnit === "function" ? getUnit() : getUnit;
        if (unit) openCardInspect(unit);
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (_) {}
      }, BATTLE_LP_MS);
    });
    const endPress = (ev) => {
      clearTimer();
      if (shown) {
        helpBlockClickUntil = Date.now() + 450;
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }
      armed = false;
      shown = false;
    };
    el.addEventListener("pointerup", endPress);
    el.addEventListener("pointercancel", endPress);
    el.addEventListener("pointerleave", () => {
      clearTimer();
      armed = false;
    });
    el.addEventListener("click", (ev) => {
      /*
       * t399：短點卡牌即開說明並暫停戰鬥（總導演要求）。
       *
       * 舊行為：`// 短點唔開 inspect，避免誤觸` —— 只有長按（BATTLE_LP_MS）才開，
       * 玩家幾乎唔知可以睇卡，實戰中亦無時間長按。
       *
       * 新行為：短點即開。戰鬥會暫停（openCardInspect 內 pauseBattle），
       * 點卡牌以外空白位置即恢復（overlay 的 click → closeCardInspect → resumeBattle）。
       *
       * 仍然保留「長按後 450ms 內抑制 click」，避免長按再觸發一次。
       */
      if (Date.now() < helpBlockClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      const unit = typeof getUnit === "function" ? getUnit() : getUnit;
      if (unit) openCardInspect(unit);
    });
    el.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        const unit = typeof getUnit === "function" ? getUnit() : getUnit;
        if (unit) openCardInspect(unit);
      }
    });
  }



  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }



  /* ---------- Card help-text builders (長按真實內容) ---------- */
  function helpTextAttr(s) {
    return esc(s == null ? "" : String(s)).replace(/\n/g, "&#10;");
  }

  function fighterHelpText(f, opts) {
    opts = opts || {};
    if (!f) return opts.empty || "＋揀出戰卡";
    if (opts.dead || (opts.checkDead && isDeadFighter(f.id))) {
      return `「${f.name || ""}」\n陣亡——今世不可再部署；當時技能一併陪葬。`;
    }
    const bits = [`攻${f.atk ?? "?"}`, `速${f.spd ?? "?"}`];
    if (f.hp != null) bits.push(`血${f.hp}`);
    if (f.def != null) bits.push(`防${f.def}`);
    if (opts.preview) {
      const pv = opts.preview;
      bits.length = 0;
      bits.push(`攻${pv.atk ?? "?"}`, `速${pv.spd ?? "?"}`, `血${pv.hp ?? "?"}`);
      if (pv.def != null) bits.push(`物防${pv.def}`);
      if (pv.matk != null) bits.push(`魔攻${pv.matk}`);
    }
    const tags = (f.tags || []).join("、") || "";
    const rare = f.rarity_slang || f.rarity || "?";
    const blurb = f.flavor || f.blurb || "";
    const lv = (opts.preview && opts.preview.level) ? opts.preview.level : fighterLevelOf(f.id);
    const star = albumFighterStar(f.id);
    const lines = [`「${f.name || ""}」`, `Lv.${lv}｜★${star}｜${rare}｜${bits.join(" ")}`];
    if (opts.preview && ((opts.preview.growAtk | 0) || (opts.preview.growHp | 0))) {
      lines.push(`成長加成：攻+${opts.preview.growAtk | 0} 血+${opts.preview.growHp | 0}（等級＋升星可疊加）`);
    }
    if (tags) lines.push(`主題：${tags}`);
    if (f.basic) lines.push(`普攻：${f.basic}（${basicPowerParenLabel(f)}）`);
    if (f.skill) {
      // 卡冊／長按：攻擊型自帶加（物／魔），與出戰「自帶・物／魔」語義一致；純輔助唔加括號
      const innTag = innatePowerTagLabel(f);
      const innateParen =
        innTag === "自帶・魔" ? "（魔）" : innTag === "自帶・物" ? "（物）" : "";
      lines.push(`自帶：${f.skill}${innateParen}${f.skill_effect ? "——" + f.skill_effect : ""}`);
    }
    if (blurb) lines.push(blurb);
    return lines.join("\n");
  }

  function skillHelpText(sk, opts) {
    opts = opts || {};
    if (!sk) return opts.empty || "＋裝技能";
    if (opts.burned || (opts.checkBurned && isBurnedSkill(sk.id))) {
      return `「${sk.name || ""}」\n已陪葬／陣亡帶走——今世不可再裝備。`;
    }
    const blurb = sk.blurb || sk.flavor || "";
    const kind = sk.kind || "招式";
    const cd = sk.cd == null ? "?" : sk.cd;
    const lines = [`「${sk.name || ""}」`, `${kind}｜CD ${cd}`];
    if (sk.effect) lines.push(`效果：${sk.effect}`);
    const summary = skillCombatSummary(sk);
    if (summary) lines.push(`結算：${summary}`);
    if (blurb) lines.push(blurb);
    return lines.join("\n");
  }

  /**
   * t364：裝備說明大幅擴充。
   * 改前只有 4 行（名／稀有度+星／四項數值／一句 flavor），玩家睇唔出：
   * 邊個槽、加乘係全隊定個人、升星實際加幾多、同邊個主題卡配、有幾多張同名卡。
   * 現在分「基本資料 / 數值（含升星預覽）/ 同名卡 / 主題 / 說明」五段。
   */
  function equipHelpText(item, slotMeta) {
    if (!item) {
      const label = (slotMeta && slotMeta.label) || "裝備槽";
      const hint = (slotMeta && slotMeta.hint) || "";
      return hint ? `${label}——${hint}` : `${label}——點選槽位循環裝／卸`;
    }
    const eff = effectiveEquipStats(item);
    const star = equipStarOf(item);
    const maxStar = Number(item.max_star) || 5;
    const slot = GEAR_SLOTS.find((s) => s.id === (item.slot || (slotMeta && slotMeta.id)));
    const slotLabel = (slot && slot.label) || (slotMeta && slotMeta.label) || "—";
    const rare = rarityEquipLabel(item.rarity) || "—";
    const count = albumCardCount(item.id);
    const starTxt = "★".repeat(star) + "☆".repeat(Math.max(0, maxStar - star));

    const lines = [`「${item.name || ""}」`];
    lines.push(`${rare}｜${slotLabel}槽｜${starTxt}`);

    // 數值：底數 vs 目前（升星後）＋ 全隊加乘說明
    const base = { atk: item.atk | 0, def: item.def | 0, hp: item.hp | 0, spd: item.spd | 0 };
    const bit = (k, label) => {
      const b = base[k];
      const e = eff[k];
      if (!b && !e) return "";
      return e !== b ? `${label}+${e}（底 ${b}）` : `${label}+${e}`;
    };
    const stats = [bit("atk", "攻"), bit("def", "防"), bit("hp", "血"), bit("spd", "速")].filter(Boolean);
    lines.push(stats.length ? `目前：${stats.join(" · ")}（全隊）` : "目前：尚未提供加乘");

    // 升星預覽
    const bonus = item.star_bonus_per_level || {};
    const perStar = ["atk", "def", "hp", "spd"]
      .filter((k) => (bonus[k] | 0) > 0)
      .map((k) => `${({ atk: "攻", def: "防", hp: "血", spd: "速" })[k]}＋${bonus[k] | 0}`);
    if (star < maxStar) {
      lines.push(`每升 1 星：${perStar.length ? perStar.join(" · ") : "—"}｜下一星需同名卡 ${albumStarNeed(star)} 張（現有 ${count}）`);
    } else {
      lines.push(`已滿星 ★${maxStar}｜每星成長：${perStar.length ? perStar.join(" · ") : "—"}`);
    }

    // 主題配對
    const tagName = equipTagLabel(item.tag_boost);
    if (tagName) lines.push(`主題：${tagName}（裝備加乘本身不分卡種，全隊生效）`);

    const blurb = item.flavor || item.blurb || "";
    if (blurb) lines.push(blurb);
    return lines.join("\n");
  }

  /**
   * t364：裝備 rich 說明（長按／卡冊用）。
   * 純文字版仍然保留（toast／aria 用），但玩家實際睇到的係這個結構化版本：
   * 標題 → 稀有度／槽／星 → 數值表（底數 → 現在）→ 升星成長 → 同名卡進度 → 主題 → flavor。
   */
  function equipHelpRichHtml(item, slotMeta) {
    if (!item) return null;
    const eff = effectiveEquipStats(item);
    const base = { atk: item.atk | 0, def: item.def | 0, hp: item.hp | 0, spd: item.spd | 0 };
    const star = equipStarOf(item);
    const maxStar = Number(item.max_star) || 5;
    const slot = GEAR_SLOTS.find((s) => s.id === (item.slot || (slotMeta && slotMeta.id)));
    const slotLabel = (slot && slot.label) || (slotMeta && slotMeta.label) || "—";
    const rare = rangeLabelSafe(item.rarity);
    const count = albumCardCount(item.id);
    const need = albumStarNeed(star);
    const canUp = star < maxStar && count >= need;

    const head = [
      `<div class="ht-title">「${esc(item.name || "")}」</div>`,
      `<div class="ht-line">${esc(rare)}｜${esc(slotLabel)}槽｜全隊加乘</div>`,
      `<div class="ht-line ht-eq-starrow">${"★".repeat(star)}<span class="ht-eq-stardim">${"★".repeat(Math.max(0, maxStar - star))}</span> <span class="ht-eq-starnum">${star}／${maxStar}</span></div>`,
    ];

    // 數值表：底數 vs 現值
    const rows = [["攻", "atk"], ["防", "def"], ["血", "hp"], ["速", "spd"]]
      .filter(([, k]) => base[k] || eff[k])
      .map(([label, k]) => {
        const b = base[k];
        const e = eff[k];
        const grow = e - b;
        return `<span class="ht-eq-stat"><b>${label}</b>${e}${grow > 0 ? `<i>（底 ${b} · 升星 +${grow}）</i>` : ""}</span>`;
      });
    if (rows.length) head.push(`<div class="ht-eq-stats">${rows.join("")}</div>`);

    // 升星成長
    const bonus = item.star_bonus_per_level || {};
    const perStar = [["攻", "atk"], ["防", "def"], ["血", "hp"], ["速", "spd"]]
      .filter(([, k]) => (bonus[k] | 0) > 0)
      .map(([label, k]) => `${label}＋${bonus[k] | 0}`)
      .join(" · ");
    const starLine = star >= maxStar
      ? `已滿星 ★${maxStar}｜每星成長：${perStar || "—"}`
      : `每升 1 星：${perStar || "—"}｜下一星需同名卡 ${need} 張（現有 ${count}${canUp ? " · 可升" : ""}）`;
    head.push(`<div class="ht-line">${esc(starLine)}</div>`);

    const tagName = equipTagLabel(item.tag_boost);
    if (tagName) head.push(`<div class="ht-line">主題：${esc(tagName)}（加乘不分卡種，全隊生效）</div>`);

    const blurb = item.flavor || item.blurb || "";
    const flavor = blurb ? `<div class="ht-flavor">${esc(blurb)}</div>` : "";
    return `<div class="ht-rich">${head.join("")}${flavor}</div>`;
  }

  function rangeLabelSafe(r) {
    return rarityLabelAny(r) || "—";
  }

  function enemyHelpPayloadAttr(e) {
    if (!e) return "";
    const def = enemyUnitDef(e) || e;
    const payload = {
      id: e.id,
      defId: e.defId || e.id || def.id,
      name: e.name || def.name,
      atk: e.atk != null ? e.atk : def.atk,
      spd: e.spd != null ? e.spd : def.spd,
      hp: e.maxHp != null ? e.maxHp : (e.hp != null ? e.hp : def.hp),
      maxHp: e.maxHp != null ? e.maxHp : undefined,
      basic: e.basic || def.basic,
      skill: e.skill || def.skill,
      skill_cd: e.skill_cd != null ? e.skill_cd : def.skill_cd,
      skill_effect: e.skill_effect || def.skill_effect || "",
      art: e.art || def.art,
      flavor: e.flavor,
      blurb: e.blurb,
    };
    return esc(JSON.stringify(payload));
  }

  function enemyHelpText(e) {
    if (!e) return "敵方卡";
    const def = enemyUnitDef(e) || e;
    const name = e.name || def.name || "敵方";
    const atk = e.atk != null ? e.atk : def.atk;
    const spd = e.spd != null ? e.spd : def.spd;
    const hp = e.maxHp != null ? e.maxHp : (e.hp != null ? e.hp : def.hp);
    const basic = e.basic || def.basic || "首通";
    const skill = e.skill || def.skill || "自帶技";
    const skillCd = e.skill_cd || def.skill_cd || 3;
    const skillEffect = def.skill_effect || e.skill_effect || "";
    const flavor =
      def.flavor ||
      def.blurb ||
      def.notes ||
      e.flavor ||
      e.blurb ||
      "後巷殘影——一擊就要記低。";
    const rare = def.rarity_slang || def.rarity || "敵方";
    const lines = [
      `「${name}」`,
      `${rare}｜攻${atk ?? "?"} 速${spd ?? "?"} 血${hp ?? "?"}`,
      `普攻：${basic}（${basicPowerParenLabel({ basic_power: e.basic_power != null ? e.basic_power : def.basic_power })}）`,
      `自帶：${skill} · CD${skillCd}${skillEffect ? "\n效果：" + skillEffect : ""}`,
      flavor,
    ];
    return lines.join("\n");
  }

  /* ---------- Long-press formal help + forfeit ---------- */

  const LP_MS = 500;
  const HELP_DEFAULT = {
    "btn-start": "點選此處開始今世——進入主頁查看歲數與膠幣。",
    "btn-hint": "短按查看流程；長按任何按鈕可查看正規說明。",
    "btn-go": "開始人生——未準備出發先入準備；已準備未揀身世先身世；之後命運／遭遇。若已有未完人生請用「繼續上次未完人生」。",
    "btn-continue-life": "繼續上次未完人生——自動存檔；關閉遊戲／瀏覽器後再開，點選此處接回身世／命運／今次遭遇。",
    "btn-book": "卡冊（收藏／升星）——全螢幕瀏覽戰鬥卡／技能卡／裝備卡；搜尋、點卡查看詳情與升星。不等於準備出發。",
    "btn-story": "瀏覽可選故事包——注入／加權主線氣氛事件；人生四揀一／命運／支線／商店／奇遇永遠是骨架，不會變成單一條直線劇。",
    "btn-story-pick": "以此包氣氛入故事——只記 active 故事包、提高該包主線出現機會；四揀一仍混其他類型。",
    "btn-back": "返回上一頁（故事內＝遇敵／準備出發等）；未確認的選擇不會保存。",
    "btn-ok": "結果會浮現顯示，睇完之後點畫面任何空白位置繼續（唔會自動跳走）。",
    "btn-abandon": "放棄今世——確認後重置今世進度並返回外層主頁 hub。進入故事後不可以只返回主頁而保留進度。",
    "btn-reset": "清空今世戰鬥卡隊與帶入技能（lifeSkills 清空）；主人裝備不清空。要重新選取後再「準備好了」。",
    "btn-confirm": "確認口袋帶入（最少 1 張）；準備出發後再揀身世同人生命運。",
    "btn-ready": "準備出發——確認今世帶入的主人裝備＋戰鬥卡口袋＋技能（每世一次）。確認後先選身世，再進入人生命運（第1–3年），之後才一般遭遇。口袋最少 1 張。",
    "prep-fighter": "戰鬥卡：面板只顯示已選隊（大圖＋星）。點選面板／空位＋ →「選擇初始戰鬥卡」由已獲得戰鬥卡選入／剔出；上限＝統率（硬頂 25）。每場最多 3 張部署。長按查看卡內容。",
    "gear-slot": "帳號裝備（頭／身／武／副／飾／足）——點選槽位或「更換裝備」開啟「選擇初始裝備卡」；選擇裝上／取消卸下；數值加乘套用全體出戰卡。",
    "attrs-toggle": "六維（力量／敏捷／智力／幸運／統率／壽命）——點擊展開或收起。收摺後頂欄只顯示膠幣／金幣／聲望，畫面留多啲位。",
    "btn-equip-star": "裝備升星只可在卡冊進行：卡冊 → 裝備卡 → 點卡 → 「升星」（消耗同名卡）。扭蛋抽到重複卡只會累積張數，唔會自動升星。",
    "btn-fight": "開始戰鬥——全自動戰，可加速／放棄。",
    "btn-speed": "切換 ×1／×2／×3 播放速度。",
    "btn-forfeit": "放棄本場＝敗北結算後仍留故事流；只鎖定已經陣亡的出戰卡與其技能，仍存活的不鎖定。",
    "btn-ding": "戰鬥結果會浮現顯示，睇完之後點畫面任何空白位置返回故事流（唔會自動跳走）。",
    "btn-again": "繼續故事——留在故事流，再進入今次遭遇。",
    "tab-life": "今世：人生 hub、開始／繼續人生。",
    "tab-book": "卡冊（收藏／升星）——戰鬥卡／技能卡／裝備卡。",
    "tab-teahouse": "茶記：用聲望換特殊戰鬥卡；聲望由每日差事賺取。",
    "tab-jobs": "差事：每日任務板——宿敵／戰鬥／奇遇／升星等，每日重置。",
    "tab-more": "更多：設定等。",
    /*
     * t386：獎勵與增減益一律不在「選擇前」顯示（總導演：顯示出來就失去選擇的樂趣）。
     * 說明只講「玩法與內容」，唔講獎勵數字、唔講增減益方向、唔講會唔會打。
     */
    "event-battle": "街上有人、有事。點下去先知道要唔要出手——打完先知賺到咩。",
    "event-gift": "有人塞嘢俾你。點下去睇下係咩。",
    "event-soft": "人情、搵食、節慶。點下去睇下呢一年發生咩事。",
    "event-minigame": "街邊一部機。點下去玩一局——玩成點，之後先知。",
    "event-faction": "兩邊都望住你。聽完先揀邊邊。",
    "btn-equip": "技能卡：今世最多帶入 10 張。點選面板／＋ →「選擇初始技能卡」由已獲得技能選入 lifeSkills；裝備／預設裝技只可用這 10 張。長按查看技能內容。",
    "btn-equip-next": "配技完成——有戰鬥就入遇敵，否則返今次遭遇（故事流）。",
    "btn-unequip": "卸下此格技能。",
    "skill-pick": "今世技能口袋（最多 10）：點選更換在彈窗選取帶入人生的技能；之後出戰裝技只可以由這批選取。",
    "deploy-slot": "出戰位——第一次（或上場已不能打）先選卡。打贏之後沿用該次配置，唔使日日再揀。短按可改這一格；長按查看卡內容。",
    "origin-pick": "選擇身世——四揀一（2×2 有圖）。四張都係真嘅人生，唔會寫明邊張好、邊張差。揀完先見後果。",
    "fate-pick": "人生命運——四揀一。街頭巷尾會發生咩事，冇人預先話你知。揀完先見後果。",
    "enemy-card": "敵方卡——長按查看攻／速／血、普攻／自帶與 flavor。",
    "ally-face": "出戰卡——短按開啟詳情；長按查看名稱、數值、效果與 flavor。",
    "fd-skill": "技能格——點選或長按查看普攻／自帶／已裝技能內容。",
    "fd-pool": "技能池——長按查看技能效果；短按裝上。",
  };

  let helpTipEl = null;
  let helpTipDismiss = null;
  let helpTipTimer = null;
  let helpBlockClickUntil = 0;

  function hideHelpTip() {
    if (helpTipTimer) {
      clearTimeout(helpTipTimer);
      helpTipTimer = null;
    }
    if (helpTipDismiss) {
      document.removeEventListener("pointerdown", helpTipDismiss, true);
      helpTipDismiss = null;
    }
    if (helpTipEl) {
      helpTipEl.remove();
      helpTipEl = null;
    }
  }

  function showHelpTip(anchor, textOrHtml, opts) {
    opts = opts || {};
    hideHelpTip();
    const tip = document.createElement("div");
    tip.className = "help-tip" + (opts.html ? " help-tip-rich" : "");
    tip.setAttribute("role", "tooltip");
    if (opts.html) {
      // 只由 battleCardSkillSlotsHtml／*HelpRichHtml 組裝，已用 esc()
      tip.innerHTML = textOrHtml;
    } else {
      tip.textContent = textOrHtml;
    }
    const host = document.getElementById("phone") || document.body;
    host.appendChild(tip);
    helpTipEl = tip;

    // t284：說明固定頂端置中（唔再跟 anchor 飄）
    // t361：rich 版由 CSS 決定寬度（接近全寬）並自行置中；其他版維持量測置中
    tip.classList.add("help-tip-top");
    if (!opts.html) {
      const hr = host.getBoundingClientRect();
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(8, (hr.width - tw) / 2) + "px";
    } else {
      // rich：left/right 都由 CSS 控制（避免 offsetWidth 含邊框造成右邊溢出）
      tip.style.left = "";
      tip.style.right = "";
    }
    tip.style.top = "10px";

    helpTipTimer = setTimeout(() => hideHelpTip(), 20000); /* t282：卡牌說明 20 秒先收 */

    // t290：rich tip 入面技能格可撳出說明（敵方／己方長按內容）
    if (opts.html) {
      tip.querySelectorAll("[data-ci-skill-help]").forEach((el) => {
        const skillTip = (el.getAttribute("data-help-text") || "").trim();
        if (!skillTip) return;
        el.style.cursor = "pointer";
        const showSkill = (ev) => {
          if (ev) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          showHelpTip(el, skillTip);
        };
        el.addEventListener("click", showSkill);
        el.addEventListener(
          "pointerdown",
          (ev) => {
            // 唔好被外層 dismiss 誤判；技能格自己收 tip 再開新 tip
            ev.stopPropagation();
          },
          true
        );
      });
    }

    const dismiss = (ev) => {
      if (tip !== helpTipEl) {
        document.removeEventListener("pointerdown", dismiss, true);
        if (helpTipDismiss === dismiss) helpTipDismiss = null;
        return;
      }
      if (tip.contains(ev.target)) return;
      hideHelpTip();
    };
    helpTipDismiss = dismiss;
    setTimeout(() => document.addEventListener("pointerdown", dismiss, true), 0);
  }

  function wireLongPressHelp(el, text, lpOpts) {
    if (!el || !text) return;
    if (el.dataset.lpBound === "1") return;
    el.dataset.lpBound = "1";
    el.classList.add("has-help");
    lpOpts = lpOpts || {};

    let timer = null;
    let armed = false;
    let shown = false;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    el.addEventListener("pointerdown", (ev) => {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      // 卸下掣：唔 arm 長按，避免擋 .fds-off click
      if (ev.target && ev.target.closest && ev.target.closest(".fds-off,[data-unequip]")) {
        clearTimer();
        armed = false;
        shown = false;
        return;
      }
      armed = true;
      shown = false;
      clearTimer();
      timer = setTimeout(() => {
        if (!armed) return;
        shown = true;
        helpBlockClickUntil = Date.now() + 450;
        let rich = null;
        try {
          rich = typeof lpOpts.getHtml === "function" ? lpOpts.getHtml() : null;
        } catch (_) {
          rich = null;
        }
        if (rich) showHelpTip(el, rich, { html: true });
        else showHelpTip(el, text);
        try {
          el.setPointerCapture(ev.pointerId);
        } catch (_) {}
      }, LP_MS);
    });

    const endPress = (ev) => {
      clearTimer();
      if (shown) {
        helpBlockClickUntil = Date.now() + 450;
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      }
      armed = false;
    };

    el.addEventListener("pointerup", endPress);
    el.addEventListener("pointercancel", () => {
      clearTimer();
      armed = false;
      shown = false;
    });
    el.addEventListener("pointerleave", () => {
      if (!shown) {
        clearTimer();
        armed = false;
      }
    });
    el.addEventListener(
      "click",
      (ev) => {
        if (shown || Date.now() < helpBlockClickUntil) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          shown = false;
        }
      },
      true
    );
    el.addEventListener("contextmenu", (ev) => {
      if (el.classList.contains("has-help")) {
        ev.preventDefault();
      }
    });
  }

  function resolveRichHelpHtml(el, key) {
    const rich = el.getAttribute("data-help-rich") || "";
    if (rich === "gear" || key === "gear-slot") {
      const gid = el.getAttribute("data-help-gid") || el.getAttribute("data-gear") || "";
      // data-gear 可能係槽 id（head/body…）而唔係裝備 id：只有拿到真裝備才算 rich
      const item = itemByIdLookup()[gid] || null;
      if (!item) return null;
      const slotMeta = GEAR_SLOTS.find((s) => s.id === item.slot) || null;
      return equipHelpRichHtml(item, slotMeta);
    }
    if (rich === "enemy" || key === "enemy-card") {
      const raw = el.getAttribute("data-help-payload");
      if (!raw) return null;
      try {
        return enemyHelpRichHtml(JSON.parse(raw));
      } catch (_) {
        return null;
      }
    }
    if (rich === "fighter" || key === "prep-fighter" || key === "deploy-slot" || key === "ally-face") {
      const fid =
        el.getAttribute("data-help-fid") ||
        el.getAttribute("data-fid") ||
        el.getAttribute("data-id") ||
        "";
      if (!fid) return null;
      const f = fighterById[fid];
      if (!f) return null;
      if (isDeadFighter(fid)) return null;
      const opts = {};
      try {
        opts.preview = fighterPreviewStats(f);
      } catch (_) {}
      return fighterHelpRichHtml(f, opts);
    }
    return null;
  }

  /**
   * t379：六維收摺 toggle（頂欄資訊分層）。
   * 用事件委派，任何畫面只要有 #btn-attrs-toggle 都生效，
   * 唔需要在每個 view 各自接線。
   */
  function wireAttrsToggle(root) {
    if (!root) return;
    const btn = root.querySelector("#btn-attrs-toggle");
    if (!btn || btn.dataset.wired === "1") return;
    btn.dataset.wired = "1";
    btn.onclick = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      state.attrsCollapsed = !state.attrsCollapsed;
      const list = root.querySelector("#lh-attrs-list");
      const collapsed = !!state.attrsCollapsed;
      if (list) list.hidden = collapsed;
      btn.classList.toggle("collapsed", collapsed);
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      btn.title = collapsed ? "展開六維" : "收起六維";
      const caret = btn.querySelector(".lhat-caret");
      if (caret) caret.textContent = collapsed ? "▸" : "▾";
    };
  }

  function wireScreenHelp(root) {
    if (!root) return;
    root.querySelectorAll("[data-help]").forEach((el) => {
      const key = el.getAttribute("data-help") || "";
      const custom = el.getAttribute("data-help-text");
      const tip = (custom && custom.trim()) ? custom : (HELP_DEFAULT[key] || key);
      const lpOpts = {};
      if (
        key === "enemy-card" ||
        key === "prep-fighter" ||
        key === "deploy-slot" ||
        key === "ally-face" ||
        el.getAttribute("data-help-rich")
      ) {
        lpOpts.getHtml = () => resolveRichHelpHtml(el, key);
      }
      if (tip) wireLongPressHelp(el, tip, lpOpts);
    });
  }

  function dismissForfeitConfirm() {
    const el = document.getElementById("forfeit-confirm");
    if (el) el.remove();
  }

  function requestForfeit() {
    const b = state.battle;
    if (!b || !b.running) return;
    if (document.getElementById("forfeit-confirm")) return;

    // Keep actions reachable above inspect overlay
    if (b.inspectOpen) closeCardInspectKeepPaused();
    pauseBattle();

    const actions = document.querySelector(".battle-actions");
    if (!actions) {
      endBattle(false);
      return;
    }
    const chip = document.createElement("div");
    chip.id = "forfeit-confirm";
    chip.className = "forfeit-confirm";
    chip.innerHTML = `
      <span class="ff-q">確定放棄？</span>
      <button type="button" class="btn small ghost" id="ff-cancel">取消</button>
      <button type="button" class="btn small gold" id="ff-ok">確定</button>
    `;
    actions.appendChild(chip);
    $("#ff-cancel", chip).onclick = (ev) => {
      ev.stopPropagation();
      dismissForfeitConfirm();
      resumeBattle();
    };
    $("#ff-ok", chip).onclick = (ev) => {
      ev.stopPropagation();
      dismissForfeitConfirm();
      const overlay = document.getElementById("card-inspect");
      if (overlay) overlay.remove();
      if (b) b.inspectOpen = false;
      endBattle(false);
    };
    wireLongPressHelp(
      $("#ff-ok", chip),
      "確認中止本場戰鬥；判定為敗北，不獲獎勵。"
    );
    wireLongPressHelp($("#ff-cancel", chip), "取消放棄，繼續本場戰鬥。");
  }


  /* t363：背景底圖保險（前序）
     曾出現：瀏覽器仍用舊 styles.css（指向已搬到 _legacy-svg 的 bg-*.svg），
     結果畫面只剩紫黑色幾何佔位圖，玩家見到「背景底圖缺失」。
     CSS 正確時呢度完全唔會介入；只有實際載入的圖唔對（或載入失敗）才補上 inline style。
     inline style 優先級高於外部 CSS，所以就算快取再舊都蓋得住。 */
  const SCENE_BG = {
    "bg-title": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.18) 0%, rgba(8,4,16,0.3) 46%, rgba(8,4,16,0.8) 100%)",
      file: "assets/ui/bg-title.jpg",
      pos: "center 28%",
    },
    "bg-home": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.22) 0%, rgba(8,4,16,0.14) 30%, rgba(8,4,16,0.6) 66%, rgba(8,4,16,0.9) 100%)",
      file: "assets/ui/bg-home.jpg",
      pos: "center 34%",
    },
    "bg-events": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.34) 0%, rgba(8,4,16,0.26) 40%, rgba(8,4,16,0.76) 100%)",
      file: "assets/ui/bg-events.jpg",
      pos: "center 34%",
    },
    "bg-team": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.36) 0%, rgba(8,4,16,0.26) 38%, rgba(8,4,16,0.8) 100%)",
      file: "assets/ui/bg-team.jpg",
      pos: "center 42%",
    },
    "bg-encounter": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.32) 0%, rgba(8,4,16,0.24) 40%, rgba(8,4,16,0.78) 100%)",
      file: "assets/ui/bg-encounter.jpg",
      pos: "center 40%",
    },
    "bg-battle": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.36) 0%, rgba(8,4,16,0.14) 38%, rgba(8,4,16,0.26) 60%, rgba(8,4,16,0.74) 100%)",
      file: "assets/ui/bg-battle-scene.jpg",
      pos: "center center",
    },
    "bg-result": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.22) 0%, rgba(8,4,16,0.36) 46%, rgba(8,4,16,0.86) 100%)",
      file: "assets/ui/bg-result.jpg",
      pos: "center 36%",
    },
    "bg-soft": {
      mask: "linear-gradient(180deg, rgba(8,4,16,0.3) 0%, rgba(8,4,16,0.72) 100%)",
      file: "assets/ui/bg-events.jpg",
      pos: "center 34%",
    },
  };

  /** 純 CSS 霓虹夜景：背景圖真的拿不到時的最後防線（唔會似破圖方塊） */
  const CSS_NIGHT_FALLBACK = [
    "radial-gradient(ellipse at 50% 0%, rgba(255,45,149,0.30) 0%, transparent 55%)",
    "radial-gradient(ellipse at 18% 38%, rgba(45,226,255,0.22) 0%, transparent 52%)",
    "radial-gradient(ellipse at 82% 62%, rgba(255,204,51,0.16) 0%, transparent 55%)",
    "linear-gradient(180deg, #1b0c2e 0%, #2a1040 34%, #160a24 68%, #0a0610 100%)",
  ].join(", ");

  /** 每張背景圖的實際載入狀態：true 成功／false 失敗／undefined 未驗證 */
  const _bgLoadState = Object.create(null);

  /** 主動驗證背景 JPG 真係載入得到（URL 對但檔案壞／404 都會露餡） */
  function probeBgFile(file, done) {
    if (typeof _bgLoadState[file] === "boolean") {
      done(_bgLoadState[file]);
      return;
    }
    const img = new Image();
    let settled = false;
    const finish = (okFlag) => {
      if (settled) return;
      settled = true;
      _bgLoadState[file] = okFlag;
      done(okFlag);
    };
    img.onload = () => finish(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => finish(false);
    setTimeout(() => finish(false), 6000);
    img.src = file;
  }

  /** 只有 CSS 實際指向的圖唔對時，才用 inline style 補回正確底圖 */
  function ensureSceneBackground(root) {
    if (!root || !root.classList) return;
    // #screen 係長期同一個元素：每次入頁先清掉上一次可能留下的 inline 背景，
    // 否則由「已修復」畫面切去正常畫面時會殘留住舊圖。
    root.style.backgroundImage = "";
    root.style.backgroundSize = "";
    root.style.backgroundPosition = "";
    root.style.backgroundRepeat = "";
    root.style.backgroundColor = "";
    try { delete root.dataset.bgRepaired; } catch (_) {}
    let key = "";
    root.classList.forEach((c) => {
      if (!key && c.indexOf("bg-") === 0) key = c;
    });
    const spec = key && SCENE_BG[key];
    if (!spec) return;
    let cur = "";
    try {
      cur = getComputedStyle(root).backgroundImage || "";
    } catch (_) {
      cur = "";
    }
    const urlOk = cur.indexOf(spec.file) !== -1;

    // CSS 已指向正確 JPG → 只需在背景圖載入失敗時退成純 CSS 夜景，唔會再出現破圖
    if (urlOk && _bgLoadState[spec.file] !== false) return;

    if (urlOk) {
      // 圖檔本身壞／404：退成純 CSS 霓虹夜景（無需任何外部檔案）
      root.style.backgroundImage = `${spec.mask}, ${CSS_NIGHT_FALLBACK}`;
      try { root.dataset.bgRepaired = key + "-cssonly"; } catch (_) {}
      return;
    }

    root.style.backgroundColor = "#0a0610";
    root.style.backgroundImage = `${spec.mask}, url("${spec.file}")`;
    root.style.backgroundSize = "cover, cover";
    root.style.backgroundPosition = `${spec.pos}, ${spec.pos}`;
    root.style.backgroundRepeat = "no-repeat, no-repeat";
    // 記錄一次，方便排查（只記類別名，唔記整條資料）
    try {
      root.dataset.bgRepaired = key;
    } catch (_) {}
  }

  /*
   * t395：結果浮現 + **點空白處前進**（總導演要求取消自動倒數）
   *
   * 演變：
   *   t387 初版「浮現後 2.6 秒自動前進」→ 總導演覺得會自己跳走，好趕。
   *   t395 改為：**完全唔自動**，玩家睇夠之後點畫面任何空白位置才前進。
   *
   * 做法：
   *   1. 結果畫面（事件結算 / 戰鬥結算 / 小遊戲 / 勢力 / 送卡）冇「繼續」大掣
   *   2. 結果內容用浮現動畫（fade + 上浮）進場
   *   3. 底部顯示提示條「點畫面繼續」，**冇倒數、冇進度條**
   *   4. 點畫面任何位置即前進（除故事底欄與「放棄今世」）
   */
  let autoAdvanceTimer = null;
  let autoAdvanceRaf = null;

  /** 清掉殘留計時器（保留函式名，避免舊呼叫點壞掉） */
  function clearAutoAdvance() {
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
    if (autoAdvanceRaf) {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(autoAdvanceRaf);
      else clearTimeout(autoAdvanceRaf);
      autoAdvanceRaf = null;
    }
  }

  /**
   * t395：唔再自動前進 —— 一律等玩家點擊。
   *
   * 保留函式名與簽名（舊呼叫點唔需要改），但唔會設任何計時器。
   * 實際前進由 `wireTapToAdvance()` 負責。
   *
   * @param {Function} fn      前進要做的事（由 wireTapToAdvance 用）
   * @param {number}   delayMs 已棄用（保留參數避免舊呼叫出錯）
   * @param {Object}   opt     已棄用
   * @returns {null} 永遠回 null（冇計時器）
   */
  function scheduleAutoAdvance(fn, delayMs, opt) {
    clearAutoAdvance();
    return null;
  }

  /** 已棄用：保留常數避免舊引用報錯 */
  const AUTO_ADVANCE_MS = 2600;

  /**
   * 結果畫面的「點擊繼續」提示條（冇倒數、冇進度條）。
   * @param {string} label 下一步係咩（例如「下一歲 21歲」）
   */
  function autoAdvanceBarHtml(label) {
    return `<button type="button" class="auto-bar tap-continue" id="auto-bar" data-tap-continue="1">
      <span class="tap-continue-ico" aria-hidden="true">▼</span>
      <span class="auto-bar-label">${esc(label || "繼續")} · 點畫面繼續</span>
    </button>`;
  }

  /**
   * 綁定「點空白處前進」（t395）。
   *
   * 只喺結果畫面用：點畫面任何位置都算（包括底部提示條），
   * 唔需要搵特定掣。
   *
   * 會排除：
   *   - 故事底欄（盟友／裝備／道具…）— 玩家可能想睇
   *   - 「放棄今世」— 唔可以誤觸
   *   - 標了 `data-no-skip` 的元素
   */
  function wireTapToAdvance(root, fn) {
    if (!root || typeof root.addEventListener !== "function") return;
    let fired = false;
    const handler = (e) => {
      if (fired) return;
      const t = e && e.target;
      /* 提示條本身係 button，要放行（否則 soft-cta 排除規則會擋住佢） */
      const onHint = !!(t && t.closest && t.closest("[data-tap-continue]"));
      if (t && t.closest && !onHint) {
        if (t.closest(".story-dock") || t.closest("[data-no-skip]")) return;
        if (t.closest("#btn-abandon") || t.closest(".btn-abandon-compact")) return;
        /* soft-cta 內除提示條以外嘅元素（例如放棄掣）唔算 */
        if (t.closest(".soft-cta")) return;
      }
      fired = true;
      clearAutoAdvance();
      try { fn(); } catch (err) {}
    };
    root.addEventListener("click", handler, { once: false });
  }

  function render() {
    hideHelpTip();
    dismissForfeitConfirm();
    clearAutoAdvance();
    const root = screenEl();
    root.innerHTML = "";
    const bgMap = {
      title: "bg-title",
      home: "bg-home",
      missions: "bg-home",
      teaHouse: "bg-soft",
      storyPacks: "bg-home",
      storyPackDetail: "bg-home",
      album: "bg-home",
      events: "bg-events",
      soft: "bg-soft",
      minigame: "bg-soft",
      faction: "bg-soft",
      office: "bg-soft",
      tale: "bg-soft",
      shop: "bg-soft",
      trade: "bg-soft",
      starup: "bg-soft",
      cardGift: "bg-soft",
      gearup: "bg-soft",
      train: "bg-soft",
      revive: "bg-soft",
      allies: "bg-soft",
      team: "bg-team",
      equip: "bg-team",
      prep: "bg-team",
      origin: "bg-events",
      fate: "bg-events",
      encounter: "bg-encounter",
      battle: "bg-battle",
      result: "bg-result",
      gacha: "bg-home",
    };
    root.className = "screen has-bg " + (bgMap[state.screen] || "");
    root.dataset.screen = state.screen;
    ensureSceneBackground(root);
    // 背景圖非同步驗證：真係載入唔到就退成純 CSS 夜景（唔會再出現紫黑破圖方塊）
    (() => {
      let key = "";
      root.classList.forEach((c) => {
        if (!key && c.indexOf("bg-") === 0) key = c;
      });
      const spec = key && SCENE_BG[key];
      if (!spec) return;
      probeBgFile(spec.file, (okFlag) => {
        if (okFlag) return;
        // 只影響仍然顯示同一畫面嘅情況
        const cur = screenEl();
        if (cur !== root || !root.classList.contains(key)) return;
        root.style.backgroundImage = `${spec.mask}, ${CSS_NIGHT_FALLBACK}`;
        root.style.backgroundSize = "cover, cover";
        try { root.dataset.bgRepaired = key + "-cssonly"; } catch (_) {}
      });
    })();
    const map = {
      title: viewTitle,
      home: viewHome,
      gacha: viewGacha,
      missions: viewMissions,
      teaHouse: viewTeaHouse,
      storyPacks: viewStoryPacks,
      storyPackDetail: viewStoryPackDetail,
      album: viewAlbum,
      events: viewEvents,
      soft: viewSoft,
      minigame: viewMinigameEntry,
      faction: viewFaction,
      office: viewOffice,
      tale: viewTale,
      shop: viewShop,
      trade: viewTrade,
      starup: viewStarUp,
      cardGift: viewCardGift,
      gearup: viewGearUpgrade,
      train: viewFighterTrain,
      revive: viewFighterRevive,
      allies: viewAlliesPanel,
      prep: viewPrep,
      team: viewPrep,
      equip: viewPrep,
      origin: viewOrigin,
      fate: viewFate,
      encounter: viewEncounter,
      battle: viewBattle,
      result: viewResult,
    };
    (map[state.screen] || viewTitle)(root);
    wireScreenHelp(root);
    wireAttrsToggle(root);
    wireGachaEntry(root);
    saveGame();
  }

  /* ---------- Screens ---------- */

  function viewTitle(root) {
    root.innerHTML = `
      <div class="title-banner">
        <div class="neon-title">${esc(DATA.product)}</div>
        <div class="tagline">港漫霓虹 · 茶記舊帳</div>
      </div>
      <div class="speed-strip"></div>
      <div class="bubble">夜巷燈未熄——準備好未？</div>
      <p class="sub">直向切片 · 前幾年人生 run<br/>準備出發 · 身世 · 命運×3 · 遭遇 · 遇敵 · 自動戰 · 年紀＋1</p>
      <div class="spacer"></div>
      <button class="btn gold" id="btn-start" data-help="btn-start">${esc(L["ui.start"] || "開始")}</button>
      <button class="btn ghost" id="btn-hint" type="button" data-help="btn-hint">查看規則</button>
    `;
    $("#btn-start", root).onclick = () => {
      state.screen = "home";
      render();
    };
    $("#btn-hint", root).onclick = () => {
      alert("開始 → 進入故事（未配則「準備出發」一次）→ 身世 → 人生命運（第1–3年四揀一，合共3次，每次＋1歲）→ 之後今次遭遇 → 遇敵確認 → 出戰 → 自動戰 → 結算→繼續故事。進入故事後不返回主頁，除非結算今世／放棄今世。長按按鈕查看正規說明。");
    };
  }


  /** 差事獎勵 → 小標籤 HTML */
  function missionRewardChips(m) {
    const r = (m && m.reward) || {};
    const out = [];
    if (r.soul) out.push(`<span class="dm-chip soul">膠幣 +${r.soul | 0}</span>`);
    const fame = missionFameGain(m);
    if (fame) out.push(`<span class="dm-chip fame">聲望 +${fame}</span>`);
    if (r.xp) out.push(`<span class="dm-chip xp">經驗 +${r.xp | 0}</span>`);
    if (r.luck_note) out.push(`<span class="dm-chip luck">幸運 +1</span>`);
    return out.join("") || `<span class="dm-chip xp">—</span>`;
  }

  function viewMissions(root) {
    ensureDaily();
    const list = dailyMissionList();
    const d = state.daily;
    const total = list.length;
    let doneCount = 0;
    let claimable = 0;
    list.forEach((m) => {
      const cur = d.progress[m.id] | 0;
      const tgt = Math.max(1, m.target | 0);
      if (cur >= tgt) {
        doneCount += 1;
        if (!d.claimed[m.id]) claimable += 1;
      }
    });

    const rows = list.map((m) => {
      const cur = d.progress[m.id] | 0;
      const tgt = Math.max(1, m.target | 0);
      const done = cur >= tgt;
      const claimed = !!d.claimed[m.id];
      const pct = Math.min(100, Math.round((cur / tgt) * 100));
      let btn;
      if (claimed) {
        btn = `<button type="button" class="btn small ghost dm-claim" disabled>已領</button>`;
      } else if (done) {
        btn = `<button type="button" class="btn small gold dm-claim" data-mid="${esc(m.id)}">領獎</button>`;
      } else {
        btn = `<button type="button" class="btn small ghost dm-claim" disabled>${cur > 0 ? "進行中" : "未開始"}</button>`;
      }
      return `
        <div class="dm-row${claimed ? " claimed" : ""}${done && !claimed ? " ready" : ""}" data-mid="${esc(m.id)}">
          <div class="dm-main">
            <div class="dm-name">${esc(m.name)}</div>
            <div class="dm-desc">${esc(m.desc || "")}</div>
            <div class="dm-bar"><span style="width:${pct}%"></span></div>
            <div class="dm-meta">
              <span class="dm-prog">${cur}/${tgt}</span>
              <span class="dm-reward">${missionRewardChips(m)}</span>
            </div>
          </div>
          <div class="dm-act">${btn}</div>
        </div>`;
    }).join("");

    const sumPct = total ? Math.round((doneCount / total) * 100) : 0;
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>差事 · ${esc(d.dateKey)}</span>
        <span class="chip soul"><span class="dot"></span>${esc(L["ui.resource"] || "膠幣")} ${state.soul}</span>
        <span class="chip gold"><span class="dot"></span>金幣 ${state.gold | 0}</span>
        <span class="chip fame"><span class="dot"></span>聲望 ${state.fame | 0}</span>
      </div>
      <div class="ribbon">每日差事</div>
      <div class="dm-summary">
        <div class="dm-sum-head">
          <span>今日進度 <b>${doneCount}/${total}</b></span>
          <span>${claimable ? `<b style="color:var(--neon-pink)">${claimable} 項可領</b>` : (doneCount === total ? "全清" : "繼續努力")}</span>
        </div>
        <div class="dm-sum-bar"><span style="width:${sumPct}%"></span></div>
        <div class="dm-sum-note">每日零時（香港時間）重置 · 甲子與升星次數跨世累計</div>
      </div>
      ${claimable > 1 ? `<button class="btn gold" id="btn-dm-claim-all" type="button" style="flex-shrink:0;padding:6px;font-size:0.78rem;">一次領取 ${claimable} 項</button>` : ""}
      <div class="dm-list">${rows || "<div class='soft-panel'>未有任務模板</div>"}</div>
      <nav class="tab-bar" aria-label="主選單">
        <button class="tab" type="button" id="tab-book" data-help="tab-book"><span class="ico">📖</span>卡冊</button>
        <button class="tab" type="button" id="tab-life" data-help="tab-life"><span class="ico">🏠</span>今世</button>
        <button class="tab" type="button" id="tab-teahouse" data-help="tab-teahouse"><span class="ico">🍜</span>茶記</button>
        <button class="tab on" type="button" id="tab-jobs" data-help="tab-jobs"><span class="ico">📋</span>差事</button>
        <button class="tab" type="button" id="tab-more" aria-disabled="true" data-help="tab-more"><span class="ico">⋯</span>更多</button>
      </nav>
      <div id="home-toast" class="home-toast" hidden></div>
    `;
    root.classList.add("missions-screen");
    const toast = (msg) => {
      const el = $("#home-toast", root);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { el.hidden = true; }, 1800);
    };
    root.querySelectorAll(".dm-claim[data-mid]").forEach((btn) => {
      btn.onclick = () => {
        if (claimDailyMission(btn.dataset.mid)) {
          toast("差事完成——獎勵入帳");
          render();
        }
      };
    });
    const claimAll = $("#btn-dm-claim-all", root);
    if (claimAll) {
      claimAll.onclick = () => {
        let n = 0;
        list.forEach((m) => {
          if (!d.claimed[m.id] && (d.progress[m.id] | 0) >= Math.max(1, m.target | 0)) {
            if (claimDailyMission(m.id)) n += 1;
          }
        });
        toast(n ? `已領取 ${n} 項差事獎勵` : "沒有可領取的差事");
        render();
      };
    }
    $("#tab-life", root).onclick = () => { state.screen = "home"; render(); };
    $("#tab-jobs", root).onclick = () => { ensureDaily(); state.screen = "missions"; render(); };
    const teaTabM = $("#tab-teahouse", root);
    if (teaTabM) teaTabM.onclick = () => { state.screen = "teaHouse"; render(); };
    const moreTabM = $("#tab-more", root);
    if (moreTabM) moreTabM.onclick = () => toast("這個位置尚未開放。");
    const tabBookM = $("#tab-book", root);
    if (tabBookM) tabBookM.onclick = () => { state.screen = "album"; render(); };
  }

  function eventDialogueHtml(ev, className) {
    const lines = ev && Array.isArray(ev.dialogue) ? ev.dialogue : [];
    if (!lines.length) return "";
    const cls = className || "ec-dialogue";
    return `<div class="${cls}">${lines.map((d) => {
      const who = (d && (d.speaker || d.who)) || "";
      const text = (d && (d.text || d.line)) || "";
      const whoHtml = who ? `<b class="dlg-who">${esc(who)}</b>：` : "";
      return `<p class="dlg-line">${whoHtml}${esc(text)}</p>`;
    }).join("")}</div>`;
  }

  function viewStoryPacks(root) {
    ensureActiveStoryPack();
    const packs = storyPacksList();
    let body;
    if (!packs.length) {
      body = `<div class="soft-panel pack-empty">人生照跑；故事包之後再加。<br/><span class="pack-empty-sub">四揀一／命運／支線／商店／奇遇不靠單一劇本。</span></div>`;
    } else {
      body = `<div class="pack-list">${packs.map((p) => {
        const soon = p.status !== "available";
        const on = state.activeStoryPackId === p.id;
        const isDefault = p.id === DEFAULT_STORY_PACK_ID;
        return `
        <button type="button" class="pack-card${soon ? " coming" : ""}${on ? " active-pack" : ""}" data-pack="${esc(p.id)}" data-help="btn-story">
          <img src="${esc(p.cover || "")}" alt="${esc(p.name)}" />
          <div class="pack-meta">
            <div class="pack-name">${esc(p.name)}${isDefault ? `<span class="pack-default-tag">預設</span>` : ""}</div>
            <div class="pack-blurb">${esc(p.blurb || "")}</div>
            <span class="pack-status ${soon ? "soon" : "ok"}">${soon ? "即將" : (on ? "使用中" : "可選")}</span>
          </div>
        </button>`;
      }).join("")}</div>`;
    }
    /*
     * t379：捲動提示數量改為「實際被切走的格數」，唔再寫死 length - 4。
     * 原本用 `packs.length - 4`，但唔同屏高、橫屏兩欄時可見數量唔同，
     * 提示數字會對唔上（例如屏高大時實際全見，仍然寫「仲有 2 個」）。
     * 現在改由 JS 量度 `scrollHeight > clientHeight` 才顯示，
     * 數量用「總數 − 實際完整可見數」。
     */
    const moreHint = (packs || []).length > 3
      ? `<div class="pack-list-more" id="pack-list-more" hidden>▾ 向下捲，仲有 <b>0</b> 個故事 ▾</div>`
      : "";
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>故事包</span>
        <span class="chip soul"><span class="dot"></span>模組 · 非直線劇</span>
      </div>
      <div class="ribbon">故事包</div>
      <p class="sub">可選模組注入主線氣氛——人生骨架永遠非直線</p>
      ${body}
      ${moreHint}
      <button class="btn ghost" id="btn-pack-back" type="button" data-help="btn-back">返主頁</button>
      <div id="home-toast" class="home-toast" hidden></div>
    `;

    // t379：捲動提示 —— 按實際可見格數計算，捲到底自動收起
    const packListEl = $(".pack-list", root);
    const moreEl = $("#pack-list-more", root);
    if (packListEl && moreEl) {
      const syncMore = () => {
        const cards = packListEl.querySelectorAll("[data-pack]");
        const listRect = packListEl.getBoundingClientRect();
        // 完整可見 = 卡片底邊 <= 清單可見底邊（容差 2px）
        let fullyVisible = 0;
        cards.forEach((c) => {
          const r = c.getBoundingClientRect();
          if (r.bottom <= listRect.bottom + 2 && r.top >= listRect.top - 2) fullyVisible += 1;
        });
        const hidden = Math.max(0, cards.length - fullyVisible);
        const atBottom = packListEl.scrollTop + packListEl.clientHeight >= packListEl.scrollHeight - 8;
        if (hidden <= 0 || atBottom) {
          moreEl.hidden = true;
        } else {
          moreEl.hidden = false;
          const b = moreEl.querySelector("b");
          if (b) b.textContent = String(hidden);
        }
      };
      packListEl.addEventListener("scroll", syncMore, { passive: true });
      syncMore();
      // 首次 render 後格高未定，延一幀再量一次
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(syncMore);
      }
    }
    const toast = (msg) => {
      const el = $("#home-toast", root);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.hidden = true; }, 1600);
    };
    $("#btn-pack-back", root).onclick = () => { state.screen = "home"; render(); };
    root.querySelectorAll(".pack-card[data-pack]").forEach((btn) => {
      btn.onclick = () => {
        const p = storyPackById(btn.dataset.pack);
        if (!p) return;
        if (p.status !== "available") {
          toast("稍後開放——此包尚未到");
          return;
        }
        state.storyPackDetailId = p.id;
        state.screen = "storyPackDetail";
        render();
      };
    });
  }

  function viewStoryPackDetail(root) {
    ensureActiveStoryPack();
    const pack = storyPackById(state.storyPackDetailId) || storyPackById(ensureActiveStoryPack());
    if (!pack) {
      state.screen = "storyPacks";
      viewStoryPacks(root);
      return;
    }
    const boost = packBoostEventIds(pack);
    const isOfficeChain = Array.isArray(pack.office_chain) && pack.office_chain.length > 0;
    const isTaleChain = Array.isArray(pack.tale_chain) && pack.tale_chain.length > 0;
    const isChainPack = isOfficeChain || isTaleChain;

    // 分支包：只列「分支 + 結局」，唔逐個節點爆雷
    let evNames;
    if (isChainPack) {
      evNames = [];
    } else {
      evNames = (DATA.events || [])
        .filter((e) => boost.has(e.id) || (pack.event_ids || []).includes(e.id))
        .map((e) => e.name);
    }
    const listHtml = evNames.length
      ? `<ul class="pack-ev-list">${evNames.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : (isChainPack ? "" : `<p class="sub">此包未掛事件——人生照常進行。</p>`);

    // t369：tale 包的人物與結局
    const taleCastHtml = (isTaleChain && Array.isArray(pack.tale_cast_profiles) && pack.tale_cast_profiles.length)
      ? `<div class="pack-ev-title">人物</div>
         <div class="tl-profile-list">${pack.tale_cast_profiles.map((c) => `
           <div class="tl-profile">
             <div class="tl-profile-head">
               <span class="tl-profile-name">${esc(c.name)}</span>
               <span class="tl-profile-role">${esc(c.role || "")}</span>
             </div>
             <p class="tl-profile-blurb">${esc(c.blurb || "")}</p>
             ${Array.isArray(c.arc_stages) && c.arc_stages.length
               ? `<div class="tl-arc-track">${c.arc_stages.map((s, i) => `<span class="tl-arc-step">${esc(s)}</span>`).join('<i class="tl-arc-arrow">›</i>')}</div>`
               : ""}
           </div>`).join("")}</div>`
      : "";

    const taleEndingsHtml = (isTaleChain && Array.isArray(pack.tale_endings))
      ? `<div class="pack-ev-title">${pack.tale_endings.length} 個結局（由你與人物的關係決定）</div>
         <div class="of-ending-list">${pack.tale_endings.map((e) => {
           const done = !!(state.lifeFlags && state.lifeFlags["tale_ending_" + pack.id + "_" + e.id]);
           return `<div class="of-ending-item${done ? " done" : ""}">
             <span class="of-ending-mark">${done ? "✓" : "○"}</span>
             <div class="of-ending-body">
               <div class="of-ending-title">${esc(e.label)}</div>
               <p class="of-ending-blurb">${esc(e.blurb)}</p>
             </div>
           </div>`;
         }).join("")}</div>
         <div class="pack-ev-title">${pack.tale_chain.length} 步分支</div>
         <p class="of-chain-note">每一步 2–3 個選擇。人物對你嘅態度會隨選擇改變——同一段對白，唔同關係會有唔同講法。行到最後，關係決定結局。</p>`
      : "";

    /*
     * t406：詳情頁唔再劇透。
     *
     * 舊版一次列出 26 段 beats + 5 個結局全文 + 全部對白，
     * 玩家未玩就知晒結局。總導演：「只留 blurb + 角色名片；
     * 場面 beats／結局全文收起，通關或步數後先解鎖回想。」
     *
     * 解鎖條件：完成任意一個結局（lifeFlags 有 office_ending_*）。
     */
    const officeCleared = (() => {
      if (!isOfficeChain) return false;
      const flags = state.lifeFlags || {};
      return Object.keys(flags).some((k) => k.indexOf("office_ending_") === 0 && flags[k]);
    })();

    // 分支包：結局一覽（未通關只顯示數量與提示，唔顯示 label／blurb）
    const endingsHtml = isOfficeChain && Array.isArray(pack.office_endings)
      ? (officeCleared
          ? `<div class="pack-ev-title">五個結局（已完成 ${pack.office_endings.filter((e) => !!(state.lifeFlags && state.lifeFlags["office_ending_" + e.id])).length} / ${pack.office_endings.length}）</div>
             <div class="of-ending-list">${pack.office_endings.map((e) => {
               const done = !!(state.lifeFlags && state.lifeFlags["office_ending_" + e.id]);
               return `<div class="of-ending-item${done ? " done" : ""}">
                 <span class="of-ending-mark">${done ? "✓" : "○"}</span>
                 <div class="of-ending-body">
                   <div class="of-ending-title">${esc(e.label)}</div>
                   <p class="of-ending-blurb">${esc(e.blurb)}</p>
                 </div>
               </div>`;
             }).join("")}</div>
             <div class="pack-ev-title">十步分支</div>
             <p class="of-chain-note">每一步三個選擇，後果喺選擇之後才揭示。共 10 幕，行到最後才見結局。本包不設中途獎賞、不設升級。</p>`
          : `<div class="pack-ev-title">${pack.office_endings.length} 個結局</div>
             <div class="of-locked-note" role="status">
               <span class="of-locked-ico">🔒</span>
               <span>結局一覽同場面回想，行完一次之後才會解鎖。<br/>首次遊玩時完全唔會劇透。</span>
             </div>
             <div class="pack-ev-title">十步分支</div>
             <p class="of-chain-note">每一步三個選擇，後果喺選擇之後才揭示。共 10 幕，行到最後才見結局。本包不設中途獎賞、不設升級。</p>`)
      : "";
    /* t406：beats 只喺通關後顯示（原本一次列出全部場面＝劇透） */
    const beatHtml = (Array.isArray(pack.beats) && pack.beats.length && (!isOfficeChain || officeCleared))
      ? `<div class="pack-ev-title">場面回想</div><div class="pack-beats">${pack.beats.map((b) => `<p class="pack-beat">${esc(b)}</p>`).join("")}</div>`
      : "";
    /* t406：對白亦只喺通關後顯示 */
    const dlgHtml = (isOfficeChain && !officeCleared)
      ? ""
      : (DATA.events || [])
        .filter((e) => (boost.has(e.id) || (pack.event_ids || []).includes(e.id)) && Array.isArray(e.dialogue) && e.dialogue.length)
        .map((e) => `<div class="pack-ev-title">對白</div>${eventDialogueHtml(e, "pack-dialogue")}`)
        .join("");
    const active = state.activeStoryPackId === pack.id;
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>${esc(pack.name)}</span>
        <span class="chip soul"><span class="dot"></span>${active ? "使用中" : "可選"}</span>
      </div>
      <div class="ribbon">故事包詳情</div>
      <div class="pack-detail">
        <div class="pack-detail-art comic-frame glow-pink">
          <img src="${esc(pack.cover || "")}" alt="${esc(pack.name)}" />
        </div>
        <div class="bubble">${esc(pack.blurb || "")}</div>
        <div class="soft-panel pack-detail-note">${isChainPack
          ? "多分支故事：每步 2–3 個選擇，人物關係會影響對白與結局。中途不設獎賞，行到最後才知道結果。"
          : "故事包只是氣氛模組；進入故事後仍是命運／四揀一混其他類型，不會變成單一條直線劇。"}</div>
        ${beatHtml}
        ${taleCastHtml}
        ${taleEndingsHtml}
        ${endingsHtml}
        <div class="pack-ev-title">含事件</div>
        ${listHtml}
        ${dlgHtml}
      </div>
      <div class="btn-row pack-detail-actions">
        <button class="btn ghost" id="btn-pack-list" type="button" data-help="btn-back">返列表</button>
        <button class="btn pink" id="btn-pack-use" type="button" data-help="btn-story-pick">${active ? "已用此包氣氛" : "以此包氣氛入故事"}</button>
        ${isChainPack ? `<button class="btn gold" id="btn-pack-start-chain" type="button">${isTaleChain ? "由第一步開始（故事）" : "由第一日返工開始（分支）"}</button>` : ""}
      </div>
      <button class="btn ghost" id="btn-pack-home" type="button" data-help="btn-back">返主頁</button>
      <div id="home-toast" class="home-toast" hidden></div>
    `;
    const toast = (msg) => {
      const el = $("#home-toast", root);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.hidden = true; }, 1600);
    };
    $("#btn-pack-list", root).onclick = () => { state.screen = "storyPacks"; render(); };
    $("#btn-pack-home", root).onclick = () => { state.screen = "home"; render(); };
    const startChain = $("#btn-pack-start-chain", root);
    if (startChain) {
      startChain.onclick = () => {
        // t369：tale 鏈優先（通用故事引擎，有角色弧線）
        if (isTaleChain) {
      state.activeStoryPackId = pack.id;
      state.storyPackUserPicked = true;
      const run = taleBeginRun(pack.id);
          const first = run ? taleNodeById(run.nodeId) : null;
          if (!first) {
            toast("此故事鏈未設定完成");
            return;
          }
          // 由故事包直接開鏈：唔需要經四揀一
          state.selectedEvent = first;
          state.eventConfirmOpen = false;
          state.screen = "tale";
          render();
          return;
        }
        const first = officeStartNode();
        if (!first) {
          toast("此分支鏈未設定完成");
          return;
        }
        state.activeStoryPackId = pack.id;
        state.storyPackUserPicked = true;
        officeBeginRun();
        state.selectedEvent = first;
        state.eventConfirmOpen = false;
        state.screen = "office";
        render();
      };
    }
    $("#btn-pack-use", root).onclick = () => {
      if (pack.status !== "available") {
        toast("稍後開放——此包尚未到");
        return;
      }
      state.activeStoryPackId = pack.id;
      state.storyPackUserPicked = true;
      toast("已記「" + pack.name + "」氣氛——人生仍非直線");
      render();
    };
  }

  function viewHome(root) {
    ensureDaily();
    ensureActiveStoryPack();
    const pack = storyPackById(state.activeStoryPackId);
    const packCover = (pack && pack.cover) || "";
    const packName = (pack && pack.name) || "故事包";
    const packCap = pack
      ? `${esc(pack.name)}${pack.status === "coming_soon" ? " · 即將開放" : " · 進行中"}`
      : "未選故事包 · 去故事包揀";
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>${state.age}歲 · 第 ${state.year} 年</span>
        <span class="chip soul"><span class="dot"></span>${esc(L["ui.resource"] || "膠幣")} ${state.soul}</span>
        ${gachaEntryHtml()}
      </div>
      <div class="ribbon">今世主頁</div>
      <div class="home-hero">
        <div class="hero-card comic-frame glow-pink" id="home-pack-cover" role="button" tabindex="0" aria-label="${esc(packName)}">
          ${packCover
            ? `<img src="${esc(packCover)}" alt="${esc(packName)}" />`
            : `<div class="home-pack-placeholder">揀故事包</div>`}
          <div class="cap">${packCap}</div>
        </div>
        <div class="bubble">${state.age}歲 · 第 ${state.year} 年——開始或繼續今世遭遇。${state.battlesThisLife ? "（今世已打 "+state.battlesThisLife+" 場）" : ""}${pack ? "（氣氛：" + esc(pack.name) + "）" : ""}</div>
        <div class="home-side">
          <button class="side-icon" type="button" id="side-spin" data-help="side-spin"><span class="ico">🎰</span>轉盤</button>
          <button class="side-icon active" type="button" id="side-ledger" data-help="btn-go"><span class="ico">🌃</span>舊帳</button>
          <button class="side-icon" type="button" id="side-welfare" data-help="side-welfare"><span class="ico">🧧</span>福利</button>
          <button class="side-icon" type="button" id="side-path" data-help="side-path"><span class="ico">🗺️</span>人生路</button>
        </div>
      </div>
      <div class="home-actions">
        <div class="btn-row home-life-row">
          <button class="btn gold" id="btn-go" data-help="btn-go">開始人生</button>
          <button class="btn cyan" id="btn-continue-life" data-help="btn-continue-life">繼續上次未完人生</button>
        </div>
        <div class="btn-row home-actions-row2">
          <button class="btn pink" id="btn-story" data-help="btn-story">故事包</button>
        </div>
      </div>
      <nav class="tab-bar" aria-label="主選單">
        <button class="tab" type="button" id="tab-book" data-help="tab-book"><span class="ico">📖</span>卡冊</button>
        <button class="tab on" type="button" id="tab-life" data-help="tab-life"><span class="ico">🏠</span>今世</button>
        <button class="tab" type="button" id="tab-teahouse" data-help="tab-teahouse"><span class="ico">🍜</span>茶記</button>
        <button class="tab" type="button" id="tab-jobs" data-help="tab-jobs"><span class="ico">📋</span>差事</button>
        <button class="tab" type="button" id="tab-more" aria-disabled="true" data-help="tab-more"><span class="ico">⋯</span>更多</button>
      </nav>
      <div id="home-toast" class="home-toast" hidden></div>
    `;
    const enterLife = () => {
      state.selectedEvent = null;
      state.eventConfirmOpen = false;
      state.selectAllySlot = null;
      state.fighterDetailId = null;
      state.detailSkillPick = null;
      if (shouldResumeToResult()) {
        state.screen = "result";
        render();
        return;
      }
      if (!state.lifePrepped) { state.screen = "prep"; }
      else if (!state.originId) { state.screen = "origin"; }
      else if ((state.fateYearIndex | 0) < 3) {
        state.fateOffer = normalizeFateOffer(state.fateOffer);
        state.screen = "fate";
      }
      else { state.screen = "events"; }
      render();
    };
    const toast = (msg) => {
      const el = $("#home-toast", root);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(el._t);
      el._t = setTimeout(() => { el.hidden = true; }, 1600);
    };
    const hasUnfinishedLife = () => !!(state.lifePrepped);
    $("#btn-go", root).onclick = () => {
      if (hasUnfinishedLife()) {
        toast("現在有未完人生——請點選「繼續上次未完人生」，或先「放棄今世」再開新局。");
        return;
      }
      enterLife();
    };
    $("#btn-continue-life", root).onclick = () => {
      if (!hasUnfinishedLife()) {
        toast("未有未完人生——請先「開始人生」。");
        return;
      }
      toast("讀取上次存檔");
      enterLife();
    };
    $("#side-ledger", root).onclick = () => {
      if (hasUnfinishedLife()) enterLife();
      else enterLife();
    };
    const openStoryPacks = () => {
      ensureActiveStoryPack();
      state.screen = "storyPacks";
      render();
    };
    const btnStory = $("#btn-story", root);
    if (btnStory) btnStory.onclick = openStoryPacks;
    const packCoverBtn = $("#home-pack-cover", root);
    if (packCoverBtn) {
      packCoverBtn.onclick = openStoryPacks;
      packCoverBtn.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          openStoryPacks();
        }
      };
    }
    ["side-spin","side-welfare","side-path","tab-more"].forEach((id) => {
      const el = $("#"+id, root);
      if (el) el.onclick = () => toast("這個位置尚未開放——請點選「舊帳」或「開始人生／繼續上次未完人生」繼續。");
    });
    const tabTea = $("#tab-teahouse", root);
    if (tabTea) {
      tabTea.removeAttribute("aria-disabled");
      tabTea.onclick = () => { state.screen = "teaHouse"; render(); };
    }
    const tabBook = $("#tab-book", root);
    if (tabBook) tabBook.onclick = () => { state.screen = "album"; render(); };
    const tabJobs = $("#tab-jobs", root);
    if (tabJobs) {
      tabJobs.removeAttribute("aria-disabled");
      tabJobs.onclick = () => {
        ensureDaily();
        state.screen = "missions";
        render();
      };
    }
  }

  /**
   * t386：事件卡面的「一句故事」。
   *
   * 用事件本身的 desc 首句（唔用 reward_blurb，因為 reward_blurb 係機制摘要，
   * 例如「免費戰鬥卡・三選一」「五年一劫・強敵」，一睇就知結果）。
   * 太長就截到第一個句號，最多 30 字，避免卡片被文字撐爆。
   */
  function eventStoryTeaser(ev) {
    const desc = String((ev && ev.desc) || "").trim();
    if (!desc) return "";
    const first = desc.split(/(?<=[。！？])/)[0] || desc;
    const t = first.trim();
    if (t.length <= 30) return t;
    return t.slice(0, 29) + "…";
  }

  function viewEvents(root) {
    if ((state.fateYearIndex | 0) < 3) {
      state.fateOffer = normalizeFateOffer(state.fateOffer);
      state.screen = "fate";
      viewFate(root);
      return;
    }
    const yearEvs = rollYearEvents(state.year);
    const cards = yearEvs
      .map((ev) => {
        /*
         * t386：卡面分類唔可以劇透。
         * special_battle 的 category_label 係「宿敵」——一睇就知係 boss 年。
         * 卡面一律用中性標籤（card_label 優先），真分類留到確認彈窗才顯示。
         */
        const catLabel = ev.card_label || eventCategoryLabel(ev);
        const catCls = "cat-default";
        const cardName = ev.card_name || ev.name;
        const isMinigame = ev.category === "minigame";
        const isFaction = ev.category === "faction";
        const isGift = ev.category === "card_gift";
        /*
         * t386：卡面唔再講「可能開打／直接收工／免費三選一」呢類後果預告，
         * 只保留「呢一年係咩事」——即事件本身的分類（主線／支線／節慶…）。
         * 總導演：顯示獎勵同結果，就失去選擇的樂趣。
         */
        const outcome = "";
        const tagCls = "";
        const helpKey = isMinigame ? "event-minigame" : (isFaction ? "event-faction" : (isGift ? "event-gift" : (ev.battle ? "event-battle" : "event-soft")));
        /*
         * t386：獎勵 chip 全部移除（+膠幣／+經驗／+金幣／+屬性）。
         * 玩家揀完、結算時才見賺到咩。
         */
        const rewardRow = "";
        /*
         * t386：卡面「劇透」一律唔顯示。
         *
         * 原本卡面有一行 `reward_blurb`（「教學戰・膠幣少許」「力＋2・無戰」
         * 「免費戰鬥卡・三選一」「破關滿獎・失敗半獎」…），等於喺選擇前講晒結果。
         * 總導演：顯示出來就失去選擇的樂趣。
         *
         * 現在卡面只講「呢一年街上發生咩事」——用事件本身的故事描述（desc）首句。
         * 唔顯示獎勵、唔顯示會唔會打、唔顯示玩法機制。
         */
        const blurbText = eventStoryTeaser(ev);
        const blurbHtml = blurbText
          ? `<div class="ev-card-blurb">${esc(blurbText)}</div>`
          : "";
        return `
        <button class="event-card" type="button" data-id="${esc(ev.id)}" data-help="${helpKey}" aria-label="${esc(cardName)}">
          <span class="ev-cat-pill ${catCls}"><i class="ev-cat-dot" aria-hidden="true"></i>${esc(catLabel)}</span>
          <img src="${esc(ev.art)}" alt="${esc(cardName)}" />
          <div class="label">
            <div class="ev-name">${esc(cardName)}</div>
            ${outcome ? `<span class="tag ${tagCls}">${esc(catLabel)} · ${esc(outcome)}</span>` : ""}
            <div class="ev-rewards">${rewardRow}</div>
            ${blurbHtml}
          </div>
        </button>`;
      })
      .join("");

    let confirmModal = "";
    const selectedEv = state.selectedEvent;
    const dialogueOnly = !!(selectedEv && !selectedEv.battle
      && Array.isArray(selectedEv.dialogue) && selectedEv.dialogue.length);
    if (state.eventConfirmOpen && selectedEv && (selectedEv.battle || dialogueOnly)) {
      const ev = selectedEv;
      const roster = ev.battle ? encounterEnemyRoster(ev) : [];
      const preview = roster
        .map((e) => {
          const helpE = enemyHelpText(e);
          return `
          <div class="ec-enemy has-help" data-help="enemy-card" data-help-rich="enemy" data-help-payload="${enemyHelpPayloadAttr(e)}" data-help-text="${helpTextAttr(helpE)}" role="button" tabindex="0" aria-label="${esc(e.name)}（長按查看內容）">
            <img src="${esc(e.art)}" alt="${esc(e.name)}" draggable="false" />
            <div class="ec-en-name">${esc(e.name)}</div>
          </div>`;
        })
        .join("");
      confirmModal = `
        <div class="modal-mask" id="event-confirm-mask" role="dialog" aria-modal="true" aria-label="${ev.battle ? "開始事件？" : "事件對白"}">
          <div class="modal-sheet event-confirm-sheet" id="event-confirm-sheet">
            <div class="modal-title">${ev.battle ? "開始事件？" : "呢一年，街上有事"}</div>
            <div class="ec-name">${esc(ev.name)}</div>
            <p class="ec-desc">${esc(ev.desc || "")}</p>
            ${eventDialogueHtml(ev, "ec-dialogue")}
            ${preview ? `<div class="ec-enemy-row">${preview}</div>` : ""}
            <div class="modal-actions">
              <button type="button" class="btn ghost" id="btn-ec-cancel">我改主意了</button>
              <button type="button" class="btn gold" id="btn-ec-go">${ev.battle ? "開始吧" : "睇完，繼續"}</button>
            </div>
          </div>
        </div>`;
    }

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("今次遭遇")}</div>
      <div class="speed-strip"></div>
      <p class="sub">本年 ${yearEvs.length} 張揀一 · 揀完先知結果</p>
      <div class="event-grid pick-4-grid">${cards}</div>
      <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      ${confirmModal}
      ${storyDockHtml()}
    `;
    root.querySelectorAll(".event-card").forEach((btn) => {
      btn.onclick = () => pickEvent(btn.dataset.id);
    });
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
    const mask = $("#event-confirm-mask", root);
    if (mask) {
      mask.onclick = (e) => {
        if (e.target !== mask) return;
        state.eventConfirmOpen = false;
        state.selectedEvent = null;
        render();
      };
      $("#btn-ec-cancel", root).onclick = () => {
        state.eventConfirmOpen = false;
        state.selectedEvent = null;
        render();
      };
      $("#btn-ec-go", root).onclick = () => {
        const ev = state.selectedEvent;
        state.eventConfirmOpen = false;
        // 無戰但有對白的主線（例如「熄燈之前」）：睇完對白 → 直接入結算，唔入編隊
        if (ev && !ev.battle) {
          state.screen = "soft";
          render();
          return;
        }
        state.selectAllySlot = null;
        state.fighterDetailId = null;
        state.detailSkillPick = null;
        /*
         * t396：一律先入編隊頁，**唔可以**直接開打。
         *
         * 舊行為：`applyRememberedDeploy()` 成功且「唔需要玩家補位」時會 `startBattle()` 直接開打，
         * 玩家完全冇機會換卡。總導演要求：「按下『開始吧』後可選擇更換出場戰鬥卡，
         * 但預設是上一輪戰鬥的未陣亡戰鬥卡，不能按下『開始吧』就直接自動戰鬥。」
         *
         * 現行為：套用上一輪配置（只保留未陣亡者）→ 入編隊頁 → 玩家按「開始戰鬥」才開打。
         */
        const resumed = applyRememberedDeploy();
        if (!resumed) state.deploy = [];
        state.deployHint = resumed
          ? "已沿用上次出場陣容（陣亡／離隊嘅已自動移除）——可換卡，準備好先按「開始戰鬥」。"
          : "揀好出場陣容，然後按「開始戰鬥」。";
        state.deployConfirmPending = false;
        state.screen = "encounter";
        render();
      };
    }
  }

  function pickEvent(id) {
    const ev = DATA.events.find((e) => e.id === id);
    if (!ev) return;
    state.selectedEvent = ev;
    state.softNote = "";
    const cat = ev.category || "";
    // 小遊戲：入 minigame 畫面，唔直接開戰／唔直接 soft
    if (cat === "minigame") {
      state.eventConfirmOpen = false;
      state.minigame = null;
      state.screen = "minigame";
      render();
      return;
    }
    // 勢力支線：入選擇畫面（幫／拒／中立）；唔卡死人生
    if (cat === "faction") {
      state.eventConfirmOpen = false;
      state.factionChoiceResult = null;
      state.screen = "faction";
      render();
      return;
    }
    // 人生店鋪：四選一・金幣購買（skill_swap 仍走 stub）
    if (cat === "shop_equip" || cat === "shop_fighter" || cat === "shop_skill") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.shop = {
        category: cat,
        offers: buildShopOffers(cat),
        bought: false,
      };
      state.screen = "shop";
      render();
      return;
    }
    if (cat === "skill_swap") {
      applyShopOrSwapStub(ev);
      state.eventConfirmOpen = false;
      state.screen = "soft";
      render();
      return;
    }
    // 交換卡：先交出己卡，再四選一換入（唔扣金幣）
    if (cat === "card_trade") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.trade = { phase: "give", giveId: null, offers: null };
      state.screen = "trade";
      render();
      return;
    }
    // 送卡：免費三選一（唔扣金幣）
    if (cat === "card_gift") {
      state.eventConfirmOpen = false;
      state.cardGift = null;
      state.screen = "cardGift";
      render();
      return;
    }
    // 升星攤：金幣升戰鬥卡星（唔燒合卡複本）
    if (cat === "star_up") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.starUp = { focusId: null };
      state.screen = "starup";
      render();
      return;
    }
    // t366：裝備強化攤（金幣直接＋星，唔需要同名卡）
    if (cat === "gear_upgrade") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.gearUpgrade = { done: null };
      state.screen = "gearup";
      render();
      return;
    }
    // t366：戰鬥卡練功（直接給卡經驗／等級）
    if (cat === "fighter_train") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.fighterTrain = { done: null };
      state.screen = "train";
      render();
      return;
    }
    // t366：復活陣亡戰鬥卡
    if (cat === "fighter_revive") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.fighterRevive = { done: null };
      state.screen = "revive";
      render();
      return;
    }
    // t366：抽卡事件（免費／低價，直接入袋）
    if (cat === "card_draw") {
      state.eventConfirmOpen = false;
      state.cardGift = null;
      state.screen = "cardGift";
      render();
      return;
    }
    // t369：通用故事鏈節點（任何故事包）
    if (isTaleNodeEvent(ev)) {
      state.eventConfirmOpen = false;
      if (!state.taleRun || state.taleRun.nodeId !== ev.id) {
        if (!state.taleRun || state.taleRun.packId !== (ev.tale_pack || state.activeStoryPackId)) {
          taleBeginRun(ev.tale_pack || state.activeStoryPackId);
        }
        if (state.taleRun) state.taleRun.nodeId = ev.id;
      }
      state.screen = "tale";
      render();
      return;
    }
    // t364：故事包分支鏈節點 → 分支選擇畫面（隱藏後果，選完才揭示）
    if (isOfficeChainEvent(ev)) {
      state.eventConfirmOpen = false;
      if (!state.officeRun || state.officeRun.nodeId !== ev.id) {
        // 玩家由事件卡直接點進某個節點（例如中途退出後再入）→ 由頭開始
        officeBeginRun();
        if (state.officeRun) state.officeRun.nodeId = ev.id;
      }
      state.screen = "office";
      render();
      return;
    }
    if (cat === "special" && !ev.battle) {
      applyEventAttrsDelta(ev);
      const bits = formatAttrsDelta(ev.attrs_delta);
      state.softNote = bits.length ? bits.join("、") : "特殊：無戰結算";
      state.eventConfirmOpen = false;
      state.screen = "soft";
      render();
      return;
    }
    // main／side／trial／adventure／special_battle：有戰→確認；有對白→先播對白；其餘→soft
    if (ev.battle) {
      state.eventConfirmOpen = true;
      state.screen = "events";
      render();
    } else if (Array.isArray(ev.dialogue) && ev.dialogue.length) {
      // 無戰但有對白的主線：先睇對白再入結算（之前一段對白會被直接跳過）
      state.eventConfirmOpen = true;
      state.screen = "events";
      render();
    } else {
      state.eventConfirmOpen = false;
      state.screen = "soft";
      render();
    }
  }

  /* ---------- t364／t406：故事包分支畫面「打工仔輓歌」 ---------- */

  /**
   * t406：四拍敘事（總導演要求）
   *
   *   進場短敘（desc） → 對白（可逐句／分頁） → 選擇 → 專屬後果文 → 下一幕
   *
   * 舊版係「三選一選單 → 即刻跳下一步」，選後只有一句抽象路線提示，
   * 玩家睇唔到場面後果。現在每步都分階段顯示，`run.phase` 控制。
   *
   * 時間軸：改用「第 N 幕」，唔再每步 +1 歲（原本 18→27 歲同正文對唔上）。
   */
  const OFFICE_TOTAL_ACTS = 10;

  function officeActOf(run) {
    const r = run || state.officeRun;
    if (!r) return 1;
    return Math.max(1, Math.min(OFFICE_TOTAL_ACTS, r.step | 0));
  }

  /** 分頁顯示對白：每頁 2 句（避免一次倒出成牆字） */
  function officeDialoguePages(node) {
    const lines = (node && Array.isArray(node.dialogue)) ? node.dialogue.filter((x) => x && String(x.text || "").trim()) : [];
    const per = 2;
    const pages = [];
    for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
    return pages;
  }

  /** 對白區（當前頁） */
  function officeDialoguePageHtml(node, page) {
    const pages = officeDialoguePages(node);
    if (!pages.length) return "";
    const p = Math.max(0, Math.min(pages.length - 1, page | 0));
    const lines = pages[p];
    const rows = lines.map((d) => {
      const who = d.speaker || d.who || "";
      const text = d.text || d.line || "";
      const whoHtml = who ? `<b class="dlg-who">${esc(who)}</b>：` : "";
      return `<p class="dlg-line">${whoHtml}${esc(text)}</p>`;
    }).join("");
    return `<div class="of-dialogue of-dialogue-paged" data-page="${p}" data-total="${pages.length}">
      ${rows}
      <div class="of-dialogue-foot"><span class="of-page-no">${p + 1} / ${pages.length}</span></div>
    </div>`;
  }

  function viewOffice(root) {
    const run = state.officeRun;
    const node = run ? officeNodeView(officeNodeById(run.nodeId), run) : officeStartNode();
    if (!node) {
      state.screen = "events";
      render();
      return;
    }
    if (!run) {
      officeBeginRun();
      render();
      return;
    }

    const pack = officePack();
    const totalSteps = Math.max(1, ((pack && pack.office_chain) || []).length);
    const stepNo = Math.min(totalSteps, Math.max(1, run.step | 0));
    const actNo = officeActOf(run);
    const choices = Array.isArray(node.office_choices) ? node.office_choices : [];
    const pages = officeDialoguePages(node);
    const page = Math.max(0, Math.min(Math.max(0, pages.length - 1), run.dlgPage | 0));

    /* 階段：intro → dialogue → choose → outcome */
    let phase = run.phase || "intro";
    if (phase === "dialogue" && !pages.length) phase = "choose";
    if (phase === "outcome" && !(run.reveal && run.reveal.outcome)) phase = "choose";
    run.phase = phase;

    const reveal = (phase === "outcome") ? run.reveal : null;

    /* HUD：主線用「第 N 幕」，唔再顯示歲數（避免同正文對唔上） */
    const hudLeft = `${esc(pack ? pack.name : "故事包")} · 第 ${actNo} 幕 / ${totalSteps}`;

    /* 進場短敘（desc）— intro 階段只顯示這一段 */
    const introHtml = phase === "intro"
      ? `<div class="of-intro">
           <img class="of-node-art of-intro-art" src="${esc(node.art || "")}" alt="" />
           <div class="of-intro-name">${esc(node.name)}</div>
           <p class="of-intro-desc">${esc(node.desc || "")}</p>
         </div>`
      : "";

    /* 對白階段 */
    const dialogueHtml = phase === "dialogue" ? officeDialoguePageHtml(node, page) : "";

    /* 選擇卡：唔預先透露結果 */
    const choiceHtml = phase === "choose" ? choices.map((c, i) => {
      const label = String.fromCharCode(65 + i);
      return `<button type="button" class="of-choice" data-choice="${i}" aria-label="選項${label}：${esc(c.text)}">
        <span class="of-choice-tag">選項 ${label}</span>
        <span class="of-choice-text">${esc(c.text)}</span>
        <span class="of-choice-unknown">後果未知 · 選後揭曉</span>
      </button>`;
    }).join("") : "";

    /* 專屬後果（選後 2–4 句，講角色／金錢／處境） */
    const outcomeHtml = reveal
      ? `<div class="of-outcome" role="status" data-step="${esc(String(reveal.step || stepNo))}">
           <div class="of-outcome-kicker">第 ${esc(String(reveal.step || stepNo))} 幕・你揀了</div>
           <p class="of-outcome-choice">「${esc(reveal.choiceText)}」</p>
           <div class="of-outcome-body">${esc(reveal.outcome)}</div>
         </div>`
      : "";

    /* 主要 CTA（按階段不同） */
    let cta = "";
    if (phase === "intro") {
      cta = `<button class="btn gold of-cta-main" id="of-next" type="button">${pages.length ? "繼續" : "揀"}</button>`;
    } else if (phase === "dialogue") {
      const last = page >= pages.length - 1;
      cta = `<button class="btn gold of-cta-main" id="of-next" type="button">${last ? "揀" : "下一句"}</button>`;
    } else if (phase === "choose") {
      cta = "";  /* 選擇用卡本身 */
    } else {
      /* outcome：明確「繼續下一幕」，唔可以同其他地方共用點擊 */
      const isFinal = stepNo >= totalSteps;
      cta = `<button class="btn gold of-cta-main" id="of-next" type="button">${isFinal ? "睇結局" : `去第 ${stepNo + 1} 幕`}</button>`;
    }

    const trail = (run.chosen || []).map((c, i) =>
      `<li class="of-trail-item"><span class="of-trail-step">${i + 1}</span>${esc(c.text)}</li>`
    ).join("");

    root.innerHTML = `
      <div class="of-hud">${hudLeft}</div>
      <div class="office-node of-phase-${esc(phase)}">
        ${introHtml}
        ${dialogueHtml}
        ${choiceHtml}
        ${outcomeHtml}
        ${trail && phase === "choose" ? `<details class="of-trail"><summary>已行過嘅路（${run.chosen.length}）</summary><ol>${trail}</ol></details>` : ""}
        <p class="of-note">此故事包不設獎賞與升級；行到最後才知道結果。</p>
      </div>
      ${cta}
      <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      ${storyDockHtml()}
    `;

    /* 選擇 */
    root.querySelectorAll(".of-choice[data-choice]").forEach((btn) => {
      btn.onclick = () => {
        if (run.phase !== "choose") return;
        const idx = parseInt(btn.dataset.choice, 10) | 0;
        const info = officeApplyChoice(idx);
        if (!info) return;
        /* t406：唔即刻跳下一步，先顯示專屬後果（outcome 階段） */
        render();
      };
    });

    /* CTA（分階段推進，唔會同選擇或其他點擊衝突） */
    const nextBtn = $("#of-next", root);
    if (nextBtn) {
      nextBtn.onclick = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (run.phase === "intro") {
          run.phase = pages.length ? "dialogue" : "choose";
          run.dlgPage = 0;
          render();
          return;
        }
        if (run.phase === "dialogue") {
          if (page < pages.length - 1) {
            run.dlgPage = page + 1;
            render();
          } else {
            run.phase = "choose";
            render();
          }
          return;
        }
        if (run.phase === "outcome") {
          run.reveal = null;
          run.phase = "intro";
          run.dlgPage = 0;
          officeAdvanceAfterChoice();
          render();
          return;
        }
      };
    }

    const ab = $("#btn-abandon", root);
    if (ab) ab.onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /**
   * 選完之後推進：
   *  - 非最後節點 → 去下一個鏈節點
   *  - 最後節點 → 依 route 分數算出結局，入結局事件（soft 畫面，+50 膠幣）
   */
  function officeAdvanceAfterChoice() {
    const run = state.officeRun;
    if (!run) return;
    const pack = officePack();
    const chain = (pack && Array.isArray(pack.office_chain)) ? pack.office_chain : [];
    const idx = chain.indexOf(run.nodeId);
    const isLast = idx >= 0 ? idx >= chain.length - 1 : true;

    if (!isLast) {
      const nextNode = officeNodeById(chain[idx + 1]);
      if (nextNode) {
        run.nodeId = nextNode.id;
        run.step = (run.step | 0) + 1;
        // t365：分支鏈年齡由 officeAge() 推算，唔改 state.age（見 officeBeginRun 註解）
        return;
      }
    }

    // 走完鏈：算結局
    const fin = officeFinishRun();
    if (fin && fin.endingEv) {
      if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
      state.lifeFlags["office_route_" + fin.routeKey] = 1;
      /*
       * t375：同時寫入 `office_ending_<id>`（同結局事件自身嘅 flag_on_complete 一致）。
       * 原本只寫 `office_route_*`，而 `eventExcludedFromYearPool()` 檢查 `office_ending_*`
       * → 排除永遠唔生效 → 完成後「第一日返工」仍然會再出現（總導演回報的循環問題）。
       */
      const endFlag = fin.endingEv.flag_on_complete || ("office_ending_" + fin.routeKey);
      state.lifeFlags[endFlag] = 1;
      state.lifeFlags["office_ending_" + fin.routeKey] = 1;
      state.officeEndAge = officeAge(run);
      state.selectedEvent = fin.endingEv;
      state.officeRun = null;
      state.softNote = "";
      state.screen = "soft";
      return;
    }
    // 極端情況：找不到結局 → 回事件頁（避免卡死）
    state.officeRun = null;
    state.screen = "events";
  }

  /**
   * t379：故事步之間嘅場面過渡（小標題 + 淡入）。
   *
   * 問題（總導演回報「跳戲」）：每一步之間冇任何轉場，
   * 玩家由第 3 步直接跳到第 4 步，只見到節點名改變，冇「過咗一段時間」嘅感覺。
   * 修法：每步頂部加一條「第 N 步 · XX 歲 · 場景」小標題，並用淡入動畫。
   * 場景由節點 `tale_scene` 指定；冇指定就用節點名的前綴推導。
   */
  function taleSceneLabel(node) {
    if (!node) return "";
    if (node.tale_scene) return String(node.tale_scene);
    // 由節點名推導：例如「第一夜・天台」→「天台」
    const nm = String(node.name || "");
    const parts = nm.split(/[・·]/);
    return parts.length > 1 ? parts[parts.length - 1].trim() : "";
  }

  function taleTransitionHtml(pack, run, node, stepNo, totalSteps) {
    const age = taleAge(run);
    const scene = taleSceneLabel(node);
    const bits = [`第 ${stepNo} 步`];
    if (age) bits.push(`${age} 歲`);
    if (scene) bits.push(scene);
    const label = bits.join(" · ");
    return `<div class="tl-transition" aria-label="場面過渡">
      <span class="tl-transition-rule" aria-hidden="true"></span>
      <span class="tl-transition-label">${esc(label)}</span>
      <span class="tl-transition-rule" aria-hidden="true"></span>
    </div>`;
  }

  /** t369：通用故事鏈畫面（含角色關係顯示） */
  function viewTale(root) {
    const run = state.taleRun;
    if (!run) {
      state.screen = "events";
      render();
      return;
    }
    const pack = talePackById(run.packId);
    const node = taleNodeById(run.nodeId);
    if (!node) {
      state.taleRun = null;
      state.screen = "events";
      render();
      return;
    }
    const chain = (pack && pack.tale_chain) || [];
    const totalSteps = Math.max(1, chain.length);
    const stepNo = Math.min(totalSteps, Math.max(1, run.step | 0));
    const choices = Array.isArray(node.tale_choices) ? node.tale_choices : [];
    const reveal = run.reveal;
    run.reveal = null; // 只顯示一次

    // 立即後果
    const revealHtml = reveal
      ? `<div class="of-reveal" role="status">
           <div class="of-reveal-label">剛才（${esc(reveal.nodeName)}）</div>
           <p class="of-reveal-choice">「${esc(reveal.choiceText)}」</p>
           ${reveal.outcome ? `<p class="of-reveal-outcome">${esc(reveal.outcome)}</p>` : ""}
           ${reveal.bondNote ? `<p class="tl-bond-note">${esc(reveal.bondNote)}</p>` : ""}
         </div>`
      : "";

    // 角色出場：顯示弧線對白
    const cast = Array.isArray(node.tale_cast) ? node.tale_cast : [];
    const castHtml = cast.map((ch) => {
      const line = taleLineForCharacter(ch, run);
      const b = run.bond[ch.id] | 0;
      const bondTag = b !== 0
        ? `<span class="tl-bond ${b > 0 ? "warm" : "cold"}">${esc(taleBondLabel(b))}</span>`
        : "";
      return `<div class="tl-char">
        <div class="tl-char-head">
          <span class="tl-char-name">${esc(ch.name)}</span>
          <span class="tl-char-role">${esc(ch.role || "")}</span>
          ${bondTag}
        </div>
        ${line ? `<p class="tl-char-line">「${esc(line)}」</p>` : ""}
      </div>`;
    }).join("");

    const choiceHtml = choices.map((c, i) => {
      const label = String.fromCharCode(65 + i);
      return `<button type="button" class="of-choice tl-choice" data-tale-choice="${i}" aria-label="選項${label}：${esc(c.text)}">
        <span class="of-choice-tag">選項 ${label}</span>
        <span class="of-choice-text">${esc(c.text)}</span>
        <span class="of-choice-unknown">後果未知 · 選後揭曉</span>
      </button>`;
    }).join("");

    const trail = (run.chosen || []).map((c, i) =>
      `<li class="of-trail-item"><span class="of-trail-step">${i + 1}</span>${esc(c.text)}${c.bondNote ? `<i class="of-trail-bond">${esc(c.bondNote)}</i>` : ""}</li>`
    ).join("");

    // 角色關係總覽
    const allCast = [];
    (pack && Array.isArray(pack.tale_cast_profiles) ? pack.tale_cast_profiles : []).forEach((c) => allCast.push(c));
    (node.tale_cast || []).forEach((c) => {
      if (!allCast.some((x) => x.id === c.id)) allCast.push(c);
    });
    const nameOfCast = (cid) => {
      const hit = allCast.find((x) => x.id === cid);
      if (hit && hit.name) return hit.name;
      // 再退回：全故事鏈任何節點用過的角色
      for (const nid of (pack && pack.tale_chain) || []) {
        const nn = taleNodeById(nid);
        const c2 = nn && (nn.tale_cast || []).find((x) => x.id === cid);
        if (c2 && c2.name) return c2.name;
      }
      return cid;
    };
    const bondKeys = Object.keys(run.bond || {});
    const bondSummary = bondKeys.length
      ? `<div class="tl-bonds"><span class="tl-bonds-label">人物</span>${bondKeys.map((cid) => {
          const v = run.bond[cid] | 0;
          return `<span class="tl-bond-chip ${v > 0 ? "warm" : (v < 0 ? "cold" : "")}">${esc(nameOfCast(cid))} · ${esc(taleBondLabel(v))}</span>`;
        }).join("")}</div>`
      : "";

    root.innerHTML = `
      <div class="of-hud">${esc(pack ? pack.name : "故事")} · ${taleAge(run)}歲 · 第 ${stepNo} / ${totalSteps} 步</div>
      <div class="office-node tl-node">
        ${revealHtml}
        ${taleTransitionHtml(pack, run, node, stepNo, totalSteps)}
        <div class="of-node-head">
          ${node.art ? `<img class="of-node-art" src="${esc(node.art)}" alt="" />` : ""}
          <div class="of-node-copy">
            <div class="of-node-name">${esc(node.name)}</div>
            <p class="of-node-desc">${esc(node.desc || "")}</p>
          </div>
        </div>
        ${eventDialogueHtml(node, "of-dialogue")}
        ${castHtml ? `<div class="tl-cast">${castHtml}</div>` : ""}
        ${bondSummary}
        <div class="of-choices">${choiceHtml}</div>
        ${trail ? `<details class="of-trail"><summary>已行過嘅路（${run.chosen.length}）</summary><ol>${trail}</ol></details>` : ""}
        <p class="of-note">每一步都會改變人與人之間嘅距離；行到最後，關係決定你嘅結局。</p>
      </div>
      <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      ${storyDockHtml()}
    `;

    root.querySelectorAll(".tl-choice[data-tale-choice]").forEach((btn) => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.taleChoice, 10) | 0;
        const info = taleApplyChoice(idx);
        if (!info) return;
        taleAdvanceAfterChoice();
        render();
      };
    });
    const ab = $("#btn-abandon", root);
    if (ab) ab.onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  function viewFaction(root) {
    const ev = state.selectedEvent;
    if (!ev || ev.category !== "faction") {
      state.screen = "events";
      render();
      return;
    }
    ensureFactionsState();
    const fid = ev.faction_id || "";
    const fname = factionName(fid);
    const curFavor = fid ? factionFavor(fid) : 0;
    const result = state.factionChoiceResult;

    if (result) {
      // 結果畫面出現時頂欄已入帳（同 EV39 rewardApplied；唔等「繼續」）
      if (!result.rewardApplied) {
        state.soul += (result.soul | 0);
        if ((result.xp | 0) > 0) gainXp(result.xp | 0);
        if ((result.gold | 0) > 0) state.gold = (state.gold | 0) + (result.gold | 0);
        if (result.attrs_delta && typeof result.attrs_delta === "object") {
          if (!state.attrs) state.attrs = defaultAttrs();
          Object.keys(result.attrs_delta).forEach((k) => {
            state.attrs[k] = (state.attrs[k] | 0) + (result.attrs_delta[k] | 0);
          });
          if (state.team.length > pocketCap()) state.team = state.team.slice(0, pocketCap());
        }
        if (ev.flag_on_complete) {
          if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
          state.lifeFlags[ev.flag_on_complete] = 1;
        }
        result.rewardApplied = true;
      }
      const curFavorNow = fid ? factionFavor(fid) : curFavor;
      // 好感句去重：favorNote 已喺 note／extra 出現則唔再單獨顯示
      const normPlus = (s) => String(s || "").replace(/＋/g, "+").replace(/−/g, "-");
      const noteText = result.note || ev.reward_blurb || "勢力";
      const noteN = normPlus(noteText);
      let favorShow = result.favorNote || "";
      if (favorShow && noteN.includes(normPlus(favorShow))) favorShow = "";
      const extras = (result.extraNotes || []).filter((t) => t && !noteN.includes(normPlus(t)) && normPlus(t) !== normPlus(favorShow));
      const favorBits = favorShow ? `<span style="color:var(--neon-pink);font-weight:800">${esc(favorShow)}</span><br/>` : "";
      const extraBits = extras.length ? extras.map((t) => esc(t)).join(" · ") + "<br/>" : "";
      root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name))}</div>
      <div class="soft-scroll soft-reveal">
        <img class="result-art soft-art" src="${esc(ev.art)}" alt="" />
        <div class="bubble neon">${esc(result.choiceLabel || "已選擇")}</div>
        <div class="soft-panel">${favorBits}${extraBits}${esc(noteText)}
          <br/>今世賺了 <b style="color:var(--neon-gold)">+${result.soul | 0}</b> 膠幣${(result.xp | 0) ? ` · 經驗 +${result.xp | 0}` : ""}${(result.gold | 0) ? ` · 金幣 +${result.gold | 0}` : ""}
          · <span style="color:var(--neon-cyan)">${esc(fname)} ${curFavorNow}/${FACTION_FAVOR_MAX}</span>
          · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span>
        </div>
      </div>
      <div class="soft-cta">
        ${autoAdvanceBarHtml(`下一歲 ${state.age + 1}歲`)}
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    const settleFaction = () => {
        const r = state.factionChoiceResult;
        // 貨幣／經驗／attrs／flag 已喺結果畫面入帳；此處只兜底（舊存檔中途再開）
        if (r && !r.rewardApplied) {
          state.soul += (r.soul | 0);
          if ((r.xp | 0) > 0) gainXp(r.xp | 0);
          if ((r.gold | 0) > 0) state.gold = (state.gold | 0) + (r.gold | 0);
          if (r.attrs_delta && typeof r.attrs_delta === "object") {
            if (!state.attrs) state.attrs = defaultAttrs();
            Object.keys(r.attrs_delta).forEach((k) => {
              state.attrs[k] = (state.attrs[k] | 0) + (r.attrs_delta[k] | 0);
            });
            if (state.team.length > pocketCap()) state.team = state.team.slice(0, pocketCap());
          }
          if (ev.flag_on_complete) {
            if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
            state.lifeFlags[ev.flag_on_complete] = 1;
          }
          r.rewardApplied = true;
        }
        trackEventMission(ev, { soft: true });
        advanceYear();
        state.selectedEvent = null;
        state.factionChoiceResult = null;
        state.softNote = "";
        if (lifeDoneFlag()) {
          state.lastResult = {
            win: true,
            reward: 0,
            rewardBlurb: lifeEndBlurb(),
            eventName: lifeEndName(),
            deadNames: [],
          };
          state.screen = "result";
        } else {
          state.screen = afterFateOrEventScreen();
        }
        render();
    };
    /*
     * t387：勢力結果浮現之後自動前進，唔需要撳「繼續」。
     */
    let facAdvanced = false;
    const facAdvance = () => {
      if (facAdvanced) return;
      facAdvanced = true;
      clearAutoAdvance();
      settleFaction();
    };
    wireTapToAdvance(root, facAdvance);
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
    return;
    }

    const choices = Array.isArray(ev.faction_choices) && ev.faction_choices.length
      ? ev.faction_choices
      : [
          { id: "help", label: "出手幫忙", favor_delta: 1, soul: 12, xp: 3, note: `${fname}＋1` },
          { id: "neutral", label: "觀望片刻", favor_delta: 0, soul: 6, xp: 1, note: "中立・好感不變" },
          { id: "refuse", label: "婉拒離開", favor_delta: -1, soul: 4, xp: 1, note: `${fname}−1` },
        ];
    /*
     * t386：勢力選項唔再顯示「好感＋1 · 膠幣 +12」。
     * 玩家只睇立場描述，揀完先見後果（同故事分支一致）。
     */
    const btns = choices
      .map((c) => {
        return `<button type="button" class="btn fac-choice" data-choice="${esc(c.id)}" data-help="event-faction">
          <span class="fac-choice-label">${esc(c.label)}</span>
        </button>`;
      })
      .join("");

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name))}</div>
      <div class="soft-scroll">
        <img class="result-art soft-art" src="${esc(ev.art)}" alt="" />
        <div class="bubble neon">${esc(ev.desc)}</div>
        <div class="soft-panel fac-meta">勢力：<b style="color:var(--neon-pink)">${esc(fname)}</b>
          <br/><span class="muted">請選擇立場——不會卡死人生。</span>
        </div>
        <div class="fac-choices">${btns}</div>
      </div>
      <div class="soft-cta">
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    root.querySelectorAll("[data-choice]").forEach((btn) => {
      btn.onclick = () => {
        const cid = btn.dataset.choice;
        const c = choices.find((x) => x.id === cid) || choices[0];
        const favorNoteRaw = adjustFactionFavor(fid, c.favor_delta | 0);
        const extraNotes = [];
        if (c.attrs_delta) {
          const bits = formatAttrsDelta(c.attrs_delta);
          if (bits.length) extraNotes.push(...bits);
        }
        const soul = soulFromBase(c.soul);
        if (soul !== (c.soul | 0)) extraNotes.push(`幸運×${luckRewardMult().toFixed(2)}`);
        const note = c.note || favorNoteRaw || "勢力結算";
        // 好感句去重：note 已含好感變化則 favorNote 留空（結果畫面只顯示一次）
        const normPlus = (s) => String(s || "").replace(/＋/g, "+").replace(/−/g, "-");
        let favorNote = favorNoteRaw || (c.favor_delta ? "" : "好感不變");
        if (favorNote && normPlus(note).includes(normPlus(favorNote))) favorNote = "";
        const extraFiltered = extraNotes.filter((t) => t && !normPlus(note).includes(normPlus(t)));
        state.factionChoiceResult = {
          choiceId: c.id,
          choiceLabel: c.label,
          note,
          favorNote,
          soul,
          xp: c.xp | 0,
          gold: c.gold | 0,
          attrs_delta: c.attrs_delta || null,
          extraNotes: extraFiltered,
          rewardApplied: false,
        };
        render();
      };
    });
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /** 通用小提示：用畫面上已有的 toast，冇就即場建一個 */
  function toastMsg(msg) {
    const root = document.getElementById("screen") || document.body;
    let el = document.getElementById("global-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "global-toast";
      el.className = "home-toast global-toast";
      root.appendChild(el);
    }
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 1800);
  }

  function shopToast(root, msg) {
    let el = $("#story-toast", root) || $("#home-toast", root);
    if (!el) {
      el = document.createElement("div");
      el.id = "home-toast";
      el.className = "home-toast";
      root.appendChild(el);
    }
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(shopToast._t);
    shopToast._t = setTimeout(() => { el.hidden = true; }, 1600);
  }

  /** 送卡事件：三選一免費卡片（優先未持有、唔重複） */
  function buildGiftOffers(kind) {
    ensureGearShape();
    albumEnsureState();
    const takeUnique = (ordered, n) => {
      const seen = new Set();
      const out = [];
      for (const it of ordered) {
        if (!it || !it.id || seen.has(it.id)) continue;
        seen.add(it.id);
        out.push(it);
        if (out.length >= n) break;
      }
      return out;
    };
    const prefer = (list) => {
      const usable = list.filter((x) => x && x.id);
      const withArt = usable.filter((x) => x.art && !String(x.art).includes("pending-manus"));
      const src = withArt.length >= 3 ? withArt : usable;
      const unowned = src.filter((x) => albumCardCount(x.id) <= 0);
      const owned = src.filter((x) => albumCardCount(x.id) > 0);
      return shuffleInPlace(unowned.slice()).concat(shuffleInPlace(owned.slice()));
    };
    let pool = [];
    let cardKind = "fighter";
    if (kind === "skill") {
      ensureLifeSkills();
      const inLife = new Set(state.lifeSkills || []);
      const all = (DATA.skills || []).filter((sk) => sk && sk.id);
      const notInLife = all.filter((sk) => !inLife.has(sk.id));
      pool = prefer(notInLife).concat(prefer(all.filter((sk) => inLife.has(sk.id))));
      cardKind = "skill";
    } else if (kind === "gear") {
      pool = prefer(equipItemList());
      cardKind = "gear";
    } else {
      const inTeam = new Set(state.team || []);
      /* t391：送卡／抽卡唔會出殘頁專屬卡 */
      const all = poolFighters();
      const notInTeam = all.filter((f) => !inTeam.has(f.id));
      pool = prefer(notInTeam).concat(prefer(all.filter((f) => inTeam.has(f.id))));
      cardKind = "fighter";
    }
    return takeUnique(pool, 3).map((it) => ({
      id: it.id,
      name: it.name || it.id,
      art: it.art || "",
      rarity: it.rarity || "",
      kind: cardKind,
      slot: it.slot || it.slot_id || null,
    }));
  }

  function viewCardGift(root) {
    const ev = state.selectedEvent;
    // t366：card_draw（抽卡事件）與 card_gift（送卡事件）共用同一套三選一畫面
    if (!ev || (ev.category !== "card_gift" && ev.category !== "card_draw")) {
      state.screen = "events";
      render();
      return;
    }
    if (!state.cardGift || state.cardGift.eventId !== ev.id) {
      state.cardGift = {
        eventId: ev.id,
        kind: ev.gift || "fighter",
        offers: buildGiftOffers(ev.gift || "fighter"),
        takenIdx: null,
        note: "",
        rewardApplied: false,
      };
    }
    const gift = state.cardGift;
    const taken = gift.takenIdx != null ? gift.offers[gift.takenIdx | 0] : null;
    const kindLabel = gift.kind === "skill" ? "技能" : (gift.kind === "gear" ? "裝備" : "戰鬥卡");

    const cards = gift.offers.map((o, idx) => {
      const rare = shopRarityLabel(o.rarity);
      const picked = gift.takenIdx != null && (gift.takenIdx | 0) === idx;
      const dimmed = gift.takenIdx != null && !picked;
      /*
       * t397：三選一卡面要顯示「卡牌內容」，唔止名同稀有度。
       * 總導演：「免費技能卡和免費戰鬥卡事件選擇，要顯示卡牌內容」。
       *
       * 分別用返各自嘅說明函式，抽最關鍵一兩行做摘要（完整內容仍然可以長按睇）。
       */
      const summary = giftOfferSummary(gift.kind, o);
      return `
        <button type="button" class="shop-card gift-card${picked ? " picked" : ""}${dimmed ? " dimmed" : ""}" data-gift-idx="${idx}" ${gift.takenIdx != null ? "disabled" : ""}
          data-help="gift-card" data-help-rich="${esc(gift.kind === "skill" ? "skill" : gift.kind === "gear" ? "gear" : "fighter")}"
          data-help-text="${helpTextAttr(giftOfferHelpText(gift.kind, o))}">
          <img src="${esc(o.art || "")}" alt="${esc(o.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(o.name || o.id)}</div>
            <div class="shop-card-rare">${esc(rare)}</div>
            ${summary ? `<div class="gift-card-desc">${esc(summary)}</div>` : ""}
            <div class="shop-price gift-tag">${picked ? "已收下" : "免費帶走"}</div>
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">暫時無卡可送</div>`;

    const rewardLine = `今世賺了 <b style="color:var(--neon-gold)">+${listedEventSoul(ev)}</b> 膠幣` +
      `${(ev.reward_xp | 0) ? ` · 經驗 +${ev.reward_xp | 0}` : ""}` +
      ` · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("送卡・" + esc(ev.name))}</div>
      <div class="shop-wrap">
        <p class="sub">${esc(ev.desc || "")}</p>
        <div class="gift-banner">${taken ? `已收下「${esc(taken.name || taken.id)}」` : `免費 ${kindLabel}・三選一（不用金幣）`}</div>
        <div class="shop-grid gift-grid">${cards}</div>
        ${taken ? `<div class="soft-panel">${esc(gift.note || "已加入收藏")}<br/>${rewardLine}</div>` : ""}
      </div>
      <div class="soft-cta">
        ${taken ? autoAdvanceBarHtml(`下一歲 ${state.age + 1}歲`) : ""}
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;

    root.querySelectorAll("[data-gift-idx]").forEach((btn) => {
      btn.onclick = () => {
        if (gift.takenIdx != null) return;
        const idx = btn.dataset.giftIdx | 0;
        const offer = gift.offers[idx];
        if (!offer) return;
        gift.takenIdx = idx;
        const extra = grantGiftCard(gift.kind, offer);
        gift.note = `已收下「${offer.name || offer.id}」` + (extra ? `（${extra}）` : "");
        render();
      };
    });

    const settleGift = () => {
        if (!gift.rewardApplied) {
          state.soul += listedEventSoul(ev);
          if ((ev.reward_xp | 0) > 0) gainXp(ev.reward_xp | 0);
          gift.rewardApplied = true;
        }
        trackEventMission(ev, { soft: true });
        state.cardGift = null;
        state.selectedEvent = null;
        state.softNote = "";
        advanceYear();
        if (lifeDoneFlag()) {
          state.lastResult = {
            win: true,
            reward: 0,
            rewardBlurb: lifeEndBlurb(),
            eventName: lifeEndName(),
            deadNames: [],
          };
          state.screen = "result";
        } else {
          state.screen = afterFateOrEventScreen();
        }
        render();
    };
    /*
     * t387：收卡之後浮現結果並自動前進，唔需要撳「繼續」。
     */
    if (taken) {
      let giftDone = false;
      const giftAdvance = () => {
        if (giftDone) return;
        giftDone = true;
        clearAutoAdvance();
        settleGift();
      };
      wireTapToAdvance(root, giftAdvance);
    }
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /**
   * t397：送卡／抽卡三選一的「卡面摘要」。
   *
   * 只抽最關鍵一兩句（玩家揀之前要知呢張卡實際做咩）：
   *   戰鬥卡 → 攻／速 + 自帶技能效果
   *   技能卡 → 效果
   *   裝備卡 → 數值 + 主題
   */
  function giftOfferSummary(kind, offer) {
    if (!offer) return "";
    try {
      if (kind === "skill") {
        const sk = (DATA.skills || []).find((s) => s && s.id === offer.id);
        if (!sk) return "";
        const eff = String(sk.effect || "").trim();
        const cd = (sk.cd | 0) > 0 ? `CD ${sk.cd | 0}` : "";
        const head = [cd, sk.kind || ""].filter(Boolean).join(" · ");
        return head ? `${head}：${eff}` : eff;
      }
      if (kind === "gear") {
        const it = equipItemList().find((x) => x && x.id === offer.id);
        if (!it) return "";
        const bits = [];
        ["atk", "def", "mdef", "spd", "hp"].forEach((k) => {
          const v = it[k] | 0;
          if (v) bits.push(`${({ atk: "攻", def: "防", mdef: "魔防", spd: "速", hp: "血" })[k]}＋${v}`);
        });
        const tag = it.tag_boost ? ` · 主題：${equipTagLabel(it.tag_boost) || it.tag_boost}` : "";
        return (bits.join(" ") || "無數值") + tag;
      }
      /* 戰鬥卡 */
      const f = (DATA.fighters || []).find((x) => x && x.id === offer.id);
      if (!f) return "";
      const eff = String(f.skill_effect || "").trim();
      const head = `攻${f.atk | 0} 速${f.spd | 0}`;
      return eff ? `${head}｜${eff}` : head;
    } catch (e) {
      return "";
    }
  }

  /** t397：送卡卡面的完整說明（長按用） */
  function giftOfferHelpText(kind, offer) {
    if (!offer) return "";
    try {
      if (kind === "skill") {
        const sk = (DATA.skills || []).find((s) => s && s.id === offer.id);
        return sk ? skillHelpText(sk) : (offer.name || "");
      }
      if (kind === "gear") {
        const it = equipItemList().find((x) => x && x.id === offer.id);
        return it ? equipHelpText(it) : (offer.name || "");
      }
      const f = (DATA.fighters || []).find((x) => x && x.id === offer.id);
      return f ? fighterHelpText(f) : (offer.name || "");
    } catch (e) {
      return offer.name || "";
    }
  }

  /** 送卡入袋：戰鬥卡／技能／裝備（唔扣金幣、唔換走己卡） */
  function grantGiftCard(kind, offer) {
    if (!offer || !offer.id) return "";
    albumEnsureState();
    if (kind === "skill") {
      ensureLifeSkills();
      const pick = (DATA.skills || []).find((sk) => sk && sk.id === offer.id) || null;
      if (!pick) return "";
      const inLife = new Set(state.lifeSkills || []);
      albumGainOne("skills", pick.id);
      if (!inLife.has(pick.id) && (state.lifeSkills || []).length < LIFE_SKILLS_CAP) {
        state.lifeSkills.push(pick.id);
        return "已加入技能口袋";
      }
      if (inLife.has(pick.id)) return "複本入卡冊";
      return `技能口袋已滿（${LIFE_SKILLS_CAP}）——入卡冊`;
    }
    if (kind === "gear") {
      ensureGearShape();
      const pick = equipItemList().find((it) => it && it.id === offer.id) || null;
      if (!pick) return "";
      albumGainOne("gear", pick.id);
      /*
       * t400：裝備一定可以「即刻裝上」。
       * 舊行為只在該槽空著時才裝；槽位已有裝備 → 只回「已入裝備收藏」，
       * 而玩家喺人生中途完全冇介面可以換裝備 → 新裝備等於永遠用唔到。
       */
      const slotId = offer.slot || pick.slot || pick.slot_id || null;
      const slotMeta = slotId ? GEAR_SLOTS.find((s) => s.id === slotId) : null;
      if (!slotMeta) return "已入裝備收藏（未對應槽位）";
      const prevId = state.accountGear[slotMeta.id];
      state.accountGear[slotMeta.id] = pick.id;
      if (prevId && prevId !== pick.id) {
        const prev = equipItemList().find((it) => it && it.id === prevId);
        return `已裝上${slotMeta.label}槽（換走「${(prev && prev.name) || prevId}」）`;
      }
      return `已裝上${slotMeta.label}槽`;
    }
    const cap = fighterPocketCap();
    const inTeam = new Set(state.team || []);
    const pick = (DATA.fighters || []).find((f) => f && f.id === offer.id) || null;
    if (!pick) return "";
    albumGainOne("fighters", pick.id);
    if (inTeam.has(pick.id)) return "複本入卡冊";
    /*
     * t397：口袋滿時唔再「靜靜入卡冊」。
     *
     * 舊行為：統率滿 → 只寫「入卡冊」，卡確實入咗收藏，但編隊頁只認 `state.team`，
     * 玩家喺開戰前完全揀唔到呢張新卡，等於「拿到但用唔到」。
     *
     * 新行為：
     *   1. 有位 → 直接入隊（同舊一樣）
     *   2. 冇位 → 仍然入卡冊，但**明確講清楚要點做**（去準備頁換走一張）
     *   3. 編隊頁亦開放由卡冊揀卡（見 viewEncounter 的 choices 來源）
     */
    if ((state.team || []).length < cap) {
      state.team.push(pick.id);
      if (!state.loadout[pick.id]) state.loadout[pick.id] = [];
      return "已加入戰鬥卡口袋";
    }
    return `統率已滿（${cap}）——已入卡冊，可去「準備」頁換走一張再上陣`;
  }

  /** 人生店鋪：四選一・金幣購買 */
  function viewShop(root) {
    const ev = state.selectedEvent;
    const shop = state.shop;
    if (!ev || !shop || !["shop_equip", "shop_fighter", "shop_skill"].includes(shop.category)) {
      state.screen = "events";
      render();
      return;
    }
    const title = shopTitleForCat(shop.category);
    const gold = state.gold | 0;
    const offers = Array.isArray(shop.offers) ? shop.offers : [];
    const cards = offers.map((o, idx) => {
      const price = o.price | 0;
      const can = gold >= price;
      const rare = shopRarityLabel(o.rarity);
      const disCls = can ? "" : " disabled";
      const priceCls = can ? "shop-price" : "shop-price insufficient";
      const hint = can ? "" : `<span class="shop-insuff">金幣不足</span>`;
      return `
        <button type="button" class="shop-card${disCls}" data-shop-idx="${idx}" ${can ? "" : 'aria-disabled="true"'}>
          <img src="${esc(o.art || "")}" alt="${esc(o.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(o.name || o.id)}</div>
            <div class="shop-card-rare">${esc(rare)}</div>
            <div class="${priceCls}">售價 ${price} 金幣</div>
            ${hint}
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">貨架暫無商品</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(title))}</div>
      <div class="shop-wrap">
        <div class="shop-gold-banner">持有金幣 <b>${gold}</b></div>
        <p class="shop-sub">四選一・金幣購買 · 僅可購入一項</p>
        <div class="shop-grid">${cards}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn ghost" id="btn-shop-leave">離開</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;

    root.querySelectorAll(".shop-card").forEach((btn) => {
      btn.onclick = () => {
        const idx = btn.dataset.shopIdx | 0;
        const offer = offers[idx];
        if (!offer) return;
        if ((state.gold | 0) < (offer.price | 0)) {
          shopToast(root, "金幣不足");
          return;
        }
        if (!buyShopOffer(offer)) {
          shopToast(root, "金幣不足");
          return;
        }
        render();
      };
    });
    $("#btn-shop-leave", root).onclick = () => {
      leaveShop();
      render();
    };
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /** 可交出的戰鬥卡（已擁有 count≥1；優先今世口袋） */
  /**
   * t371：換卡保護。
   *
   * 問題：玩家可以把「最後一張能打的卡」交出去。雖然換入會補回，
   * 但若換入的剛好是廢卡，等於用主力換雜牌。
   *
   * ⚠ 特別處理：`albumEnsureState()` 每次都會強制補 C03「霓虹咒匠」（demo 驗魔攻用），
   * 所以卡冊永遠「有一張後備」。但嗰張唔係玩家自己揀嘅主力，
   * 唔應該當成「安全網」→ 判定時要把 `DEMO_FALLBACK_CARDS` 排除。
   */
  const DEMO_FALLBACK_CARDS = ["C03"]; // demo 種子／兜底卡

  function isDemoFallbackCard(id) {
    return DEMO_FALLBACK_CARDS.includes(String(id || ""));
  }

  function tradeWouldLeaveNoFighter(fighterId) {
    const team = Array.isArray(state.team) ? state.team : [];
    // 交出後仍在 team 的卡（未陣亡、仍持有、唔係兜底卡）
    const remain = team.filter(
      (id) => id !== fighterId && fighterById[id] && albumCardCount(id) > 0
        && !isDeadFighter(id) && !isDemoFallbackCard(id)
    );
    // 卡冊中其他可用卡（不在 team、未陣亡、唔係兜底卡）
    const spare = (DATA.fighters || []).filter(
      (f) => f && f.id && f.id !== fighterId && !isDeadFighter(f.id)
        && albumCardCount(f.id) > 0 && !team.includes(f.id)
        && !isDemoFallbackCard(f.id)
    );
    return remain.length === 0 && spare.length === 0;
  }

  function tradeGiveCandidates() {
    albumEnsureState();
    const team = Array.isArray(state.team) ? state.team.slice() : [];
    const teamSet = new Set(team);
    const owned = (DATA.fighters || []).filter((f) => f && f.id && albumCardCount(f.id) > 0);
    const inTeam = team.map((id) => fighterById[id]).filter((f) => f && albumCardCount(f.id) > 0);
    const rest = owned.filter((f) => !teamSet.has(f.id));
    const seen = new Set();
    const out = [];
    for (const f of inTeam.concat(rest)) {
      if (!f || seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(f);
    }
    return out;
  }

  /** 標記候選：lastUsable = 交出呢張之後會冇卡可打 */
  function tradeCandidatesWithRisk() {
    const list = tradeGiveCandidates();
    return list.map((f) => ({
      f,
      lastUsable: tradeWouldLeaveNoFighter(f.id),
    }));
  }

  function buildTradeTakeOffers(excludeId) {
    albumEnsureState();
    /* t391：換卡唔可以換到殘頁專屬卡 */
    let withArt = poolFighters().filter(
      (f) => f && f.id && f.id !== excludeId && f.art && !String(f.art).includes("pending-manus")
    );
    if (!withArt.length) {
      withArt = poolFighters().filter((f) => f && f.id && f.id !== excludeId);
    }
    const unowned = withArt.filter((f) => albumCardCount(f.id) <= 0);
    const owned = withArt.filter((f) => albumCardCount(f.id) > 0);
    const ordered = shuffleInPlace(unowned.slice()).concat(shuffleInPlace(owned.slice()));
    const seen = new Set();
    const picks = [];
    for (const f of ordered) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      picks.push({
        id: f.id,
        name: f.name || f.id,
        art: f.art || "",
        rarity: f.rarity || "",
      });
      if (picks.length >= 4) break;
    }
    return picks;
  }

  /** 交出戰鬥卡：team 移走＋清 loadout；album count−1（不低於 0） */
  function tradeGiveAway(fighterId) {
    if (!fighterId) return false;
    albumEnsureState();
    const n = albumCardCount(fighterId);
    if (n <= 0) return false;
    albumSetCount(fighterId, n - 1);
    const ti = (state.team || []).indexOf(fighterId);
    if (ti >= 0) {
      state.team.splice(ti, 1);
      if (state.loadout) delete state.loadout[fighterId];
      if (state.loadoutInited) delete state.loadoutInited[fighterId];
    }
    return true;
  }

  /** 換入：album＋1；口袋未滿且未有則入 team */
  function tradeReceive(fighterId) {
    if (!fighterId) return "";
    albumEnsureState();
    const pick = fighterById[fighterId];
    if (!pick) return "";
    albumGainOne("fighters", fighterId);
    const cap = fighterPocketCap();
    const inTeam = new Set(state.team || []);
    if (!inTeam.has(fighterId) && (state.team || []).length < cap) {
      state.team.push(fighterId);
      if (!state.loadout[fighterId]) state.loadout[fighterId] = [];
      return "已加入戰鬥卡口袋";
    }
    if (inTeam.has(fighterId)) return "複本入卡冊";
    return `統率已滿（${cap}）——入卡冊`;
  }

  function leaveTrade() {
    state.softNote = "離開換卡檔，未交換";
    state.shopLeftEmpty = true;
    state.trade = null;
    state.screen = "soft";
  }

  function viewTrade(root) {
    const ev = state.selectedEvent;
    if (!ev || ev.category !== "card_trade") {
      state.screen = "events";
      render();
      return;
    }
    if (!state.trade) state.trade = { phase: "give", giveId: null, offers: null };
    const tr = state.trade;

    if (tr.phase === "take" && tr.giveId) {
      const offers = Array.isArray(tr.offers) ? tr.offers : [];
      const giveName = (fighterById[tr.giveId] && fighterById[tr.giveId].name) || tr.giveId;
      const cards = offers.map((o, idx) => {
        const rare = shopRarityLabel(o.rarity);
        return `
          <button type="button" class="shop-card" data-take-idx="${idx}">
            <img src="${esc(o.art || "")}" alt="${esc(o.name || "")}" />
            <div class="shop-card-body">
              <div class="shop-card-name">${esc(o.name || o.id)}</div>
              <div class="shop-card-rare">${esc(rare)}</div>
              <div class="shop-price trade-tag">交換入手</div>
            </div>
          </button>`;
      }).join("") || `<div class="shop-empty">貨架暫無卡可換</div>`;
      root.innerHTML = `
        ${lifeHudHtml()}
        <div class="ribbon">${ageRibbon("換卡・選入手")}</div>
        <div class="shop-wrap">
          <div class="shop-gold-banner">已交出「${esc(giveName)}」· 請選一張換入</div>
          <p class="shop-sub">四選一・以物易物（不扣金幣）</p>
          <div class="shop-grid">${cards}</div>
        </div>
        <div class="soft-cta">
          <button type="button" class="btn ghost" id="btn-trade-leave">離開</button>
          <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
        </div>
        ${storyDockHtml()}
      `;
      root.querySelectorAll("[data-take-idx]").forEach((btn) => {
        btn.onclick = () => {
          const idx = btn.dataset.takeIdx | 0;
          const offer = offers[idx];
          if (!offer) return;
          const giveId = tr.giveId;
          const giveNm = (fighterById[giveId] && fighterById[giveId].name) || giveId;
          if (!tradeGiveAway(giveId)) {
            shopToast(root, "交出失敗——持有不足");
            return;
          }
          const extra = tradeReceive(offer.id);
          state.softNote = `以「${giveNm}」換得「${offer.name || offer.id}」` + (extra ? `（${extra}）` : "");
          state.shopLeftEmpty = false;
          state.trade = null;
          state.screen = "soft";
          render();
        };
      });
      $("#btn-trade-leave", root).onclick = () => { leaveTrade(); render(); };
      $("#btn-abandon", root).onclick = () => requestAbandonLife();
      wireStoryDock(root);
      return;
    }

    // phase give
    const risky = tradeCandidatesWithRisk();
    // 只有當「全部候選都係最後一張」時，唔可以再擋（否則事件變死路）
    const allRisky = risky.length > 0 && risky.every((x) => x.lastUsable);
    const cards = risky.map(({ f, lastUsable }) => {
      const inPocket = (state.team || []).includes(f.id);
      const rare = shopRarityLabel(f.rarity);
      const star = albumFighterStar(f.id);
      const warn = lastUsable
        ? `<div class="trade-warn">⚠ 交出後冇卡可打${allRisky ? "（只此一張）" : ""}</div>`
        : "";
      return `
        <button type="button" class="shop-card${lastUsable ? " trade-risk" : ""}" data-give-id="${esc(f.id)}" data-last-usable="${lastUsable ? "1" : "0"}">
          <img src="${esc(f.art || "")}" alt="${esc(f.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(f.name || f.id)}</div>
            <div class="shop-card-rare">${esc(rare)} · ★${star}${inPocket ? " · 口袋" : ""}</div>
            <div class="shop-price trade-tag">交出交換</div>
            ${warn}
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">沒有可交出的戰鬥卡</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name || "換卡檔"))}</div>
      <div class="shop-wrap">
        <div class="shop-gold-banner">請選一張已持有戰鬥卡交出</div>
        <p class="shop-sub">以物易物 · 不扣金幣 · 可離開</p>
        <div class="shop-grid shop-grid-scroll">${cards}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn ghost" id="btn-trade-leave">離開</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    root.querySelectorAll("[data-give-id]").forEach((btn) => {
      btn.onclick = () => {
        const gid = btn.dataset.giveId;
        if (!gid || albumCardCount(gid) <= 0) {
          shopToast(root, "持有不足");
          return;
        }
        const isLast = btn.getAttribute("data-last-usable") === "1";
        if (isLast) {
          // t371：交出「最後一張能打嘅卡」需要二次確認
          showTradeRiskConfirm(root, gid);
          return;
        }
        state.trade = {
          phase: "take",
          giveId: gid,
          offers: buildTradeTakeOffers(gid),
        };
        render();
      };
    });
    $("#btn-trade-leave", root).onclick = () => { leaveTrade(); render(); };
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /**
   * t371：交出「最後一張能打嘅卡」二次確認。
   * 用 fixed 覆蓋層（唔依賴 state），取消即返回；確認才進入換入階段。
   */
  function showTradeRiskConfirm(root, giveId) {
    const old = document.getElementById("trade-risk-confirm");
    if (old) old.remove();
    const f = fighterById[giveId];
    const name = (f && f.name) || giveId;
    const mask = document.createElement("div");
    mask.id = "trade-risk-confirm";
    mask.className = "trade-risk-mask";
    mask.innerHTML = `
      <div class="trade-risk-sheet" role="dialog" aria-modal="true" aria-label="交出最後一張卡確認">
        <div class="trade-risk-title">⚠ 這是你最後一張能打的卡</div>
        <p class="trade-risk-body">交出「<b>${esc(name)}</b>」之後，你暫時冇卡可以出戰。<br/>換入的卡會補上，但如果換到廢卡，你就冇主力。</p>
        <p class="trade-risk-q">確定要交出去？</p>
        <div class="trade-risk-actions">
          <button type="button" class="btn small ghost" id="trc-cancel">唔交，返去揀</button>
          <button type="button" class="btn small gold" id="trc-ok">我明白，照交</button>
        </div>
      </div>`;
    (document.getElementById("phone") || document.body).appendChild(mask);

    const close = () => { const m = document.getElementById("trade-risk-confirm"); if (m) m.remove(); };
    const cancel = $("#trc-cancel", mask);
    if (cancel) cancel.onclick = (e) => { if (e) e.stopPropagation(); close(); };
    const ok = $("#trc-ok", mask);
    if (ok) {
      ok.onclick = (e) => {
        if (e) e.stopPropagation();
        close();
        state.trade = { phase: "take", giveId, offers: buildTradeTakeOffers(giveId) };
        render();
      };
    }
    if (mask.onclick) mask.onclick = (e) => { if (e.target === mask) close(); };
  }

  /** 升星價：15 × 當前星 */
  function starUpPrice(currentStar) {
    return 15 * Math.max(1, currentStar | 0);
  }
  function starUpCandidates() {
    albumEnsureState();
    const team = Array.isArray(state.team) ? state.team.slice() : [];
    const teamSet = new Set(team);
    const owned = (DATA.fighters || []).filter((f) => f && f.id && albumCardCount(f.id) > 0);
    const can = owned.filter((f) => albumFighterStar(f.id) < ALBUM_MAX_STAR);
    const inTeam = can.filter((f) => teamSet.has(f.id));
    const rest = can.filter((f) => !teamSet.has(f.id));
    // team 優先，維持 team 順序
    const ordered = [];
    const seen = new Set();
    for (const id of team) {
      const f = can.find((x) => x.id === id);
      if (f && !seen.has(f.id)) {
        seen.add(f.id);
        ordered.push(f);
      }
    }
    for (const f of rest) {
      if (!seen.has(f.id)) {
        seen.add(f.id);
        ordered.push(f);
      }
    }
    return ordered;
  }

  function leaveStarUp() {
    state.softNote = "離開升星攤，未升星";
    state.shopLeftEmpty = true;
    state.starUp = null;
    state.screen = "soft";
  }

  /**
   * 夜市升星攤（EV45）：玩家主動付金幣，**選一張卡**升星——同卡冊按鈕一樣係手動操作。
   * t364 保留此入口，但與卡冊共用同一套「燒同名卡」語意以外嘅規則：
   * 佢只升戰鬥卡、只可由玩家逐張按、而且要有足夠金幣，唔存在任何自動升星。
   */
  /* ---------- 茶記：聲望換特殊卡 ---------- */
  /** 茶記特殊卡（fame 為聲望價；售完即止，跨世保留已買記錄） */
  function teaShopList() {
    return Array.isArray(DATA.tea_shop_cards) ? DATA.tea_shop_cards : [];
  }

  function teaShopBoughtSet() {
    if (!Array.isArray(state.teaShopBought)) state.teaShopBought = [];
    return new Set(state.teaShopBought);
  }

  function buyTeaShopCard(cardId) {
    albumEnsureState();
    const card = teaShopList().find((c) => c && c.id === cardId);
    if (!card) return { ok: false, msg: "無此卡" };
    const bought = teaShopBoughtSet();
    if (bought.has(cardId)) return { ok: false, msg: "已經換過" };
    const price = Math.max(0, card.fame | 0);
    if ((state.fame | 0) < price) return { ok: false, msg: `聲望不足（需 ${price}）` };
    state.fame = (state.fame | 0) - price;
    albumGainOne("fighters", card.id);
    const cap = fighterPocketCap();
    const inTeam = new Set(state.team || []);
    let note = "已入卡冊";
    if (!inTeam.has(card.id) && (state.team || []).length < cap) {
      state.team.push(card.id);
      if (!state.loadout[card.id]) state.loadout[card.id] = [];
      note = "已加入戰鬥卡口袋";
    } else if ((state.team || []).length >= cap) {
      note = `統率已滿（${cap}）——入卡冊`;
    }
    state.teaShopBought.push(cardId);
    return { ok: true, msg: `換得「${card.name}」（${note}）` };
  }

  /** 茶記特殊卡詳情彈窗：卡圖＋完整戰力／技能說明＋聲望價 */
  function teaCardDetailHtml(card, opts) {
    opts = opts || {};
    const f = fighterById[card.id];
    const name = card.name || (f && f.name) || card.id;
    const price = Math.max(0, card.fame | 0);
    const owned = !!opts.owned;
    const can = !!opts.can;
    const art = card.art || (f && f.art) || "";
    const artHtml = art
      ? `<img src="${esc(art)}" alt="${esc(name)}" loading="lazy" data-card-name="${esc(name)}" data-card-kind="fighter" />`
      : `<img src="${cardGlyphDataUrl(name, "fighter")}" alt="${esc(name)}" />`;
    const rare = (f && (f.rarity_slang || f.rarity)) || card.rarity || "特殊";
    const stars = f ? albumFighterStar(f.id) : 1;
    const rich = f ? fighterHelpRichHtml(f, { preview: fighterPreviewStats(f) }) : "";
    const blurb = card.blurb || (f && (f.blurb || f.flavor)) || "";
    const btnLabel = owned ? "已換過" : (can ? `用 ${price} 聲望換` : `聲望不足（需 ${price}）`);
    return `
      <div class="album-mask tea-detail-mask" id="tea-detail-mask" role="dialog" aria-modal="true" aria-label="${esc(name)} 說明">
        <div class="album-detail-sheet" id="tea-detail-sheet">
          <button type="button" class="album-detail-x" id="tea-detail-x" aria-label="關閉">×</button>
          <div class="album-detail-top">
            <span class="album-badge">茶記特殊卡</span>
            <div class="album-detail-stars">${starsRowHtml(stars, ALBUM_MAX_STAR)}</div>
            <div class="album-detail-name">${esc(name)}</div>
            <div class="album-detail-next">${esc(rare)}</div>
          </div>
          <div class="album-detail-art"><div class="tea-detail-artbox">${artHtml}</div></div>
          ${rich
            ? `<div class="album-detail-body tea-detail-rich">${rich}</div>`
            : (blurb ? `<div class="album-detail-body"><p class="album-detail-line">${esc(blurb)}</p></div>` : "")}
          <div class="tea-detail-price">
            <span class="tea-fame">聲望 ${price}</span>
            ${owned ? `<span class="tea-detail-state">已換過</span>` : ""}
          </div>
          <button type="button" class="btn ${can ? "gold" : "ghost"} tea-detail-buy" id="tea-detail-buy" data-tea-id="${esc(card.id)}" ${can ? "" : "disabled"}>${esc(btnLabel)}</button>
          <p class="album-detail-foot">點擊空白處或右上角關閉</p>
        </div>
      </div>`;
  }

  function viewTeaHouse(root) {
    ensureDaily();
    const cards = teaShopList();
    const bought = teaShopBoughtSet();
    const fame = state.fame | 0;
    const detailCard = state.teaDetailId ? cards.find((c) => c && c.id === state.teaDetailId) : null;

    const rows = cards.map((c) => {
      const f = fighterById[c.id];
      const price = Math.max(0, c.fame | 0);
      const owned = bought.has(c.id);
      const can = !owned && fame >= price;
      const art = c.art || (f && f.art) || "";
      const name = c.name || (f && f.name) || c.id;
      const blurb = c.blurb || (f && (f.blurb || f.flavor)) || "";
      const artHtml = art
        ? `<img src="${esc(art)}" alt="${esc(name)}" loading="lazy" data-card-name="${esc(name)}" data-card-kind="fighter" />`
        : `<img src="${cardGlyphDataUrl(name, "fighter")}" alt="${esc(name)}" />`;
      return `
        <article class="tea-card${owned ? " owned" : ""}${can ? " can" : ""}" data-tea-id="${esc(c.id)}" role="button" tabindex="0" aria-label="${esc(name)}（點擊查看說明）" title="點擊查看說明">
          <div class="tea-art">${artHtml}${owned ? `<span class="tea-badge">已換</span>` : ""}</div>
          <div class="tea-body">
            <div class="tea-name">${esc(name)}<span class="tea-help-ico" aria-hidden="true">?</span></div>
            <div class="tea-rare">${esc((f && (f.rarity_slang || f.rarity)) || c.rarity || "特殊")}${f ? ` · 攻${f.atk | 0} 速${f.spd | 0}` : ""}</div>
            ${blurb ? `<p class="tea-blurb">${esc(blurb)}</p>` : ""}
            <div class="tea-price"><span class="tea-fame">聲望 ${price}</span></div>
          </div>
          <div class="tea-act">
            <button type="button" class="btn small ${can ? "gold" : "ghost"} tea-buy" data-tea-id="${esc(c.id)}" ${can ? "" : "disabled"}>${owned ? "已換" : (fame >= price ? "換" : "聲望不足")}</button>
          </div>
        </article>`;
    }).join("") || `<div class="soft-panel">茶記暫時未有特殊卡——等老闆入貨。</div>`;

    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>茶記</span>
        <span class="chip soul"><span class="dot"></span>膠幣 ${state.soul}</span>
        <span class="chip fame"><span class="dot"></span>聲望 ${fame}</span>
      </div>
      <div class="ribbon">茶記 · 熟客</div>
      <div class="tea-wrap">
        <p class="tea-intro">做差事儲聲望，同老闆娘講兩句，就有特別貨。<br/><span class="tea-tap-hint">點卡片可以睇完整說明</span></p>
        <div class="tea-list">${rows}</div>
      </div>
      ${detailCard
        ? teaCardDetailHtml(detailCard, {
            owned: bought.has(detailCard.id),
            can: !bought.has(detailCard.id) && fame >= Math.max(0, detailCard.fame | 0),
          })
        : ""}
      <nav class="tab-bar" aria-label="主選單">
        <button class="tab" type="button" id="tab-book"><span class="ico">📖</span>卡冊</button>
        <button class="tab" type="button" id="tab-life"><span class="ico">🏠</span>今世</button>
        <button class="tab on" type="button" id="tab-teahouse"><span class="ico">🍜</span>茶記</button>
        <button class="tab" type="button" id="tab-jobs"><span class="ico">📋</span>差事</button>
        <button class="tab" type="button" id="tab-more" aria-disabled="true"><span class="ico">⋯</span>更多</button>
      </nav>
      <div id="home-toast" class="home-toast" hidden></div>
    `;
    root.classList.add("tea-screen");
    const toast = (msg) => {
      const el = $("#home-toast", root);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { el.hidden = true; }, 1900);
    };
    if (state.teaPendingNote) {
      const note = state.teaPendingNote;
      state.teaPendingNote = "";
      setTimeout(() => toast(note), 60);
    }
    root.querySelectorAll(".tea-buy[data-tea-id]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const res = buyTeaShopCard(btn.dataset.teaId);
        toast(res.msg);
        if (res.ok) render();
      };
    });

    /* 點卡片（非按鈕區）→ 開詳情 */
    const openDetail = (id) => {
      state.teaDetailId = id;
      render();
    };
    root.querySelectorAll(".tea-card[data-tea-id]").forEach((card) => {
      card.onclick = (e) => {
        if (e.target && e.target.closest && e.target.closest(".tea-buy")) return;
        openDetail(card.dataset.teaId);
      };
      card.onkeydown = (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        openDetail(card.dataset.teaId);
      };
    });

    const dMask = $("#tea-detail-mask", root);
    if (dMask) {
      const close = () => { state.teaDetailId = null; render(); };
      dMask.onclick = (e) => { if (e.target === dMask) close(); };
      const dx = $("#tea-detail-x", root);
      if (dx) dx.onclick = (e) => { e.stopPropagation(); close(); };
      /* 詳情內的技能格：點一下睇效果（同卡冊一致） */
      dMask.querySelectorAll(".fd-skill.fixed, .fd-skill.filled").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const text = (el.getAttribute("data-help-text") || "").trim();
          if (!text) return;
          showHelpTip(el, text);
        });
      });
      const dBuy = $("#tea-detail-buy", root);
      if (dBuy) {
        dBuy.onclick = (e) => {
          e.stopPropagation();
          const res = buyTeaShopCard(dBuy.dataset.teaId);
          if (res.ok) {
            state.teaDetailId = null;
            state.teaPendingNote = res.msg;
            render();
          } else {
            toast(res.msg);
          }
        };
      }
    }
    $("#tab-life", root).onclick = () => { state.screen = "home"; render(); };
    $("#tab-jobs", root).onclick = () => { state.screen = "missions"; render(); };
    const tb = $("#tab-book", root);
    if (tb) tb.onclick = () => { state.screen = "album"; render(); };
    const more = $("#tab-more", root);
    if (more) more.onclick = () => toast("這個位置尚未開放。");
  }

  function buyStarUp(fighterId) {
    albumEnsureState();
    const f = fighterById[fighterId];
    if (!f) return false;
    const star = albumFighterStar(fighterId);
    if (star >= ALBUM_MAX_STAR) return false;
    const price = starUpPrice(star);
    if ((state.gold | 0) < price) return false;
    state.gold = (state.gold | 0) - price;
    state.fighterStars[fighterId] = star + 1;
    state.softNote = `「${f.name || fighterId}」升至 ★${star + 1}`;
    state.shopLeftEmpty = false;
    state.starUp = null;
    state.screen = "soft";
    return true;
  }

  function viewStarUp(root) {
    const ev = state.selectedEvent;
    if (!ev || ev.category !== "star_up") {
      state.screen = "events";
      render();
      return;
    }
    if (!state.starUp) state.starUp = { focusId: null };
    const gold = state.gold | 0;
    const cands = starUpCandidates();
    const cards = cands.map((f) => {
      const star = albumFighterStar(f.id);
      const price = starUpPrice(star);
      const can = gold >= price;
      const inPocket = (state.team || []).includes(f.id);
      const disCls = can ? "" : " disabled";
      const priceCls = can ? "shop-price" : "shop-price insufficient";
      const hint = can ? "" : `<span class="shop-insuff">金幣不足</span>`;
      return `
        <button type="button" class="shop-card${disCls}" data-starup-id="${esc(f.id)}" ${can ? "" : 'aria-disabled="true"'}>
          <img src="${esc(f.art || "")}" alt="${esc(f.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(f.name || f.id)}</div>
            <div class="shop-card-rare">★${star} → ★${star + 1}${inPocket ? " · 口袋" : ""}</div>
            <div class="${priceCls}">售價 ${price} 金幣</div>
            ${hint}
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">沒有可升星的戰鬥卡（需未滿 ★${ALBUM_MAX_STAR}）</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name || "升星攤"))}</div>
      <div class="shop-wrap">
        <div class="shop-gold-banner">持有金幣 <b>${gold}</b> · 價＝15×當前星</div>
        <p class="shop-sub">選一張戰鬥卡升星（不消耗同名複本）</p>
        <div class="shop-grid shop-grid-scroll">${cards}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn ghost" id="btn-starup-leave">離開</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    root.querySelectorAll("[data-starup-id]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.starupId;
        const star = albumFighterStar(id);
        const price = starUpPrice(star);
        if ((state.gold | 0) < price) {
          shopToast(root, "金幣不足");
          return;
        }
        if (!buyStarUp(id)) {
          shopToast(root, "無法升星");
          return;
        }
        render();
      };
    });
    $("#btn-starup-leave", root).onclick = () => { leaveStarUp(); render(); };
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /* ========== t366：三類養成事件（裝備強化／戰鬥卡練功／復活） ========== */

  /** 裝備強化價：膠幣 40 × 當前星（t367：改膠幣，因金幣稀缺） */
  function gearUpgradePrice(star) {
    return 40 * Math.max(1, star | 0);
  }

  /** 已擁有、未滿星嘅裝備（口袋優先排序，方便玩家搵） */
  function gearUpgradeCandidates() {
    albumEnsureState();
    ensureGearShape();
    const equipped = new Set(GEAR_SLOTS.map((s) => state.accountGear[s.id]).filter(Boolean));
    const owned = equipItemList().filter((it) => it && it.id && albumCardCount(it.id) > 0);
    const can = owned.filter((it) => equipStarOf(it) < (Number(it.max_star) || 5));
    const on = can.filter((it) => equipped.has(it.id));
    const rest = can.filter((it) => !equipped.has(it.id));
    return on.concat(rest);
  }

  /** 裝備強化：直接＋1 星（用膠幣；t367 由金幣改成膠幣） */
  function buyGearUpgrade(itemId) {
    albumEnsureState();
    ensureGearShape();
    const item = itemByIdLookup()[itemId];
    if (!item) return false;
    const star = equipStarOf(item);
    const maxS = Math.max(1, Number(item.max_star) || 5);
    if (star >= maxS) return false;
    const price = gearUpgradePrice(star);
    if ((state.soul | 0) < price) return false;
    state.soul = (state.soul | 0) - price;
    state.equipStars[itemId] = star + 1;
    bumpEquipStar(1);
    state.softNote = `「${item.name}」升至 ★${star + 1}（全隊加乘）`;
    state.shopLeftEmpty = false;
    state.gearUpgrade = { done: { id: itemId, star: star + 1 } };
    state.screen = "soft";
    return true;
  }

  function leaveGearUpgrade() {
    state.softNote = "離開強化攤，未強化";
    state.shopLeftEmpty = true;
    state.gearUpgrade = null;
    state.screen = "soft";
  }

  function viewGearUpgrade(root) {
    const ev = state.selectedEvent;
    if (!ev || ev.category !== "gear_upgrade") {
      state.screen = "events";
      render();
      return;
    }
    const soul = state.soul | 0;
    const cands = gearUpgradeCandidates();
    const cards = cands.map((it) => {
      const star = equipStarOf(it);
      const maxS = Math.max(1, Number(it.max_star) || 5);
      const price = gearUpgradePrice(star);
      const can = soul >= price;
      const slotMeta = GEAR_SLOTS.find((s) => s.id === it.slot);
      const slotLabel = (slotMeta && slotMeta.label) || it.slot || "";
      return `
        <button type="button" class="shop-card${can ? "" : " disabled"}" data-gearup-id="${esc(it.id)}" ${can ? "" : 'aria-disabled="true"'}>
          <img src="${esc(it.art || "")}" alt="${esc(it.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(it.name || it.id)}</div>
            <div class="shop-card-rare">${esc(slotLabel)}槽 · ★${star} → ★${star + 1}／${maxS}</div>
            <div class="${can ? "shop-price" : "shop-price insufficient"}">膠幣 ${price}</div>
            ${can ? "" : `<span class="shop-insuff">膠幣不足</span>`}
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">沒有可強化嘅裝備（已擁有且未滿星）</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name || "裝備強化攤"))}</div>
      <div class="shop-wrap">
        <div class="shop-gold-banner">持有膠幣 <b>${soul}</b> · 價＝40×當前星</div>
        <p class="shop-sub">選一件裝備直接＋1 星（唔需同名卡，加乘全隊生效）</p>
        <div class="shop-grid shop-grid-scroll">${cards}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn ghost" id="btn-gearup-leave">離開</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    root.querySelectorAll("[data-gearup-id]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.gearupId;
        const item = itemByIdLookup()[id];
        if (!item) return;
        const price = gearUpgradePrice(equipStarOf(item));
        if ((state.soul | 0) < price) {
          shopToast(root, "膠幣不足");
          return;
        }
        if (!buyGearUpgrade(id)) {
          shopToast(root, "無法強化");
          return;
        }
        render();
      };
    });
    $("#btn-gearup-leave", root).onclick = () => { leaveGearUpgrade(); render(); };
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /* ---------- 戰鬥卡練功 ---------- */

  /** 練功所得卡經驗：40 × 當前等級（Lv5 就唔再升） */
  function trainXpGain(level) {
    return 40 * Math.max(1, level | 0);
  }

  function trainCandidates() {
    albumEnsureState();
    const team = Array.isArray(state.team) ? state.team.slice() : [];
    const owned = (DATA.fighters || []).filter(
      (f) => f && f.id && albumCardCount(f.id) > 0 && !isDeadFighter(f.id)
    );
    const can = owned.filter((f) => fighterLevelOf(f.id) < FIGHTER_LEVEL_MAX);
    const inTeam = can.filter((f) => team.includes(f.id));
    const rest = can.filter((f) => !team.includes(f.id));
    return inTeam.concat(rest);
  }

  function leaveFighterTrain() {
    state.softNote = "離開練功場，未練功";
    state.shopLeftEmpty = true;
    state.fighterTrain = null;
    state.screen = "soft";
  }

  function viewFighterTrain(root) {
    const ev = state.selectedEvent;
    if (!ev || ev.category !== "fighter_train") {
      state.screen = "events";
      render();
      return;
    }
    const cands = trainCandidates();
    const cards = cands.map((f) => {
      const lv = fighterLevelOf(f.id);
      const xp = fighterXpOf(f.id);
      const gain = trainXpGain(lv);
      const need = fighterXpToNext(lv);
      const inPocket = (state.team || []).includes(f.id);
      const star = albumFighterStar(f.id);
      return `
        <button type="button" class="shop-card" data-train-id="${esc(f.id)}">
          <img src="${esc(f.art || "")}" alt="${esc(f.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(f.name || f.id)}</div>
            <div class="shop-card-rare">Lv.${lv} · ★${star}${inPocket ? " · 口袋" : ""}</div>
            <div class="shop-price gift-tag">練功 +${gain} 卡經驗</div>
            <div class="shop-sub-line">${lv >= FIGHTER_LEVEL_MAX ? "已滿級" : `現 ${xp}／${need}`}</div>
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">沒有可練功嘅戰鬥卡（已滿級或全部陣亡）</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name || "練功場"))}</div>
      <div class="shop-wrap">
        <p class="shop-sub">選一張戰鬥卡練功：直接得卡經驗 ${esc("（每級 +2 攻 / +10 血）")}</p>
        <div class="shop-grid shop-grid-scroll">${cards}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn ghost" id="btn-train-leave">離開</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    root.querySelectorAll("[data-train-id]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.trainId;
        if (!id) return;
        const lv = fighterLevelOf(id);
        if (lv >= FIGHTER_LEVEL_MAX) {
          shopToast(root, "已滿級");
          return;
        }
        const gain = trainXpGain(lv);
        const res = grantFighterCardXp(id, gain);
        if (!res) {
          shopToast(root, "無法練功");
          return;
        }
        state.fighterTrain = { done: { id, lv: res.toLv, xp: res.xp, leveled: res.leveled } };
        state.softNote = res.leveled
          ? `「${res.name}」升到 Lv.${res.toLv}`
          : `「${res.name}」練功 +${gain} 卡經驗`;
        state.shopLeftEmpty = false;
        state.screen = "soft";
        render();
      };
    });
    $("#btn-train-leave", root).onclick = () => { leaveFighterTrain(); render(); };
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /* ---------- 復活陣亡卡 ---------- */

  /**
   * t367 經濟修復（B）：復活接受「膠幣」。
   * 膠幣（soul）收入充足（平均 16/事件、戰鬥亦有），而金幣是稀缺資源。
   * 復活改為主要用膠幣，令機制在實戰中真正可用。
   */
  function reviveSoulPrice(fighterId) {
    const f = fighterById[fighterId];
    const rank = { 普通: 1, 稀有: 1.5, 史詩: 2.25, 最高級: 3 }[f && f.rarity] || 1;
    return Math.round(60 * rank);
  }

  /** 復活價：可選膠幣（主）或金幣（較便宜，給缺膠幣的人） */
  function revivePrice(fighterId) {
    return reviveSoulPrice(fighterId);
  }

  function reviveCandidates() {
    albumEnsureState();
    const dead = Array.isArray(state.deadFighters) ? state.deadFighters.slice() : [];
    return dead
      .map((id) => fighterById[id])
      .filter(Boolean);
  }

  function leaveFighterRevive() {
    state.softNote = "離開義莊，未復活";
    state.shopLeftEmpty = true;
    state.fighterRevive = null;
    state.screen = "soft";
  }

  function buyRevive(fighterId, useGold) {
    if (!isDeadFighter(fighterId)) return false;
    const f = fighterById[fighterId];
    if (!f) return false;
    const soulPrice = reviveSoulPrice(fighterId);
    if (!useGold && (state.soul | 0) < soulPrice) return false;
    if (useGold && (state.gold | 0) < Math.round(soulPrice * 0.4)) return false;
    if (useGold) {
      state.gold = (state.gold | 0) - Math.round(soulPrice * 0.4);
    } else {
      state.soul = (state.soul | 0) - soulPrice;
    }
    // 移出陣亡名單 → 可再出戰；技能唔會自動復原（已燒）
    state.deadFighters = state.deadFighters.filter((id) => id !== fighterId);
    // 重新入隊（若口袋有位）
    const cap = fighterPocketCap();
    if (!state.team.includes(fighterId) && (state.team || []).length < cap) {
      state.team.push(fighterId);
    }
    if (!state.loadout[fighterId]) state.loadout[fighterId] = [];
    state.softNote = `「${f.name}」已復活——重返隊伍（技能已燒，需再裝）`;
    state.shopLeftEmpty = false;
    state.fighterRevive = { done: { id: fighterId, name: f.name } };
    state.screen = "soft";
    return true;
  }

  function viewFighterRevive(root) {
    const ev = state.selectedEvent;
    if (!ev || ev.category !== "fighter_revive") {
      state.screen = "events";
      render();
      return;
    }
    const soul = state.soul | 0;
    const gold = state.gold | 0;
    const cands = reviveCandidates();
    const cards = cands.map((f) => {
      const sp = reviveSoulPrice(f.id);
      const gp = Math.round(sp * 0.4);
      const canSoul = soul >= sp;
      const canGold = gold >= gp;
      const can = canSoul || canGold;
      const star = albumFighterStar(f.id);
      const lv = fighterLevelOf(f.id);
      return `
        <button type="button" class="shop-card${can ? "" : " disabled"}" data-revive-id="${esc(f.id)}" data-revive-soul="${sp}" data-revive-gold="${gp}" ${canSoul ? 'data-use-soul="1"' : (canGold ? 'data-use-gold="1"' : "")} ${can ? "" : 'aria-disabled="true"'}>
          <img src="${esc(f.art || "")}" alt="${esc(f.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(f.name || f.id)}</div>
            <div class="shop-card-rare">Lv.${lv} · ★${star} · ${esc(f.rarity || "")}</div>
            <div class="${canSoul ? "shop-price" : "shop-price insufficient"}">膠幣 ${sp}</div>
            <div class="${canGold ? "shop-price" : "shop-price insufficient"}">或 金幣 ${gp}</div>
          </div>
        </button>`;
    }).join("") || `<div class="shop-empty">今世冇陣亡卡——義莊得個空位</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name || "義莊"))}</div>
      <div class="shop-wrap">
        <div class="shop-gold-banner">膠幣 <b>${soul}</b> · 金幣 <b>${gold}</b> · 陣亡卡 ${cands.length} 張</div>
        <p class="shop-sub">付膠幣（或較便宜嘅金幣）請師傅做法事，令陣亡卡重返隊伍（技能已燒，需重新裝）</p>
        <div class="shop-grid shop-grid-scroll">${cards}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn ghost" id="btn-revive-leave">離開</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    root.querySelectorAll("[data-revive-id]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.reviveId;
        const useGold = btn.getAttribute("data-use-soul") !== "1" && btn.getAttribute("data-use-gold") === "1";
        if (!buyRevive(id, useGold)) {
          shopToast(root, "資源不足");
          return;
        }
        render();
      };
    });
    $("#btn-revive-leave", root).onclick = () => { leaveFighterRevive(); render(); };
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  /**
   * t379：四揀一結果嘅即時回饋（總導演：「結果加半秒回饋，唔好即跳年」）。
   *
   * 原本玩家揀完一張事件卡，畫面即刻變成結算頁，獎勵只係一行細字，
   * 好似「點完就冇咗」，冇獲得感。
   * 現在結算頁頂部加一條結果條：圖示 + 獎勵 chips，帶滑入動畫（約 0.45s）。
   * 純顯示用，唔改任何數值。
   */
  function softResultBarHtml(ev, gain, goldGain, isEnding, endingClaimable) {
    if (isEnding) {
      return `<div class="soft-result-bar ending${endingClaimable ? "" : " muted"}" role="status">
        <span class="srb-ico">✦</span>
        <span class="srb-text">${endingClaimable ? "分支結局達成" : "此結局已領過"}</span>
      </div>`;
    }
    const chips = [];
    if (gain) chips.push(`<span class="srb-chip soul">膠幣 +${gain}</span>`);
    if ((ev.reward_xp | 0) > 0) chips.push(`<span class="srb-chip xp">經驗 +${ev.reward_xp | 0}</span>`);
    if (goldGain) chips.push(`<span class="srb-chip gold">金幣 +${goldGain}</span>`);
    const attrs = formatAttrsDelta(ev.attrs_delta);
    attrs.forEach((a) => chips.push(`<span class="srb-chip attr">${esc(a)}</span>`));
    return `<div class="soft-result-bar" role="status">
      <span class="srb-ico">✔</span>
      <span class="srb-text">${esc(ev.name || "事件")} · 已結算</span>
      <span class="srb-chips">${chips.join("") || `<span class="srb-chip">無獎勵</span>`}</span>
    </div>`;
  }

  function viewSoft(root) {
    const ev = state.selectedEvent;
    // t364：結局事件只有 50 膠幣，而且只發一次（已領過就 0）
    const isEnding = !!ev.office_ending;
    const endingClaimable = isEnding ? endingRewardAvailable(ev) : true;
    const gain = endingClaimable ? listedEventSoul(ev) : 0;
    const goldGain = endingClaimable ? (ev.reward_gold | 0) : 0;
    const rewardLine = isEnding
      ? (endingClaimable
          ? `結局達成 · 獲得 <b style="color:var(--neon-gold)">+${gain}</b> ${esc(L["ui.resource"] || "膠幣")}（一次性）`
          : `<span style="color:var(--muted)">此結局已領過 50 膠幣——重玩唔再發</span>`)
      : `今世賺了 <b style="color:var(--neon-gold)">+${gain}</b> ${esc(L["ui.resource"] || "膠幣")}${(ev.reward_xp|0) ? ` · 經驗 +${ev.reward_xp|0}` : ""}${goldGain ? ` · 金幣 +${goldGain}` : ""} · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span>`;
    const endingBanner = isEnding
      ? `<div class="of-ending-banner">
           <div class="of-ending-kicker">分支結局</div>
           <div class="of-ending-name">${esc(ev.office_ending_label || ev.name || "")}</div>
         </div>`
      : "";
    // t365：分支結局用「故事包 · 結局」頂條，唔顯示人生 HUD（避免 10 歲等不相干歲數）
    const endingAge = state.officeEndAge | 0;
    const packMeta = storyPackById("office_ballad");
    /*
     * t406：結局要「全屏停住」——結語 + 角色一句 + 獎勵 + 明確按鈕。
     * 唔用 autoAdvanceBarHtml（點畫面即跳），改為單一確認掣。
     */
    const endingVoice = isEnding
      ? (() => {
          const cast = (packMeta && Array.isArray(packMeta.tale_cast_profiles)) ? packMeta.tale_cast_profiles : [];
          /* 揀一個角色講最後一句；優先用「嗰個人」，否則第一個 */
          const pick = cast.find((c) => c.id === "partner") || cast[0] || null;
          if (!pick) return "";
          const q = {
            mom: "你返嚟食飯啦。今日煲咗湯。",
            colleague: "我走咗之後，你坐我個位？（佢笑）小心啲。",
            partner: "（望住你）我哋……仲有下一次嗎？",
          }[pick.id] || "（佢冇再講嘢，只係望住你）";
          return `<div class="of-ending-voice"><b class="of-ending-who">${esc(pick.name)}</b><p>${esc(q)}</p></div>`;
        })()
      : "";
    root.innerHTML = `
      ${isEnding
        ? `<div class="of-hud">${esc(packMeta ? packMeta.name : "故事包")} · 結局</div>`
        : lifeHudHtml()}
      <div class="ribbon">${isEnding
        ? esc(ev.office_ending_label || ev.name || "")
        : ageRibbon(esc(ev.name))}</div>
      <div class="soft-scroll soft-reveal${isEnding ? " of-ending-scroll" : ""}">
        ${endingBanner}
        ${softResultBarHtml(ev, gain, goldGain, isEnding, endingClaimable)}
        <img class="result-art soft-art" src="${esc(ev.art)}" alt="" />
        <div class="bubble neon">${esc(ev.desc)}</div>
        ${eventDialogueHtml(ev, "soft-dialogue")}
        ${endingVoice}
        <div class="soft-panel">${state.softNote ? `<span style="color:var(--neon-pink);font-weight:800">${esc(state.softNote)}</span><br/>` : ""}${isEnding ? "" : esc(eventCategoryLabel(ev) || "日常") + "<br/>"}${rewardLine}</div>
      </div>
      <div class="soft-cta">
        ${isEnding
          ? `<button class="btn gold of-ending-ok" id="btn-ok-ending" type="button">睇完，返回人生</button>`
          : autoAdvanceBarHtml(lifeDoneFlag() ? "結算今世" : `下一歲 ${state.age + 1}歲`)}
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    const settleTo = (screen) => {
      state.soul += gain;
      if (goldGain) state.gold = (state.gold | 0) + goldGain;
      if ((ev.reward_xp | 0) > 0) gainXp(ev.reward_xp | 0);
      // 結局旗標：領完即鎖，防止重複領 50 膠幣
      if (isEnding && endingClaimable && ev.flag_on_complete) {
        if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
        state.lifeFlags[ev.flag_on_complete] = 1;
      }
      state.shopLeftEmpty = false;
      trackEventMission(ev, { soft: true });
      advanceYear();
      state.selectedEvent = null;
      state.softNote = "";
      if (lifeDoneFlag()) {
        state.lastResult = {
          win: true,
          reward: 0,
          rewardBlurb: lifeEndBlurb(),
          eventName: lifeEndName(),
          deadNames: [],
        };
        state.screen = "result";
      } else {
        state.screen = screen;
      }
      render();
    };
    /*
     * t387：唔再需要撳「繼續」——結果浮現之後自動前進。
     * 玩家想快啲，點畫面任何位置即可（wireTapToAdvance）。
     */
    /*
     * t406：結局卡要全屏停住，唔可以被同一點擊食掉。
     *
     * 舊問題：`wireTapToAdvance(root, advance)` 令點任何空白都前進。
     * 玩家點完最後一個選擇、手勢落在空白 → 結局卡一閃即逝，
     * 直接跳去人生命運事件，完全冇睇到結語。
     *
     * 新行為（isEnding）：
     *   1. 唔呼叫 wireTapToAdvance（點空白唔會前進）
     *   2. 全屏結果 + 角色一句話
     *   3. 只有明確撳「繼續」/「重玩此包」才前進，且加短暫延遲防誤觸
     */
    if (isEnding) {
      /* 結局：只靠按鈕，唔接受點空白 */
      const okBtn = $("#btn-ok-ending", root);
      if (okBtn) {
        /* 首 900ms 內唔接受點擊，避免最後一個選擇的手勢誤觸 */
        let armed = false;
        okBtn.disabled = true;
        setTimeout(() => { armed = true; okBtn.disabled = false; }, 900);
        okBtn.onclick = (e) => {
          if (e) { e.preventDefault(); e.stopPropagation(); }
          if (!armed) return;
          settleTo(afterFateOrEventScreen());
        };
      }
      const abEnd = $("#btn-abandon", root);
      if (abEnd) abEnd.onclick = () => requestAbandonLife();
      wireStoryDock(root);
      return;
    }
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      clearAutoAdvance();
      settleTo(afterFateOrEventScreen());
    };
    wireTapToAdvance(root, advance);
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }


  /**
   * t379：小遊戲輸入時限（秒）。原本寫死 10000ms，玩家完全唔知幾時夠鐘；
   * 現在延長至 12 秒並在畫面顯示倒數。抽成常數，避免倒數條同實際計時不一致。
   */


  /* ================= t390：黑市賭檔・字花骰寶 =================
   *
   * 三粒骰：4–10 細、11–17 大（3 同 18 為「圍骰」，莊家通殺）。
   * 莊家隱藏傾向影響骰子分佈：
   *   bias = "big"     → 骰值偏高（+1 修正）
   *   bias = "small"   → 骰值偏低（-1 修正）
   *   bias = "fair"    → 正常
   *
   * 玩家每局可「猜大」「猜細」，或「睇莊」（唔落注，觀察一局）。
   */
  const DICE_LABELS = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const DICE_BIAS_LABEL = { big: "偏大", small: "偏細", fair: "公正" };

  /** 擲三粒骰（受 bias 影響） */
  function diceRoll(bias, rng) {
    const r = rng || Math.random;
    const out = [];
    for (let i = 0; i < 3; i++) {
      let v = 1 + Math.floor(r() * 6);
      /*
       * t390：bias 強度 0.58（實測偏大莊約 69% 開大）。
       * 太低（0.45）玩家睇兩三局睇唔出分別，「睇莊」就冇意義；
       * 太高（0.85）就變咗必勝，失去心理戰。
       */
      if (bias === "big" && v < 6 && r() < 0.58) v += 1;
      if (bias === "small" && v > 1 && r() < 0.58) v -= 1;
      out.push(v);
    }
    return out;
  }

  /** 總和 → 大／細／圍骰 */
  function diceResult(dice) {
    const sum = dice.reduce((a, b) => a + b, 0);
    /* 三粒同點 = 圍骰（莊家通殺） */
    const triple = dice[0] === dice[1] && dice[1] === dice[2];
    if (triple) return { sum, side: "triple", label: "圍骰" };
    if (sum >= 11) return { sum, side: "big", label: "大" };
    return { sum, side: "small", label: "細" };
  }

  /** 隨機揀一個莊家傾向（偏大／偏細各 35%、公正 30%） */
  function dicePickBias(rng) {
    const r = rng || Math.random;
    const v = r();
    if (v < 0.35) return "big";
    if (v < 0.70) return "small";
    return "fair";
  }

  function diceFacesText(dice) {
    return (dice || []).map((v) => DICE_LABELS[v] || String(v)).join(" ");
  }
  function diceSumText(dice) {
    return (dice || []).reduce((a, b) => a + b, 0);
  }

  /* ================= t390：黑市賭檔・麻雀殘局 =================
   *
   * 用「簡化牌」：萬／筒／條 各 1–9，每種 4 張（共 108 張）。
   * 玩家手上 13 張，目標係換到「聽牌」（差一張就食糊）或「食糊」（14 張齊）。
   *
   * 食糊判定：4 副面子（順子／刻子）＋ 1 對眼。
   * 為咗 3–5 步內可行，起始手牌會刻意接近聽牌（差 1–3 張）。
   */
  const MJ_SUITS = [
    { id: "wan", label: "萬", glyph: "萬" },
    { id: "tong", label: "筒", glyph: "筒" },
    { id: "tiao", label: "條", glyph: "條" },
  ];

  /** 一張牌 → 顯示用文字（例如「三萬」） */
  const MJ_NUM_CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  function mjLabel(tile) {
    if (!tile) return "";
    const s = MJ_SUITS.find((x) => x.id === tile.suit);
    return (MJ_NUM_CN[tile.num] || String(tile.num)) + (s ? s.glyph : "");
  }
  function mjKey(t) { return t.suit + t.num; }

  /** 13 張手牌 + 1 張摸牌 → 是否食糊（14 張） */
  function mjIsWin(hand14) {
    if (!Array.isArray(hand14) || hand14.length !== 14) return false;
    const counts = {};
    hand14.forEach((t) => { const k = mjKey(t); counts[k] = (counts[k] | 0) + 1; });
    /* 試每一種「眼」 */
    const keys = Object.keys(counts).sort();
    for (const eye of keys) {
      if ((counts[eye] | 0) < 2) continue;
      const c = Object.assign({}, counts);
      c[eye] -= 2;
      if (c[eye] === 0) delete c[eye];
      if (mjAllMelds(c)) return true;
    }
    return false;
  }

  /** 剩餘牌能否全部拆成面子 */
  function mjAllMelds(counts) {
    const keys = Object.keys(counts).filter((k) => (counts[k] | 0) > 0).sort();
    if (!keys.length) return true;
    const first = keys[0];
    const suit = first.replace(/[0-9]+$/, "");
    const num = parseInt(first.replace(/^[a-z]+/, ""), 10);
    /* 刻子 */
    if ((counts[first] | 0) >= 3) {
      const c2 = Object.assign({}, counts);
      c2[first] -= 3;
      if (c2[first] === 0) delete c2[first];
      if (mjAllMelds(c2)) return true;
    }
    /* 順子 num, num+1, num+2（限同花色，且 1–7 起） */
    if (num <= 7) {
      const k2 = suit + (num + 1);
      const k3 = suit + (num + 2);
      if ((counts[k2] | 0) > 0 && (counts[k3] | 0) > 0) {
        const c3 = Object.assign({}, counts);
        c3[first] -= 1; c3[k2] -= 1; c3[k3] -= 1;
        [first, k2, k3].forEach((k) => { if (c3[k] === 0) delete c3[k]; });
        if (mjAllMelds(c3)) return true;
      }
    }
    return false;
  }

  /** 13 張是否「聽牌」（差一張就食糊），回傳可以食糊的牌 keys */
  function mjWaitingTiles(hand13) {
    if (!Array.isArray(hand13) || hand13.length !== 13) return [];
    const out = [];
    const have = {};
    hand13.forEach((t) => { const k = mjKey(t); have[k] = (have[k] | 0) + 1; });
    MJ_SUITS.forEach((s) => {
      for (let n = 1; n <= 9; n++) {
        const key = s.id + n;
        if ((have[key] | 0) >= 4) continue;
        const test = hand13.concat([{ suit: s.id, num: n }]);
        if (mjIsWin(test)) out.push(key);
      }
    });
    return out;
  }

  /** 生成一副「接近聽牌」的 13 張手牌 */
  function mjDealNearReady(rng) {
    const r = rng || Math.random;
    const rand = (n) => Math.floor(r() * n);
    while (true) {
      /* 砌 4 副面子 + 1 對眼 = 14 張，然後抽走一張 → 13 張（必然聽牌） */
      const full = [];
      let guard = 0;
      while (full.length < 12 && guard++ < 200) {
        const suit = MJ_SUITS[rand(3)].id;
        if (r() < 0.42) {
          const n = 1 + rand(9);
          full.push({ suit, num: n }, { suit, num: n }, { suit, num: n });
        } else {
          const n = 1 + rand(7);
          full.push({ suit, num: n }, { suit, num: n + 1 }, { suit, num: n + 2 });
        }
      }
      const eyeSuit = MJ_SUITS[rand(3)].id;
      const eyeNum = 1 + rand(9);
      full.push({ suit: eyeSuit, num: eyeNum }, { suit: eyeSuit, num: eyeNum });
      if (full.length !== 14) continue;
      /* 點數上限檢查（同一張牌唔可以超過 4 張） */
      const cnt = {};
      let bad = false;
      full.forEach((t) => { const k = mjKey(t); cnt[k] = (cnt[k] | 0) + 1; if (cnt[k] > 4) bad = true; });
      if (bad) continue;
      /* 抽走一張 */
      const drop = rand(full.length);
      const hand = full.slice(0, drop).concat(full.slice(drop + 1));
      if (hand.length !== 13) continue;
      if (mjWaitingTiles(hand).length) return { hand, full };
    }
  }

  /** 摸牌堆：未出現過的牌（每種最多 4 張） */
  function mjDrawPool(hand) {
    const have = {};
    hand.forEach((t) => { const k = mjKey(t); have[k] = (have[k] | 0) + 1; });
    const pool = [];
    MJ_SUITS.forEach((s) => {
      for (let n = 1; n <= 9; n++) {
        if ((have[s.id + n] | 0) < 4) pool.push({ suit: s.id, num: n });
      }
    });
    return pool;
  }


  /* ===================================================================
   * t390：黑市賭檔 view（兩款遊戲分流）
   * =================================================================== */

  /** 賭檔畫面入口：按 cfg.modes 隨機抽一款 */
  function viewBlackMarket(root) {
    const ev = state.selectedEvent;
    if (!ev) { state.screen = "events"; render(); return; }
    const cfg = (ev.minigame && typeof ev.minigame === "object") ? ev.minigame : {};
    const modes = Array.isArray(cfg.modes) && cfg.modes.length ? cfg.modes : ["mahjong", "dice"];

    /* 第一次進入：抽一款並初始化 */
    if (!state.minigame || state.minigame.eventId !== ev.id) {
      const kind = modes[Math.floor(Math.random() * modes.length)];
      state.minigame = {
        eventId: ev.id,
        mode: kind,              // mahjong | dice
        phase: "intro",          // intro | play | won | lost
        settled: false,
        rewardApplied: false,
        rewardSoul: 0,
        rewardXp: 0,
        rewardGold: 0,
        shards: 0,
        won: false,
        message: "",
        /* 麻雀 */
        mj: null,
        /* 骰寶 */
        dice: null,
      };
      if (kind === "mahjong") initMahjong(state.minigame, cfg);
      else initDice(state.minigame, cfg);
    }
    if (state.minigame.mode === "mahjong") return viewMahjong(root);
    return viewDiceTable(root);
  }

  /* ---------------- 麻雀殘局 ---------------- */
  function initMahjong(mg, cfg) {
    const deal = mjDealNearReady();
    mg.mj = {
      hand: deal.hand,          // 13 張
      stepsLeft: Math.max(3, Math.min(5, (cfg.mj_steps | 0) || 4)),
      stepsUsed: 0,
      drawn: null,              // 摸到但未打的那張
      log: [],
      waiting: mjWaitingTiles(deal.hand),
      result: null,             // win | ready | lose
    };
  }

  function viewMahjong(root) {
    const ev = state.selectedEvent;
    const mg = state.minigame;
    const mj = mg.mj;
    if (!mj) return;

    const isResult = mg.phase === "won" || mg.phase === "lost";
    const hand = mj.hand;

    /* 牌面 */
    const tileHtml = (t, i, extra) => {
      /* t390：結果階段鎖住牌面（唔可以再點，避免以為仲打得） */
      const cls = (extra ? " " + extra : "") + (isResult ? " locked" : "");
      const dis = isResult ? " disabled" : "";
      return `<button type="button" class="mj-tile${cls}" data-mj-tile="${i}"${dis} aria-label="${esc(mjLabel(t))}">
        <span class="mj-num">${esc(MJ_NUM_CN[t.num] || t.num)}</span>
        <span class="mj-suit">${esc(MJ_SUITS.find((s) => s.id === t.suit).glyph)}</span>
      </button>`;
    };

    const handHtml = hand.map((t, i) => tileHtml(t, i)).join("");
    const drawnHtml = mj.drawn
      ? `<div class="mj-drawn">
           <span class="mj-drawn-label">摸到</span>
           <button type="button" class="mj-tile drawn" data-mj-discard="1" aria-label="打出 ${esc(mjLabel(mj.drawn))}">
             <span class="mj-num">${esc(MJ_NUM_CN[mj.drawn.num] || mj.drawn.num)}</span>
             <span class="mj-suit">${esc(MJ_SUITS.find((s) => s.id === mj.drawn.suit).glyph)}</span>
           </button>
         </div>`
      : "";

    /* 剩餘步數 */
    const dots = [];
    for (let i = 0; i < mj.stepsLeft; i++) {
      dots.push(`<span class="mj-step-dot${i < mj.stepsUsed ? " used" : ""}"></span>`);
    }

    let cta = "";
    if (mg.phase === "intro") {
      cta = `<button class="btn gold" id="mj-start" type="button">埋枱</button>
        <button class="btn ghost" id="mj-quit" type="button">唔賭（半獎）</button>`;
    } else if (!isResult) {
      cta = `<button class="btn ghost" id="mj-quit" type="button">收手（半獎）</button>`;
    } else {
      cta = `${autoAdvanceBarHtml("繼續")}
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>`;
    }

    const resultPanel = isResult
      ? `<div class="soft-panel mj-result">
           ${esc(mg.message)}
           <br/>今世賺了 <b style="color:var(--neon-gold)">+${mg.rewardSoul}</b> 膠幣
           ${mg.rewardXp ? ` · 經驗 +${mg.rewardXp}` : ""}
           ${mg.shards ? ` · <span class="shard-gain">${shardIconHtml()}<b>殘頁 ×${mg.shards}</b></span>` : ""}
           · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲</span>
         </div>`
      : "";

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name) + " · 麻雀殘局")}</div>
      <div class="mg-wrap">
        <div class="mg-arcade bm-table">
          <div class="bm-head">
            <span class="bm-mode">十三張殘局</span>
            <span class="mj-steps">${dots.join("")}</span>
            <span class="bm-left">剩 ${mj.stepsLeft - mj.stepsUsed} 步</span>
          </div>
          <div class="bubble neon mg-msg">${esc(mg.message || "揀牌打，或者摸一張。湊夠 4 副 + 1 對就食糊。")}</div>
          <div class="mj-hand">${handHtml}</div>
          ${drawnHtml}
          <p class="mj-hint">點一張牌打出；或者「摸牌」再決定。</p>
        </div>
        ${resultPanel}
      </div>
      <div class="soft-cta mg-cta">
        ${(!isResult && mg.phase !== "intro") ? `<button class="btn gold" id="mj-draw" type="button">摸牌</button>` : ""}
        ${cta}
      </div>
      ${storyDockHtml()}
    `;

    wireStoryDock(root);

    const startBtn = $("#mj-start", root);
    if (startBtn) startBtn.onclick = () => { mg.phase = "play"; mg.message = "揀一張打出，或者摸牌。"; render(); };
    const quitBtn = $("#mj-quit", root);
    if (quitBtn) quitBtn.onclick = () => endBlackMarket(false, "收手離場——半獎，人生繼續。");
    const ab = $("#btn-abandon", root);
    if (ab) ab.onclick = () => requestAbandonLife();

    /* 摸牌 */
    const drawBtn = $("#mj-draw", root);
    if (drawBtn) drawBtn.onclick = () => {
      if (mg.phase !== "play" || mj.drawn) return;
      const pool = mjDrawPool(mj.hand);
      if (!pool.length) return;
      mj.drawn = pool[Math.floor(Math.random() * pool.length)];
      mg.message = `摸到「${mjLabel(mj.drawn)}」。要留定要打？`;
      render();
    };

    /* 打出手牌 */
    root.querySelectorAll("[data-mj-tile]").forEach((btn) => {
      btn.onclick = () => {
        if (mg.phase !== "play") return;
        const idx = btn.dataset.mjTile | 0;
        if (idx < 0 || idx >= mj.hand.length) return;
        discardAndDraw(idx);
      };
    });

    /* 打出摸到的牌 */
    const discardBtn = root.querySelector("[data-mj-discard]");
    if (discardBtn) discardBtn.onclick = () => {
      if (mg.phase !== "play" || !mj.drawn) return;
      /* 打出摸到的那張 = 原封不動，只消耗一步 */
      mj.drawn = null;
      mj.stepsUsed += 1;
      afterStep();
    };

    if (isResult) {
      let done = false;
      const go = () => { if (done) return; done = true; clearAutoAdvance(); settleBlackMarket(); };
      wireTapToAdvance(root, go);
    }

    /* 每步之後：檢查是否食糊／聽牌／用盡步數 */
    function afterStep() {
      const w = mjWaitingTiles(mj.hand);
      mj.waiting = w;
      if (w.length) {
        /* 已經聽牌 → 食糊判定（用摸到那張模擬一次） */
        endMahjong("ready");
        return;
      }
      if (mj.stepsUsed >= mj.stepsLeft) {
        endMahjong("lose");
        return;
      }
      mg.message = `打出一張，仲有 ${mj.stepsLeft - mj.stepsUsed} 步。`;
      render();
    }

    function discardAndDraw(idx) {
      /* 如果有摸牌：換入摸到的牌 */
      if (mj.drawn) {
        mj.hand = mj.hand.slice();
        mj.hand[idx] = mj.drawn;
        mj.drawn = null;
      } else {
        /* 冇摸牌就打出一張（等於少一張，之後要摸） */
        mj.hand = mj.hand.slice();
        mj.hand.splice(idx, 1);
        const pool = mjDrawPool(mj.hand);
        if (pool.length) mj.hand.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      mj.stepsUsed += 1;
      /* 食糊檢查：13 張 + 1 張 = 14 */
      const testWin = () => {
        /* 用摸牌堆中每一張試，睇有冇可以食糊 */
        const pool = mjDrawPool(mj.hand);
        return pool.some((t) => mjIsWin(mj.hand.concat([t])));
      };
      if (testWin()) { endMahjong("win"); return; }
      afterStep();
    }

    function endMahjong(result) {
      mj.result = result;
      mg.phase = result === "lose" ? "lost" : "won";
      mg.won = result !== "lose";
      const full = listedEventSoul(ev);
      const xp = ev.reward_xp | 0;
      const gold = ev.reward_gold | 0;
      let ratio = 0.5;
      let msg = "";
      if (result === "win") { ratio = 1; msg = "食糊！莊家面色一沉，推錢過嚟。"; }
      else if (result === "ready") { ratio = 0.8; msg = "聽牌！差最後一張，莊家唔敢再留你。"; }
      else { ratio = 0.5; msg = "散牌收場。莊家笑住收錢，話下次再嚟。"; }
      mg.rewardSoul = Math.max(1, Math.round(full * ratio));
      mg.rewardXp = Math.max(0, Math.round(xp * ratio));
      mg.rewardGold = Math.max(0, Math.round(gold * ratio));
      mg.shards = rollShards(ev, mg.minigameCfg, result);
      mg.message = msg;
      applyBlackMarketRewards();
      render();
    }
  }

  /* ---------------- 字花骰寶 ---------------- */
  function initDice(mg, cfg) {
    mg.dice = {
      bias: dicePickBias(),
      round: 1,
      needWins: 2,
      wins: 0,
      losses: 0,
      lastRoll: null,
      lastSide: null,
      peeks: 1,
      history: [],
      log: [],
    };
  }

  function viewDiceTable(root) {
    const ev = state.selectedEvent;
    const mg = state.minigame;
    const dd = mg.dice;
    if (!dd) return;

    const isResult = mg.phase === "won" || mg.phase === "lost";

    const histHtml = dd.history.length
      ? dd.history.map((h) => `<span class="dice-hist ${h.side}">${esc(diceFacesText(h.dice))} = ${h.sum} ${esc(h.label)}</span>`).join("")
      : `<span class="dice-hist-empty">仲未開過局</span>`;

    let cta = "";
    if (mg.phase === "intro") {
      cta = `<button class="btn gold" id="dd-start" type="button">埋枱</button>
        <button class="btn ghost" id="dd-quit" type="button">唔賭（半獎）</button>`;
    } else if (!isResult) {
      cta = `<button class="btn ghost" id="dd-quit" type="button">收手（半獎）</button>`;
    } else {
      cta = `${autoAdvanceBarHtml("繼續")}
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>`;
    }

    const resultPanel = isResult
      ? `<div class="soft-panel dice-result">
           ${esc(mg.message)}
           <br/>今世賺了 <b style="color:var(--neon-gold)">+${mg.rewardSoul}</b> 膠幣
           ${mg.rewardXp ? ` · 經驗 +${mg.rewardXp}` : ""}
           ${mg.shards ? ` · <span class="shard-gain">${shardIconHtml()}<b>殘頁 ×${mg.shards}</b></span>` : ""}
           · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲</span>
         </div>`
      : "";

    const lastHtml = dd.lastRoll
      ? `<div class="dice-last ${dd.lastSide}">
           <span class="dice-faces">${esc(diceFacesText(dd.lastRoll))}</span>
           <span class="dice-sum">${esc(String(dd.lastRoll.reduce((a, b) => a + b, 0)))}</span>
           <span class="dice-side">${esc(dd.lastSide === "triple" ? "圍骰" : dd.lastSide === "big" ? "大" : "細")}</span>
         </div>`
      : `<div class="dice-last empty">三粒骰等你落注</div>`;

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name) + " · 字花骰寶")}</div>
      <div class="mg-wrap">
        <div class="mg-arcade dice-table">
          <div class="bm-head">
            <span class="bm-mode">三粒骰・三局兩勝</span>
            <span class="dice-score">贏 ${dd.wins} · 輸 ${dd.losses}</span>
          </div>
          ${lastHtml}
          <div class="bubble neon mg-msg">${esc(mg.message || "4–10 細，11–17 大。三粒同點做圍骰，莊家通殺。")}</div>
          <div class="dice-history">${histHtml}</div>
          <p class="mj-hint">莊家會做手腳——留意前幾局。剩 ${dd.peeks} 次「睇莊」。</p>
        </div>
        ${resultPanel}
      </div>
      <div class="soft-cta mg-cta mt-cta">
        ${(!isResult && mg.phase === "play") ? `
          <button class="btn gold" id="dd-small" type="button">買細</button>
          <button class="btn gold" id="dd-big" type="button">買大</button>
          ${dd.peeks > 0 ? `<button class="btn ghost" id="dd-peek" type="button">睇莊（唔落注）</button>` : ""}
        ` : ""}
        ${cta}
      </div>
      ${storyDockHtml()}
    `;

    wireStoryDock(root);
    const startBtn = $("#dd-start", root);
    if (startBtn) startBtn.onclick = () => { mg.phase = "play"; mg.message = "落注。買大定買細？"; render(); };
    const quitBtn = $("#dd-quit", root);
    if (quitBtn) quitBtn.onclick = () => endBlackMarket(false, "收手離場——半獎，人生繼續。");
    const ab = $("#btn-abandon", root);
    if (ab) ab.onclick = () => requestAbandonLife();

    const play = (pick) => {
      if (mg.phase !== "play") return;
      const dice = diceRoll(dd.bias);
      const res = diceResult(dice);
      dd.lastRoll = dice;
      dd.lastSide = res.side;
      dd.history.push({ dice, sum: res.sum, side: res.side, label: res.label });
      const win = res.side === pick;
      if (win) dd.wins += 1; else dd.losses += 1;
      mg.message = win
        ? `開 ${res.sum} ${res.label}——買中咗。`
        : `開 ${res.sum} ${res.label}——輸咗呢局。`;
      if (dd.wins >= dd.needWins) { endDice(true); return; }
      if (dd.losses >= dd.needWins) { endDice(false); return; }
      dd.round += 1;
      render();
    };

    const smallBtn = $("#dd-small", root);
    if (smallBtn) smallBtn.onclick = () => play("small");
    const bigBtn = $("#dd-big", root);
    if (bigBtn) bigBtn.onclick = () => play("big");

    /* 睇莊：開一局但唔計分，讓玩家觀察傾向 */
    const peekBtn = $("#dd-peek", root);
    if (peekBtn) peekBtn.onclick = () => {
      if (mg.phase !== "play" || dd.peeks <= 0) return;
      dd.peeks -= 1;
      const dice = diceRoll(dd.bias);
      const res = diceResult(dice);
      dd.lastRoll = dice;
      dd.lastSide = res.side;
      dd.history.push({ dice, sum: res.sum, side: res.side, label: res.label });
      mg.message = `睇莊：開 ${res.sum} ${res.label}（呢局唔計分）。`;
      render();
    };

    if (isResult) {
      let done = false;
      const go = () => { if (done) return; done = true; clearAutoAdvance(); settleBlackMarket(); };
      wireTapToAdvance(root, go);
    }

    function endDice(won) {
      mg.phase = won ? "won" : "lost";
      mg.won = !!won;
      const full = listedEventSoul(ev);
      const ratio = won ? 1 : 0.5;
      mg.rewardSoul = Math.max(1, Math.round(full * ratio));
      mg.rewardXp = Math.max(0, Math.round((ev.reward_xp | 0) * ratio));
      mg.rewardGold = Math.max(0, Math.round((ev.reward_gold | 0) * ratio));
      mg.shards = rollShards(ev, ev.minigame, won ? "win" : "lose");
      mg.message = won
        ? `贏咗 ${dd.wins} 局。莊家唔出聲，收檔。`
        : `輸咗 ${dd.losses} 局。莊家話：下次帶多啲。`;
      applyBlackMarketRewards();
      render();
    }
  }

  /* ---------------- 共用：獎勵與殘頁 ---------------- */
  /** 擲殘頁數量（只喺賭檔掉落） */
  function rollShards(ev, cfg, result) {
    const c = (cfg && typeof cfg === "object") ? cfg : {};
    const chance = (c.shard_chance != null) ? Number(c.shard_chance) : 0.85;
    if (result === "lose") return 0;           // 輸咗冇殘頁
    if (Math.random() >= chance) return 0;
    const min = Math.max(1, (c.shard_min | 0) || 1);
    const max = Math.max(min, (c.shard_max | 0) || 2);
    const n = min + Math.floor(Math.random() * (max - min + 1));
    /* 食糊多一張 */
    return result === "win" ? n + 1 : n;
  }

  /** 入帳（只做一次） */
  function applyBlackMarketRewards() {
    const mg = state.minigame;
    if (!mg || mg.rewardApplied) return;
    if ((mg.rewardSoul | 0) > 0) state.soul += mg.rewardSoul | 0;
    if ((mg.rewardXp | 0) > 0) gainXp(mg.rewardXp | 0);
    if ((mg.rewardGold | 0) > 0) state.gold = (state.gold | 0) + (mg.rewardGold | 0);
    if ((mg.shards | 0) > 0) addCardShards(mg.shards);
    mg.rewardApplied = true;
  }

  /** 加入殘頁（隨機分配到清單中的卡） */
  function addCardShards(n) {
    const list = shardRewardPool();
    if (!list.length) return;
    if (!state.cardShards || typeof state.cardShards !== "object") state.cardShards = {};
    for (let i = 0; i < n; i++) {
      const id = list[Math.floor(Math.random() * list.length)];
      state.cardShards[id] = (state.cardShards[id] | 0) + 1;
    }
  }

  /** t392：殘頁道具圖（統一存放，缺檔自動退回文字圖示） */
  const SHARD_ITEM_ART = "assets/shards/shard-item.jpg";

  /** 殘頁小圖示（橫幅／結果用） */
  function shardIconHtml(extraCls) {
    const cls = extraCls ? " " + extraCls : "";
    return `<img class="shard-item-ico${cls}" src="${SHARD_ITEM_ART}" alt="" aria-hidden="true" draggable="false" />`;
  }

  /** 殘頁兌換面板（卡冊內彈出） */
  function shardRedeemHtml() {
    const cfg = DATA.shard_rewards || {};
    const need = Math.max(1, (cfg.need | 0) || 10);
    const pool = shardRewardPool();
    const rows = pool.map((id) => {
      const f = fighterById[id];
      if (!f) return "";
      const have = shardCountOf(id);
      const can = have >= need;
      /* 進度條最多 100%；數字保留實際值（玩家會想知有冇多過） */
      const pct = Math.min(100, Math.round((have / need) * 100));
      const shown = can ? `${have}／${need} ✓` : `${have}／${need}`;
      /*
       * t392：左邊顯示「殘頁道具圖」（玩家收集的東西），
       * 中間箭頭，右邊才係可以換到的卡 → 一眼睇出兌換關係。
       */
      return `<div class="shard-row${can ? " ready" : ""}">
        <div class="shard-pair">
          <img class="shard-art shard-art-item" src="${SHARD_ITEM_ART}" alt="殘頁" draggable="false" />
          <span class="shard-arrow-mid" aria-hidden="true">→</span>
          <img class="shard-art" src="${esc(f.art)}" alt="${esc(f.name)}" draggable="false" />
        </div>
        <div class="shard-info">
          <div class="shard-name">${esc(f.name)}</div>
          <div class="shard-bar"><i style="width:${pct}%"></i></div>
          <div class="shard-count">${shown}</div>
        </div>
        <button type="button" class="btn shard-btn${can ? " gold" : ""}" data-shard-redeem="${esc(id)}" ${can ? "" : "disabled"}>${can ? "兌換" : "未夠"}</button>
      </div>`;
    }).join("") || `<p class="shard-empty">暫時冇可換清單</p>`;
    return `<div class="album-mask" id="shard-mask">
      <div class="album-detail-sheet shard-sheet" role="dialog" aria-label="戰鬥卡殘頁">
        <button type="button" class="album-detail-x" id="shard-x" aria-label="關閉">×</button>
        <div class="album-detail-top">
          <span class="album-badge album-badge-fighters">殘頁</span>
          <div class="album-detail-name">戰鬥卡殘頁</div>
        </div>
        <p class="shard-note">每 ${need} 張換一張指定戰鬥卡。殘頁只喺黑市賭檔掉落。</p>
        <div class="shard-list">${rows}</div>
        <p class="album-detail-foot">點擊彈窗以外的任意位置，可以關閉彈窗</p>
      </div>
    </div>`;
  }

  /** 殘頁橫幅與兌換面板接線 */
  function wireShardPanel(root, toast) {
    const banner = $("#shard-banner", root);
    if (!banner) return;
    banner.onclick = () => {
      const host = root.querySelector(".album-screen") || root;
      if (root.querySelector("#shard-mask")) return;
      host.insertAdjacentHTML("beforeend", shardRedeemHtml());
      const mask = $("#shard-mask", root);
      if (!mask) return;
      const close = () => { if (mask.parentNode) mask.parentNode.removeChild(mask); };
      const x = $("#shard-x", mask);
      if (x) x.onclick = close;
      mask.addEventListener("click", (e) => { if (e.target === mask) close(); });
      mask.querySelectorAll("[data-shard-redeem]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-shard-redeem") || "";
          const r = redeemShardCard(id);
          if (r.ok) {
            if (toast) toast(root, `已兌換「${r.name || id}」`);
            close();
            render();
          } else if (toast) {
            toast(root, r.reason || "兌換失敗");
          }
        };
      });
    };
  }

  /** 殘頁可換的卡清單 */
  function shardRewardPool() {
    const cfg = DATA.shard_rewards;
    if (cfg && Array.isArray(cfg.pool) && cfg.pool.length) {
      return cfg.pool.filter((id) => !!fighterById[id]);
    }
    /* 兜底：城寨系 */
    return ["C01"];
  }

  /**
   * t390：卡冊「戰鬥卡」頁頂的殘頁橫幅。
   * 只在有殘頁時顯示；點開可睇每張卡嘅殘頁進度同兌換。
   */
  function shardBannerHtml() {
    const cfg = DATA.shard_rewards || {};
    const need = Math.max(1, (cfg.need | 0) || 10);
    const pool = shardRewardPool();
    if (!pool.length) return "";
    const total = shardTotal();
    /* 計算有幾多個「完整 10 張」可以換 */
    const ready = pool.filter((id) => shardCountOf(id) >= need);
    const chipCls = ready.length ? "shard-banner ready" : (total > 0 ? "shard-banner" : "shard-banner empty");
    const summary = total > 0
      ? `殘頁 <b>${total}</b> 張${ready.length ? ` · <span class="shard-go">可換 ${ready.length} 張卡</span>` : `（每 ${need} 張換一張）`}`
      : `戰鬥卡殘頁：去黑市賭檔贏返嚟（每 ${need} 張換一張）`;
    return `<div class="${chipCls}" id="shard-banner">
      ${shardIconHtml("shard-ico")}
      <span class="shard-text">${summary}</span>
      <span class="shard-arrow">▾</span>
    </div>`;
  }

  /** 某張卡的殘頁數 */
  function shardCountOf(id) {
    if (!state.cardShards || typeof state.cardShards !== "object") return 0;
    return Math.max(0, state.cardShards[id] | 0);
  }

  /** 殘頁總數 */
  function shardTotal() {
    if (!state.cardShards || typeof state.cardShards !== "object") return 0;
    return Object.keys(state.cardShards).reduce((a, k) => a + Math.max(0, state.cardShards[k] | 0), 0);
  }

  /** 兌換：滿 need 張 → 指定卡入冊 */
  function redeemShardCard(id, need) {
    const n = need || ((DATA.shard_rewards && DATA.shard_rewards.need) | 0) || 10;
    if (shardCountOf(id) < n) return { ok: false, reason: `殘頁不足（${shardCountOf(id)}／${n}）` };
    state.cardShards[id] = (state.cardShards[id] | 0) - n;
    const f = fighterById[id];
    if (!f) return { ok: false, reason: "冇呢張卡" };
    const before = albumCardCount(id);
    albumSetCount(id, before + 1);
    if (before <= 0) albumMarkNewCardStar1("fighters", id);
    return { ok: true, name: f.name };
  }

  /** 賭檔最終結算：回人生 */
  function settleBlackMarket() {
    const ev = state.selectedEvent;
    const mg = state.minigame;
    if (!mg || mg.settled) return;
    mg.settled = true;
    applyBlackMarketRewards();
    if (ev) trackEventMission(ev, { soft: true });
    state.minigame = null;
    state.selectedEvent = null;
    state.softNote = "";
    advanceYear();
    if (lifeDoneFlag()) {
      state.lastResult = {
        win: true, reward: 0,
        rewardBlurb: lifeEndBlurb(),
        eventName: lifeEndName(),
        deadNames: [],
      };
      state.screen = "result";
    } else {
      state.screen = afterFateOrEventScreen();
    }
    render();
  }

  /** 中途放棄（半獎） */
  function endBlackMarket(won, msg) {
    const mg = state.minigame;
    const ev = state.selectedEvent;
    if (!mg) return;
    const full = ev ? listedEventSoul(ev) : 0;
    mg.phase = won ? "won" : "lost";
    mg.won = !!won;
    mg.rewardSoul = Math.max(1, Math.round(full * 0.5));
    mg.rewardXp = ev ? Math.max(0, Math.round((ev.reward_xp | 0) * 0.5)) : 0;
    mg.rewardGold = ev ? Math.max(0, Math.round((ev.reward_gold | 0) * 0.5)) : 0;
    mg.shards = 0;
    mg.message = msg || "收手離場——半獎，人生繼續。";
    applyBlackMarketRewards();
    render();
  }

  /* ===================================================================
   * t390：小遊戲分流 —— 舊「記憶鍵位」同新「黑市賭檔」並存
   * =================================================================== */
  function viewMinigameEntry(root) {
    const ev = state.selectedEvent;
    const kind = (ev && ev.minigame && ev.minigame.kind) || "";
    if (kind === "black_market") return viewBlackMarket(root);
    return viewMinigame(root);
  }

  const MG_INPUT_LIMIT_S = 12;
  const MG_INPUT_LIMIT_MS = MG_INPUT_LIMIT_S * 1000;

  /** 小遊戲關：記憶鍵位破關（約 20–40 秒）；勝滿獎／敗半獎；可放棄＝半獎 */
  function viewMinigame(root) {
    const ev = state.selectedEvent;
    if (!ev) {
      state.screen = "events";
      render();
      return;
    }
    const cfg = (ev.minigame && typeof ev.minigame === "object") ? ev.minigame : {};
    const padCount = Math.max(3, Math.min(6, (cfg.pad_count | 0) || 4));
    const maxRounds = Math.max(2, Math.min(5, (cfg.rounds | 0) || 3));
    const timeLimitSec = Math.max(20, Math.min(45, (cfg.time_limit_sec | 0) || 35));
    const PAD_LABELS = ["赤", "青", "金", "紫", "翠", "白"];
    const PAD_COLORS = ["#ff4d6a", "#3dfff0", "#ffd36a", "#c9a0ff", "#7dffb3", "#f0f0f0"];

    if (!state.minigame || state.minigame.eventId !== ev.id) {
      state.minigame = {
        eventId: ev.id,
        phase: "intro", // intro | watch | input | won | lost
        round: 1,
        sequence: [],
        inputIdx: 0,
        flashIdx: -1,
        message: "依序記住亮起的鍵位，再依同樣順序點選。",
        startedAt: 0,
        deadlineAt: 0,
        inputDeadlineAt: 0,
        timers: [],
        settled: false,
        rewardApplied: false,
        rewardSoul: 0,
        rewardXp: 0,
        rewardGold: 0,
        won: false,
      };
    }
    const mg = state.minigame;

    const clearMgTimers = () => {
      (mg.timers || []).forEach((t) => clearTimeout(t));
      mg.timers = [];
      // t379：連每秒倒數 interval 一齊清
      if (mg.inputTick) {
        try { clearInterval(mg.inputTick); } catch (_) {}
        mg.inputTick = null;
      }
    };

    const baseSoul = () => listedEventSoul(ev);
    const baseXp = () => (ev.reward_xp | 0);
    const baseGold = () => (ev.reward_gold | 0);

    const paint = () => {
      const remain = mg.deadlineAt
        ? Math.max(0, Math.ceil((mg.deadlineAt - Date.now()) / 1000))
        : timeLimitSec;
      const phaseLabel = ({
        intro: "準備",
        watch: "記住序列",
        input: "依序點選",
        won: "破關成功",
        lost: "破關失敗",
      })[mg.phase] || "";
      const isResult = mg.phase === "won" || mg.phase === "lost";
      const timePct = Math.max(0, Math.min(100, (remain / timeLimitSec) * 100));
      const timeWarn = remain <= 8;

      // 關卡指示燈
      const dots = [];
      for (let r = 1; r <= maxRounds; r++) {
        const cls = mg.phase === "won" || r < mg.round ? "done" : (r === mg.round && !isResult ? "now" : "");
        dots.push(`<span class="mg-round-dot${cls ? " " + cls : ""}"></span>`);
      }

      // 鍵位（圓形霓虹）
      const pads = [];
      for (let i = 0; i < padCount; i++) {
        const lit = mg.flashIdx === i ? " lit" : "";
        const dis = mg.phase !== "input" ? " disabled" : "";
        pads.push(
          `<button type="button" class="mg-pad mg-pad-neon${lit}" data-pad="${i}" style="--mg-c:${PAD_COLORS[i]}"${dis} aria-label="${PAD_LABELS[i]}">` +
          `<span class="mg-pad-label">${PAD_LABELS[i]}</span></button>`
        );
      }

      // 輸入進度
      const progress = mg.phase === "input" && mg.sequence.length
        ? `<div class="mg-input-progress">${mg.sequence
            .map((_, i) => `<i class="${i < mg.inputIdx ? "on" : ""}"></i>`)
            .join("")}</div>`
        : "";

      let cta = "";
      if (mg.phase === "intro") {
        cta = `<button class="btn gold" id="btn-mg-start" type="button">開始破關</button>
          <button class="btn ghost" id="btn-mg-skip" type="button">放棄（半獎）</button>`;
      } else if (isResult) {
        /* t387：結果浮現之後自動前進，唔需要撳「繼續」 */
        cta = `${autoAdvanceBarHtml("繼續")}
          <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>`;
      } else {
        cta = `<button class="btn ghost" id="btn-mg-skip" type="button">放棄（半獎）</button>`;
      }

      const rewardLine = isResult
        ? `<div class="soft-panel">${esc(mg.message)}<br/>今世賺了 <b style="color:var(--neon-gold)">+${mg.rewardSoul}</b> 膠幣` +
          `${mg.rewardXp ? ` · 經驗 +${mg.rewardXp}` : ""}` +
          `${mg.rewardGold ? ` · 金幣 +${mg.rewardGold}` : ""}` +
          `${mg.won && ev.attrs_delta ? ` · ${esc(formatAttrsDelta(ev.attrs_delta).join("、") || "")}` : ""}` +
          ` · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span></div>`
        : "";

      // t379：輸入階段顯示「輸入剩餘秒數」（原本 10 秒時限完全睇唔到）
      const inputLeft = mg.phase === "input" && mg.inputDeadlineAt
        ? Math.max(0, Math.ceil((mg.inputDeadlineAt - Date.now()) / 1000))
        : null;
      const inputUrgent = inputLeft != null && inputLeft <= 3;

      root.innerHTML = `
        ${lifeHudHtml()}
        <div class="ribbon">${ageRibbon(esc(ev.name) + " · 小遊戲")}</div>
        <div class="mg-wrap">
          <div class="mg-arcade">
            <div class="mg-rounds" aria-hidden="true">${dots.join("")}</div>
            <div class="mg-timebar${timeWarn ? " warn" : ""}"><i style="width:${timePct}%"></i></div>
            <div class="mg-status">
              <span>第 <b>${mg.round}</b>／${maxRounds} 關</span>
              <span class="mg-phase">${esc(phaseLabel)}</span>
              <span>剩餘 <b>${remain}</b>s</span>
            </div>
            ${
              inputLeft != null
                ? `<div class="mg-input-timer${inputUrgent ? " urgent" : ""}" role="timer" aria-live="off">
                     <span class="mit-label">輸入時間</span>
                     <span class="mit-bar"><i style="width:${Math.max(0, Math.min(100, (inputLeft / MG_INPUT_LIMIT_S) * 100))}%"></i></span>
                     <span class="mit-num">${inputLeft}s</span>
                   </div>`
                : ""
            }
            ${
              isResult
                ? `<div class="mg-result-banner ${mg.won ? "win" : "lose"}">${mg.won ? "★ 破關成功 ★" : "破關失敗"}</div>`
                : `<div class="bubble neon mg-msg">${esc(mg.message)}</div>`
            }
            ${progress}
            <div class="mg-pads mg-pads-neon" style="--mg-n:${padCount}">${pads.join("")}</div>
          </div>
          ${rewardLine}
        </div>
        <div class="soft-cta mg-cta">${cta}</div>
        ${storyDockHtml()}
      `;
      wireStoryDock(root);
      const startBtn = $("#btn-mg-start", root);
      if (startBtn) startBtn.onclick = () => beginRun();
      const skipBtn = $("#btn-mg-skip", root);
      if (skipBtn) skipBtn.onclick = () => endRun(false, "已放棄破關——半獎，人生繼續。");
      const abBtn = $("#btn-abandon", root);
      if (abBtn) abBtn.onclick = () => requestAbandonLife();
      /*
       * t387：結果階段浮現之後自動前進（唔需要撳「繼續」）。
       * 玩家想快啲，點畫面任何位置即可。
       */
      if (isResult) {
        let settled = false;
        const go = () => {
          if (settled) return;
          settled = true;
          clearAutoAdvance();
          settleMinigameToLife();
        };
        wireTapToAdvance(root, go);
      }
      root.querySelectorAll(".mg-pad").forEach((btn) => {
        btn.onclick = () => onPad(btn.dataset.pad | 0);
      });
    };

    const schedule = (fn, ms) => {
      const t = setTimeout(fn, ms);
      mg.timers.push(t);
      return t;
    };

    const failByTimeout = () => {
      if (mg.phase === "won" || mg.phase === "lost") return;
      endRun(false, "時間到——半獎，人生繼續。");
    };

    const beginRun = () => {
      clearMgTimers();
      mg.startedAt = Date.now();
      mg.deadlineAt = mg.startedAt + timeLimitSec * 1000;
      mg.round = 1;
      mg.sequence = [];
      mg.message = "請注視鍵位亮起的順序。";
      schedule(failByTimeout, timeLimitSec * 1000);
      startWatchRound();
    };

    const startWatchRound = () => {
      /*
       * t378b：清走上一關殘留嘅「輸入超時」計時器。
       *
       * 原本只靠 `if (mg.phase === "input")` 判斷，但實測發現：
       * 第 1 關輸入完 → 進入第 2 關 watch → 播完序列 → 第 2 關 input，
       * 而第 1 關嗰個 10 秒超時計時器仍然存在，若它喺第 2 關 input 期間到期，
       * 就會立即判「輸入逾時」（實測第 2 關只有 300ms 反應時間）。
       * 這裡只取消舊嘅 input 超時，唔碰全局限時（mg.deadlineAt 嗰個）。
       */
      if (mg.inputTimer) {
        clearTimeout(mg.inputTimer);
        mg.inputTimer = null;
      }
      // 每關序列長度 = round+1（第1關長2…第3關長4）
      const len = mg.round + 1;
      mg.sequence = [];
      for (let i = 0; i < len; i++) {
        mg.sequence.push(Math.floor(Math.random() * padCount));
      }
      mg.inputIdx = 0;
      mg.phase = "watch";
      mg.flashIdx = -1;
      mg.message = `第 ${mg.round} 關：記住 ${len} 步序列。`;
      paint();
      let step = 0;
      const flashNext = () => {
        if (mg.phase !== "watch") return;
        if (step >= mg.sequence.length) {
          mg.flashIdx = -1;
          mg.phase = "input";
          mg.inputIdx = 0;
          mg.message = "依同樣順序點選鍵位。";
          /*
           * t379：輸入時限延長至 12 秒（原本 10 秒），並加入每秒倒數刷新。
           * 總導演反映「街機要加長輸入窗或顯示剩餘時間」——兩樣都做。
           */
          const inputLimitMs = MG_INPUT_LIMIT_MS;
          mg.inputDeadlineAt = Date.now() + inputLimitMs;
          paint();
          // 每秒刷新倒數（只喺 input 階段生效）
          if (mg.inputTick) clearInterval(mg.inputTick);
          mg.inputTick = (typeof setInterval === "function")
            ? setInterval(() => {
                if (mg.phase !== "input") { clearInterval(mg.inputTick); mg.inputTick = null; return; }
                paint();
              }, 1000)
            : null;
          // t378b：記錄計時器 id，方便下一關開始時取消（避免舊超時誤判新關卡）
          if (mg.inputTimer) clearTimeout(mg.inputTimer);
          mg.inputTimer = schedule(() => {
            if (mg.phase === "input") endRun(false, "輸入逾時——半獎，人生繼續。");
          }, inputLimitMs);
          return;
        }
        mg.flashIdx = mg.sequence[step];
        // t378：亮起音效（每個鍵位不同音高，聽感上幫記憶）
        gachaBeep(420 + mg.flashIdx * 110, 0.09, 0.03);
        paint();
        /*
         * t378：亮起時間隨序列長度遞增（480ms → 最長 620ms），
         * 因舊版固定 480ms，第 3 關 4 步時玩家經常追唔切。
         */
        const litMs = Math.min(620, 480 + (mg.sequence.length - 2) * 45);
        schedule(() => {
          mg.flashIdx = -1;
          paint();
          step += 1;
          schedule(flashNext, 220);
        }, litMs);
      };
      schedule(flashNext, 400);
    };

    const onPad = (idx) => {
      if (mg.phase !== "input") return;
      if (Date.now() > mg.deadlineAt) {
        endRun(false, "時間到——半獎，人生繼續。");
        return;
      }
      const expect = mg.sequence[mg.inputIdx];
      if (idx !== expect) {
        // t378：錯誤鍵位抖動 + 正確鍵位閃一下，即時視覺回饋
        const wrongEl = root.querySelector(`.mg-pad[data-pad="${idx}"]`);
        if (wrongEl) {
          wrongEl.classList.add("miss");
          setTimeout(() => wrongEl && wrongEl.classList.remove("miss"), 380);
        }
        const rightEl = root.querySelector(`.mg-pad[data-pad="${expect}"]`);
        if (rightEl) {
          rightEl.classList.add("hit");
          setTimeout(() => rightEl && rightEl.classList.remove("hit"), 320);
        }
        gachaBeep(160, 0.12, 0.06);
        schedule(() => endRun(false, "順序有誤——半獎，人生繼續。"), 380);
        return;
      }
      mg.inputIdx += 1;
      mg.flashIdx = idx;
      paint();
      // t378：命中波紋
      const hitEl = root.querySelector(`.mg-pad[data-pad="${idx}"]`);
      if (hitEl) {
        hitEl.classList.add("hit");
        setTimeout(() => hitEl && hitEl.classList.remove("hit"), 320);
      }
      gachaBeep(520 + idx * 90, 0.05, 0.035);
      schedule(() => {
        mg.flashIdx = -1;
        if (mg.inputIdx >= mg.sequence.length) {
          if (mg.round >= maxRounds) {
            endRun(true, "破關成功——領取滿額獎勵。");
          } else {
            mg.round += 1;
            mg.message = "過關。下一關序列更長。";
            paint();
            schedule(startWatchRound, 650);
          }
        } else {
          paint();
        }
      }, 160);
    };

    const endRun = (won, msg) => {
      if (mg.phase === "won" || mg.phase === "lost") return;
      clearMgTimers();
      mg.phase = won ? "won" : "lost";
      mg.won = !!won;
      mg.flashIdx = -1;
      mg.message = msg;
      let soul = baseSoul();
      let xp = baseXp();
      let gold = baseGold();
      if (!won) {
        soul = Math.max(1, Math.floor(soul / 2));
        xp = Math.floor(xp / 2);
        gold = Math.floor(gold / 2);
      }
      mg.rewardSoul = soul;
      mg.rewardXp = xp;
      mg.rewardGold = gold;
      // 結果畫面出現時頂欄已入帳（與 attrs／戰鬥結算一致；唔等「繼續」）
      if (!mg.rewardApplied) {
        state.soul += soul | 0;
        if ((xp | 0) > 0) gainXp(xp | 0);
        if ((gold | 0) > 0) state.gold = (state.gold | 0) + (gold | 0);
        mg.rewardApplied = true;
      }
      if (won) {
        applyEventAttrsDelta(ev);
        if (!state.lifeFlags || typeof state.lifeFlags !== "object") state.lifeFlags = {};
        const flag = ev.flag_on_win || "arcade_clear";
        state.lifeFlags[flag] = 1;
        state.softNote = "破關成功・滿獎";
      } else {
        state.softNote = "破關失敗・半獎";
      }
      paint();
    };

    const settleMinigameToLife = () => {
      if (mg.settled) return;
      mg.settled = true;
      clearMgTimers();
      // 貨幣／經驗已喺 endRun 入帳；此處只兜底（舊存檔中途再開）
      if (!mg.rewardApplied) {
        state.soul += mg.rewardSoul | 0;
        if ((mg.rewardXp | 0) > 0) gainXp(mg.rewardXp | 0);
        if ((mg.rewardGold | 0) > 0) state.gold = (state.gold | 0) + (mg.rewardGold | 0);
        mg.rewardApplied = true;
      }
      trackEventMission(ev, { soft: true });
      advanceYear();
      state.selectedEvent = null;
      state.minigame = null;
      state.softNote = "";
      if (lifeDoneFlag()) {
        state.lastResult = {
          win: true,
          reward: 0,
          rewardBlurb: lifeEndBlurb(),
          eventName: lifeEndName(),
          deadNames: [],
        };
        state.screen = "result";
      } else {
        state.screen = afterFateOrEventScreen();
      }
      render();
    };

    paint();
  }

  /** 6 equipment slots — HK street props（EQP01–EQP40；帳號級全隊加乘） */
  const GEAR_SLOTS = [
    { id: "head", label: "頭", hint: "黃帽／頭巾／漁夫帽" },
    { id: "body", label: "身", hint: "反光衣／圍裙／雨衣" },
    { id: "main", label: "武", hint: "鐵通／鑊鏟／扳手" },
    { id: "off", label: "副", hint: "紅白藍袋／托盤／錐筒" },
    { id: "charm", label: "飾", hint: "八達通掛／粽結／玉如意" },
    { id: "feet", label: "足", hint: "白鞋／拖鞋／雨靴" },
  ];

  function ensureGearShape() {
    if (state.equipGear) delete state.equipGear;
    if (!state.accountGear || typeof state.accountGear !== "object") state.accountGear = {};
    GEAR_SLOTS.forEach((slot) => {
      if (!(slot.id in state.accountGear)) state.accountGear[slot.id] = null;
    });
    if (!state.equipStars || typeof state.equipStars !== "object") state.equipStars = {};
  }

  function equipItemList() {
    return DATA.equipment || DATA.equip_items || [];
  }

  function itemByIdLookup() {
    return Object.fromEntries(equipItemList().map((it) => [it.id, it]));
  }

  function equipStarOf(item) {
    if (!item) return 1;
    ensureGearShape();
    const maxS = Math.max(1, Number(item.max_star) || 5);
    let s = state.equipStars[item.id];
    if (s == null) s = Number(item.star) || 1;
    return Math.min(maxS, Math.max(1, s | 0));
  }

  /** effective = base + star_bonus_per_level * (star - 1) */
  function effectiveEquipStats(item) {
    if (!item) return { atk: 0, def: 0, hp: 0, spd: 0 };
    const star = equipStarOf(item);
    const bonus = item.star_bonus_per_level || {};
    const levels = Math.max(0, star - 1);
    return {
      atk: (Number(item.atk) || 0) + (Number(bonus.atk) || 0) * levels,
      def: (Number(item.def) || 0) + (Number(bonus.def) || 0) * levels,
      hp: (Number(item.hp) || 0) + (Number(bonus.hp) || 0) * levels,
      spd: (Number(item.spd) || 0) + (Number(bonus.spd) || 0) * levels,
    };
  }

  function accountGearBonus() {
    ensureGearShape();
    const byId = itemByIdLookup();
    const bonus = { atk: 0, def: 0, hp: 0, spd: 0 };
    GEAR_SLOTS.forEach((slot) => {
      const iid = state.accountGear[slot.id];
      const item = iid ? byId[iid] : null;
      if (!item) return;
      const eff = effectiveEquipStats(item);
      bonus.atk += eff.atk;
      bonus.def += eff.def;
      bonus.hp += eff.hp;
      bonus.spd += eff.spd;
    });
    return bonus;
  }

  /** t364：裝備／戰鬥卡共用同一套稀有度名（以前 epic→「稀有」、legend→「傳奇」同卡冊對不上） */
  function rarityEquipLabel(r) {
    return rarityLabelAny(r);
  }

  /**
   * t364：把裝備的 tag_boost（street／chachaan／wok…）轉成玩家睇得明的主題名。
   * 原本 40 張裝備有 32 張寫住 tag_boost，但全站冇任何地方讀取 → 純死資料。
   * 現用在說明卡，講清楚呢件裝備屬於邊個街頭主題。
   */
  function equipTagLabel(tag) {
    if (!tag) return "";
    const key = String(tag).trim();
    if (!key) return "";
    const fromData = (DATA.skill_tags || []).find((t) => t && t.id === key);
    if (fromData && fromData.name) return fromData.name;
    const fallback = {
      street: "街頭", chachaan: "茶記", wok: "鑊氣", walled: "城寨",
      arcade: "打機舖", nightshift: "夜更", festival: "節慶",
      weather: "天氣", mtr: "港鐵", renqing: "人情", neon: "霓虹",
      rooftop: "天台", any: "通用",
    };
    return fallback[key] || key;
  }

  function formatTeamBonus(bonus) {
    const parts = [];
    if (bonus.atk) parts.push("攻+" + bonus.atk);
    if (bonus.spd) parts.push("速+" + bonus.spd);
    if (bonus.hp) parts.push("血+" + bonus.hp);
    if (bonus.def) parts.push("防+" + bonus.def);
    return parts.length ? parts.join(" · ") : "（未裝）";
  }

  function accountHolderFighter() {
    const av = DATA.account_avatar;
    if (av && typeof av === "object" && av.id && fighterById[av.id]) return fighterById[av.id];
    if (typeof av === "string" && fighterById[av]) return fighterById[av];
    const defId = (DATA.default_team || [])[0];
    if (defId && fighterById[defId]) return fighterById[defId];
    return (DATA.fighters || [])[0] || null;
  }

  function skillKindGlyph(kind) {
    const map = {
      招式: "拳",
      防護: "擋",
      回復: "補",
      群攻: "轟",
      機動: "閃",
      常駐: "常",
    };
    return map[kind] || "技";
  }

  function prepToast(root, msg) {
    let el = $("#prep-toast", root);
    if (!el) {
      el = document.createElement("div");
      el.id = "prep-toast";
      el.className = "prep-toast";
      root.appendChild(el);
    }
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 1600);
  }

  function rosterFighters() {
    return (DATA.fighters || []).filter((f) => f && f.art && !String(f.art).includes("pending-manus"));
  }

  /* ---------- 人生 HUD／故事底欄（origin／events／encounter／soft／result） ---------- */

  function lifeHudHtml() {
    const a = state.attrs || defaultAttrs();
    const xp = state.xp | 0;
    const xpTo = Math.max(1, state.xpToNext | 0);
    const xpPct = Math.min(100, Math.round((xp / xpTo) * 100));
    return `
      <div class="life-hud" aria-label="人生狀態">
        <div class="lh-left">
          <div class="lh-avatar" title="主角占位" aria-hidden="true">🧑</div>
          <div class="lh-lv">
            <span class="lh-lv-label">Lv.${state.lv || 1}</span>
            <div class="lh-xp" title="經驗 ${xp}/${xpTo}"><i style="width:${xpPct}%"></i><span>${xp}/${xpTo}</span></div>
          </div>
        </div>
        ${(() => {
          /*
           * t379：六維可收摺（總導演：「頂欄資訊分層，六圍可收摺」）。
           * 六維佔一整行，但多數時間玩家只關心膠幣／金幣。
           * 收摺後只顯示「六維」按鈕，點一下展開；狀態記喺 state.attrsCollapsed。
           */
          const collapsed = !!state.attrsCollapsed;
          return `<div class="lh-attrs-wrap">
            <button type="button" class="lh-attrs-toggle${collapsed ? " collapsed" : ""}" id="btn-attrs-toggle" aria-expanded="${collapsed ? "false" : "true"}" aria-controls="lh-attrs-list" title="${collapsed ? "展開六維" : "收起六維"}" data-help="attrs-toggle">
              <span class="lhat-ico">📊</span><span class="lhat-txt">六維</span><span class="lhat-caret">${collapsed ? "▸" : "▾"}</span>
            </button>
            <div class="lh-attrs" id="lh-attrs-list" role="list"${collapsed ? ' hidden' : ""}>
              <span class="lh-a" role="listitem" title="力量：每 1 點＝所有戰鬥卡 +1 物攻、+5 HP">💪${a.str}</span>
              <span class="lh-a" role="listitem" title="敏捷：每 1 點＝所有戰鬥卡 +1 物防、+1 魔防">⚡${a.agi}</span>
              <span class="lh-a" role="listitem" title="智力：每 1 點＝所有戰鬥卡 +1 魔攻、+5 HP">🧠${a.intel}</span>
              <span class="lh-a" role="listitem" title="幸運：用於人生事件或奇遇事件獎勵">🍀${a.luck}</span>
              <span class="lh-a" role="listitem" title="統率：今世戰鬥卡數量上限">👑${a.lead}</span>
              <span class="lh-a" role="listitem" title="壽命：今次人生歲數上限">⏳${a.life}</span>
            </div>
          </div>`;
        })()}
        <div class="lh-right">
          <span class="chip soul" title="膠幣"><span class="dot"></span>${state.soul}</span>
          <span class="chip fame" title="聲望（茶記買特殊卡）"><span class="dot"></span>聲望 ${state.fame | 0}</span>
          <span class="chip gold" title="金幣"><span class="dot"></span>${state.gold | 0}</span>
          ${gachaEntryHtml()}
        </div>
        <div class="lh-factions" title="今世勢力好感（0–5；隨人生重置）">${esc(factionFavorLine() || "勢力好感未開")}</div>
      </div>`;
  }

  /** 故事底欄「盟友」面板：顯示今世可出場的戰鬥卡（圖＋戰力＋普攻／自帶） */
  function viewAlliesPanel(root) {
    ensureDefaultLoadout(false);
    ensureLoadoutShape();
    const cap = fighterPocketCap();
    const team = (state.team || []).filter((id) => id && fighterById[id]);
    const deploySet = new Set((state.deploy || []).filter(Boolean));
    const rows = team.map((fid) => {
      const f = fighterById[fid];
      const dead = isDeadFighter(fid);
      const pv = dead ? null : fighterPreviewStats(f);
      const stars = albumFighterStar(fid);
      const rare = shopRarityLabel(f.rarity) || f.rarity || "普通";
      const slang = f.rarity_slang || "";
      const inField = deploySet.has(fid);
      const load = (state.loadout[fid] || []).filter(Boolean).map((sid) => skillById[sid]).filter(Boolean);
      const loadHtml = load.length
        ? load.map((s) => `<span class="al-skill">${esc(s.name)}</span>`).join("")
        : `<span class="al-skill empty">未裝技能</span>`;
      const art = f.art
        ? `<img src="${esc(f.art)}" alt="${esc(f.name)}" loading="lazy" data-card-name="${esc(f.name)}" data-card-kind="fighter" />`
        : `<img src="${cardGlyphDataUrl(f.name, "fighter")}" alt="${esc(f.name)}" loading="lazy" />`;
      const statBits = pv
        ? `<span><b>攻</b>${pv.atk}</span>
           <span><b>物防</b>${pv.def}</span>
           <span><b>魔攻</b>${pv.matk}</span>
           <span><b>速</b>${pv.spd}</span>
           <span><b>HP</b>${pv.hp}</span>`
        : `<span class="al-dead">已陣亡 · 今世不可再出場</span>`;
      const basic = f.basic
        ? `<div class="al-line"><span class="al-k">普攻</span>${esc(f.basic)}<em>${esc(basicPowerParenLabel(f))}</em></div>`
        : "";
      const innate = f.skill
        ? `<div class="al-line"><span class="al-k">自帶</span>${esc(f.skill)}<em>${esc(innatePowerTagLabel(f))}</em>${f.skill_cd != null ? `<span class="al-cd">CD ${f.skill_cd | 0}</span>` : ""}</div>
           ${f.skill_effect ? `<div class="al-eff">${esc(f.skill_effect)}</div>` : ""}`
        : "";
      const blurb = (f.blurb || f.flavor || "");
      return `
        <article class="al-card${dead ? " dead" : ""}${inField ? " infield" : ""}">
          <div class="al-art">${art}
            ${inField ? `<span class="al-badge field">場上</span>` : ""}
            ${dead ? `<span class="al-badge dead">陣亡</span>` : ""}
          </div>
          <div class="al-body">
            <div class="al-head">
              <span class="al-name">${esc(f.name)}</span>
              <span class="al-lv">Lv.${pv ? pv.level : fighterLevelOf(fid)}</span>
            </div>
            <div class="al-sub">${esc(rare)}${slang ? " · " + esc(slang) : ""} · ${starsRowHtml(stars, ALBUM_MAX_STAR)}</div>
            <div class="al-stats">${statBits}</div>
            ${basic}${innate}
            <div class="al-line"><span class="al-k">已裝</span><span class="al-skills">${loadHtml}</span></div>
            ${blurb ? `<p class="al-blurb">${esc(blurb)}</p>` : ""}
          </div>
        </article>`;
    }).join("") || `<p class="ally-empty">口袋暫時未有戰鬥卡——準備出發時先揀卡。</p>`;

    const deadCount = (state.deadFighters || []).length;
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">盟友 · 今世戰鬥卡</div>
      <div class="al-wrap">
        <div class="al-top">
          <span class="al-pill">口袋 ${team.length}/${cap}</span>
          <span class="al-pill cyan">出戰上限 ${TEAM_SIZE} 張</span>
          <span class="al-pill ${deadCount ? "pink" : ""}">今世陣亡 ${deadCount}</span>
        </div>
        <p class="al-hint">戰鬥只會派上場 3 張；按下方返回可繼續人生。</p>
        <div class="al-list">${rows}</div>
      </div>
      <div class="soft-cta">
        <button type="button" class="btn gold" id="btn-allies-back">返回</button>
      </div>
      ${storyDockHtml()}
    `;
    $("#btn-allies-back", root).onclick = () => {
      state.screen = state.alliesReturnScreen || "events";
      state.alliesReturnScreen = null;
      render();
    };
    wireStoryDock(root);
  }

  function openAlliesPanel() {
    if (state.screen !== "allies") state.alliesReturnScreen = state.screen || "events";
    state.screen = "allies";
    render();
  }

  /** 故事流底欄 7 掣（港式名；對齊參考：盟友／冒險技能／戰鬥技能／裝備／道具／聲望／戰利品） */
  function storyDockHtml() {
    return `
      <nav class="story-dock" aria-label="故事功能">
        <button type="button" class="sd-btn" data-sd="allies" data-help="sd-allies"><span class="ico">🤝</span>盟友</button>
        <button type="button" class="sd-btn" data-sd="adv" data-help="sd-adv"><span class="ico">📗</span>奇遇技</button>
        <button type="button" class="sd-btn" data-sd="battle" data-help="sd-battle"><span class="ico">🎒</span>戰鬥技</button>
        <button type="button" class="sd-btn" data-sd="gear" data-help="sd-gear"><span class="ico">🛡️</span>裝備</button>
        <button type="button" class="sd-btn" data-sd="item" data-help="sd-item"><span class="ico">💊</span>道具</button>
        <button type="button" class="sd-btn" data-sd="fame" data-help="sd-fame"><span class="ico">📜</span>聲望</button>
        <button type="button" class="sd-btn" data-sd="loot" data-help="sd-loot"><span class="ico">📦</span>戰利</button>
      </nav>
      <div id="story-toast" class="home-toast" hidden></div>`;
  }

  function storyToast(root, msg) {
    const el = $("#story-toast", root) || $("#home-toast", root);
    if (!el) {
      try { console.info(msg); } catch (_) {}
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 1800);
  }

  function wireStoryDock(root) {
    root.querySelectorAll(".sd-btn").forEach((btn) => {
      btn.onclick = () => {
        const k = btn.dataset.sd;
        if (k === "allies") {
          openAlliesPanel();
          return;
        }
        if (k === "fame") {
          storyToast(root, "聲望／勢力：" + (factionFavorLine() || "尚未結識"));
          return;
        }
        const labels = {
          adv: "奇遇技",
          battle: "戰鬥技",
          gear: "裝備",
          item: "道具",
          fame: "聲望",
          loot: "戰利",
        };
        storyToast(root, (labels[k] || "功能") + " · 切片未開放");
      };
    });
  }

  function ageRibbon(extra) {
    const y = state.year | 0;
    const base = `${state.age | 0}歲`;
    return extra ? `${base} · ${extra}` : `${base} · 第 ${y} 年`;
  }

  /** 幸運加成：軟事件／奇遇獎勵 × (1 + luck×0.01)；demo 可見數字差 */
  function luckRewardMult() {
    const luck = (state.attrs && state.attrs.luck) | 0;
    return 1 + luck * 0.01;
  }

  function applyLuckToReward(base) {
    return Math.max(1, Math.round((base || 0) * luckRewardMult()));
  }

  /** 事件膠幣：卡面、入帳用同一個數（身世加成後再乘幸運）。0 就係 0，唔再兜成 10。 */
  function soulFromBase(base) {
    let gain = base | 0;
    if (!gain) return 0;
    const og = state.originId ? originById[state.originId] : null;
    if (og && og.bonus_soul) gain = Math.max(1, Math.round(gain * (1 + og.bonus_soul)));
    return applyLuckToReward(gain);
  }

  function listedEventSoul(ev) {
    // t364：故事包結局固定 50 膠幣，唔受身世／幸運加成影響（要求：結局才給 50）
    if (ev && ev.office_ending) return Math.max(0, ev.reward_soul | 0);
    return soulFromBase(ev && ev.reward_soul);
  }

  /**
   * t364：故事包分支事件唔可以當普通年度事件隨機抽出。
   *  - 結局事件（office_ending）：只可以由分支鏈走到底觸發
   *  - 中途節點（office_node 但唔係鏈頭）：只可以由上一步推進觸發
   *  - **鏈頭（office_entry）**：只可以「未玩過」時入池
   *
   * t375 修正（總導演回報：「完成後，事件再次出現『第一日返工』的選項」）：
   * 原本鏈頭永遠可以入年度池，所以行完一次之後仍會再抽到，變成無限循環。
   * 現在：只要已達成任何一個結局（`office_ending_*` 旗標），鏈頭亦唔再入池。
   */
  function eventExcludedFromYearPool(ev) {
    if (!ev) return true;
    if (ev.office_ending) return true;
    if (ev.office_node) {
      const pack = officePack();
      const entry = pack && pack.office_entry;
      // 非鏈頭 → 一律排除
      if (!entry || ev.id !== entry) return true;
      // 鏈頭：若已經行完任何結局，就唔再出（一個故事包只玩一次）
      const flags = state.lifeFlags || {};
      const alreadyFinished = Object.keys(flags).some((k) => k.indexOf("office_ending_") === 0);
      return alreadyFinished;
    }
    // t369：tale 鏈節點亦唔入年度池（同 office 一樣只由分支鏈觸發）
    if (ev.tale_node) return true;
    return false;
  }

  /** 結局 50 膠幣只可領一次：以 flag_on_complete 判斷 */
  function endingRewardAvailable(ev) {
    if (!ev || !ev.office_ending) return true;
    const flag = ev.flag_on_complete;
    if (!flag) return true;
    return !(state.lifeFlags && state.lifeFlags[flag]);
  }

  function fighterPocketCap() {
    // 統率＝人生內戰鬥卡數量上限；硬上限 25
    const lead = Math.max(1, (state.attrs && state.attrs.lead) | 0);
    return Math.min(25, lead);
  }

  /** 戰鬥卡／技能卡口袋唔隨年擴張（t236）。戰鬥卡可見／可帶入上限＝統率（硬上限 25）。 */
  function pocketOpenCount() {
    return fighterPocketCap();
  }

  /** 今世戰鬥卡口袋上限＝統率（硬上限 25） */
  function pocketCap() {
    return fighterPocketCap();
  }

  function fighterNumId(id) {
    const m = String(id || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }

  function rosterFightersSorted() {
    return rosterFighters()
      .slice()
      .sort((a, b) => fighterNumId(a.id) - fighterNumId(b.id) || String(a.id).localeCompare(String(b.id)));
  }

  /** 可揀進口袋嘅戰鬥卡＝帳號已擁有（cardCounts>0）；統率 cap 仍由 toggle／揀隊限制。 */
  function openPocketFighters() {
    return rosterFightersSorted().filter((f) => albumCardCount(f.id) > 0);
  }

  /** 已獲得技能＝album 持有張數 > 0（卡冊全目錄另用 DATA.skills） */
  function obtainedSkillsSorted() {
    return (DATA.skills || [])
      .filter((sk) => albumCardCount(sk.id) > 0)
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  /**
   * 今世帶入技能：null／缺＝由已擁有技能種子（demo 通常 5 張）；已係陣列＝尊重（可空）。
   * 去重、剔無效／未擁有 id、硬頂 LIFE_SKILLS_CAP。
   */
  function ensureLifeSkills() {
    albumEnsureState();
    if (!Array.isArray(state.lifeSkills)) {
      state.lifeSkills = obtainedSkillsSorted()
        .slice(0, LIFE_SKILLS_CAP)
        .map((s) => s.id);
    }
    const seen = new Set();
    const next = [];
    for (const id of state.lifeSkills) {
      if (!id || seen.has(id) || !skillById[id]) continue;
      if (albumCardCount(id) <= 0) continue;
      seen.add(id);
      next.push(id);
      if (next.length >= LIFE_SKILLS_CAP) break;
    }
    state.lifeSkills = next;
    return state.lifeSkills;
  }

  /** 裝備／預設裝技／遭遇詳情只睇今世 lifeSkills（唔係全 72）。 */
  function openPocketSkills() {
    ensureLifeSkills();
    const ok = new Set(state.lifeSkills);
    return obtainedSkillsSorted().filter((sk) => ok.has(sk.id));
  }

  function pruneLoadoutToLifeSkills() {
    ensureLifeSkills();
    const ok = new Set(state.lifeSkills);
    Object.keys(state.loadout || {}).forEach((fid) => {
      const arr = state.loadout[fid];
      if (!Array.isArray(arr)) return;
      state.loadout[fid] = arr.map((sid) =>
        sid && ok.has(sid) && !isBurnedSkill(sid) ? sid : null
      );
    });
  }

  function pruneTeamToOpenPocket() {
    const openIds = new Set(openPocketFighters().map((f) => f.id));
    state.team = state.team.filter((id) => openIds.has(id) && !isDeadFighter(id));
    if (state.equipFocus && !state.team.includes(state.equipFocus)) {
      state.equipFocus = state.team[0] || null;
      state.equipSlot = null;
    }
    pruneLoadoutToLifeSkills();
  }

  function toggleLifeSkill(sid) {
    ensureLifeSkills();
    if (!sid || !skillById[sid]) return;
    const i = state.lifeSkills.indexOf(sid);
    if (i >= 0) {
      state.lifeSkills.splice(i, 1);
      pruneLoadoutToLifeSkills();
      return;
    }
    if (state.lifeSkills.length >= LIFE_SKILLS_CAP) return;
    state.lifeSkills.push(sid);
  }

  function skillPoolForFocus(focus) {
    const equipped = new Set(loadoutIds(focus));
    const all = openPocketSkills().slice();
    const sortKey = (s) => {
      if (isBurnedSkill(s.id)) return 3;
      if (equipped.has(s.id)) return 0;
      if (skillFieldTaken(s.id, focus)) return 2; // t316：其他出戰卡已裝
      return 1;
    };
    all.sort((a, b) => sortKey(a) - sortKey(b) || String(a.id).localeCompare(String(b.id)));
    return all;
  }

  function toggleFighter(id) {
    if (isDeadFighter(id)) return;
    if (!openPocketFighters().some((f) => f.id === id) && state.team.indexOf(id) < 0) return;
    const i = state.team.indexOf(id);
    if (i >= 0) {
      state.team.splice(i, 1);
      state.deploy = (state.deploy || []).filter((x) => x !== id);
      if (state.equipFocus === id) {
        state.equipFocus = state.team[0] || null;
        state.equipSlot = null;
      }
    } else if (state.team.length < pocketCap()) {
      state.team.push(id);
      state.equipFocus = id;
      state.equipSlot = null;
    }
    ensureLoadoutShape();
    ensureGearShape();
    render();
  }

  function loadoutIds(fighterId) {
    return (state.loadout[fighterId] || []).filter(Boolean);
  }


  /** 稀有度→星數（視覺；裝備另用 equipStarOf） */
  function rarityStars(rarity) {
    const r = String(rarity || "");
    if (/傳說|傳奇|legend/i.test(r)) return 5;
    if (/史詩|epic/i.test(r)) return 4;
    if (/稀有|rare/i.test(r)) return 3;
    if (/優秀|uncommon/i.test(r)) return 2;
    return 1;
  }
  function starsRowHtml(n, max) {
    const m = Math.max(1, max == null ? 5 : max | 0);
    const lit = Math.max(0, Math.min(m, n | 0));
    return `<span class="stars-row" aria-label="${lit}星">${"★".repeat(lit)}<span class="stars-dim">${"★".repeat(Math.max(0, m - lit))}</span></span>`;
  }

  /** Combined pre-battle: left focus+gear, top-right fighters, bottom-right skills. */
  function viewPrep(root) {
    albumEnsureState();
    pruneTeamToOpenPocket();
    ensureDefaultLoadout(false);
    ensureLoadoutShape();
    ensureGearShape();
    ensureLifeSkills();

    const selected = new Set(state.team);
    if (!state.equipFocus || !state.team.includes(state.equipFocus)) {
      state.equipFocus = state.team[0] || null;
    }
    const focus = state.equipFocus;
    const f = focus ? fighterById[focus] : null;
    const cap = f ? raritySlots(f) : 0;
    if (f) {
      let slots = state.loadout[focus] || [];
      slots = Array.from({ length: cap }, (_, i) => slots[i] || null);
      state.loadout[focus] = slots;
    }
    const n = state.team.length;
    const pCap = pocketCap();
    const ready = n >= 1;
    const gear = state.accountGear || {};
    const itemById = itemByIdLookup();
    const teamBonus = accountGearBonus();
    const holder = accountHolderFighter();
    const lifeSkillIds = state.lifeSkills.slice();
    const lifeSkillSet = new Set(lifeSkillIds);
    const attrs = state.attrs || defaultAttrs();
    const qRaw = String(state.prepPickQuery || "").trim().toLowerCase();

    const gearHtml = GEAR_SLOTS.map((slot) => {
      const iid = gear[slot.id] || null;
      const item = iid ? itemById[iid] : null;
      const poolN = equipItemList().filter((it) => it.slot === slot.id).length;
      const foc = state.prepGearFocusSlot === slot.id ? " focus-slot" : "";
      if (item) {
        const star = equipStarOf(item);
        const helpGear = equipHelpText(item, slot);
        return `<button type="button" class="prep-gear-slot filled${foc}" data-gear="${esc(slot.id)}" data-gid="${esc(item.id)}" data-help="gear-slot" data-help-rich="gear" data-help-gid="${esc(item.id)}" data-help-text="${helpTextAttr(helpGear)}" aria-label="${esc(slot.label)} ${esc(item.name)} ${star}星">
          <span class="pg-label">${esc(slot.label)}</span>
          <span class="pg-art">${item.art ? `<img src="${esc(item.art)}" alt="" />` : `<span class="pg-glyph">裝</span>`}</span>
          <span class="pg-stars">${starsRowHtml(star, Number(item.max_star) || 5)}</span>
        </button>`;
      }
      const helpEmpty = equipHelpText(null, slot) + (poolN ? `（池 ${poolN}）` : "（待產）");
      return `<button type="button" class="prep-gear-slot empty${poolN ? "" : " locked"}${foc}" data-gear="${esc(slot.id)}" data-help="gear-slot" data-help-text="${helpTextAttr(helpEmpty)}" aria-label="${esc(slot.label)} 空">
        <span class="pg-label">${esc(slot.label)}</span>
        <span class="pg-art"><span class="pg-glyph">＋</span></span>
        <span class="pg-stars pg-empty-hint">${poolN ? "空" : "待"}</span>
      </button>`;
    }).join("");

    const fighterCells = [];
    state.team.forEach((fid) => {
      const ff = fighterById[fid];
      if (!ff) return;
      const dead = isDeadFighter(ff.id);
      const foc = !dead && focus === ff.id ? " focus" : "";
      const helpText = fighterHelpText(ff, { dead });
      const artSrc = ff.art ? esc(ff.art) : "";
      const artHtml = artSrc
        ? `<img src="${artSrc}" alt="${esc(ff.name)}" data-card-name="${esc(ff.name)}" data-card-kind="fighter" />`
        : `<img src="${cardGlyphDataUrl(ff.name, "fighter")}" alt="${esc(ff.name)}" />`;
      const stars = rarityStars(ff.rarity);
      const fLv = fighterLevelOf(ff.id);
      fighterCells.push(`<button type="button" class="prep-f-thumb selected${foc}${dead ? " dead" : ""}" data-id="${esc(ff.id)}" data-help="prep-fighter" data-help-rich="fighter" data-help-fid="${esc(ff.id)}" data-help-text="${helpTextAttr(helpText)}" aria-label="${esc(ff.name)} Lv.${fLv}${dead ? "（陣亡）" : ""}">
          ${artHtml}
          <span class="pf-lv">Lv.${fLv}</span>
          <span class="pf-stars">${starsRowHtml(stars)}</span>
          ${dead ? `<span class="pf-dead">陣亡</span>` : ""}
          <span class="pf-name">${esc(ff.name)}</span>
        </button>`);
    });
    fighterCells.push(`<button type="button" class="prep-f-thumb empty-slot add-slot" data-open-pick="fighters" data-help="prep-fighter" data-help-text="${helpTextAttr("＋揀戰鬥卡帶入今世")}" aria-label="揀戰鬥卡">
          <span class="pf-plus">＋</span>
        </button>`);
    const fighterThumbs = fighterCells.join("");

    const skillCells = [];
    for (const sid of lifeSkillIds) {
      const sk = skillById[sid];
      if (!sk) continue;
      const burned = isBurnedSkill(sk.id);
      const helpText = skillHelpText(sk, { burned });
      const artHtml = sk.art
        ? `<img src="${esc(sk.art)}" alt="" />`
        : `<span class="ps-glyph kind-${esc(sk.kind || "招式")}">${esc(skillKindGlyph(sk.kind))}</span>`;
      skillCells.push(`<button type="button" class="prep-s-thumb life-selected${burned ? " burned" : ""}" data-sid="${esc(sk.id)}" data-help="skill-pick" data-help-text="${helpTextAttr(helpText)}" aria-label="${esc(sk.name)}">
              <span class="ps-art">${artHtml}</span>
              <span class="ps-name">${esc(sk.name)}</span>
            </button>`);
    }
    if (lifeSkillIds.length < LIFE_SKILLS_CAP) {
      skillCells.push(`<button type="button" class="prep-s-thumb empty-slot add-slot" data-open-pick="skills" data-help="skill-pick" data-help-text="${helpTextAttr("＋揀技能帶入今世（最多10）")}" aria-label="揀技能">
              <span class="ps-art"><span class="ps-glyph">＋</span></span>
            </button>`);
    }
    const skillThumbs = skillCells.join("");

    const leftPortrait = holder && holder.art
      ? `<img class="prep-hero-art" src="${esc(holder.art)}" alt="${esc(holder.name || "帳號主人")}" />`
      : `<div class="prep-hero-art placeholder">帳號主人</div>`;

    const bonusStrip = `<div class="prep-team-bonus" aria-label="全隊加乘">
      <span class="ptb-label">全隊加乘</span>
      <span class="ptb-vals">${esc(formatTeamBonus(teamBonus))}</span>
    </div>`;
    const sixStrip = `<div class="prep-six-attrs" aria-label="六維">
      <span class="psa" title="力量">💪${attrs.str | 0}</span>
      <span class="psa" title="敏捷">⚡${attrs.agi | 0}</span>
      <span class="psa" title="智力">🧠${attrs.intel | 0}</span>
      <span class="psa" title="幸運">🍀${attrs.luck | 0}</span>
      <span class="psa" title="統率">👑${attrs.lead | 0}</span>
      <span class="psa" title="壽命">⏳${attrs.life | 0}</span>
    </div>`;

    const closePick = () => {
      state.prepPickKind = null;
      state.prepPickQuery = "";
      state.prepGearFocusSlot = null;
    };

    let pickModal = "";
    if (state.prepPickKind === "fighters") {
      const teamSet = new Set(state.team);
      let roster = openPocketFighters();
      if (qRaw) roster = roster.filter((ff) => String(ff.name || "").toLowerCase().includes(qRaw));
      const cards = roster.map((ff) => {
        const dead = isDeadFighter(ff.id);
        const on = !dead && teamSet.has(ff.id);
        const helpText = fighterHelpText(ff, { dead });
        const artHtml = ff.art
          ? `<img src="${esc(ff.art)}" alt="${esc(ff.name)}" data-card-name="${esc(ff.name)}" data-card-kind="fighter" />`
          : `<img src="${cardGlyphDataUrl(ff.name, "fighter")}" alt="${esc(ff.name)}" />`;
        const stars = rarityStars(ff.rarity);
        const btnLabel = on ? "取消" : "選擇";
        const btnCls = on ? "pick-act cancel" : "pick-act select";
        return `<div class="pick-card fighter${on ? " selected" : ""}${dead ? " dead" : ""}" data-help="prep-fighter" data-help-rich="fighter" data-help-fid="${esc(ff.id)}" data-id="${esc(ff.id)}" data-help-text="${helpTextAttr(helpText)}">
          <div class="pick-art-wrap">${artHtml}
            ${on ? `<span class="pick-check">✓</span>` : ""}
          </div>
          <span class="pick-stars">${starsRowHtml(stars)}</span>
          <span class="pick-name">${esc(ff.name)}</span>
          <button type="button" class="${btnCls}" data-toggle-fid="${esc(ff.id)}" ${dead ? "disabled" : ""} aria-label="${esc(ff.name)} ${btnLabel}">${btnLabel}</button>
        </div>`;
      }).join("");
      pickModal = `
        <div class="modal-mask prep-pick-mask" id="prep-pick-mask" role="dialog" aria-modal="true" aria-label="選擇初始戰鬥卡">
          <div class="modal-sheet prep-pick-sheet" id="prep-pick-sheet">
            <button type="button" class="prep-pick-x" id="prep-pick-x" aria-label="關閉">×</button>
            <div class="modal-title">選擇初始戰鬥卡</div>
            <div class="pick-count">已選 ${n}／${pCap}</div>
            <div class="pick-toolbar">
              <input type="search" class="pick-search" id="prep-pick-search" placeholder="搜尋名稱…" value="${esc(state.prepPickQuery || "")}" autocomplete="off" />
              <button type="button" class="pick-filter-btn" id="prep-pick-filter" title="篩選（暫未開放）" aria-label="篩選">▽</button>
            </div>
            <div class="pick-grid fighters cols4">${cards || "<div class='soft-panel'>無符合卡</div>"}</div>
            <p class="modal-hint">點擊彈窗以外的任意位置，可以關閉彈窗</p>
          </div>
        </div>`;
    } else if (state.prepPickKind === "skills") {
      let all = obtainedSkillsSorted();
      if (qRaw) all = all.filter((sk) => String(sk.name || "").toLowerCase().includes(qRaw));
      const cards = all.map((sk) => {
        const burned = isBurnedSkill(sk.id);
        const on = lifeSkillSet.has(sk.id);
        const helpText = skillHelpText(sk, { burned });
        const artHtml = sk.art
          ? `<img src="${esc(sk.art)}" alt="" />`
          : `<span class="ps-glyph kind-${esc(sk.kind || "招式")}">${esc(skillKindGlyph(sk.kind))}</span>`;
        const btnLabel = on ? "取消" : "選擇";
        const btnCls = on ? "pick-act cancel" : "pick-act select";
        return `<div class="pick-card skill${on ? " selected" : ""}${burned ? " burned" : ""}" data-help="skill-pick" data-help-text="${helpTextAttr(helpText)}">
          <div class="pick-art-wrap"><span class="pick-art">${artHtml}</span>
            ${on ? `<span class="pick-check">✓</span>` : ""}
          </div>
          <span class="pick-name">${esc(sk.name)}</span>
          <button type="button" class="${btnCls}" data-toggle-sid="${esc(sk.id)}" aria-label="${esc(sk.name)} ${btnLabel}">${btnLabel}</button>
        </div>`;
      }).join("");
      pickModal = `
        <div class="modal-mask prep-pick-mask" id="prep-pick-mask" role="dialog" aria-modal="true" aria-label="選擇初始技能卡">
          <div class="modal-sheet prep-pick-sheet" id="prep-pick-sheet">
            <button type="button" class="prep-pick-x" id="prep-pick-x" aria-label="關閉">×</button>
            <div class="modal-title">選擇初始技能卡</div>
            <div class="pick-count">已選 ${lifeSkillIds.length}／${LIFE_SKILLS_CAP}</div>
            <div class="pick-toolbar">
              <input type="search" class="pick-search" id="prep-pick-search" placeholder="搜尋名稱…" value="${esc(state.prepPickQuery || "")}" autocomplete="off" />
              <button type="button" class="pick-filter-btn" id="prep-pick-filter" title="篩選（暫未開放）" aria-label="篩選">▽</button>
            </div>
            <div class="pick-grid skills cols4">${cards || "<div class='soft-panel'>無符合卡</div>"}</div>
            <p class="modal-hint">點擊彈窗以外的任意位置，可以關閉彈窗</p>
          </div>
        </div>`;
    } else if (state.prepPickKind === "gear") {
      const focusSlot = state.prepGearFocusSlot || null;
      let pool = equipItemList().filter((it) => albumCardCount(it.id) > 0);
      if (focusSlot) pool = pool.filter((it) => it.slot === focusSlot);
      if (qRaw) pool = pool.filter((it) => String(it.name || "").toLowerCase().includes(qRaw));
      const equippedIds = new Set(GEAR_SLOTS.map((s) => gear[s.id]).filter(Boolean));
      const equippedCount = equippedIds.size;
      const cards = pool.map((item) => {
        const on = equippedIds.has(item.id);
        const star = equipStarOf(item);
        const slotMeta = GEAR_SLOTS.find((s) => s.id === item.slot);
        const helpText = equipHelpText(item, slotMeta || { id: item.slot, label: item.slot });
        const artHtml = item.art
          ? `<img src="${esc(item.art)}" alt="" />`
          : `<span class="pf-placeholder">裝</span>`;
        const btnLabel = on ? "取消" : "選擇";
        const btnCls = on ? "pick-act cancel" : "pick-act select";
        const rare = rarityEquipLabel(item.rarity);
        return `<div class="pick-card gear${on ? " selected" : ""}" data-help="gear-slot" data-help-rich="gear" data-help-gid="${esc(item.id)}" data-help-text="${helpTextAttr(helpText)}">
          <div class="pick-art-wrap">${artHtml}
            ${on ? `<span class="pick-check">✓</span>` : ""}
          </div>
          <span class="pick-stars">${starsRowHtml(star, Number(item.max_star) || 5)}</span>
          <span class="pick-name">${esc(item.name)}</span>
          <span class="pick-meta">${esc((slotMeta && slotMeta.label) || item.slot)}${rare ? " · " + esc(rare) : ""}</span>
          <button type="button" class="${btnCls}" data-toggle-eid="${esc(item.id)}" aria-label="${esc(item.name)} ${btnLabel}">${btnLabel}</button>
        </div>`;
      }).join("");
      const sub = focusSlot
        ? (() => {
            const s = GEAR_SLOTS.find((x) => x.id === focusSlot);
            return s ? `槽：${s.label}` : "";
          })()
        : "全部槽";
      pickModal = `
        <div class="modal-mask prep-pick-mask" id="prep-pick-mask" role="dialog" aria-modal="true" aria-label="選擇初始裝備卡">
          <div class="modal-sheet prep-pick-sheet" id="prep-pick-sheet">
            <button type="button" class="prep-pick-x" id="prep-pick-x" aria-label="關閉">×</button>
            <div class="modal-title">選擇初始裝備卡</div>
            <div class="pick-count">已裝 ${equippedCount}／6 · ${esc(sub)}</div>
            <div class="pick-toolbar">
              <input type="search" class="pick-search" id="prep-pick-search" placeholder="搜尋名稱…" value="${esc(state.prepPickQuery || "")}" autocomplete="off" />
              <button type="button" class="pick-filter-btn" id="prep-pick-filter" title="篩選（暫未開放）" aria-label="篩選">▽</button>
            </div>
            <div class="pick-grid gear cols4">${cards || "<div class='soft-panel'>此格暫無裝備</div>"}</div>
            <p class="modal-hint">點擊彈窗以外的任意位置，可以關閉彈窗</p>
          </div>
        </div>`;
    }

    root.innerHTML = `
      <div class="hud prep-hud">
        <span class="chip year"><span class="dot"></span>第 ${state.year} 年</span>
        <span class="chip soul"><span class="dot"></span>${esc(L["ui.resource"] || "膠幣")} ${state.soul}</span>
        ${gachaEntryHtml()}
      </div>
      <div class="ribbon">今世準備出發</div>
      <div class="prep-body">
        <section class="prep-left" aria-label="帳號主人">
          <div class="prep-left-head">帳號主人</div>
          <div class="prep-hero">
            ${leftPortrait}
            <div class="prep-gear-overlay" aria-label="裝備槽">${gearHtml}</div>
          </div>
          <button type="button" class="btn small ghost prep-change-gear" id="btn-pick-gear" data-help="gear-slot">更換裝備</button>
          ${bonusStrip}
          ${sixStrip}
        </section>
        <section class="prep-right" aria-label="卡池">
          <div class="prep-panel fighters-panel" id="fighters-panel" data-help="prep-fighter" data-open-panel="fighters">
            <div class="prep-panel-title">
              <span>戰鬥卡 <span class="prep-count">${n}／${pCap}</span></span>
            </div>
            <div class="prep-f-grid team-only">${fighterThumbs}</div>
          </div>
          <div class="prep-panel skills-panel" id="skills-panel" data-help="btn-equip" data-open-panel="skills">
            <div class="prep-panel-title">
              <span>技能卡 <span class="prep-count">${lifeSkillIds.length}／${LIFE_SKILLS_CAP}</span></span>
            </div>
            <div class="prep-s-grid life-only">${skillThumbs}</div>
          </div>
        </section>
      </div>
      <div class="prep-cta">
        <button class="btn gold prep-ready" id="btn-ready" data-help="btn-ready" ${ready ? "" : "disabled"}>準備好了</button>
        <div class="prep-cta-row">
          <button class="btn small ghost" id="btn-reset" data-help="btn-reset">清晒</button>
          <button class="btn small ghost" id="btn-back" data-help="btn-back">${esc(L["ui.cancel"] || "取消／返回")}</button>
        </div>
      </div>
      <div id="prep-toast" class="prep-toast" hidden></div>
      ${pickModal}
    `;

    const openPick = (kind, gearSlot) => {
      state.prepPickKind = kind;
      state.prepPickQuery = "";
      state.prepGearFocusSlot = kind === "gear" ? (gearSlot || null) : null;
      render();
    };

    const btnPickGear = $("#btn-pick-gear", root);
    if (btnPickGear) {
      btnPickGear.onclick = (e) => {
        e.stopPropagation();
        openPick("gear", state.prepGearFocusSlot || null);
      };
    }

    root.querySelectorAll("[data-open-pick]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openPick(btn.dataset.openPick);
      };
    });

    const fPanel = $("#fighters-panel", root);
    if (fPanel) {
      fPanel.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openPick("fighters");
      });
    }
    const sPanel = $("#skills-panel", root);
    if (sPanel) {
      sPanel.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openPick("skills");
      });
    }

    root.querySelectorAll(".prep-f-thumb.selected:not(.dead)").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        if (isDeadFighter(id)) {
          prepToast(root, "這張已陣亡——今世不可用");
          return;
        }
        if (state.equipFocus !== id) {
          state.equipFocus = id;
          state.equipSlot = null;
          render();
        } else {
          openPick("fighters");
        }
      };
    });

    root.querySelectorAll(".prep-s-thumb.life-selected").forEach((btn) => {
      btn.onclick = () => openPick("skills");
    });

    root.querySelectorAll(".prep-gear-slot").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const slotId = btn.dataset.gear;
        const pool = equipItemList().filter((it) => it.slot === slotId && albumCardCount(it.id) > 0);
        if (!pool.length) {
          prepToast(root, "此格暫無裝備");
          return;
        }
        openPick("gear", slotId);
      };
    });

    const pickMask = $("#prep-pick-mask", root);
    if (pickMask) {
      pickMask.onclick = (e) => {
        if (e.target !== pickMask) return;
        closePick();
        render();
      };
      const xBtn = $("#prep-pick-x", root);
      if (xBtn) {
        xBtn.onclick = (e) => {
          e.stopPropagation();
          closePick();
          render();
        };
      }
      const search = $("#prep-pick-search", root);
      if (search) {
        search.focus();
        try {
          const len = search.value.length;
          search.setSelectionRange(len, len);
        } catch (_) {}
        search.oninput = () => {
          state.prepPickQuery = search.value;
          render();
        };
        search.onclick = (e) => e.stopPropagation();
      }
      const filterBtn = $("#prep-pick-filter", root);
      if (filterBtn) {
        filterBtn.onclick = (e) => {
          e.stopPropagation();
          prepToast(root, "篩選稍後開放");
        };
      }

      root.querySelectorAll("[data-toggle-fid]").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const id = btn.dataset.toggleFid;
          if (isDeadFighter(id)) {
            prepToast(root, "這張已陣亡——今世不可用");
            return;
          }
          const i = state.team.indexOf(id);
          if (i >= 0) {
            state.team.splice(i, 1);
            state.deploy = (state.deploy || []).filter((x) => x !== id);
            if (state.equipFocus === id) {
              state.equipFocus = state.team[0] || null;
              state.equipSlot = null;
            }
            ensureLoadoutShape();
          } else if (state.team.length < pocketCap()) {
            state.team.push(id);
            state.equipFocus = id;
            state.equipSlot = null;
            ensureLoadoutShape();
            ensureGearShape();
            ensureDefaultLoadout(false);
          } else {
            prepToast(root, `統率上限 ${pocketCap()} 張`);
            return;
          }
          render();
        };
      });
      root.querySelectorAll("[data-toggle-sid]").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const sid = btn.dataset.toggleSid;
          ensureLifeSkills();
          const i = state.lifeSkills.indexOf(sid);
          if (i >= 0) {
            state.lifeSkills.splice(i, 1);
            pruneLoadoutToLifeSkills();
          } else if (state.lifeSkills.length >= LIFE_SKILLS_CAP) {
            prepToast(root, `今世技能最多 ${LIFE_SKILLS_CAP} 張`);
            return;
          } else {
            state.lifeSkills.push(sid);
          }
          render();
        };
      });
      root.querySelectorAll("[data-toggle-eid]").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const eid = btn.dataset.toggleEid;
          ensureGearShape();
          const item = itemByIdLookup()[eid];
          if (!item) return;
          const slotId = item.slot;
          const cur = state.accountGear[slotId] || null;
          if (cur === eid) {
            state.accountGear[slotId] = null;
            prepToast(root, "卸下");
          } else {
            GEAR_SLOTS.forEach((s) => {
              if (state.accountGear[s.id] === eid) state.accountGear[s.id] = null;
            });
            state.accountGear[slotId] = eid;
            state.prepGearFocusSlot = slotId;
            const st = equipStarOf(item);
            const rare = rarityEquipLabel(item.rarity);
            prepToast(root, `裝上 ${item.name}${rare ? "（" + rare + "）" : ""} ★${st}（全隊加乘）`);
          }
          render();
        };
      });
    }

    $("#btn-reset", root).onclick = () => {
      state.team = [];
      state.deploy = [];
      state.equipFocus = null;
      state.equipSlot = null;
      state.loadout = {};
      state.loadoutInited = {};
      state.lifeSkills = [];
      state.prepPickKind = null;
      state.prepPickQuery = "";
      state.prepGearFocusSlot = null;
      render();
    };
    $("#btn-ready", root).onclick = () => {
      if (state.team.length < 1) return;
      ensureLifeSkills();
      pruneLoadoutToLifeSkills();
      state.team.forEach((fid) => {
        state.loadout[fid] = (state.loadout[fid] || []).filter(Boolean);
      });
      state.equipSlot = null;
      state.prepPickKind = null;
      state.prepPickQuery = "";
      state.prepGearFocusSlot = null;
      state.lifePrepped = true;
      state.deploy = [];
      state.deployHint = "";
      state.lastWinDeploy = [];
      state.battleFieldSnapshot = null;
      state.cardGift = null;
      state.selectedEvent = null;
      state.eventConfirmOpen = false;
      state.selectAllySlot = null;
      state.fighterDetailId = null;
      state.detailSkillPick = null;
      state.screen = "origin";
      render();
    };
    $("#btn-back", root).onclick = () => {
      state.equipSlot = null;
      state.prepPickKind = null;
      state.prepPickQuery = "";
      state.prepGearFocusSlot = null;
      state.screen = "home";
      render();
    };
  }

  /*
   * t364：已移除 raiseEquippedStarsToast()。
   * 它原本會「一鍵把所有已裝裝備各升 1 星」，屬自動升星；
   * 而且從未接上任何按鈕（只在 HELP_DEFAULT 有說明文字），係死碼。
   * 現在升星只有一個入口：卡冊 → 點裝備卡 → 「升星」（燒同名卡）。
   */

  /* ---------- 魂焰扭蛋：廟街霓虹扭蛋機（t318） ---------- */
  const gachaPriceSingle = 1;
  const gachaPriceTen = 10;
  const GACHA_PITY_RARE = 20;
  const GACHA_PITY_EPIC = 40;
  /** t322 權重：普通 70／稀有 20／史詩 8／最高級 2（合計 100） */
  const GACHA_WEIGHTS = { "普通": 70, "稀有": 20, "史詩": 8, "最高級": 2 };
  /** t322 種類：先抽 kind——戰鬥卡 65／技能 20／裝備 15 */
  const GACHA_KIND_WEIGHTS = { fighters: 65, skills: 20, gear: 15 };
  const GACHA_KIND_ORDER = ["fighters", "skills", "gear"];
  const GACHA_RARITY_RANK = { "普通": 1, "稀有": 2, "史詩": 3, "最高級": 4 };
  const GACHA_RARITY_ORDER = ["普通", "稀有", "史詩", "最高級"];

  function ensureGachaPity() {
    if (typeof state.gachaPityRare !== "number" || !Number.isFinite(state.gachaPityRare)) {
      state.gachaPityRare = 0;
    }
    if (typeof state.gachaPityEpic !== "number" || !Number.isFinite(state.gachaPityEpic)) {
      state.gachaPityEpic = 0;
    }
    state.gachaPityRare = Math.max(0, state.gachaPityRare | 0);
    state.gachaPityEpic = Math.max(0, state.gachaPityEpic | 0);
    if (!Array.isArray(state.gachaResults)) state.gachaResults = [];
    if (!state.gachaPhase || typeof state.gachaPhase !== "string") state.gachaPhase = "idle";
  }

  function gachaNormalizeRarity(raw) {
    // t364：與全站共用同一張表，避免第四套叫法。
    // 認不出（例如 "foo"）回 null 讓 pool 跳過；"傳奇" 等別名已被正規化成「最高級」。
    const label = rarityLabelAny(raw);
    if (!label) return null;
    return RARITY_LABELS[rarityIdOf(label)] === label ? label : null;
  }

  /**
   * t322：無 rarity 唔再默認「普通」當池填料——回 null，buildGachaPool 跳過。
   * 資料已補齊；若仍缺則可按 id 啟發式（S*／EQP* → 普通），但仍優先 data。
   */
  function gachaItemRarity(kind, item) {
    if (!item) return null;
    if (item.rarity != null && String(item.rarity).trim() !== "") {
      return gachaNormalizeRarity(item.rarity);
    }
    // 啟發式兜底（唔當無標記填料灌普通池）：有 id 先給普通，否則跳過
    const id = String(item.id || "");
    if (kind === "skills" && /^S\d+/i.test(id)) return "普通";
    if (kind === "gear" && /^EQP\d+/i.test(id)) return "普通";
    if (kind === "fighters" && /^C\d+/i.test(id)) return "普通";
    return null;
  }

  function buildGachaPool() {
    albumEnsureState();
    const pool = [];
    rosterFightersSorted().forEach((f) => {
      if (!f || !f.id) return;
      /* t391：殘頁專屬卡唔入扭蛋池 */
      if (isShardOnlyFighter(f)) return;
      const rarity = gachaItemRarity("fighters", f);
      if (!rarity) return;
      pool.push({ kind: "fighters", id: f.id, rarity, item: f });
    });
    (DATA.skills || []).forEach((sk) => {
      if (!sk || !sk.id) return;
      const rarity = gachaItemRarity("skills", sk);
      if (!rarity) return;
      pool.push({ kind: "skills", id: sk.id, rarity, item: sk });
    });
    equipItemList().forEach((it) => {
      if (!it || !it.id) return;
      const rarity = gachaItemRarity("gear", it);
      if (!rarity) return;
      pool.push({ kind: "gear", id: it.id, rarity, item: it });
    });
    return pool;
  }

  /** t322：先抽 kind（戰鬥／技能／裝備） */
  function rollGachaKind() {
    let total = 0;
    GACHA_KIND_ORDER.forEach((k) => { total += GACHA_KIND_WEIGHTS[k] | 0; });
    if (total <= 0) return "fighters";
    let roll = Math.random() * total;
    for (let i = 0; i < GACHA_KIND_ORDER.length; i++) {
      const k = GACHA_KIND_ORDER[i];
      roll -= GACHA_KIND_WEIGHTS[k] | 0;
      if (roll < 0) return k;
    }
    return "fighters";
  }

  /**
   * 依權重＋保底抽稀有度。
   * pity.rare／pity.epic＝今次扭前已累計「未中」次數；
   * 達 20／40 則強制稀有（含以上）／史詩（含以上）。
   */
  function rollGachaRarity(pity) {
    ensureGachaPity();
    const pRare = (pity && pity.rare != null) ? (pity.rare | 0) : (state.gachaPityRare | 0);
    const pEpic = (pity && pity.epic != null) ? (pity.epic | 0) : (state.gachaPityEpic | 0);
    let forceMin = null;
    if (pEpic + 1 >= GACHA_PITY_EPIC) forceMin = "史詩";
    else if (pRare + 1 >= GACHA_PITY_RARE) forceMin = "稀有";

    const weights = Object.assign({}, GACHA_WEIGHTS);
    if (forceMin) {
      const minRank = GACHA_RARITY_RANK[forceMin] || 1;
      GACHA_RARITY_ORDER.forEach((r) => {
        if ((GACHA_RARITY_RANK[r] || 0) < minRank) weights[r] = 0;
      });
    }
    let total = 0;
    GACHA_RARITY_ORDER.forEach((r) => { total += weights[r] | 0; });
    if (total <= 0) return forceMin || "普通";
    let roll = Math.random() * total;
    for (let i = 0; i < GACHA_RARITY_ORDER.length; i++) {
      const r = GACHA_RARITY_ORDER[i];
      roll -= weights[r] | 0;
      if (roll < 0) return r;
    }
    return "普通";
  }

  /**
   * t322：喺 kind＋rarity 池均勻抽一張。
   * 池空 fallback：① 同級戰鬥卡 → ② 同 kind 降一檔稀有度 → ③ 再降 → ④ 任意戰鬥卡。
   */
  function pickGachaCardOfRarity(rarity, pool, kind) {
    const all = pool || buildGachaPool();
    const wantKind = kind || "fighters";
    function uni(list) {
      if (!list || !list.length) return null;
      return list[Math.floor(Math.random() * list.length)];
    }
    let hit = uni(all.filter((e) => e.kind === wantKind && e.rarity === rarity));
    if (hit) return hit;
    // ① 同級戰鬥卡
    hit = uni(all.filter((e) => e.kind === "fighters" && e.rarity === rarity));
    if (hit) return hit;
    // ②／③ 同 kind 降稀有度
    let rank = GACHA_RARITY_RANK[rarity] || 1;
    while (rank > 1) {
      rank -= 1;
      const lower = GACHA_RARITY_ORDER[rank - 1];
      hit = uni(all.filter((e) => e.kind === wantKind && e.rarity === lower));
      if (hit) return hit;
      hit = uni(all.filter((e) => e.kind === "fighters" && e.rarity === lower));
      if (hit) return hit;
    }
    // ④ 任意戰鬥卡
    hit = uni(all.filter((e) => e.kind === "fighters"));
    if (hit) return hit;
    return uni(all);
  }

  /**
   * t364：扭蛋結果只負責「入冊」，**唔會自動升星**。
   * - 新卡：count 0 → 1，★1 →「新獲得」
   * - 重複卡：count ＋1（同名卡疊起，卡冊顯示 x2、x3…）→「重複」
   *   ★ 由玩家自己去卡冊按「升星」燒同名卡，升星只此一個入口。
   * - 已 ★5：照樣加同名卡（可留作他日用），並退回單抽價
   */
  function applyGachaGrant(kind, id) {
    albumEnsureState();
    ensureGearShape();
    let item = null;
    if (kind === "fighters") item = fighterById[id];
    else if (kind === "skills") item = skillById[id];
    else item = itemByIdLookup()[id];
    const name = (item && item.name) || id;
    const art = (item && item.art) || null;
    const rarity = gachaItemRarity(kind, item) || "普通";
    const before = albumCardCount(id);
    const maxS = albumMaxStar(kind, item);
    const star = albumStarOf(kind, id, item);

    if (before <= 0) {
      albumSetCount(id, 1);
      albumMarkNewCardStar1(kind, id);
      return {
        kind, id, name, art, rarity,
        flag: "new",
        flagLabel: "新獲得",
        star: albumStarOf(kind, id, item),
        count: albumCardCount(id),
        refund: 0,
      };
    }

    // 重複卡：只加張數，唔碰星數（★ 一律由卡冊「升星」按鈕處理）
    albumSetCount(id, before + 1);
    const need = albumStarNeed(star);
    const canUp = star < maxS && albumCardCount(id) >= need;

    if (star >= maxS) {
      const refund = gachaPriceSingle;
      state.soul = (state.soul | 0) + refund;
      return {
        kind, id, name, art, rarity,
        flag: "refund",
        flagLabel: "已滿星 · 退回 " + refund + " 膠幣",
        star,
        count: albumCardCount(id),
        refund,
      };
    }

    return {
      kind, id, name, art, rarity,
      flag: "dupe",
      flagLabel: canUp
        ? "重複 · 可去卡冊升星"
        : `重複 · 同名 ${albumCardCount(id)}／${need}`,
      star,
      count: albumCardCount(id),
      refund: 0,
    };
  }

  function pullGachaOnce() {
    ensureGachaPity();
    const pool = buildGachaPool();
    // t322：先 kind，再稀有度，再喺該池抽
    const kind = rollGachaKind();
    const rarity = rollGachaRarity({
      rare: state.gachaPityRare | 0,
      epic: state.gachaPityEpic | 0,
    });
    const pick = pickGachaCardOfRarity(rarity, pool, kind);
    if (!pick) return null;

    state.gachaPityRare = (state.gachaPityRare | 0) + 1;
    state.gachaPityEpic = (state.gachaPityEpic | 0) + 1;
    const rank = GACHA_RARITY_RANK[rarity] || 1;
    if (rank >= 2) state.gachaPityRare = 0;
    if (rank >= 3) {
      state.gachaPityEpic = 0;
      state.gachaPityRare = 0;
    }

    const grant = applyGachaGrant(pick.kind, pick.id);
    // 顯示／保底用「抽中稀有度」；若 fallback 降檔仍以 roll 結果計 pity
    if (grant) grant.rarity = rarity;
    return grant;
  }

  /** n＝1 扣 gachaPriceSingle；n＝10 扣 gachaPriceTen；不足則 ok:false、唔扣唔發 */
  function pullGacha(n) {
    ensureGachaPity();
    const count = Math.max(1, n | 0);
    const cost = (count === 10) ? gachaPriceTen : gachaPriceSingle * (count === 1 ? 1 : count);
    if ((state.soul | 0) < cost) {
      return { ok: false, reason: "膠幣不足", results: [], cost: 0 };
    }
    state.soul = (state.soul | 0) - cost;
    const results = [];
    for (let i = 0; i < count; i++) {
      const r = pullGachaOnce();
      if (r) results.push(r);
    }
    state.gachaResults = results;
    return { ok: true, cost, results };
  }

  /* ---------- 扭蛋演出層（t318b；規則仍用上方 pull／pity／grant） ---------- */
  let _gachaAnimToken = 0;
  let _gachaAudioCtx = null;

  function gachaBeep(freq, dur, vol) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!_gachaAudioCtx) _gachaAudioCtx = new AC();
      const ctx = _gachaAudioCtx;
      if (ctx.state === "suspended") ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = freq || 660;
      const v = vol == null ? 0.035 : vol;
      g.gain.setValueAtTime(v, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + (dur || 0.06));
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + (dur || 0.06) + 0.01);
    } catch (_) { /* optional */ }
  }

  function clearGachaAnim() {
    _gachaAnimToken += 1;
  }

  function gachaPhaseIsBusy(phase) {
    const p = phase || state.gachaPhase || "idle";
    return p !== "idle" && p !== "result";
  }

  function gachaResultsMaxRank(results) {
    let max = 1;
    (results || []).forEach((r) => {
      const rank = GACHA_RARITY_RANK[gachaNormalizeRarity(r && r.rarity)] || 1;
      if (rank > max) max = rank;
    });
    return max;
  }


  /** t320：結果卡說明（跟 kind 開 fighter／skill／equip 正確文案） */
  function gachaResultHelpText(r) {
    if (!r) return "";
    const kind = r.kind || "";
    const id = r.id;
    if (kind === "fighters") {
      const f = fighterById[id];
      if (f) return fighterHelpText(f);
      return "「" + (r.name || id || "") + "」\n稀有 " + (r.rarity || "?") + "｜出戰卡";
    }
    if (kind === "skills") {
      const sk = skillById[id];
      if (sk) return skillHelpText(sk);
      return "「" + (r.name || id || "") + "」\n稀有 " + (r.rarity || "?") + "｜技能卡";
    }
    // gear／裝備
    const item = (typeof itemByIdLookup === "function") ? itemByIdLookup()[id] : null;
    if (item) return equipHelpText(item);
    return "「" + (r.name || id || "") + "」\n稀有 " + (r.rarity || "?") + "｜裝備卡";
  }

  function gachaResultHelpRich(r) {
    if (!r) return null;
    // t364：裝備／技能都補 rich 版（以前只有戰鬥卡有，其餘只得純文字）
    if (r.kind === "gear") {
      const item = itemByIdLookup()[r.id] || null;
      if (!item) return null;
      const slotMeta = GEAR_SLOTS.find((s) => s.id === item.slot) || null;
      return equipHelpRichHtml(item, slotMeta);
    }
    if (r.kind === "skills") {
      // 技能未做 rich 版：回 null 讓呼叫端退到純文字說明
      return null;
    }
    if (r.kind !== "fighters") return null;
    const f = fighterById[r.id];
    if (!f) return null;
    try {
      const opts = {};
      try { opts.preview = fighterPreviewStats(f); } catch (_) {}
      return fighterHelpRichHtml(f, opts);
    } catch (_) {
      return null;
    }
  }

  function wireGachaCardHelp(root) {
    if (!root) return;
    const results = Array.isArray(state.gachaResults) ? state.gachaResults : [];
    root.querySelectorAll(".gacha-card[data-gacha-help], .gacha-card[data-id]").forEach((el) => {
      const idx = Number(el.getAttribute("data-gacha-idx"));
      let r = (Number.isFinite(idx) && results[idx]) ? results[idx] : null;
      if (!r) {
        const id = el.getAttribute("data-id") || "";
        const kind = el.getAttribute("data-kind") || "";
        r = results.find((x) => x && x.id === id && (!kind || x.kind === kind))
          || results.find((x) => x && x.id === id)
          || { id, kind, name: (el.querySelector(".gacha-card-name") || {}).textContent || id };
      }
      const text = gachaResultHelpText(r);
      if (!text) return;
      el.style.cursor = "pointer";
      el.setAttribute("title", "點擊查看說明");
      el.setAttribute("role", "button");
      if (!el.hasAttribute("tabindex")) el.tabIndex = 0;
      // 長按（同卡冊／出戰習慣）
      wireLongPressHelp(el, text, {
        getHtml: () => gachaResultHelpRich(r),
      });
      // 點擊亦開說明（出戰詳情技能格同款）
      if (el.dataset.gachaHelpClickBound === "1") return;
      el.dataset.gachaHelpClickBound = "1";
      el.addEventListener("click", (e) => {
        if (Date.now() < helpBlockClickUntil) return;
        e.preventDefault();
        e.stopPropagation();
        const rich = gachaResultHelpRich(r);
        if (rich) showHelpTip(el, rich, { html: true });
        else showHelpTip(el, text);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        const rich = gachaResultHelpRich(r);
        if (rich) showHelpTip(el, rich, { html: true });
        else showHelpTip(el, text);
      });
    });
  }

  function gachaCardBlurb(r) {
    if (!r) return "";
    let line = "";
    if (r.kind === "fighters") {
      const f = fighterById[r.id];
      if (f) {
        const flavor = f.blurb || f.flavor || "";
        const skill = f.skill ? ("自帶「" + f.skill + "」" + (f.skill_effect ? "：" + f.skill_effect : "")) : "";
        line = [flavor, skill].filter(Boolean).join(" ");
      }
    } else if (r.kind === "skills") {
      const sk = skillById[r.id];
      if (sk) line = sk.effect || sk.blurb || sk.flavor || "";
    } else {
      const item = (typeof itemByIdLookup === "function") ? itemByIdLookup()[r.id] : null;
      if (item) line = item.blurb || item.flavor || item.effect || "";
    }
    line = String(line || "").replace(/\s+/g, " ").trim();
    if (!line) return "點擊查看完整說明";
    return line.length > 48 ? line.slice(0, 47) + "…" : line;
  }

  function gachaCardHtml(r, idx, opts) {
    opts = opts || {};
    const rareLabel = gachaNormalizeRarity(r.rarity) || "普通";
    const art = r.art
      ? ("<img src=\"" + esc(r.art) + "\" alt=\"" + esc(r.name) + "\" data-card-name=\"" + esc(r.name) + "\" data-card-kind=\"" + esc(r.kind || "") + "\" />")
      : ("<img src=\"" + esc(cardGlyphDataUrl(r.name, r.kind)) + "\" alt=\"" + esc(r.name) + "\" />");
    const flagCls = r.flag === "new"
      ? "new"
      : (r.flag === "refund" ? "refund" : "dupe");
    const eggCls = "egg-" + ((idx % 5) + 1);
    const finale = opts.finale ? " gacha-finale" : "";
    const big = opts.big ? " gacha-card-big" : "";
    const particles =
      "<div class=\"gacha-card-particles\" aria-hidden=\"true\">" +
        "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>" +
      "</div>";
    const kind = r.kind || "";
    const id = r.id || "";
    const newBadge = r.flag === "new" ? "<span class=\"gacha-new-badge\">NEW</span>" : "";
    const blurb = gachaCardBlurb(r);
    // t364：重複卡顯示同名張數（升星材料），玩家一眼知可以去卡冊升星
    const qty = r.flag !== "new" && (r.count | 0) > 1
      ? "<span class=\"gacha-card-qty\">x" + (r.count | 0) + "</span>"
      : "";
    return (
      "<div class=\"gacha-card rarity-" + esc(rareLabel) + finale + big +
        "\" role=\"button\" tabindex=\"0\" title=\"點擊查看說明\"" +
        " data-rarity=\"" + esc(rareLabel) + "\"" +
        " data-id=\"" + esc(id) + "\" data-kind=\"" + esc(kind) + "\"" +
        " data-gacha-idx=\"" + (idx | 0) + "\" data-gacha-help=\"1\">" +
        newBadge +
        qty +
        "<div class=\"gacha-card-beam\" aria-hidden=\"true\"></div>" +
        "<div class=\"gacha-card-sparkles\" aria-hidden=\"true\"></div>" +
        particles +
        "<div class=\"gacha-card-shell " + eggCls + "\" aria-hidden=\"true\"></div>" +
        "<div class=\"gacha-card-art\">" + art + "</div>" +
        "<div class=\"gacha-card-meta\">" +
          "<div class=\"gacha-card-name\">" + esc(r.name) + "</div>" +
          "<div class=\"gacha-card-rare\">" + esc(rareLabel || "普通") + " · ★" + Math.max(1, r.star | 0) + "</div>" +
          "<p class=\"gacha-card-blurb\">" + esc(blurb) + "</p>" +
          "<div class=\"gacha-card-flag " + flagCls + "\">" + esc(r.flagLabel || "") + "</div>" +
          "<div class=\"gacha-card-hint\">點擊查看完整說明</div>" +
        "</div>" +
      "</div>"
    );
  }

  function gachaEggHtml(r, idx) {
    const rareLabel = gachaNormalizeRarity(r && r.rarity) || "普通";
    const eggCls = "egg-" + ((idx % 5) + 1);
    return (
      "<div class=\"gacha-egg " + eggCls + " rarity-" + esc(rareLabel) + "\" data-egg-idx=\"" + idx + "\">" +
        "<span class=\"gacha-egg-half half-top\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-half half-bot\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-shard s1\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-shard s2\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-shard s3\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-shard s4\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-crack\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-glow\" aria-hidden=\"true\"></span>" +
        "<span class=\"gacha-egg-label\">扭蛋</span>" +
      "</div>"
    );
  }

  function gachaMachineHtml() {
    /* t323：主視覺改用 assets/gacha/machine-ref.webp；純 CSS 示意機降級隱藏 */
    return (
      "<div class=\"gacha-machine gm-has-art\" aria-hidden=\"true\">" +
        "<div class=\"gm-brand-tag\" role=\"note\">" +
          "<b class=\"gm-neon-cn\">廟街扭蛋</b>" +
          "<em class=\"gm-neon-en\">／NEON</em>" +
        "</div>" +
        "<div class=\"gm-art-wrap\">" +
          "<img class=\"gm-art gm-art-photo\" src=\"assets/gacha/machine-hk.png?v=t373-1\" width=\"520\" height=\"818\" alt=\"香港主題霓虹扭蛋機\" draggable=\"false\" />" +
        "</div>" +
        "<div class=\"gm-price-board\" aria-label=\"扭蛋價錢\">" +
          "<span><b>" + gachaPriceSingle + "</b> 膠幣／次</span>" +
          "<span><b>" + gachaPriceTen + "</b> 膠幣／十連</span>" +
        "</div>" +
        /* 純 CSS 示意機：主視覺圖載入失敗時顯示（.gm-css-schematic 預設隱藏）；
           DOM 要齊全，否則降級時只剩空白一片 */
        "<div class=\"gm-css-schematic\" hidden>" +
          "<div class=\"gm-dome\">" +
            "<div class=\"gm-dome-glass\">" +
              "<div class=\"gm-eggs-pile\">" +
                "<i class=\"gm-ball b1\"></i><i class=\"gm-ball b2\"></i><i class=\"gm-ball b3\"></i>" +
                "<i class=\"gm-ball b4\"></i><i class=\"gm-ball b5\"></i><i class=\"gm-ball b6\"></i>" +
                "<i class=\"gm-ball b7\"></i><i class=\"gm-ball b8\"></i><i class=\"gm-ball b9\"></i>" +
                "<i class=\"gm-ball b10\"></i><i class=\"gm-ball b11\"></i><i class=\"gm-ball b12\"></i>" +
                "<i class=\"gm-ball b13\"></i><i class=\"gm-ball b14\"></i><i class=\"gm-ball b15\"></i>" +
                "<i class=\"gm-ball b16\"></i><i class=\"gm-ball b17\"></i><i class=\"gm-ball b18\"></i>" +
                "<i class=\"gm-ball b19\"></i><i class=\"gm-ball b20\"></i><i class=\"gm-ball b21\"></i>" +
                "<i class=\"gm-ball b22\"></i><i class=\"gm-ball b23\"></i><i class=\"gm-ball b24\"></i>" +
                "<i class=\"gm-ball b25\"></i><i class=\"gm-ball b26\"></i><i class=\"gm-ball b27\"></i>" +
                "<i class=\"gm-ball b28\"></i>" +
              "</div>" +
              "<div class=\"gm-glass-shine\"></div>" +
              "<div class=\"gm-glass-shine gm-glass-shine-2\"></div>" +
            "</div>" +
            "<div class=\"gm-dome-rim\">" +
              "<i class=\"gm-rim-bolt\"></i><i class=\"gm-rim-bolt\"></i>" +
              "<i class=\"gm-rim-bolt\"></i><i class=\"gm-rim-bolt\"></i>" +
            "</div>" +
          "</div>" +
          "<div class=\"gm-lightbox\">" +
            "<i class=\"gm-bulb\"></i><i class=\"gm-bulb\"></i>" +
            "<span class=\"gm-lightbox-text\">" +
              "<b class=\"gm-neon-cn\">廟街扭蛋</b>" +
              "<em class=\"gm-neon-en\">／NEON</em>" +
            "</span>" +
            "<i class=\"gm-bulb\"></i><i class=\"gm-bulb\"></i>" +
          "</div>" +
          "<div class=\"gm-cabinet\">" +
            "<div class=\"gm-controls\">" +
              "<div class=\"gm-coin-slot\"><em></em><span>投幣</span></div>" +
              "<div class=\"gm-knob\">" +
                "<span class=\"gm-knob-ring\"></span>" +
                "<span class=\"gm-knob-handle\">" +
                  "<span class=\"gm-knob-grip\"></span>" +
                "</span>" +
                "<span class=\"gm-knob-hub\"></span>" +
              "</div>" +
            "</div>" +
            "<div class=\"gm-chute\">" +
              "<span class=\"gm-chute-label\">出蛋</span>" +
              "<span class=\"gm-chute-door\"></span>" +
              "<span class=\"gm-chute-frame\"></span>" +
              "<span class=\"gm-chute-lip\"></span>" +
            "</div>" +
          "</div>" +
          "<div class=\"gm-base\"><span></span><span></span></div>" +
        "</div>" +
        /* t322／t323：提示字獨立實色橫條——機底下方，唔蓋罩／轉柄／出蛋口 */
        "<div class=\"gm-hint-bar\" role=\"note\">投入膠幣，扭出霓虹塑膠蛋</div>" +
        "<div class=\"gm-coin-fly\" aria-hidden=\"true\"></div>" +
      "</div>"
    );
  }

  function applyGachaPhaseDom(root, phase) {
    if (!root) return;
    const panel = root.querySelector(".gacha-panel");
    if (panel) {
      panel.setAttribute("data-phase", phase);
      panel.className = "gacha-panel phase-" + phase;
    }
    const busy = gachaPhaseIsBusy(phase);
    const skip = root.querySelector("#btn-gacha-skip");
    if (skip) {
      skip.hidden = !busy;
      skip.disabled = !busy;
    }
    // P0：result／idle「返回」永遠可撳；演出中亦允許離開（clearGachaAnim）
    const backBtn = root.querySelector("#btn-gacha-back");
    if (backBtn) {
      backBtn.removeAttribute("disabled");
      backBtn.classList.remove("disabled");
    }
    const actions = root.querySelector(".gacha-actions");
    if (actions) {
      actions.classList.toggle("is-locked", busy);
      actions.querySelectorAll("button").forEach((b) => {
        if (b.id === "btn-gacha-skip") return;
        const need = Number(b.getAttribute("data-need") || 0);
        const broke = !!(need && (state.soul | 0) < need);
        if (busy) {
          b.setAttribute("disabled", "disabled");
          b.classList.toggle("is-broke", broke);
          b.classList.toggle("disabled", broke);
        } else {
          // 魂焰不足：唔用 disabled 屬性，保留 click → toast「膠幣不足」
          b.removeAttribute("disabled");
          b.classList.toggle("is-broke", broke);
          b.classList.toggle("disabled", broke);
          if (broke) b.setAttribute("aria-disabled", "true");
          else b.removeAttribute("aria-disabled");
        }
      });
    }
    const stage = root.querySelector("#gacha-stage");
    if (!stage) return;
    const results = Array.isArray(state.gachaResults) ? state.gachaResults : [];
    const maxRank = gachaResultsMaxRank(results);
    const isTen = results.length >= 10;

    if (phase === "idle") {
      // t322：提示改掛機底 gm-hint-bar；舞台留空免半透明蓋旋鈕
      stage.innerHTML = "";
      return;
    }
    if (phase === "coin") {
      stage.innerHTML = "<div class=\"gacha-phase-label\">投幣中…</div>";
      return;
    }
    if (phase === "spin") {
      stage.innerHTML = "<div class=\"gacha-phase-label\">大轉鈕轉動…</div>";
      return;
    }
    if (phase === "egg_out") {
      stage.innerHTML =
        "<div class=\"gacha-phase-label\">出蛋！</div>" +
        "<div class=\"gacha-results eggs\">" +
          results.map((r, i) => gachaEggHtml(r, i)).join("") +
        "</div>";
      return;
    }
    if (phase === "crack") {
      stage.innerHTML =
        "<div class=\"gacha-phase-label\">開蛋…</div>" +
        "<div class=\"gacha-results eggs cracking\">" +
          results.map((r, i) => gachaEggHtml(r, i)).join("") +
        "</div>";
      return;
    }
    if (phase === "reveal") {
      const overlay = (maxRank >= 4)
        ? ("<div class=\"gacha-legend-overlay\" aria-hidden=\"true\">" +
            "<div class=\"gacha-legend-pillar\"></div>" +
            "<div class=\"gacha-legend-burst\"></div>" +
            "<span>爆</span></div>")
        : (maxRank >= 3 ? "<div class=\"gacha-epic-flash\" aria-hidden=\"true\"></div>" : "");
      stage.innerHTML =
        overlay +
        "<div class=\"gacha-phase-label\">見卡！</div>" +
        "<div class=\"gacha-results revealed" + (isTen ? " ten" : " single") + "\">" +
          results.map((r, i) => gachaCardHtml(r, i, {
            finale: isTen && i === results.length - 1,
            big: !isTen || (i === results.length - 1 && maxRank >= 3),
          })).join("") +
        "</div>";
      wireGachaCardHelp(stage);
      return;
    }
    if (phase === "result") {
      const gridCls = isTen ? "result-grid" : "single";
      // t364：重複卡唔再自動升星 → 底部提示玩家去卡冊親手升
      const hasDupe = results.some((r) => r.flag === "dupe");
      const tip = hasDupe
        ? "<p class=\"gacha-result-tip\">重複卡已存為同名卡（見卡上 xN）。升星要自己去「卡冊 → 裝備卡／技能卡／戰鬥卡」點卡按「升星」，扭蛋唔會自動升。</p>"
        : "";
      stage.innerHTML =
        (results.length
          ? ("<div class=\"gacha-results revealed " + gridCls + "\">" +
              results.map((r, i) => gachaCardHtml(r, i, {
                finale: isTen && i === results.length - 1,
                big: !isTen,
              })).join("") +
              tip +
            "</div>")
          : "<div class=\"gacha-idle-hint solid\">投入膠幣，扭出霓虹塑膠蛋</div>");
    }
    // t320：出卡後（reveal／result）綁定點擊／長按說明
    if (phase === "reveal" || phase === "result") {
      wireGachaCardHelp(stage);
    }
  }

  function skipGachaAnim() {
    clearGachaAnim();
    state.gachaPhase = "result";
    state.gachaReveal = true;
    const root = document.getElementById("screen");
    if (root && root.querySelector(".gacha-panel")) {
      applyGachaPhaseDom(root, "result");
      gachaBeep(880, 0.05, 0.03);
    } else {
      render();
    }
  }

  function runGachaPhaseChain(fromIndex) {
    clearGachaAnim();
    const token = _gachaAnimToken;
    const results = Array.isArray(state.gachaResults) ? state.gachaResults : [];
    const maxRank = gachaResultsMaxRank(results);
    const isTen = results.length >= 10;
    const revealMs = maxRank >= 4 ? 1200 : (maxRank >= 3 ? 850 : (isTen ? 720 : 560));
    const steps = [
      { phase: "coin", ms: 400, beep: [520, 0.05] },
      { phase: "spin", ms: 560, beep: [380, 0.08] },
      { phase: "egg_out", ms: 480, beep: [640, 0.06] },
      { phase: "crack", ms: 420, beep: [720, 0.05] },
      { phase: "reveal", ms: revealMs, beep: maxRank >= 4 ? [980, 0.12] : [840, 0.07] },
      { phase: "result", ms: 0, beep: [440, 0.04] },
    ];

    const root = () => document.getElementById("screen");
    let i = Math.max(0, fromIndex | 0);
    const applyStep = (step) => {
      state.gachaPhase = step.phase;
      state.gachaReveal = (step.phase === "reveal" || step.phase === "result");
      const el = root();
      if (el && el.querySelector(".gacha-panel")) {
        applyGachaPhaseDom(el, step.phase);
      } else {
        render();
      }
      if (step.beep) gachaBeep(step.beep[0], step.beep[1]);
    };
    const tick = () => {
      if (token !== _gachaAnimToken) return;
      if (i >= steps.length) return;
      const step = steps[i];
      applyStep(step);
      const wait = step.ms | 0;
      i += 1;
      if (i < steps.length) {
        setTimeout(tick, Math.max(0, wait));
      }
    };
    tick();
  }

  function enterGachaScreen() {
    ensureGachaPity();
    clearGachaAnim();
    if (gachaEntryLocked()) {
      toastMsg(state.lifePrepped
          ? "人生進行中唔可以抽扭蛋——完結今世先返主頁抽。"
          : "戰鬥進行中唔可以抽扭蛋——打完先抽。");
      return;
    }
    if (state.screen !== "gacha") {
      state.gachaReturnScreen = state.screen || "home";
    }
    if (!state.gachaPhase || state.gachaPhase === "undefined") state.gachaPhase = "idle";
    // 入機時若唔喺演出中，維持 idle／result
    if (gachaPhaseIsBusy(state.gachaPhase)) {
      state.gachaPhase = "idle";
      state.gachaReveal = false;
    }
    state.screen = "gacha";
    render();
  }

  /** 進入人生後停止扭蛋：準備出發／今世進行中一律鎖；只可喺今世主頁（未開始）抽 */
  /**
   * t379：扭蛋開放至人生中（總導演：「人生中允許扭蛋，或主頁寫清楚『結算後先抽』」）。
   *
   * 原本 `gachaEntryLocked()` 喺 `lifePrepped` 之後就鎖死，玩家喺人生中途完全抽唔到，
   * 而 UI 只顯示「人生中停抽」四個字，冇解釋。
   * 現在改為**人生中都可以抽**（膠幣係跨世保留嘅帳號資源，抽卡提升卡冊合理），
   * 唯一限制：戰鬥進行中唔可以抽（避免中途改動隊伍／卡冊狀態）。
   */
  /**
   * t401：扭蛋入口 —— 進入人生後完全鎖定並隱藏。
   *
   * 演變：
   *   t379 曾開放「人生中亦可抽」→ 但總導演要求改回：
   *   「進人生後不能扭蛋，進人生後把右上角的扭蛋按鈕隱藏。」
   *
   * 規則：
   *   - `lifePrepped === true`（已開始人生）→ 一律鎖定（唔止戰鬥中）
   *   - 戰鬥進行中亦鎖定
   *   - UI 上 `gachaEntryHtml()` 回空字串 → 按鈕完全消失，唔會顯示「停抽」
   */
  function gachaEntryLocked() {
    if (state.lifePrepped) return true;
    const inBattle = state.screen === "battle" && state.battle && state.battle.running;
    return !!inBattle;
  }

  /** 扭蛋按鈕：鎖定時**完全唔顯示**（t401：隱藏，而非顯示「停抽」） */
  function gachaEntryHtml() {
    if (gachaEntryLocked()) return "";
    return `<button type="button" class="chip gacha-entry" id="btn-gacha-entry" data-gacha-entry title="廟街霓虹扭蛋機">霓虹扭蛋</button>`;
  }

  function wireGachaEntry(root) {
    if (!root) return;
    root.querySelectorAll("#btn-gacha-entry, [data-gacha-entry]").forEach((btn) => {
      btn.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (gachaEntryLocked()) {
          toastMsg(state.lifePrepped
          ? "人生進行中唔可以抽扭蛋——完結今世先返主頁抽。"
          : "戰鬥進行中唔可以抽扭蛋——打完先抽。");
          return;
        }
        enterGachaScreen();
      };
    });
  }

  function viewGacha(root) {
    ensureGachaPity();
    // t379：只有戰鬥進行中才擋（人生其他畫面都可以抽）
    if (gachaEntryLocked()) {
      state.gachaReturnScreen = null;
      state.gachaResults = [];
      state.gachaReveal = false;
      state.gachaPhase = "idle";
      state.screen = "home";
      render();
      toastMsg(state.lifePrepped
          ? "人生進行中唔可以抽扭蛋——完結今世先返主頁抽。"
          : "戰鬥進行中唔可以抽扭蛋——打完先抽。");
      return;
    }
    const soul = state.soul | 0;
    const pityRare = state.gachaPityRare | 0;
    const pityEpic = state.gachaPityEpic | 0;
    const toRare = Math.max(0, GACHA_PITY_RARE - pityRare);
    const toEpic = Math.max(0, GACHA_PITY_EPIC - pityEpic);
    const results = Array.isArray(state.gachaResults) ? state.gachaResults : [];
    const canSingle = soul >= gachaPriceSingle;
    const canTen = soul >= gachaPriceTen;
    let phase = state.gachaPhase || "idle";
    if (!phase || phase === "undefined") phase = "idle";
    if (results.length && phase === "idle" && state.gachaReveal) phase = "result";
    state.gachaPhase = phase;
    const busy = gachaPhaseIsBusy(phase);

    root.innerHTML =
      "<div class=\"gacha-panel phase-" + esc(phase) + "\" data-phase=\"" + esc(phase) + "\">" +
        "<div class=\"gacha-topbar\">" +
          "<span class=\"gacha-soul-big\"><span class=\"dot\"></span>膠幣 <b>" + soul + "</b></span>" +
          "<button type=\"button\" class=\"btn tiny ghost gacha-skip\" id=\"btn-gacha-skip\"" +
            (busy ? "" : " hidden") + ">略過動畫</button>" +
        "</div>" +
        "<div class=\"ribbon gacha-ribbon\">廟街霓虹扭蛋機</div>" +
        "<p class=\"gacha-sub\">單次 " + gachaPriceSingle + " 膠幣 · 十連 " + gachaPriceTen + " 膠幣 · 綜合池</p>" +
        "<div class=\"gacha-pity\">距稀有尚餘 <b>" + toRare + "</b> 次 · 距史詩尚餘 <b>" + toEpic + "</b> 次</div>" +
        gachaMachineHtml() +
        "<div class=\"gacha-stage\" id=\"gacha-stage\"></div>" +
        "<div class=\"gacha-actions" + (busy ? " is-locked" : "") + "\">" +
          "<button type=\"button\" class=\"btn cyan gacha-pull-btn" + (canSingle ? "" : " is-broke disabled") +
            "\" id=\"btn-gacha-1\" data-need=\"" + gachaPriceSingle + "\"" +
            (busy ? " disabled" : "") +
            (canSingle ? "" : " aria-disabled=\"true\"") +
            "><span class=\"gacha-pull-main\">扭一蛋</span><span class=\"gacha-pull-cost\">" + gachaPriceSingle + " 膠幣</span></button>" +
          "<button type=\"button\" class=\"btn gold gacha-pull-btn" + (canTen ? "" : " is-broke disabled") +
            "\" id=\"btn-gacha-10\" data-need=\"" + gachaPriceTen + "\"" +
            (busy ? " disabled" : "") +
            (canTen ? "" : " aria-disabled=\"true\"") +
            "><span class=\"gacha-pull-main\">十連扭蛋</span><span class=\"gacha-pull-cost\">" + gachaPriceTen + " 膠幣</span></button>" +
        "</div>" +
        "<div class=\"gacha-cta\">" +
          "<button type=\"button\" class=\"btn ghost\" id=\"btn-gacha-back\">返回</button>" +
        "</div>" +
        "<div id=\"home-toast\" class=\"home-toast\" hidden></div>" +
      "</div>";

    applyGachaPhaseDom(root, phase);

    const toast = (msg) => {
      const el = $("#home-toast", root);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(toast._t);
      toast._t = setTimeout(() => { el.hidden = true; }, 1600);
    };

    const doPull = (n) => {
      if (gachaPhaseIsBusy(state.gachaPhase)) return;
      const res = pullGacha(n);
      if (!res.ok) {
        toast(res.reason || "膠幣不足");
        return;
      }
      state.gachaReveal = false;
      state.gachaPhase = "coin";
      render();
      gachaBeep(520, 0.05);
      // 首段 coin 已由 render 播完；400ms 後由 spin 接棒，避免 class 重套令動畫唔重播
      clearGachaAnim();
      const token = _gachaAnimToken;
      setTimeout(() => {
        if (token !== _gachaAnimToken) return;
        if (state.gachaPhase !== "coin") return;
        runGachaPhaseChain(1);
      }, 400);
    };

    const b1 = $("#btn-gacha-1", root);
    if (b1) {
      b1.onclick = () => {
        if (gachaPhaseIsBusy(state.gachaPhase)) return;
        if ((state.soul | 0) < gachaPriceSingle) {
          toast("膠幣不足");
          return;
        }
        doPull(1);
      };
    }
    const b10 = $("#btn-gacha-10", root);
    if (b10) {
      b10.onclick = () => {
        if (gachaPhaseIsBusy(state.gachaPhase)) return;
        if ((state.soul | 0) < gachaPriceTen) {
          toast("膠幣不足");
          return;
        }
        doPull(10);
      };
    }
    const skipBtn = $("#btn-gacha-skip", root);
    if (skipBtn) {
      skipBtn.onclick = () => {
        if (state.gachaPhase === "idle" || state.gachaPhase === "result") return;
        skipGachaAnim();
      };
    }
    const back = $("#btn-gacha-back", root);
    if (back) {
      // P0：result／idle／演出中皆可返回；離開時清動畫 token
      back.removeAttribute("disabled");
      back.onclick = () => {
        clearGachaAnim();
        const ret = state.gachaReturnScreen || "home";
        state.gachaReturnScreen = null;
        state.gachaReveal = false;
        state.gachaPhase = "idle";
        state.gachaResults = [];
        state.screen = (ret && ret !== "gacha") ? ret : "home";
        render();
      };
    }
  }


  /* ---------- 卡冊 helpers（album- 前綴；唔動 prep layout） ---------- */
  const ALBUM_MAX_STAR = 5;
  const ALBUM_FILTER_CYCLE = [null, "普通", "稀有", "史詩", "最高級"];
  /** demo 收藏種子版：隨機各 5 張戰鬥／技能／裝備 count=1；其餘 0。Bump 強制重種子。 */
  const DEMO_CARD_COUNTS_SEED = 271;

  function albumCountRaw(id) {
    if (!id) return 0;
    const n = state.cardCounts[id];
    return n == null ? 0 : Math.max(0, n | 0);
  }

  /** 輕修剪：隊／裝技／accountGear／lifeSkills 唔再指向未擁有卡 */
  function pruneUnownedRefs() {
    ensureGearShape();
    const owned = (id) => albumCountRaw(id) > 0;
    state.team = (state.team || []).filter((id) => owned(id));
    /*
     * t374：P0 保險 —— 修剪之後如果隊伍變空，自動由已擁有嘅卡補回。
     * 原因：state.team 預設為 default_team，但 demo 種子只隨機抽 5 張，
     * 有機會一張都唔中；原本修剪後 team 變空 → 準備頁無法開始遊戲（實測 100% 重現）。
     * 現在即使種子再變，玩家都一定有卡可以揀。
     */
    if (!state.team.length) {
      const cap = fighterPocketCap();
      const fallback = [];
      // 先試 default_team 中有擁有嘅
      (DATA.default_team || []).forEach((id) => {
        if (fallback.length < cap && owned(id)) fallback.push(id);
      });
      // 再唔夠就由卡冊任意補
      if (fallback.length < 1) {
        (DATA.fighters || []).forEach((f) => {
          if (fallback.length >= Math.min(3, cap)) return;
          if (f && f.id && owned(f.id) && !fallback.includes(f.id)) fallback.push(f.id);
        });
      }
      state.team = fallback;
    }
    state.deploy = (state.deploy || []).filter((id) => state.team.includes(id));
    if (state.equipFocus && !state.team.includes(state.equipFocus)) {
      state.equipFocus = state.team[0] || null;
      state.equipSlot = null;
    }
    Object.keys(state.loadout || {}).forEach((fid) => {
      if (!state.team.includes(fid)) {
        delete state.loadout[fid];
        if (state.loadoutInited) delete state.loadoutInited[fid];
        return;
      }
      const arr = state.loadout[fid];
      if (!Array.isArray(arr)) return;
      state.loadout[fid] = arr.map((sid) => (sid && owned(sid) ? sid : null));
    });
    GEAR_SLOTS.forEach((slot) => {
      const iid = state.accountGear[slot.id];
      if (iid && !owned(iid)) state.accountGear[slot.id] = null;
    });
    if (Array.isArray(state.lifeSkills)) {
      state.lifeSkills = state.lifeSkills.filter((id) => id && skillById[id] && owned(id));
    }
  }

  function albumEnsureState() {
    if (!state.albumTab || !["fighters", "skills", "gear"].includes(state.albumTab)) {
      state.albumTab = "fighters";
    }
    if (typeof state.albumQuery !== "string") state.albumQuery = "";
    if (state.albumDetailId == null) state.albumDetailId = null;
    if (state.albumDetailKind == null) state.albumDetailKind = null;
    if (state.albumFilterRarity === undefined) state.albumFilterRarity = null;
    if (!state.cardCounts || typeof state.cardCounts !== "object") state.cardCounts = {};
    if (!state.fighterStars || typeof state.fighterStars !== "object") state.fighterStars = {};
    if (!state.skillStars || typeof state.skillStars !== "object") state.skillStars = {};
    if (!state.fighterLevels || typeof state.fighterLevels !== "object") state.fighterLevels = {};
    if (!state.fighterXp || typeof state.fighterXp !== "object") state.fighterXp = {};
    ensureGearShape();

    const fighters = rosterFightersSorted();
    const skills = (DATA.skills || []).slice();
    const equips = equipItemList().slice();
    const stubs = ["C_STUB0", "S_STUB0", "EQP_STUB0"];

    if (state.demoSeedVersion !== DEMO_CARD_COUNTS_SEED) {
      const next = {};
      fighters.forEach((f) => { if (f.id) next[f.id] = 0; });
      skills.forEach((sk) => { if (sk.id) next[sk.id] = 0; });
      equips.forEach((it) => { if (it.id) next[it.id] = 0; });
      stubs.forEach((id) => { next[id] = 0; });
      shuffleCopy(fighters).slice(0, 5).forEach((f) => {
        if (!f.id) return;
        next[f.id] = 1;
        state.fighterStars[f.id] = 1; // t322 種子新卡 ★1
      });
      /*
       * t374：P0 修正 —— 種子必須包含 default_team（C241 泥頭車／C244 纜車廂／C248 晨跑徑）。
       *
       * 原本只隨機抽 5 張，default_team 嘅三張經常抽唔到；
       * 而 `state.team` 初始化為 default_team、隨後 `pruneUnownedRefs()` 會剔走未擁有嘅卡
       * → team 變空 → 準備頁只有「＋」、`btn-ready` 永久 disabled → **玩家完全無法開始遊戲**。
       * 實測：全新開局 100% 重現（default_team 三張一張都冇）。
       */
      (DATA.default_team || []).forEach((id) => {
        if (!id) return;
        next[id] = Math.max(1, next[id] | 0);
        if (state.fighterStars[id] == null) state.fighterStars[id] = 1;
      });
      shuffleCopy(skills).slice(0, 5).forEach((sk) => {
        if (!sk.id) return;
        next[sk.id] = 1;
        state.skillStars[sk.id] = 1;
      });
      shuffleCopy(equips).slice(0, 5).forEach((it) => {
        if (!it.id) return;
        next[it.id] = 1;
        state.equipStars[it.id] = 1;
      });
      state.cardCounts = next;
      state.demoSeedVersion = DEMO_CARD_COUNTS_SEED;
      pruneUnownedRefs();
    } else {
      const ensureZero = (id) => {
        if (!id || state.cardCounts[id] != null) return;
        state.cardCounts[id] = 0;
      };
      fighters.forEach((f) => ensureZero(f.id));
      skills.forEach((sk) => ensureZero(sk.id));
      equips.forEach((it) => ensureZero(it.id));
      stubs.forEach(ensureZero);
      /*
       * t375b：舊存檔亦要補 default_team。
       * 原因：種子版本未變（271）→ 唔會重種子，但舊存檔可能完全冇 default_team 嘅三張卡，
       * 而 pruneUnownedRefs() 之後 team 會變空（下面另有空隊保險，但補卡更徹底）。
       * 只補「未擁有」嘅，唔會洗走玩家收藏。
       */
      (DATA.default_team || []).forEach((id) => {
        if (!id) return;
        if ((state.cardCounts[id] | 0) < 1) {
          state.cardCounts[id] = 1;
          if (state.fighterStars[id] == null) state.fighterStars[id] = 1;
        }
      });
      pruneUnownedRefs();
    }

    // demo 旁觀驗「普攻・魔／自帶・魔」用：強制至少擁有 C03「霓虹咒匠」（只補 count，唔 bump／重置全部隨機 5+5+5，避免洗走玩家收藏）
    if ((state.cardCounts["C03"] | 0) < 1) {
      state.cardCounts["C03"] = 1;
      if (state.fighterStars["C03"] == null) state.fighterStars["C03"] = 1; // t322
    }
    // t322：已擁有但缺 star 欄 → 補 ★1（舊檔／種子）
    Object.keys(state.cardCounts || {}).forEach((id) => {
      if ((state.cardCounts[id] | 0) <= 0) return;
      if (fighterById[id] && state.fighterStars[id] == null) state.fighterStars[id] = 1;
      else if (skillById[id] && state.skillStars[id] == null) state.skillStars[id] = 1;
      else if (itemByIdLookup()[id] && state.equipStars[id] == null) state.equipStars[id] = 1;
    });
  }

  function albumCardCount(id) {
    albumEnsureState();
    if (!id) return 0;
    const n = state.cardCounts[id];
    return n == null ? 0 : Math.max(0, n | 0);
  }

  function albumSetCount(id, n) {
    albumEnsureState();
    if (!id) return;
    state.cardCounts[id] = Math.max(0, n | 0);
  }

  /**
   * t322：首次入冊（count 0→1）明確寫 ★1 入對應 star map（唔只靠讀取 clamp）。
   * kind: fighters｜skills｜gear
   */
  function albumMarkNewCardStar1(kind, id) {
    albumEnsureState();
    if (!id) return;
    if (kind === "fighters") {
      state.fighterStars[id] = 1;
    } else if (kind === "skills") {
      state.skillStars[id] = 1;
    } else if (kind === "gear") {
      ensureGearShape();
      state.equipStars[id] = 1;
    }
  }

  /** count 由 0 變正數時寫 ★1；已有星數唔覆蓋 */
  function albumGainOne(kind, id) {
    albumEnsureState();
    if (!id) return;
    const before = albumCardCount(id);
    albumSetCount(id, before + 1);
    if (before <= 0) albumMarkNewCardStar1(kind, id);
  }

  function albumFighterStar(id) {
    albumEnsureState();
    const f = fighterById[id];
    const maxS = ALBUM_MAX_STAR;
    let s = state.fighterStars[id];
    if (s == null) s = 1;
    return Math.min(maxS, Math.max(1, s | 0));
  }

  /* ---------- 戰鬥卡等級（帳號級 RPG；可與升星疊加） ---------- */
  /** Lv.1–5；缺欄位＝Lv.1／0 xp。xp 升下一級需 10×當前等級（Lv1→2＝10，Lv2→3＝20…） */
  const FIGHTER_LEVEL_MAX = 5;
  const FIGHTER_LEVEL_ATK_PER = 2;
  const FIGHTER_LEVEL_HP_PER = 10;
  /** 升星戰力（每星高於 1）：可與等級加成疊加；升星玩法仍為卡冊合卡，本刀不重做 */
  const FIGHTER_STAR_ATK_PER = 1;
  const FIGHTER_STAR_HP_PER = 5;
  /** 戰鬥勝利：每張本場參戰卡（deploy 進場）自動＋卡經驗 */
  const FIGHTER_BATTLE_XP = 10;

  function fighterLevelOf(id) {
    albumEnsureState();
    let lv = state.fighterLevels[id];
    if (lv == null) lv = 1;
    return Math.min(FIGHTER_LEVEL_MAX, Math.max(1, lv | 0));
  }

  function fighterXpOf(id) {
    albumEnsureState();
    return Math.max(0, state.fighterXp[id] | 0);
  }

  function fighterXpToNext(level) {
    const lv = Math.max(1, level | 0);
    if (lv >= FIGHTER_LEVEL_MAX) return 0;
    return 10 * lv;
  }

  /** 等級加成：每級高於 Lv.1 → 物攻＋2、HP＋10 */
  function fighterLevelBonus(id) {
    const steps = Math.max(0, fighterLevelOf(id) - 1);
    return { atk: steps * FIGHTER_LEVEL_ATK_PER, hp: steps * FIGHTER_LEVEL_HP_PER };
  }

  /** 星數加成：每星高於 ★1 → 物攻＋1、HP＋5；與等級疊加 */
  function fighterStarCombatBonus(id) {
    const steps = Math.max(0, albumFighterStar(id) - 1);
    return { atk: steps * FIGHTER_STAR_ATK_PER, hp: steps * FIGHTER_STAR_HP_PER };
  }

  function fighterGrowthBonus(id) {
    const lvB = fighterLevelBonus(id);
    const stB = fighterStarCombatBonus(id);
    return { atk: (lvB.atk | 0) + (stB.atk | 0), hp: (lvB.hp | 0) + (stB.hp | 0) };
  }

  /**
   * 帳號級卡經驗。回傳 { id, name, xpGain, fromLv, toLv, leveled, xp, xpNeed }
   * 滿級後多餘 xp 丟棄（歸零）。
   */
  function grantFighterCardXp(id, amount) {
    albumEnsureState();
    const f = fighterById[id];
    if (!id || !f) return null;
    const add = Math.max(0, amount | 0);
    let lv = fighterLevelOf(id);
    let xp = fighterXpOf(id) + add;
    const fromLv = lv;
    let guard = 0;
    while (lv < FIGHTER_LEVEL_MAX && guard < 20) {
      const need = fighterXpToNext(lv);
      if (need <= 0 || xp < need) break;
      xp -= need;
      lv += 1;
      guard++;
    }
    if (lv >= FIGHTER_LEVEL_MAX) xp = 0;
    state.fighterLevels[id] = lv;
    state.fighterXp[id] = xp;
    return {
      id,
      name: f.name || id,
      xpGain: add,
      fromLv,
      toLv: lv,
      leveled: lv > fromLv,
      xp,
      xpNeed: fighterXpToNext(lv),
    };
  }

  /** 戰鬥勝利：本場參戰卡（players）各＋FIGHTER_BATTLE_XP */
  function grantDeployedCardXpFromBattle(b) {
    const notes = [];
    if (!b || !Array.isArray(b.players)) return notes;
    const seen = Object.create(null);
    b.players.forEach((p) => {
      if (!p || !p.id || seen[p.id]) return;
      seen[p.id] = true;
      const r = grantFighterCardXp(p.id, FIGHTER_BATTLE_XP);
      if (r) notes.push(r);
    });
    return notes;
  }


  function albumSkillStar(id) {
    albumEnsureState();
    let s = state.skillStars[id];
    if (s == null) s = 1;
    return Math.min(ALBUM_MAX_STAR, Math.max(1, s | 0));
  }

  function albumStarOf(kind, id, item) {
    if (kind === "fighters") return albumFighterStar(id);
    if (kind === "skills") return albumSkillStar(id);
    if (kind === "gear") return equipStarOf(item || itemByIdLookup()[id]);
    return 1;
  }

  function albumMaxStar(kind, item) {
    if (kind === "gear" && item) return Math.max(1, Number(item.max_star) || ALBUM_MAX_STAR);
    return ALBUM_MAX_STAR;
  }

  /** t256：S→S+1 要同名卡 (S+1) 張 */
  function albumStarNeed(star) {
    return Math.max(1, (star | 0) + 1);
  }

  function albumStarsHtml(star, maxS) {
    // t322：新卡／缺欄一律至少顯示 ★1，唔好 ★0 或空白
    const s = Math.max(1, star | 0);
    const m = Math.max(s, maxS | 0, 1);
    let out = "";
    for (let i = 1; i <= m; i++) {
      out += `<span class="album-star${i <= s ? " on" : ""}">★</span>`;
    }
    return out;
  }

  function albumRarityKey(kind, item) {
    if (!item) return "";
    // t364：一套叫法行全站——裝備唔再自己翻譯一次
    return rarityLabelAny(item.rarity);
  }

  function albumRarityClass(kind, item) {
    const id = rarityIdOf(item && item.rarity);
    return "r-" + id;
  }

  function albumListForTab(tab) {
    if (tab === "skills") {
      return (DATA.skills || [])
        .slice()
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
        .map((sk) => ({
          kind: "skills",
          id: sk.id,
          name: sk.name || sk.id,
          art: sk.art || null,
          item: sk,
        }));
    }
    if (tab === "gear") {
      return equipItemList().map((it) => ({
        kind: "gear",
        id: it.id,
        name: it.name || it.id,
        art: it.art || null,
        item: it,
      }));
    }
    return rosterFightersSorted().map((f) => ({
      kind: "fighters",
      id: f.id,
      name: f.name || f.id,
      art: f.art || null,
      item: f,
    }));
  }

  function albumFilteredEntries() {
    albumEnsureState();
    const tab = state.albumTab;
    const q = String(state.albumQuery || "").trim().toLowerCase();
    const fr = state.albumFilterRarity;
    // 卡冊只顯示已擁有（count>0）；全目錄仍由 albumListForTab 等 helper 提供
    return albumListForTab(tab).filter((e) => {
      if (albumCardCount(e.id) <= 0) return false;
      if (q) {
        const hay = `${e.name} ${e.id} ${albumRarityKey(e.kind, e.item)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fr) {
        const rk = albumRarityKey(e.kind, e.item) || (e.kind === "skills" ? "" : "普通");
        // 技能多數無 rarity：有篩選時唔硬剔（只靠搜尋）；戰鬥／裝備跟稀有度
        if (e.kind === "skills") return true;
        if (rk !== fr) return false;
      }
      return true;
    });
  }

  function albumArtHtml(art, name, phClass, kind) {
    const k = kind || "fighter";
    if (art) {
      return `<img src="${esc(art)}" alt="${esc(name || "")}" loading="lazy" decoding="async" data-card-name="${esc(name || "")}" data-card-kind="${esc(k)}" />`;
    }
    return `<img src="${cardGlyphDataUrl(name, k)}" alt="${esc(name || "")}" loading="lazy" />`;
  }

  function albumDetailBodyHtml(kind, id) {
    const count = albumCardCount(id);
    let item = null;
    let badge = "出戰卡";
    let help = "";
    let name = id;
    let art = null;
    if (kind === "fighters") {
      item = fighterById[id];
      badge = "出戰卡";
      if (!item) return "";
      name = item.name;
      art = item.art;
      help = fighterHelpText(item);
    } else if (kind === "skills") {
      item = skillById[id];
      badge = "技能";
      if (!item) return "";
      name = item.name;
      art = item.art;
      help = skillHelpText(item);
    } else {
      item = itemByIdLookup()[id];
      badge = "裝備";
      if (!item) return "";
      name = item.name;
      art = item.art;
      help = equipHelpText(item);
    }
    const star = albumStarOf(kind, id, item);
    const maxS = albumMaxStar(kind, item);
    const need = albumStarNeed(star);
    const canUp = count >= need && star < maxS;
    const owned = count > 0;
    const helpBlocks = String(help || "")
      .split("\n")
      .filter(Boolean)
      .map((line) => `<p class="album-detail-line">${esc(line)}</p>`)
      .join("");
    const nextHint =
      star < maxS
        ? `<p class="album-detail-next">下一星需要同名卡 ${need} 張（現在 ${count}）</p>`
        : `<p class="album-detail-next">已滿星（★${maxS}）</p>`;

    let levelBlock = "";
    if (kind === "fighters" && owned) {
      const lv = fighterLevelOf(id);
      const xp = fighterXpOf(id);
      const needXp = fighterXpToNext(lv);
      const grow = fighterGrowthBonus(id);
      const xpLine =
        lv >= FIGHTER_LEVEL_MAX
          ? "已達等級上限"
          : `卡經驗 ${xp}／${needXp}（下一級需 ${needXp}）`;
      levelBlock = `
        <div class="album-level-block">
          <div class="album-level-title">Lv.${lv}<span class="album-level-max">／${FIGHTER_LEVEL_MAX}</span></div>
          <p class="album-level-xp">${esc(xpLine)}</p>
          <p class="album-level-bonus">成長加成：物攻 +${grow.atk | 0} · HP +${grow.hp | 0}（等級與升星可疊加）</p>
        </div>`;
    }

    return `
      <div class="album-detail-sheet" role="dialog" aria-label="${esc(name)}">
        <button type="button" class="album-detail-x" id="album-detail-x" aria-label="關閉">×</button>
        <div class="album-detail-top">
          <span class="album-badge album-badge-${esc(kind)}">${esc(badge)}</span>
          <div class="album-detail-stars">${albumStarsHtml(star, maxS)}</div>
          <div class="album-detail-name">${esc(name)}${kind === "fighters" ? ` <span class="album-lv-inline">Lv.${fighterLevelOf(id)}</span>` : ""}</div>
        </div>
        <div class="album-detail-art ${owned ? "" : "unowned"}">${albumArtHtml(art, name, "album-detail-ph")}</div>
        ${levelBlock}
        <div class="album-detail-body">${helpBlocks || "<p class='album-detail-line'>（無詳細）</p>"}</div>
        <div class="album-starup">
          <div class="album-starup-label">同名卡 <b>${count}</b>／${need}</div>
          ${nextHint}
          ${/* t400：裝備卡可以直接裝上／卸下 */""}
          ${kind === "gear" ? albumGearEquipBtnHtml(id) : ""}
          <button type="button" class="btn album-starup-btn${canUp ? " ready" : ""}" id="album-btn-starup" ${canUp ? "" : "disabled"}>升星</button>
        </div>
        <p class="album-detail-foot">點擊彈窗以外的任意位置，可以關閉彈窗</p>
      </div>`;
  }

  /**
   * t400：卡冊裝備詳情的「裝上／卸下」按鈕。
   * 準備頁只在 `!lifePrepped` 時可進入，人生中途冇任何介面可以換裝備。
   */
  function albumGearEquipBtnHtml(id) {
    ensureGearShape();
    const item = itemByIdLookup()[id];
    if (!item) return "";
    const slotId = item.slot || item.slot_id || null;
    const slotMeta = slotId ? GEAR_SLOTS.find((s) => s.id === slotId) : null;
    if (!slotMeta) return "";
    const equipped = state.accountGear[slotMeta.id] === id;
    if (equipped) {
      return `<button type="button" class="btn ghost album-gear-btn" id="album-btn-gear" data-gear-act="off">卸下（${esc(slotMeta.label)}槽）</button>`;
    }
    return `<button type="button" class="btn cyan album-gear-btn" id="album-btn-gear" data-gear-act="on">裝上（${esc(slotMeta.label)}槽）</button>`;
  }

  /** t400：卡冊內裝上／卸下裝備 */
  function albumToggleGearEquip(id, toastFn, root) {
    ensureGearShape();
    const item = itemByIdLookup()[id];
    if (!item) { toastFn(root, "找不到這件裝備"); return false; }
    const slotId = item.slot || item.slot_id || null;
    const slotMeta = slotId ? GEAR_SLOTS.find((s) => s.id === slotId) : null;
    if (!slotMeta) { toastFn(root, "此裝備未對應槽位"); return false; }
    if (state.accountGear[slotMeta.id] === id) {
      state.accountGear[slotMeta.id] = null;
      toastFn(root, `已卸下「${item.name || id}」`);
      return true;
    }
    const prevId = state.accountGear[slotMeta.id];
    state.accountGear[slotMeta.id] = id;
    if (prevId && prevId !== id) {
      const prev = itemByIdLookup()[prevId];
      toastFn(root, `已裝上「${item.name || id}」（換走「${(prev && prev.name) || prevId}」）`);
    } else {
      toastFn(root, `已裝上「${item.name || id}」`);
    }
    return true;
  }

  function albumTryStarUp(kind, id, toastFn, root) {
    albumEnsureState();
    let item = null;
    if (kind === "fighters") item = fighterById[id];
    else if (kind === "skills") item = skillById[id];
    else item = itemByIdLookup()[id];
    if (!item) {
      toastFn(root, "找不到這張卡");
      return;
    }
    const star = albumStarOf(kind, id, item);
    const maxS = albumMaxStar(kind, item);
    if (star >= maxS) {
      toastFn(root, "已滿星");
      return;
    }
    const need = albumStarNeed(star);
    const n = albumCardCount(id);
    if (n < need) {
      toastFn(root, `同名卡不足（${n}／${need}）`);
      return;
    }
    // 扣 need 張，保留 1 張作為升星後本體（n - need + 1）
    albumSetCount(id, n - need + 1);
    if (kind === "fighters") state.fighterStars[id] = star + 1;
    else if (kind === "skills") state.skillStars[id] = star + 1;
    else {
      state.equipStars[id] = star + 1;
      bumpEquipStar(1);
    }
    toastFn(root, `「${item.name}」升星 → ★${star + 1}`);
    render();
  }

  function viewAlbum(root) {
    albumEnsureState();
    const tab = state.albumTab;
    const entries = albumFilteredEntries();
    const tabLabel =
      tab === "skills" ? "技能卡" : tab === "gear" ? "裝備卡" : "戰鬥卡";

    const hasQueryOrFilter = !!(String(state.albumQuery || "").trim() || state.albumFilterRarity);
    const emptyMsg = hasQueryOrFilter ? "此頁尚無已擁有卡" : "未持有任何卡";
    const cells = entries
      .map((e) => {
        const count = albumCardCount(e.id);
        const star = albumStarOf(e.kind, e.id, e.item);
        const maxS = albumMaxStar(e.kind, e.item);
        const rareCls = albumRarityClass(e.kind, e.item);
        const lvBadge =
          e.kind === "fighters"
            ? `<span class="album-cell-lv">Lv.${fighterLevelOf(e.id)}</span>`
            : "";
        // 只列已擁有；點擊卡圖／整格開詳情（唔掛 data-help，避免長按擋住 click）
        /*
         * t393：橫圖卡（例：C255 雙節棍 16:9）喺 1:1 格用 cover 會切走主體，
         * 改為 contain（CSS `.album-cell-art img.art-landscape`）。
         */
        const isLandscape = !!(e.item && e.item.art_landscape);
        const artHtml = albumArtHtml(e.art, e.name, null, e.kind);
        return `<button type="button" class="album-cell ${rareCls}" data-album-id="${esc(e.id)}" data-album-kind="${esc(e.kind)}" aria-label="${esc(e.name)} x${count}">
          <div class="album-cell-art" data-album-open="1">${isLandscape ? artHtml.replace("<img ", '<img class="art-landscape" ') : artHtml}${lvBadge}<div class="album-cell-stars">${albumStarsHtml(star, Math.min(maxS, 5))}</div></div>
          <div class="album-cell-name">${esc(e.name)} <span class="album-qty">x${count}</span></div>
        </button>`;
      })
      .join("");

    const filterLabel = state.albumFilterRarity
      ? `篩選：${state.albumFilterRarity}`
      : "篩選";

    const detailHtml =
      state.albumDetailId && state.albumDetailKind
        ? `<div class="album-mask" id="album-mask">${albumDetailBodyHtml(state.albumDetailKind, state.albumDetailId)}</div>`
        : "";

    root.innerHTML = `
      <div class="album-screen">
        <header class="album-head">
          <h1 class="album-title">卡冊</h1>
          <button type="button" class="album-close" id="btn-album-back" aria-label="返主頁">×</button>
        </header>
        <nav class="album-tabs" role="tablist">
          <button type="button" class="album-tab coming" id="album-tab-talent" disabled title="未開放">天賦 · 未開放</button>
          <button type="button" class="album-tab${tab === "fighters" ? " on" : ""}" data-album-tab="fighters" role="tab" aria-selected="${tab === "fighters"}">戰鬥卡</button>
          <button type="button" class="album-tab${tab === "skills" ? " on" : ""}" data-album-tab="skills" role="tab" aria-selected="${tab === "skills"}">技能卡</button>
          <button type="button" class="album-tab${tab === "gear" ? " on" : ""}" data-album-tab="gear" role="tab" aria-selected="${tab === "gear"}">裝備卡</button>
        </nav>
        <div class="album-search-row">
          <input type="search" class="album-search" id="album-search" placeholder="搜尋${esc(tabLabel)}…" value="${esc(state.albumQuery || "")}" autocomplete="off" />
          <button type="button" class="album-filter-btn" id="album-filter" title="${esc(filterLabel)}">${esc(filterLabel)}</button>
        </div>
        ${/* t390：戰鬥卡殘頁入口（只喺戰鬥卡 tab 顯示） */""}
        ${tab === "fighters" ? shardBannerHtml() : ""}
        <div class="album-grid-wrap">
          <div class="album-grid" id="album-grid">${cells || `<div class="album-empty">${esc(emptyMsg)}</div>`}</div>
        </div>
      </div>
      ${detailHtml}
      <div id="album-toast" class="prep-toast" hidden></div>
    `;

    const toast = (r, msg) => {
      const el = $("#album-toast", r);
      if (!el) return;
      el.hidden = false;
      el.textContent = msg;
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        el.hidden = true;
      }, 1600);
    };

    $("#btn-album-back", root).onclick = () => {
      state.albumDetailId = null;
      state.albumDetailKind = null;
      state.screen = "home";
      render();
    };
    /* t390：殘頁橫幅 */
    wireShardPanel(root, toast);

    root.querySelectorAll("[data-album-tab]").forEach((btn) => {
      btn.onclick = () => {
        state.albumTab = btn.getAttribute("data-album-tab");
        state.albumDetailId = null;
        state.albumDetailKind = null;
        state.albumPage = 0;
        render();
      };
    });

    const talent = $("#album-tab-talent", root);
    if (talent) {
      talent.onclick = () => toast(root, "天賦尚未開放");
    }

    const search = $("#album-search", root);
    if (search) {
      search.oninput = () => {
        state.albumQuery = search.value || "";
        // 唔成個 render，只刷新 grid，保留 focus
        const wrap = $("#album-grid", root);
        if (!wrap) return;
        // 輕量：仍全量 render 但還原 focus／caret
        const pos = search.selectionStart;
        render();
        const again = document.querySelector("#album-search");
        if (again) {
          again.focus();
          try {
            again.setSelectionRange(pos, pos);
          } catch (_) {}
        }
      };
    }

    const filterBtn = $("#album-filter", root);
    if (filterBtn) {
      filterBtn.onclick = () => {
        const cur = state.albumFilterRarity;
        const idx = ALBUM_FILTER_CYCLE.indexOf(cur);
        const next = ALBUM_FILTER_CYCLE[(idx + 1) % ALBUM_FILTER_CYCLE.length];
        state.albumFilterRarity = next;
        toast(root, next ? `篩選：${next}` : "篩選：全部");
        render();
      };
    }

    const openAlbumDetail = (id, kind) => {
      if (!id || !kind) return;
      state.albumDetailId = id;
      state.albumDetailKind = kind;
      render();
    };
    // 點擊卡牌圖片（.album-cell-art）或整格 → 開詳情／升星 modal
    root.querySelectorAll(".album-cell[data-album-id]").forEach((btn) => {
      const id = btn.getAttribute("data-album-id");
      const kind = btn.getAttribute("data-album-kind");
      btn.onclick = () => openAlbumDetail(id, kind);
      const art = btn.querySelector(".album-cell-art");
      if (art) {
        art.onclick = (ev) => {
          ev.stopPropagation();
          openAlbumDetail(id, kind);
        };
      }
    });

    const mask = $("#album-mask", root);
    if (mask) {
      mask.onclick = (ev) => {
        if (ev.target === mask) {
          state.albumDetailId = null;
          state.albumDetailKind = null;
          render();
        }
      };
      const x = $("#album-detail-x", root);
      if (x) {
        x.onclick = (ev) => {
          ev.stopPropagation();
          state.albumDetailId = null;
          state.albumDetailKind = null;
          render();
        };
      }
      const sheet = mask.querySelector(".album-detail-sheet");
      if (sheet) sheet.onclick = (ev) => ev.stopPropagation();
      /* t400：裝備裝上／卸下 */
      const gearBtn = $("#album-btn-gear", root);
      if (gearBtn) {
        gearBtn.onclick = (ev) => {
          ev.stopPropagation();
          const gid = state.albumDetailId;
          if (gid && albumToggleGearEquip(gid, toast, root)) render();
        };
      }
      const up = $("#album-btn-starup", root);
      if (up) {
        up.onclick = (ev) => {
          ev.stopPropagation();
          albumTryStarUp(state.albumDetailKind, state.albumDetailId, toast, root);
        };
      }
    }
  }

  function viewTeam(root) { viewPrep(root); }
  function viewEquip(root) { viewPrep(root); }

  function viewOrigin(root) {
    const cards = ORIGINS.map((o) => {
      const art = o.art || "assets/events/ev-alley-wake.jpg";
      /*
       * t386：身世卡唔再顯示「增益／減益」標籤、唔再顯示數值 blurb、
       * 亦唔再用綠／紅邊暗示好壞。四張一律同色，玩家睇故事自己判斷。
       */
      return `
      <button type="button" class="event-card fate-card origin-card" data-oid="${esc(o.id)}" data-help="origin-pick" aria-label="${esc(o.name)}">
        <span class="ev-cat-pill cat-default"><i class="ev-cat-dot" aria-hidden="true"></i>身世</span>
        <img src="${esc(art)}" alt="${esc(o.name)}" />
        <div class="label">
          <div class="ev-name">${esc(o.name)}</div>
          <div class="ev-rewards"><span class="ev-reward fate-blurb-line">${esc(o.flavor || o.blurb || "")}</span></div>
        </div>
      </button>`;
    }).join("");
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("選擇身世")}</div>
      <div class="speed-strip"></div>
      <p class="sub">進人生第一年 · 預設 ${state.age | 0} 歲 · 四揀一 · 揀完先見後果</p>
      <div class="event-grid origin-grid pick-4-grid">${cards}</div>
      <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      ${storyDockHtml()}
    `;
    root.querySelectorAll(".origin-card").forEach((btn) => {
      btn.onclick = () => {
        const oid = btn.dataset.oid;
        state.originId = oid;
        state.attrs = defaultAttrs();
        const og = originById[oid];
        if (og && og.attrs) {
          Object.keys(og.attrs).forEach((k) => {
            state.attrs[k] = (state.attrs[k] || 0) + (og.attrs[k] || 0);
          });
        }
        // 統率變咗：口袋唔准超
        if (state.team.length > pocketCap()) {
          state.team = state.team.slice(0, pocketCap());
        }
        state.fatePicks = [];
        state.fateYearIndex = 0;
        state.fateBattleBonus = { atk: 0, def: 0, hp: 0 };
        state.yearEventOffer = [];
        state.yearEventYear = 0;
        state.softNote = "";
        rollFateOffer();
        state.screen = "fate";
        render();
      };
    });
    // 已準備出發入身世＝入咗人生；唔准返 prep（t265）
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }


  function viewFate(root) {
    if (!(state.fateOffer && state.fateOffer.length === FATE_OFFER_SIZE)) {
      state.fateOffer = normalizeFateOffer(state.fateOffer);
    }
    const n = Math.min(3, (state.fateYearIndex | 0) + 1);
    const cards = (state.fateOffer || []).map((fid) => {
      const f = fateById[fid] || { id: fid, name: fid, blurb: "", kind: "mixed" };
      const art = (f.art) || fateArt(f);
      /*
       * t386：命運卡唔再標「增益／減益／混合」，唔再用綠／紅／金邊暗示好壞，
       * blurb 亦唔再寫「敏捷直接＋2」呢類結果。四張一律同色，睇故事自己判斷。
       */
      return `
      <button type="button" class="event-card fate-card" data-fid="${esc(f.id)}" data-help="fate-pick" aria-label="${esc(f.name)}">
        <span class="ev-cat-pill cat-default"><i class="ev-cat-dot" aria-hidden="true"></i>命運</span>
        <img src="${esc(art)}" alt="${esc(f.name)}" />
        <div class="label">
          <div class="ev-name">${esc(f.name)}</div>
          <div class="ev-rewards"><span class="ev-reward fate-blurb-line">${esc(fateFlavorText(f))}</span></div>
        </div>
      </button>`;
    }).join("");
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("人生命運")}</div>
      <div class="speed-strip"></div>
      <p class="sub">第${n}／3年 · 四揀一 · 揀完先見後果</p>
      <div class="event-grid fate-grid pick-4-grid">${cards}</div>
      <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      ${storyDockHtml()}
    `;
    root.querySelectorAll(".fate-card").forEach((btn) => {
      btn.onclick = () => {
        const fid = btn.dataset.fid;
        const f = fateById[fid];
        if (!f) return;
        applyFate(f);
        if (!state.fatePicks.includes(fid)) state.fatePicks.push(fid);
        state.fateYearIndex = (state.fateYearIndex | 0) + 1;
        advanceYear();
        if ((state.fateYearIndex | 0) < 3) {
          rollFateOffer();
          state.screen = "fate";
        } else {
          state.fateOffer = [];
          state.screen = "events";
        }
        render();
      };
    });
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }


  /** 遇敵場出戰預覽：六維＋帳號裝備＋命運暫存＋卡等級／升星加成 */
  function fighterPreviewStats(f) {
    if (!f) return { atk: 0, def: 0, matk: 0, spd: 0, hp: 1, level: 1 };
    const bonus = accountGearBonus();
    const a = state.attrs || defaultAttrs();
    ensureFateBattleBonus();
    const fb = state.fateBattleBonus || { atk: 0, def: 0, hp: 0 };
    const og = state.originId ? originById[state.originId] : null;
    const originAtk = (og && og.bonus_atk) ? og.bonus_atk : 0;
    const grow = fighterGrowthBonus(f.id);
    const level = fighterLevelOf(f.id);
    const atk = (f.atk | 0) + (bonus.atk || 0) + originAtk + (a.str | 0) + (fb.atk | 0) + (grow.atk | 0);
    const def = (bonus.def || 0) + (a.agi | 0) + (fb.def | 0);
    const matk = (a.intel | 0);
    const spd = (f.spd | 0) + (bonus.spd || 0);
    const hp = Math.max(1, fighterHp(f) + (bonus.hp || 0) + (fb.hp | 0) + (a.str | 0) * 5 + (a.intel | 0) * 5 + (grow.hp | 0));
    return { atk, def, matk, spd, hp, level, growAtk: grow.atk | 0, growHp: grow.hp | 0 };
  }

  function deploySlotIndexOf(fid) {
    if (!fid || !Array.isArray(state.deploy)) return -1;
    for (let i = 0; i < TEAM_SIZE; i++) {
      if (state.deploy[i] === fid) return i;
    }
    return -1;
  }

  /** 槽位對齊的可出戰名單：離隊、陣亡、重複的格留空 */
  function livingDeploySlots(list) {
    const next = [];
    const used = new Set();
    const src = Array.isArray(list) ? list : [];
    const team = state.team || [];
    for (let i = 0; i < TEAM_SIZE; i++) {
      const id = src[i] || null;
      const ok = id && fighterById[id] && team.includes(id) && !isDeadFighter(id) && !used.has(id);
      if (ok) {
        next[i] = id;
        used.add(id);
      } else {
        next[i] = null;
      }
    }
    return next;
  }

  function applyRememberedDeploy() {
    const next = livingDeploySlots(state.lastWinDeploy);
    if (!next.some(Boolean)) return false;
    state.deploy = next;
    return true;
  }

  /** 上次上場有空位（陣亡／離隊），而口袋仍有未上場的卡 → 交由玩家自己決定補位 */
  function deployNeedsPlayerPick() {
    const cur = state.deploy || [];
    let emptySlots = 0;
    for (let i = 0; i < TEAM_SIZE; i++) {
      if (!cur[i] || !fighterById[cur[i]] || isDeadFighter(cur[i])) emptySlots += 1;
    }
    if (!emptySlots) return false;
    const used = new Set(cur.filter(Boolean));
    const spares = (state.team || []).filter(
      (id) => id && fighterById[id] && !isDeadFighter(id) && !used.has(id)
    );
    return spares.length > 0;
  }

  function setDeploySlot(slot, fid) {
    const next = [];
    for (let i = 0; i < TEAM_SIZE; i++) next[i] = state.deploy[i] || null;
    if (fid) {
      for (let i = 0; i < TEAM_SIZE; i++) {
        if (next[i] === fid) next[i] = null;
      }
      next[slot] = fid;
    } else {
      next[slot] = null;
    }
    state.deploy = next;
  }

  function viewEncounter(root) {
    const ev = state.selectedEvent;
    if (!Array.isArray(state.deploy)) state.deploy = [];
    ensureDefaultLoadout(false);
    ensureLoadoutShape();
    const primary = enemyById[ev.battle];
    const roster = encounterEnemyRoster(ev);
    const previewCards = roster
      .map((e) => {
        const hp = e.maxHp != null ? e.maxHp : (e.hp | 0);
        const helpE = enemyHelpText(e);
        return `
        <div class="enemy-preview-card has-help" data-help="enemy-card" data-help-rich="enemy" data-help-payload="${enemyHelpPayloadAttr(e)}" data-help-text="${helpTextAttr(helpE)}" role="button" tabindex="0" aria-label="${esc(e.name)}（長按查看內容）">
          <img src="${esc(e.art)}" alt="${esc(e.name)}" />
          <div class="ep-hp"><i style="width:100%"></i><span>${hp}/${hp}</span></div>
          <div class="ep-name">${esc(e.name)}</div>
        </div>`;
      })
      .join("");

    const slots = [];
    for (let i = 0; i < TEAM_SIZE; i++) {
      const fid = state.deploy[i] || null;
      const f = fid ? fighterById[fid] : null;
      if (f && !isDeadFighter(fid)) {
        const pv = fighterPreviewStats(f);
        const helpD = fighterHelpText(f, { preview: pv });
        slots.push(`<button type="button" class="deploy-slot filled" data-slot="${i}" data-fid="${esc(f.id)}" data-help="deploy-slot" data-help-rich="fighter" data-help-fid="${esc(f.id)}" data-help-text="${helpTextAttr(helpD)}" aria-label="${esc(f.name)} Lv.${pv.level}">
          <img src="${esc(f.art)}" alt="${esc(f.name)}" />
          <span class="ds-lv">Lv.${pv.level}</span>
          <span class="ds-hp"><i style="width:100%"></i><b>${pv.hp}/${pv.hp}</b></span>
          <span class="ds-name">${esc(f.name)}</span>
        </button>`);
      } else {
        slots.push(`<button type="button" class="deploy-slot empty" data-slot="${i}" data-help="deploy-slot" data-help-text="${helpTextAttr("＋揀出戰卡")}" aria-label="出戰位 ${i + 1}">
          <span class="ds-plus">＋</span>
        </button>`);
      }
    }

    const canFight = state.deploy.filter((id) => id && !isDeadFighter(id)).length >= 1;

    let allyModal = "";
    if (state.selectAllySlot != null) {
      const slot = state.selectAllySlot | 0;
      const occupied = new Set(state.deploy.filter(Boolean));
      const cur = state.deploy[slot] || null;
      /*
       * t397：選卡來源由「只有隊伍」擴闊到「隊伍 + 卡冊已擁有」。
       *
       * 舊行為：只列 `state.team`。當統率已滿、新拿到的卡只入卡冊，
       * 玩家喺開戰前嘅編隊頁完全揀唔到佢 → 「拿到但用唔到」。
       *
       * 新行為：列出所有「已擁有且未陣亡」的戰鬥卡。
       * 揀咗之後若果唔在 team 內，會自動加入 team（統率有上限，滿了會提示）。
       */
      const ownedIds = (DATA.fighters || [])
        .filter((f) => f && f.id && albumCardCount(f.id) > 0)
        .map((f) => f.id);
      const teamIds = (state.team || []).filter((id) => fighterById[id]);
      const allIds = [];
      const seenId = new Set();
      /* 隊伍優先（維持原本次序），之後補卡冊其他卡 */
      teamIds.concat(ownedIds).forEach((id) => {
        if (!id || seenId.has(id)) return;
        seenId.add(id);
        allIds.push(id);
      });
      const choices = allIds
        .filter((id) => !isDeadFighter(id) && fighterById[id])
        .filter((id) => id === cur || !occupied.has(id));
      const grid = choices
        .map((id) => {
          const f = fighterById[id];
          const isCur = id === cur;
          const slang = f.rarity_slang || f.rarity || "";
          const stars = "★".repeat(Math.min(5, Math.max(1, (f.slots | 0) - 2)));
          const helpA = fighterHelpText(f);
          return `<div class="ally-pick${isCur ? " cur" : ""}" data-fid="${esc(id)}">
            <button type="button" class="ap-face" data-fid="${esc(id)}" data-help="ally-face" data-help-rich="fighter" data-help-fid="${esc(id)}" data-help-text="${helpTextAttr(helpA)}" aria-label="詳情 ${esc(f.name)}">
              <img src="${esc(f.art)}" alt="${esc(f.name)}" />
              <span class="ap-stars">${stars}</span>
              <span class="ap-name">${esc(f.name)}</span>
              ${slang ? `<span class="ap-slang">${esc(slang)}</span>` : ""}
            </button>
            <button type="button" class="ap-act${isCur ? " cancel" : ""}" data-fid="${esc(id)}" data-act="${isCur ? "cancel" : "pick"}">${isCur ? "取消" : "選擇"}</button>
          </div>`;
        })
        .join("") || `<p class="ally-empty">口袋沒有可用出戰卡</p>`;
      allyModal = `
        <div class="modal-mask ally-mask" id="ally-mask" role="dialog" aria-modal="true" aria-label="選擇出戰卡">
          <div class="modal-sheet ally-sheet" id="ally-sheet">
            <div class="modal-title">選擇出戰卡</div>
            <div class="ally-grid">${grid}</div>
            <p class="modal-hint">點擊彈窗以外的任意位置，可以關閉彈窗</p>
          </div>
        </div>`;
    }

    let detailModal = "";
    if (state.fighterDetailId) {
      const id = state.fighterDetailId;
      const f = fighterById[id];
      if (f) {
        const pv = fighterPreviewStats(f);
        const slang = f.rarity_slang || f.rarity || "";
        const albumStar = albumFighterStar(id);
        const stars = "★".repeat(Math.min(ALBUM_MAX_STAR, Math.max(1, albumStar)));
        const cap = raritySlots(f);
        let load = state.loadout[id] || [];
        load = Array.from({ length: cap }, (_, i) => load[i] || null);
        state.loadout[id] = load;
        const depIdx = deploySlotIndexOf(id);
        const deployed = depIdx >= 0;

        const skillCells = [];
        // fixed: basic
        {
          const basicName = f.basic || "普通攻擊";
          const bpTag = basicPowerTagLabel(f);
          const skBasic = (DATA.skills || []).find((s) => s && s.name === basicName);
          const helpB = skBasic
            ? skillHelpText(Object.assign({}, skBasic, { kind: skBasic.kind || bpTag }))
            : `「${basicName}」\n${bpTag}｜首通\n${f.name || ""} 的基本出手。`;
          skillCells.push(`<div class="fd-skill fixed" data-help="fd-skill" data-help-text="${helpTextAttr(helpB)}" title="${esc(bpTag)}">
          <span class="fds-ico">${fixedSlotIcoHtml(basicName, f.art)}</span>
          <span class="fds-name">${esc(basicName)}</span>
          <span class="fds-tag">${esc(bpTag)}</span>
        </div>`);
        }
        // fixed: innate skill
        if (f.skill) {
          const innTag = innatePowerTagLabel(f);
          const skInn = (DATA.skills || []).find((s) => s && s.name === f.skill);
          const settleSrc = Object.assign({}, f, { power: resolveInnatePower(f) });
          const helpInn = skInn
            ? skillHelpText(Object.assign({}, skInn, {
                kind: skInn.kind || innTag,
                effect: skInn.effect || f.skill_effect || "",
                cd: skInn.cd != null ? skInn.cd : f.skill_cd,
                flavor: skInn.flavor || skInn.blurb || f.flavor || f.blurb || "",
                blurb: skInn.blurb || skInn.flavor || f.flavor || f.blurb || "",
              }))
            : `「${f.skill}」\n${innTag}${f.skill_cd != null ? "｜CD " + f.skill_cd : ""}\n${f.skill_effect ? "效果：" + f.skill_effect + "\n" : ""}結算：${skillCombatSummary(settleSrc)}\n${f.flavor || f.blurb || ""}`.trim();
          skillCells.push(`<div class="fd-skill fixed innate" data-help="fd-skill" data-help-text="${helpTextAttr(helpInn)}" title="${esc(f.skill)}">
            <span class="fds-ico">${fixedSlotIcoHtml(f.skill, f.art)}</span>
            <span class="fds-name">${esc(f.skill)}</span>
            <span class="fds-tag">${esc(innTag)}</span>
          </div>`);
        }
        // loadout slots
        for (let si = 0; si < cap; si++) {
          const sid = load[si];
          const sk = sid ? skillById[sid] : null;
          if (sk) {
            // 掛 data-help 顯示內容；wireLongPressHelp 對 .fds-off 唔 arm，卸下仍可用
            skillCells.push(`<div class="fd-skill filled" data-slot="${si}" data-help="fd-skill" data-help-text="${helpTextAttr(skillHelpText(sk))}" title="${esc(sk.name)}">
              <span class="fds-ico">${sk.art ? `<img src="${esc(sk.art)}" alt="" />` : "技"}</span>
              <span class="fds-name">${esc(sk.name)}</span>
              <button type="button" class="fds-off" data-unequip="${si}">卸下</button>
            </div>`);
          } else {
            skillCells.push(`<button type="button" class="fd-skill empty" data-add-slot="${si}" data-help="fd-skill" data-help-text="${helpTextAttr("＋裝技能")}" aria-label="裝技">
              <span class="fds-plus">＋</span>
            </button>`);
          }
        }

        let skillPickModal = "";
        if (state.detailSkillPick != null) {
          const pickSlot = state.detailSkillPick | 0;
          const equipped = new Set(loadoutIds(id));
          // 池：今世 lifeSkills、未燒、此卡未裝；持有張數>0 可見；其他卡已裝 → 鎖定（同場不可重複）
          const pool = openPocketSkills()
            .filter((sk) => !isBurnedSkill(sk.id) && !equipped.has(sk.id) && skillOwnedCopies(sk.id) > 0)
            .filter((sk) => skillCompatible(f, sk))
            .sort((a, b) => {
              const fa = skillFieldTaken(a.id, id) ? 1 : 0;
              const fb = skillFieldTaken(b.id, id) ? 1 : 0;
              return fa - fb || String(a.name || "").localeCompare(String(b.name || ""), "zh");
            });
          const rows = pool.length
            ? pool.slice(0, 24).map((sk) => {
                const locked = skillFieldTaken(sk.id, id);
                const onName = locked ? skillEquippedOnName(sk.id, id) : null;
                const ico = sk.art ? `<img src="${esc(sk.art)}" alt="" />` : `<span class="fd-pool-glyph">技</span>`;
                const note = locked
                  ? `<small class="fd-pool-note">已鎖定 · 同場不可重複 · 裝於「${esc(onName || "其他出戰卡")}」</small>`
                  : "";
                if (locked) {
                  return `
                <div class="fd-pool-item locked" data-help="fd-pool" data-help-text="${helpTextAttr(skillHelpText(sk))}" aria-disabled="true">
                  ${ico}
                  <span>${esc(sk.name)}</span>
                  ${note}
                </div>`;
                }
                return `
                <button type="button" class="fd-pool-item" data-equip-sid="${esc(sk.id)}" data-equip-slot="${pickSlot}" data-help="fd-pool" data-help-text="${helpTextAttr(skillHelpText(sk))}">
                  ${ico}
                  <span>${esc(sk.name)}</span>
                </button>`;
              }).join("")
            : `<p class="ally-empty">沒有可裝技能</p>`;
          // t292：另開揀技彈窗，唔塞喺出戰詳情底部
          skillPickModal = `
          <div class="modal-mask skill-pick-mask" id="skill-pick-mask" role="dialog" aria-modal="true" aria-label="揀技能裝上">
            <div class="modal-sheet skill-pick-sheet" id="fd-skill-pick">
              <div class="modal-title">揀技能裝上</div>
              <p class="modal-hint fd-sp-sub">裝去「${esc(f.name)}」</p>
              <p class="modal-hint fd-sp-lock-hint">同一技能同場只能裝在一張出戰卡（即使持有複本亦不可分裝上陣）。</p>
              <div class="fd-pool">${rows}</div>
              <button type="button" class="btn ghost sm" id="fd-sp-cancel">關閉</button>
              <p class="modal-hint">點擊彈窗以外的任意位置，可以關閉彈窗</p>
            </div>
          </div>`;
        }

        detailModal = `
        <div class="modal-mask detail-mask" id="detail-mask" role="dialog" aria-modal="true" aria-label="出戰卡詳情">
          <div class="modal-sheet fighter-detail" id="fighter-detail">
            <div class="fd-head">
              <span class="fd-pill">出戰卡</span>
              <span class="fd-title">${esc(f.name)}</span>
              <span class="fd-lv">Lv.${pv.level}</span>
              <span class="fd-stars">${stars}${slang ? " · " + esc(slang) : ""}</span>
            </div>
            <div class="fd-body">
              <img class="fd-art" src="${esc(f.art)}" alt="${esc(f.name)}" />
              <div class="fd-stats">
                <span><b>攻</b>${pv.atk}</span>
                <span><b>物防</b>${pv.def}</span>
                <span><b>魔攻</b>${pv.matk}</span>
                <span><b>速</b>${pv.spd}</span>
                <span><b>HP</b>${pv.hp}</span>
                ${(pv.growAtk | 0) || (pv.growHp | 0) ? `<span class="fd-grow">成長 攻+${pv.growAtk | 0} 血+${pv.growHp | 0}</span>` : ""}
              </div>
            </div>
            <div class="fd-skills" aria-label="技能欄">${skillCells.join("")}</div>
            <button type="button" class="btn cyan" id="fd-undeploy" ${deployed ? "" : "disabled"}>${deployed ? "卸下" : "未出戰"}</button>
            <p class="modal-hint">點擊彈窗以外的任意位置，可以關閉彈窗</p>
          </div>
        </div>`;
        // attach pick modal after detail (higher z)
        detailModal += skillPickModal;
      }
    }

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name || "遇敵"))}</div>
      <div class="encounter-stage">
        <div class="enemy-preview multi">
          <div class="enemy-preview-row">${previewCards}</div>
        </div>
        <button class="btn gold enc-fight" id="btn-fight" data-help="btn-fight" ${canFight ? "" : "disabled"}>開始戰鬥</button>
        <div class="deploy-row" aria-label="出戰位">${slots.join("")}</div>
        ${/*
           * t396：一律顯示「可換卡」提示（唔再只在需要補位時才講）。
           * 之前只有 deployNeedsPlayerPick() 為 true 才顯示，令「沿用上次陣容」時
           * 玩家完全唔知自己可以換卡。
           */""}
        ${(() => {
          const needPick = deployNeedsPlayerPick();
          if (needPick && state.deployHint) {
            return `<p class="modal-hint deploy-hint" role="status">${esc(state.deployHint)}</p>`;
          }
          return `<p class="modal-hint deploy-hint" role="status">可換卡：點下面任何一格改出場陣容。預設已沿用上次未陣亡嘅卡。</p>`;
        })()}
      </div>
      <button class="btn ghost enc-back" id="btn-back" data-help="btn-back">放棄，重新開始！</button>
      ${allyModal}
      ${detailModal}
      ${storyDockHtml()}
    `;

    root.querySelectorAll(".deploy-slot").forEach((btn) => {
      btn.onclick = () => {
        const slot = Number(btn.dataset.slot);
        state.selectAllySlot = slot;
        state.fighterDetailId = null;
        state.detailSkillPick = null;
        render();
      };
    });

    $("#btn-fight", root).onclick = () => startBattle();
    $("#btn-back", root).onclick = () => {
      state.deploy = [];
      state.deployHint = "";
      state.selectAllySlot = null;
      state.fighterDetailId = null;
      state.detailSkillPick = null;
      state.screen = "events";
      render();
    };

    const mask = $("#ally-mask", root);
    if (mask) {
      mask.onclick = (e) => {
        if (e.target !== mask) return;
        if (state.fighterDetailId) return;
        state.selectAllySlot = null;
        state.detailSkillPick = null;
        render();
      };
      root.querySelectorAll(".ap-face").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          state.fighterDetailId = btn.dataset.fid;
          state.detailSkillPick = null;
          render();
        };
      });
      root.querySelectorAll(".ap-act").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const slot = state.selectAllySlot | 0;
          const fid = btn.dataset.fid;
          const act = btn.dataset.act;
          if (act === "cancel") {
            setDeploySlot(slot, null);
          } else {
            /*
             * t397：由卡冊揀卡時，如果佢仍未在 team 內，自動加入。
             * 否則 `pruneUnownedRefs` / 隊伍檢查會令部署無效。
             * 統率已滿就唔加入（但仍然可以出戰，因為佢已擁有）——
             * 提示交由 deployHint 講清楚。
             */
            if (fid && !(state.team || []).includes(fid) && fighterById[fid]) {
              const cap = fighterPocketCap();
              if ((state.team || []).length < cap) {
                state.team.push(fid);
                if (!state.loadout[fid]) state.loadout[fid] = [];
              }
            }
            setDeploySlot(slot, fid);
          }
          state.selectAllySlot = null;
          state.fighterDetailId = null;
          state.detailSkillPick = null;
          render();
        };
      });
    }

    const dmask = $("#detail-mask", root);
    if (dmask) {
      dmask.onclick = (e) => {
        if (e.target !== dmask) return;
        state.fighterDetailId = null;
        state.detailSkillPick = null;
        render();
      };
      const und = $("#fd-undeploy", root);
      if (und) {
        und.onclick = () => {
          const id = state.fighterDetailId;
          const idx = deploySlotIndexOf(id);
          if (idx < 0) return;
          setDeploySlot(idx, null);
          state.fighterDetailId = null;
          state.detailSkillPick = null;
          render();
        };
      }
      root.querySelectorAll("[data-unequip]").forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          const id = state.fighterDetailId;
          if (!id) return;
          const si = Number(btn.dataset.unequip);
          const f = fighterById[id];
          const cap = raritySlots(f);
          const display = Array.from({ length: cap }, (_, i) => (state.loadout[id] || [])[i] || null);
          display[si] = null;
          state.loadout[id] = display;
          if (!state.loadoutInited) state.loadoutInited = {};
          state.loadoutInited[id] = true; // 卸到空都唔好再 auto-fill
          state.detailSkillPick = null;
          render();
        };
      });
      root.querySelectorAll("[data-add-slot]").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          state.detailSkillPick = Number(btn.dataset.addSlot);
          render();
        };
      });
      // 出戰詳情：撳 普攻／自帶／已裝技 顯示內容（唔開空＋格；唔擋卸下）
      root.querySelectorAll(".fighter-detail .fd-skill.fixed, .fighter-detail .fd-skill.filled").forEach((el) => {
        el.addEventListener("click", (e) => {
          if (e.target && e.target.closest && e.target.closest(".fds-off,[data-unequip]")) return;
          if (Date.now() < helpBlockClickUntil) return;
          const text = (el.getAttribute("data-help-text") || "").trim();
          if (!text) return;
          e.stopPropagation();
          showHelpTip(el, text);
        });
      });
    }

    // t292：獨立揀技彈窗
    const spMask = $("#skill-pick-mask", root);
    if (spMask) {
      spMask.onclick = (e) => {
        if (e.target !== spMask) return;
        state.detailSkillPick = null;
        render();
      };
      const spCancel = $("#fd-sp-cancel", root);
      if (spCancel) {
        spCancel.onclick = (e) => {
          e.stopPropagation();
          state.detailSkillPick = null;
          render();
        };
      }
      root.querySelectorAll("[data-equip-sid]").forEach((btn) => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const id = state.fighterDetailId;
          const sid = btn.dataset.equipSid;
          const slot = Number(btn.dataset.equipSlot);
          if (isBurnedSkill(sid)) return;
          if (skillFieldTaken(sid, id)) return;
          claimSkillForFighter(id, sid, slot);
          state.detailSkillPick = null;
          render();
        };
      });
    }
    wireStoryDock(root);
  }

  /** 戰鬥速度只接受 1／2／4；其他值回 1 */
  function normalizeBattleSpeed(v) {
    const n = v | 0;
    return (n === 2 || n === 4) ? n : 1;
  }

  function speedButtonLabel(speed) {
    return speed === 1
      ? (L["ui.speed2"] || "加速・兩倍")
      : speed === 2
        ? "再快・四倍"
        : "回復・一倍";
  }

  function applySpeedToButton() {
    const btn = document.getElementById("btn-speed");
    if (btn) btn.textContent = speedButtonLabel(state.speed);
    const spd = document.getElementById("b-spd");
    if (spd) spd.textContent = state.speed + "×";
  }

  function startBattle() {
    const deployIds = (state.deploy || []).filter((id) => id && !isDeadFighter(id));
    if (!deployIds.length) return;
    state.deployHint = "";
    state.battleFieldSnapshot = [];
    for (let i = 0; i < TEAM_SIZE; i++) {
      const id = (state.deploy || [])[i] || null;
      state.battleFieldSnapshot[i] = (id && deployIds.indexOf(id) >= 0) ? id : null;
    }
    const ev = state.selectedEvent;
    const enemyDef = enemyById[ev.battle];
    ensureDefaultLoadout(false);
    const bonus = accountGearBonus();
    const og = state.originId ? originById[state.originId] : null;
    const originAtk = (og && og.bonus_atk) ? og.bonus_atk : 0;
    const a = state.attrs || defaultAttrs();
    ensureFateBattleBonus();
    const fb = state.fateBattleBonus;
    // 六維套用（同 accountGearBonus 一齊）：力量→物攻+HP；敏捷→物防/魔防；智力→魔攻+HP
    // 每場重建單位＝滿血（戰鬥後生還者自動回滿；陣亡者唔入 team／deploy）
    const players = deployIds.map((id) => {
      const f = fighterById[id];
      const grow = fighterGrowthBonus(id);
      const hp = Math.max(1, fighterHp(f) + (bonus.hp || 0) + (fb.hp | 0) + (a.str | 0) * 5 + (a.intel | 0) * 5 + (grow.hp | 0));
      const equipped = loadoutIds(id)
        .map((sid) => skillById[sid])
        .filter(Boolean)
        .map((s) => ({
          id: s.id,
          name: s.name,
          cd: s.cd != null ? s.cd : f.skill_cd || 3,
          effect: s.effect || "",
          tags: skillTagsOf(s),
          art: s.art || skillArtByName(s.name) || null,
          dmg_mult: s.dmg_mult,
          hits: s.hits,
          target: s.target,
          power: s.power,
          splash_mult: s.splash_mult,
          heal_mult: s.heal_mult,
          support: s.support,
          passive: s.passive,
          execute_hp_pct: s.execute_hp_pct,
          execute_mult: s.execute_mult,
          hit_scales: s.hit_scales,
        }));
      return {
        side: "player",
        id: f.id,
        name: f.name,
        atk: f.atk + (bonus.atk || 0) + originAtk + (a.str | 0) + (fb.atk | 0) + (grow.atk | 0),
        matk: (a.intel | 0), // 魔攻：技能加成／顯示用
        level: fighterLevelOf(id),
        spd: f.spd + (bonus.spd || 0),
        def: (bonus.def || 0) + (a.agi | 0) + (fb.def | 0),
        mdef: (a.agi | 0),
        basic: f.basic,
        skill: f.skill,
        skill_cd: f.skill_cd || 3,
        skill_effect: f.skill_effect || "",
        dmg_mult: f.dmg_mult,
        hits: f.hits,
        target: f.target,
        power: resolveInnatePower(f),
        splash_mult: f.splash_mult,
        heal_mult: f.heal_mult,
        support: f.support,
        passive: f.passive,
        execute_hp_pct: f.execute_hp_pct,
        execute_mult: f.execute_mult,
        hit_scales: f.hit_scales,
        tags: f.tags || [],
        rarity_slang: f.rarity_slang || f.rarity || "",
        flavor: f.flavor || f.blurb || "",
        art: f.art,
        basic_power: fighterBasicPower(f),
        maxHp: hp,
        hp,
        turnsTaken: 0,
        skillCursor: 0,
        equipped,
        statuses: [],
        alive: true,
      };
    });
    const enemies = encounterEnemyRoster(ev);
    if (enemyDef && enemyDef.id === "E03") {
      players.forEach((p) => {
        p.spd = Math.max(1, p.spd - 1);
      });
    }
    // 沿用上次戰鬥揀好嘅速度（唔再每場重設做 1×）
    state.speed = normalizeBattleSpeed(state.speed);
    state.battle = {
      players,
      enemies,
      primaryEnemyId: ev.battle,
      turn: 0,
      running: true,
      paused: false,
      inspectOpen: false,
      timer: null,
      queue: [],
      // 幸運亦影響戰鬥結算魂焰（同軟事件公式）
      reward: listedEventSoul(ev),
      lastHit: null,
    };
    state.pendingDefeat = {
      eventId: (ev && ev.id) || null,
      eventName: (ev && ev.name) || "",
      enemyName: (enemyDef && enemyDef.name) || "",
      enemyArt: (enemyDef && enemyDef.art) || "",
      rewardBlurb: (ev && ev.reward_blurb) || "",
      year: state.year | 0,
    };
    state.screen = "battle";
    render();
    scheduleNext(380);
  }

  /* Web Audio — short hit thuds (no voice / no text) */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function sfxHit(skill) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(skill ? 180 : 120, t0);
    o.frequency.exponentialRampToValueAtTime(skill ? 55 : 40, t0 + 0.12);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(skill ? 0.22 : 0.14, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (skill ? 0.18 : 0.12));
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  function scheduleNext(baseMs) {
    const b = state.battle;
    if (!b || !b.running || b.paused) return;
    clearTimeout(b.timer);
    const ms = Math.max(70, (baseMs || 500) / state.speed);
    b.timer = setTimeout(() => battleTick(), ms);
  }

  function pauseBattle() {
    const b = state.battle;
    if (!b || !b.running) return;
    b.paused = true;
    clearTimeout(b.timer);
    b.timer = null;
  }

  function resumeBattle() {
    const b = state.battle;
    if (!b || !b.running) return;
    if (!b.paused) return;
    b.paused = false;
    scheduleNext(280);
  }

  /**
   * t399：安全恢復 —— 只在戰鬥狀態完整時才繼續推進。
   *
   * 問題：`resumeBattle()` 會 `scheduleNext(280)` 排一個 `battleTick`，
   * 而 `battleTick` 會讀 `b.queue.length`。若戰鬥物件被中途清空
   * （換畫面／舊存檔／測試注入的假物件），就會拋
   * `TypeError: Cannot read properties of undefined (reading 'length')`。
   */
  function resumeBattleSafe() {
    const b = state.battle;
    if (!b || !b.running) return;
    if (!b.paused) return;
    b.paused = false;
    if (!Array.isArray(b.queue) || !Array.isArray(b.players) || !Array.isArray(b.enemies)) return;
    scheduleNext(280);
  }

  function unitKey(u) {
    return u.side + ":" + u.id;
  }


  /** 技能戰鬥規格：讀 data 結構化欄位；文案缺失時合理默認 */
  function skillCombatSpec(src) {
    src = src || {};
    const cd = src.cd != null ? src.cd : src.skill_cd;
    const passive = !!(src.passive || cd === 0);
    let dmg_mult = src.dmg_mult != null ? Number(src.dmg_mult) : NaN;
    if (!isFinite(dmg_mult)) dmg_mult = passive ? 0 : 1.5;
    const hits = Math.max(1, (src.hits | 0) || 1);
    const target = src.target || "single";
    // 明確 power 優先；缺省時若有 basic_power（戰鬥卡自帶）fallback；裝備技卡無 basic_power → phys
    const power =
      src.power === "magic" || src.power === "phys"
        ? src.power
        : src.basic_power != null
          ? fighterBasicPower(src)
          : "phys";
    return {
      dmg_mult,
      hits,
      target,
      power,
      passive,
      heal_mult: src.heal_mult != null ? Number(src.heal_mult) : 0,
      splash_mult: src.splash_mult != null ? Number(src.splash_mult) : 0,
      support: !!src.support,
      execute_hp_pct: src.execute_hp_pct != null ? Number(src.execute_hp_pct) : null,
      execute_mult: src.execute_mult != null ? Number(src.execute_mult) : null,
      hit_scales: Array.isArray(src.hit_scales) ? src.hit_scales.map(Number) : null,
    };
  }

  function skillCombatSummary(specLike) {
    const spec = skillCombatSpec(specLike);
    if (spec.passive) return "常駐被動（開場生效，不進入主動輪轉）";
    const bits = [];
    const pow = spec.power === "magic" ? "魔攻" : "物攻";
    if (spec.heal_mult > 0) {
      const tgt =
        spec.target === "allies" ? "全隊" : spec.target === "ally" ? "友軍" : "自己";
      bits.push(`治療 ${pow}×${spec.heal_mult}（${tgt}）`);
    }
    if (spec.dmg_mult > 0) {
      const tgtMap = {
        single: "單體",
        front: "最前敵",
        aoe: "敵全體",
        lowest: "血量最低",
        highest: "血量最高",
        self: "自己",
        ally: "友軍",
        allies: "全隊",
      };
      if (spec.hit_scales && spec.hit_scales.length) {
        bits.push(
          `傷害 ${spec.hit_scales.map((x) => pow + "×" + x).join("＋")} · ${tgtMap[spec.target] || spec.target}`
        );
      } else {
        const hitBit = spec.hits > 1 ? `×${spec.hits}下` : "";
        bits.push(`傷害 ${pow}×${spec.dmg_mult}${hitBit} · ${tgtMap[spec.target] || spec.target}`);
      }
      if (spec.splash_mult > 0) bits.push(`濺射 ${pow}×${spec.splash_mult}`);
      if (spec.execute_mult && spec.execute_hp_pct != null) {
        bits.push(`殘血＜${spec.execute_hp_pct}% → ×${spec.execute_mult}`);
      }
    }
    if (!bits.length) return spec.support ? "輔助／觸發（不以普攻倍率結算）" : "輔助效果";
    return bits.join("；");
  }

  /** 普攻物／魔：獨立欄 basic_power；缺省 phys（唔改技能 power 語義） */
  function fighterBasicPower(src) {
    return src && src.basic_power === "magic" ? "magic" : "phys";
  }
  function basicPowerTagLabel(src) {
    return fighterBasicPower(src) === "magic" ? "普攻・魔" : "普攻・物";
  }
  function basicPowerParenLabel(src) {
    return fighterBasicPower(src) === "magic" ? "魔" : "物";
  }

  /** 自帶技物／魔：明確 power 優先；缺則 fallback basic_power（唔改裝備技卡語義） */
  function resolveInnatePower(f) {
    if (!f) return "phys";
    if (f.power === "magic" || f.power === "phys") return f.power;
    return fighterBasicPower(f);
  }
  function innatePowerTagLabel(src) {
    src = src || {};
    const spec = skillCombatSpec(
      Object.assign({}, src, { power: resolveInnatePower(src) })
    );
    if (!(spec.dmg_mult > 0) && !(spec.splash_mult > 0)) return "自帶";
    return resolveInnatePower(src) === "magic" ? "自帶・魔" : "自帶・物";
  }

  function attackBaseForPower(actor, power) {
    const atk = (actor && actor.atk) | 0;
    const matk = (actor && actor.matk) | 0;
    if (power === "magic") return Math.max(1, atk + matk);
    return Math.max(1, atk);
  }

  function pickCombatTarget(foes, mode) {
    const alive = (foes || []).filter((u) => u.alive);
    if (!alive.length) return null;
    if (mode === "lowest" || mode === "single" || !mode) {
      alive.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.spd - c.spd);
      return alive[0];
    }
    if (mode === "highest") {
      alive.sort((a, c) => c.hp / c.maxHp - a.hp / a.maxHp || c.spd - a.spd);
      return alive[0];
    }
    if (mode === "front") return alive[0];
    alive.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp || a.spd - c.spd);
    return alive[0];
  }

  function dealSkillDamage(actor, target, raw, power, useSkill, moveName, effectText) {
    if (!target || !target.alive) return 0;
    const dmg = calcDamage(actor, target, raw, power);
    target.hp = Math.max(0, target.hp - dmg);
    playImpact(actor, target, dmg, useSkill, moveName);
    applySkillStatuses(actor, target, moveName, useSkill, effectText);
    if (target.hp <= 0) target.alive = false;
    return dmg;
  }

  /** 統一技能／自帶／裝備技結算；回傳主目標。 */
  function resolveCombatMove(actor, moveSpec, effectText, moveName, useSkill) {
    const b = state.battle;
    const spec = skillCombatSpec(moveSpec);
    const foes = actor.side === "player" ? b.enemies : b.players;
    const allies = actor.side === "player" ? b.players : b.enemies;
    const power = spec.power;
    const base = attackBaseForPower(actor, power);

    if (spec.heal_mult > 0 && !(spec.dmg_mult > 0)) {
      let targets = [];
      if (spec.target === "allies") targets = allies.filter((u) => u.alive);
      else if (spec.target === "ally") {
        const hurt = allies.filter((u) => u.alive).slice().sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
        targets = [hurt[0] || actor];
      } else targets = [actor];
      const raw = Math.max(1, Math.round(base * spec.heal_mult));
      targets.forEach((u) => {
        if (!u || !u.alive) return;
        u.hp = Math.min(u.maxHp, u.hp + raw);
      });
      const primary = targets[0] || actor;
      playImpact(actor, primary, raw, useSkill, moveName);
      applySkillStatuses(actor, primary, moveName, useSkill, effectText);
      return primary;
    }

    if (!(spec.dmg_mult > 0) && !(spec.splash_mult > 0)) {
      let primary = actor;
      if (spec.target === "aoe") {
        const list = foes.filter((u) => u.alive);
        primary = list[0] || actor;
        list.forEach((t) => applySkillStatuses(actor, t, moveName, useSkill, effectText));
      } else if (spec.target === "allies") {
        allies.filter((u) => u.alive).forEach((t) => applySkillStatuses(actor, t, moveName, useSkill, effectText));
        primary = allies.find((u) => u.alive) || actor;
      } else if (spec.target === "self" || spec.target === "ally") {
        primary = actor;
        applySkillStatuses(actor, primary, moveName, useSkill, effectText);
      } else {
        primary = pickCombatTarget(foes, spec.target) || pickLowestHp(foes) || actor;
        applySkillStatuses(actor, primary, moveName, useSkill, effectText);
      }
      playImpact(actor, primary, 0, useSkill, moveName);
      return primary;
    }

    const rawFor = (mult) => Math.round(base * mult);

    if (spec.target === "aoe") {
      const list = foes.filter((u) => u.alive);
      const primary = list[0] || null;
      list.forEach((t) => {
        let mult = spec.dmg_mult;
        if (spec.execute_mult && spec.execute_hp_pct != null && (t.hp / t.maxHp) * 100 < spec.execute_hp_pct) {
          mult = spec.execute_mult;
        }
        if (spec.hit_scales && spec.hit_scales.length) {
          spec.hit_scales.forEach((sc) => dealSkillDamage(actor, t, rawFor(sc), power, useSkill, moveName, effectText));
        } else {
          for (let h = 0; h < spec.hits; h++) {
            dealSkillDamage(actor, t, rawFor(mult), power, useSkill, moveName, effectText);
          }
        }
      });
      return primary;
    }

    const primary = pickCombatTarget(foes, spec.target) || pickLowestHp(foes);
    if (!primary) return null;
    let mult = spec.dmg_mult;
    if (spec.execute_mult && spec.execute_hp_pct != null && (primary.hp / primary.maxHp) * 100 < spec.execute_hp_pct) {
      mult = spec.execute_mult;
    }
    if (spec.hit_scales && spec.hit_scales.length) {
      spec.hit_scales.forEach((sc) => dealSkillDamage(actor, primary, rawFor(sc), power, useSkill, moveName, effectText));
    } else {
      for (let h = 0; h < spec.hits; h++) {
        dealSkillDamage(actor, primary, rawFor(mult), power, useSkill, moveName, effectText);
      }
    }
    if (spec.splash_mult > 0) {
      foes.filter((u) => u.alive && u !== primary).forEach((t) => {
        dealSkillDamage(actor, t, rawFor(spec.splash_mult), power, useSkill, moveName, effectText);
      });
    }
    return primary;
  }

  function battleTick() {
    const b = state.battle;
    if (!b || !b.running || b.paused) return;

    if (b.turn >= MAX_TURNS) {
      endBattle(false);
      return;
    }

    if (!b.queue.length) {
      b.turn += 1;
      tickStatusesAtTurnStart();
      const alive = [
        ...b.players.filter((p) => p.alive),
        ...b.enemies.filter((e) => e.alive),
      ];
      alive.sort((a, c) => effectiveSpd(c) - effectiveSpd(a) || (a.side === "player" ? -1 : 1));
      b.queue = alive.map((u) => unitKey(u));
      updateBattleBars();
      updateBattleHud();
    }

    const token = b.queue.shift();
    if (!token) {
      scheduleNext(160);
      return;
    }
    const [side, uid] = token.split(":");
    const actor =
      side === "enemy"
        ? b.enemies.find((e) => e.id === uid)
        : b.players.find((p) => p.id === uid);
    if (!actor || !actor.alive) {
      scheduleNext(100);
      return;
    }

    if (hasStatus(actor, "stun")) {
      removeStatus(actor, "stun");
      updateStatusRows();
      scheduleNext(280);
      return;
    }

    actor.turnsTaken += 1;
    const cd = Math.max(1, actor.skill_cd | 0);
    let useSkill = actor.turnsTaken % cd === 0;
    let moveName = useSkill ? actor.skill : actor.basic;
    let effectText = actor.skill_effect || "";
    let moveSpec = useSkill
      ? {
          dmg_mult: actor.dmg_mult,
          hits: actor.hits,
          target: actor.target,
          power: actor.power,
          splash_mult: actor.splash_mult,
          heal_mult: actor.heal_mult,
          support: actor.support,
          execute_hp_pct: actor.execute_hp_pct,
          execute_mult: actor.execute_mult,
          hit_scales: actor.hit_scales,
          passive: actor.passive,
          skill_cd: actor.skill_cd,
          cd: actor.skill_cd,
        }
      : { dmg_mult: 1, hits: 1, target: "single", power: "phys" };

    if (useSkill && actor.side === "player") {
      // 輪轉：自帶技 → 裝備主動技；cd===0 常駐被動唔入橫幅輪轉
      const innateSpec = skillCombatSpec({
        dmg_mult: actor.dmg_mult,
        hits: actor.hits,
        target: actor.target,
        power: resolveInnatePower(actor),
        basic_power: actor.basic_power,
        splash_mult: actor.splash_mult,
        heal_mult: actor.heal_mult,
        support: actor.support,
        execute_hp_pct: actor.execute_hp_pct,
        execute_mult: actor.execute_mult,
        hit_scales: actor.hit_scales,
        passive: actor.passive,
        skill_cd: actor.skill_cd,
        cd: actor.skill_cd,
        name: actor.skill,
        effect: actor.skill_effect || "",
      });
      const cycle = [];
      if (actor.skill && !innateSpec.passive) {
        cycle.push({
          name: actor.skill,
          effect: actor.skill_effect || "",
          spec: innateSpec,
        });
      }
      (actor.equipped || []).forEach((s) => {
        const sp = skillCombatSpec(s);
        if (sp.passive) return;
        cycle.push({ name: s.name, effect: s.effect || "", spec: sp });
      });
      if (cycle.length) {
        const pick = cycle[actor.skillCursor % cycle.length];
        actor.skillCursor = (actor.skillCursor || 0) + 1;
        moveName = pick.name;
        effectText = pick.effect || "";
        moveSpec = pick.spec;
      }
    } else if (useSkill && actor.side === "enemy") {
      // 敵方＝卡池卡：自帶技照玩家同一套結算（群攻／治療／斬殺等都會生效）
      const innateSpec = skillCombatSpec({
        dmg_mult: actor.dmg_mult,
        hits: actor.hits,
        target: actor.target,
        power: actor.power || actor.basic_power,
        basic_power: actor.basic_power,
        splash_mult: actor.splash_mult,
        heal_mult: actor.heal_mult,
        support: actor.support,
        execute_hp_pct: actor.execute_hp_pct,
        execute_mult: actor.execute_mult,
        hit_scales: actor.hit_scales,
        passive: actor.passive,
        skill_cd: actor.skill_cd,
        cd: actor.skill_cd,
      });
      if (innateSpec.passive) {
        // 被動技唔當主動出招，改用普攻
        useSkill = false;
        moveName = actor.basic;
        moveSpec = { dmg_mult: 1, hits: 1, target: "single", power: actor.basic_power || "phys" };
      } else if (!(innateSpec.dmg_mult > 0) && !(innateSpec.splash_mult > 0) && !(innateSpec.heal_mult > 0) && innateSpec.target !== "self") {
        // 無結構化自帶技：維持原本倍率
        moveSpec = { dmg_mult: 1.5, hits: 1, target: "single", power: actor.basic_power || "phys" };
      }
    }

    if (!useSkill) {
      // 普攻：依 basic_power 走物／魔（phys→atk／def；magic→atk+matk／mdef）
      const foes = actor.side === "player" ? b.enemies : b.players;
      const target = pickLowestHp(foes);
      if (!target) {
        endBattle(actor.side === "player");
        return;
      }
      const bp = fighterBasicPower(actor);
      const raw = attackBaseForPower(actor, bp);
      const dmg = calcDamage(actor, target, raw, bp);
      target.hp = Math.max(0, target.hp - dmg);
      playImpact(actor, target, dmg, false, moveName);
      if (target.hp <= 0) target.alive = false;
    } else {
      const primary = resolveCombatMove(actor, moveSpec, effectText, moveName, true);
      if (!primary && actor.side === "player" && !b.enemies.some((e) => e.alive)) {
        updateBattleBars();
        endBattle(true);
        return;
      }
      if (!primary && actor.side === "enemy" && !b.players.some((p) => p.alive)) {
        updateBattleBars();
        endBattle(false);
        return;
      }
    }

    if (actor.side === "player") {
      if (!b.enemies.some((e) => e.alive)) {
        updateBattleBars();
        endBattle(true);
        return;
      }
    } else {
      if (!b.players.some((p) => p.alive)) {
        updateBattleBars();
        endBattle(false);
        return;
      }
    }

    updateBattleBars();
    scheduleNext(useSkill ? 720 : 420);
  }

  function slotEl(unit) {
    if (!unit) return null;
    if (unit.side === "enemy") return document.querySelector('[data-unit="e:' + unit.id + '"]');
    return document.querySelector('[data-unit="p:' + unit.id + '"]');
  }

  function playImpact(actor, target, dmg, skill, moveName) {
    const b = state.battle;
    if (!b) return;
    b.lastHit = { actor: unitKey(actor), target: unitKey(target), dmg, skill, moveName };

    const battleRoot = document.querySelector(".battle");
    const fx = document.getElementById("fx-layer");
    const flash = document.getElementById("impact-flash");
    const aEl = slotEl(actor);
    const tEl = slotEl(target);

    if (aEl) {
      aEl.classList.remove("attack", "skill-glow");
      void aEl.offsetWidth;
      aEl.classList.add("attack");
      if (skill) aEl.classList.add("skill-glow");
      setTimeout(() => aEl.classList.remove("attack", "skill-glow"), 360);
    }
    if (tEl) {
      tEl.classList.remove("hit");
      void tEl.offsetWidth;
      tEl.classList.add("hit");
      setTimeout(() => tEl.classList.remove("hit"), 400);
    }
    if (battleRoot) {
      battleRoot.classList.remove("shake", "shake-hard");
      void battleRoot.offsetWidth;
      battleRoot.classList.add(skill ? "shake-hard" : "shake");
      setTimeout(() => battleRoot.classList.remove("shake", "shake-hard"), 420);
    }
    if (flash) {
      flash.className = "impact-flash" + (skill ? " skill" : "") + " on";
      setTimeout(() => flash.classList.remove("on"), 340);
    }

    if (fx) {
      if (skill && moveName) {
        // remove previous skill banner if any
        fx.querySelectorAll(".fx-skill-name, .fx-speedlines").forEach((n) => n.remove());
        const lines = document.createElement("div");
        lines.className = "fx-speedlines" + (actor.side === "enemy" ? " enemy" : "");
        fx.appendChild(lines);
        setTimeout(() => lines.remove(), 450);

        const banner = document.createElement("div");
        banner.className =
          "fx-skill-name inspectable" + (actor.side === "enemy" ? " enemy" : "");
        banner.innerHTML =
          '<span class="who">' +
          esc(actor.name) +
          "</span>" +
          esc(moveName);
        banner.title = "查看卡";
        banner.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openCardInspect(actor);
        });
        fx.appendChild(banner);
        setTimeout(() => banner.remove(), 1000);
      }

      if (tEl) {
        const br = fx.getBoundingClientRect();
        const tr = tEl.getBoundingClientRect();
        const x = tr.left + tr.width / 2 - br.left;
        const y = tr.top + tr.height * 0.35 - br.top;

        const num = document.createElement("div");
        num.className = "fx-dmg" + (skill ? " skill crit" : "");
        num.textContent = "−" + dmg;
        num.style.left = x + "px";
        num.style.top = y + "px";
        fx.appendChild(num);
        setTimeout(() => num.remove(), 1000);

        const slash = document.createElement("div");
        slash.className = "fx-slash" + (skill ? " skill" : "");
        slash.style.left = x + "px";
        slash.style.top = y + 10 + "px";
        fx.appendChild(slash);
        setTimeout(() => slash.remove(), 450);

        if (skill) {
          const burst = document.createElement("div");
          burst.className = "fx-burst";
          burst.style.left = x + "px";
          burst.style.top = y + "px";
          fx.appendChild(burst);
          setTimeout(() => burst.remove(), 500);
        }
      }
    }

    sfxHit(skill);
  }

  function updateBattleHud() {
    const turnEl = document.getElementById("b-turn");
    if (turnEl && state.battle) {
      turnEl.textContent = "回合 " + state.battle.turn + "/" + MAX_TURNS;
    }
  }

  function updateBattleBars() {
    const b = state.battle;
    if (!b || state.screen !== "battle") return;

    b.enemies.forEach((e) => {
      const pct = Math.max(0, Math.round((e.hp / e.maxHp) * 100));
      const bar = document.getElementById("hp-i-" + e.id);
      const lab = document.getElementById("hp-lab-" + e.id);
      const slot = document.querySelector('[data-unit="e:' + e.id + '"]');
      if (bar) bar.style.width = pct + "%";
      if (lab) lab.textContent = e.hp + "/" + e.maxHp;
      if (slot) slot.classList.toggle("down", !e.alive);
    });

    b.players.forEach((p) => {
      const pct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
      const bar = document.getElementById("hp-i-" + p.id);
      const lab = document.getElementById("hp-lab-" + p.id);
      const slot = document.querySelector('[data-unit="p:' + p.id + '"]');
      if (bar) bar.style.width = pct + "%";
      if (lab) lab.textContent = p.hp + "/" + p.maxHp;
      if (slot) slot.classList.toggle("down", !p.alive);
    });
    updateStatusRows();
    updateBattleHud();
  }

  function endBattle(win) {
    const b = state.battle;
    if (!b) return;
    state.pendingDefeat = null;
    b.running = false;
    b.paused = false;
    b.inspectOpen = false;
    clearTimeout(b.timer);
    dismissForfeitConfirm();
    hideHelpTip();
    const overlay = document.getElementById("card-inspect");
    if (overlay) overlay.remove();
    // 教學期單場敗：暫時 KO，唔永久燒卡／唔加歲；留故事流可再揀遭遇
    const tutorialLoss = !win && inTutorialPeriod();
    const newlyDead = lockDeadFromBattle(b, { permanent: !tutorialLoss });
    const deadNames = tutorialLoss
      ? []
      : newlyDead
          .map((id) => (fighterById[id] && fighterById[id].name) || id)
          .filter(Boolean);
    const survivorCount = b.players.filter((p) => p.alive).length;
    const lead =
      b.enemies.find((e) => e.defId === b.primaryEnemyId) || b.enemies[0] || null;
    const ev = state.selectedEvent;
    // 非教學期全滅＝今世死光結束（唔留「冇卡可打」死路）
    if (!win && !tutorialLoss && !hasUsableTeamFighter()) {
      state.lifeWiped = true;
    }
    state.lastResult = {
      win,
      reward: win ? b.reward : 0,
      enemyName: lead ? lead.name : "",
      enemyArt: lead ? lead.art : "",
      rewardBlurb: (ev && ev.reward_blurb) || "",
      eventName: (ev && ev.name) || "",
      yearBefore: state.year,
      deadNames,
      survivorHealed: survivorCount > 0,
      softRevive: tutorialLoss,
    };
    state.battlesThisLife += 1;
    if (win) {
      if (Array.isArray(state.battleFieldSnapshot) && state.battleFieldSnapshot.some(Boolean)) {
        state.lastWinDeploy = state.battleFieldSnapshot.slice(0, TEAM_SIZE);
      }
      state.soul += b.reward;
      /*
       * t367：戰鬥勝利必給金幣（經濟修復 A）。
       * 原本 85 個事件只有 3 個有 reward_gold，總和 21 金幣，
       * 而復活一張卡要 20–60 金幣 → 復活機制形同虛設（實測整條命只夠復活 0.5 次）。
       * 現在每場勝利都有基礎金幣，令「打贏 → 有錢 → 可以復活/強化」這個循環成立。
       */
      const baseGold = victoryGoldFor(ev) - ((ev && ev.reward_gold) | 0);
      const goldGain = baseGold + ((ev && ev.reward_gold) | 0);
      if (goldGain) state.gold = (state.gold | 0) + goldGain;
      if (state.lastResult) state.lastResult.goldGain = goldGain;
      // 卡面有寫經驗就照發；冇寫先用 4＋幸運微調
      const luck = (state.attrs && state.attrs.luck) | 0;
      const xpGain = (ev && (ev.reward_xp | 0) > 0)
        ? (ev.reward_xp | 0)
        : Math.max(1, 4 + Math.floor(luck / 5));
      gainXp(xpGain);
      if (state.lastResult) state.lastResult.xpGain = xpGain;
      // 卡經驗：本場參戰卡各＋FIGHTER_BATTLE_XP（帳號級；存活／陣亡同得）
      const cardXpNotes = grantDeployedCardXpFromBattle(b);
      if (state.lastResult) state.lastResult.cardXpNotes = cardXpNotes;
      // t367 補卡修復（C）：戰鬥勝利有機率掉落新戰鬥卡，補充陣亡缺口
      const drop = tryBattleCardDrop(ev);
      if (drop && state.lastResult) state.lastResult.cardDrop = drop;
      trackEventMission(ev, { battleWin: true });
    }
    state.battleFieldSnapshot = null;
    if (tutorialLoss) {
      // 教學期敗：唔加歲／唔推遭遇；清選中事件，返回同年四揀一
      state.selectedEvent = null;
      state.deploy = [];
    } else {
      // 勝或畢業後敗：結算後年紀＋1
      advanceYear();
    }
    setTimeout(() => {
      state.screen = "result";
      render();
    }, 560 / state.speed);
  }

  /**
   * t368 補卡修復（C）：戰鬥勝利掉落戰鬥卡。
   * 實測：每場平均陣亡 0.58 張，而原本補充只有 0.33 張/年 → 淨流失必死。
   * 現在勝利 85% 機率掉卡（原本 60%），並在口袋已滿時仍然入冊，
   * 讓玩家有卡可以替換（不再因為「池滿」而白費掉落）。
   */
  const BATTLE_CARD_DROP_CHANCE = 0.85;

  function tryBattleCardDrop(ev) {
    if (Math.random() >= BATTLE_CARD_DROP_CHANCE) return null;
    albumEnsureState();
    const teamSet = new Set(state.team || []);
    const cap = fighterPocketCap();
    /* t391：戰鬥掉落唔會出殘頁專屬卡（只可經殘頁兌換） */
    const all = poolFighters();
    if (!all.length) return null;
    // 優先未持有 → 其次未在隊
    const unowned = all.filter((f) => albumCardCount(f.id) <= 0 && !teamSet.has(f.id));
    const notInTeam = all.filter((f) => !teamSet.has(f.id));
    const src = unowned.length ? unowned : (notInTeam.length ? notInTeam : all);
    const pick = src[Math.floor(Math.random() * src.length)];
    if (!pick) return null;
    albumGainOne("fighters", pick.id);
    let joined = false;
    // 口袋有空位才自動入隊；滿了就只入卡冊（玩家可在準備頁換上）
    if ((state.team || []).length < cap) {
      state.team.push(pick.id);
      if (!state.loadout[pick.id]) state.loadout[pick.id] = [];
      joined = true;
    }
    return {
      id: pick.id,
      name: pick.name || pick.id,
      art: pick.art || null,
      rarity: pick.rarity || "",
      joined,
    };
  }

  function lookupDef(unit) {
    if (!unit) return null;
    if (unit.side === "enemy") return enemyUnitDef(unit);
    return fighterById[unit.id] || null;
  }

  function closeCardInspect() {
    const b = state.battle;
    const overlay = document.getElementById("card-inspect");
    if (overlay) overlay.remove();
    if (b) b.inspectOpen = false;
    /* t399：用安全版（戰鬥狀態唔完整時唔會排 tick 而 crash） */
    resumeBattleSafe();
  }

  function openCardInspect(unit) {
    const b = state.battle;
    if (!b || !b.running || !unit) return;
    if (b.inspectOpen) closeCardInspectKeepPaused();
    pauseBattle();
    b.inspectOpen = true;

    const def = lookupDef(unit) || {};
    const isEnemy = unit.side === "enemy";
    const atkLabel = L["ui.atk"] || "攻";
    const spdLabel = L["ui.spd"] || "速";
    const rarityBase = def.rarity || (isEnemy ? "敵方" : "普通");
    const raritySlang = def.rarity_slang || "";
    const rarity = raritySlang ? `${rarityBase} · ${raritySlang}` : rarityBase;
    const tags = def.tags || [];
    const basic = unit.basic || def.basic || "首通";
    const skill = unit.skill || def.skill || "自帶技";
    const skillCd = unit.skill_cd || def.skill_cd || 3;
    const skillEffect = def.skill_effect || "";
    const flavor =
      def.flavor ||
      def.blurb ||
      def.notes ||
      (isEnemy
        ? "後巷殘影——一擊就要記低。"
        : "街巷卡面——出手先講。");
    const stage = def.stage || "";
    const hpNow = unit.hp;
    const hpMax = unit.maxHp;

    const tagHtml = tags
      .map((t) => `<span class="ci-tag">${esc(t)}</span>`)
      .join("");
    const battleRoot = document.querySelector(".battle");
    if (!battleRoot) return;

    const overlay = document.createElement("div");
    overlay.id = "card-inspect";
    overlay.className = "card-inspect";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "卡牌詳情");
    overlay.innerHTML = `
      <div class="card-inspect-panel ${isEnemy ? "enemy" : ""}" id="card-inspect-panel">
        <div class="card-inspect-art">
          <img src="${esc(unit.art)}" alt="${esc(unit.name)}" />
          <span class="rarity-badge">${esc(rarity)}</span>
          <span class="paused-tag">暫停</span>
        </div>
        <div class="card-inspect-body">
          <div class="ci-name">${esc(unit.name)}${(!isEnemy && unit.level) ? ` <span class="ci-lv">Lv.${unit.level}</span>` : ""}</div>
          ${stage ? `<div class="ci-tags"><span class="ci-tag">${esc(stage)}</span></div>` : ""}
          ${tagHtml ? `<div class="ci-tags">${tagHtml}</div>` : ""}
          <div class="ci-stats">
            <span class="ci-stat atk">${esc(atkLabel)} ${unit.atk}</span>
            <span class="ci-stat spd">${esc(spdLabel)} ${unit.spd}</span>
            <span class="ci-stat hp">血 ${hpNow}/${hpMax}</span>
          </div>
          <div class="ci-section">
            <div class="ci-label">技能</div>
            <div class="ci-skill">
              ${battleCardSkillSlotsHtml({
                basic,
                skill,
                skillCd,
                skillEffect,
                basic_power: unit.basic_power != null ? unit.basic_power : def.basic_power,
                basicPowerTag: basicPowerTagLabel({
                  basic_power: unit.basic_power != null ? unit.basic_power : def.basic_power,
                }),
                combatSpec: {
                  dmg_mult: unit.dmg_mult != null ? unit.dmg_mult : def.dmg_mult,
                  hits: unit.hits != null ? unit.hits : def.hits,
                  target: unit.target != null ? unit.target : def.target,
                  power: resolveInnatePower({
                    power: unit.power != null ? unit.power : def.power,
                    basic_power: unit.basic_power != null ? unit.basic_power : def.basic_power,
                  }),
                  basic_power: unit.basic_power != null ? unit.basic_power : def.basic_power,
                  splash_mult: unit.splash_mult != null ? unit.splash_mult : def.splash_mult,
                  heal_mult: unit.heal_mult != null ? unit.heal_mult : def.heal_mult,
                  support: unit.support != null ? unit.support : def.support,
                  passive: unit.passive != null ? unit.passive : def.passive,
                  execute_hp_pct: unit.execute_hp_pct != null ? unit.execute_hp_pct : def.execute_hp_pct,
                  execute_mult: unit.execute_mult != null ? unit.execute_mult : def.execute_mult,
                  hit_scales: unit.hit_scales != null ? unit.hit_scales : def.hit_scales,
                  cd: skillCd,
                },
                innatePowerTag: innatePowerTagLabel({
                  power: unit.power != null ? unit.power : def.power,
                  basic_power: unit.basic_power != null ? unit.basic_power : def.basic_power,
                  dmg_mult: unit.dmg_mult != null ? unit.dmg_mult : def.dmg_mult,
                  splash_mult: unit.splash_mult != null ? unit.splash_mult : def.splash_mult,
                  heal_mult: unit.heal_mult != null ? unit.heal_mult : def.heal_mult,
                  support: unit.support != null ? unit.support : def.support,
                  passive: unit.passive != null ? unit.passive : def.passive,
                  skill_cd: skillCd,
                }),
                artFallback: unit.art,
                equipped: !isEnemy && unit.equipped && unit.equipped.length
                  ? unit.equipped.map((s) => ({
                      id: s.id,
                      name: s.name,
                      art: s.art || (s.id && skillById[s.id] && skillById[s.id].art) || skillArtByName(s.name) || null,
                      cd: s.cd,
                      effect: s.effect,
                      blurb: s.blurb,
                      flavor: s.flavor,
                      kind: s.kind,
                    }))
                  : [],
              })}
              ${
                skillEffect
                  ? `<div class="ci-skill-effect">${esc(skillEffect)}${
                      unit.dmg_mult != null || unit.heal_mult
                        ? `<div class="ci-skill-settle">結算：${esc(
                            skillCombatSummary({
                              dmg_mult: unit.dmg_mult != null ? unit.dmg_mult : def.dmg_mult,
                              hits: unit.hits != null ? unit.hits : def.hits,
                              target: unit.target != null ? unit.target : def.target,
                              power: resolveInnatePower({
                                power: unit.power != null ? unit.power : def.power,
                                basic_power: unit.basic_power != null ? unit.basic_power : def.basic_power,
                              }),
                              splash_mult: unit.splash_mult != null ? unit.splash_mult : def.splash_mult,
                              heal_mult: unit.heal_mult != null ? unit.heal_mult : def.heal_mult,
                              support: unit.support != null ? unit.support : def.support,
                              passive: unit.passive != null ? unit.passive : def.passive,
                              execute_hp_pct: unit.execute_hp_pct != null ? unit.execute_hp_pct : def.execute_hp_pct,
                              execute_mult: unit.execute_mult != null ? unit.execute_mult : def.execute_mult,
                              hit_scales: unit.hit_scales != null ? unit.hit_scales : def.hit_scales,
                              cd: skillCd,
                            })
                          )}</div>`
                        : ""
                    }</div>`
                  : `<div class="ci-skill-effect">自帶技 · 每 ${skillCd} 回出手一次</div>`
              }
            </div>
          </div>
          ${statusesInspectHtml(unit)}
          <div class="ci-section">
            <div class="ci-label">卡面文案</div>
            <div class="ci-flavor">${esc(flavor)}</div>
          </div>
          <div class="ci-hint">點卡外／Esc 繼續</div>
        </div>
      </div>`;
    battleRoot.appendChild(overlay);

    const panel = overlay.querySelector("#card-inspect-panel");
    panel.addEventListener("click", (ev) => ev.stopPropagation());
    overlay.addEventListener("click", () => closeCardInspect());
    // t285：戰鬥 inspect 技能格撳／長按出說明（頂端置中）
    panel.querySelectorAll("[data-ci-skill-help]").forEach((el) => {
      const tip = el.getAttribute("data-help-text") || "";
      if (!tip) return;
      el.style.cursor = "pointer";
      const show = (ev) => {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        showHelpTip(el, tip);
      };
      el.addEventListener("click", show);
      wireLongPressHelp(el, tip);
    });
  }

  /** Close overlay UI without resuming (used when swapping inspect target). */
  function closeCardInspectKeepPaused() {
    const b = state.battle;
    const overlay = document.getElementById("card-inspect");
    if (overlay) overlay.remove();
    if (b) b.inspectOpen = false;
  }

  function viewBattle(root) {
    const b = state.battle;
    if (!b) return;

    function slotHtml(u, sidePrefix) {
      const pct = Math.max(0, Math.round((u.hp / u.maxHp) * 100));
      const isEnemy = u.side === "enemy";
      return `
        <div class="unit-slot ${isEnemy ? "enemy" : ""} inspectable ${u.alive ? "" : "down"}" data-unit="${sidePrefix}:${esc(u.id)}" data-side="${esc(u.side)}" data-id="${esc(u.id)}" title="點擊查看卡（戰鬥暫停）" role="button" tabindex="0">
          ${statusRowHtml(u, sidePrefix)}
          <img src="${esc(u.art)}" alt="${esc(u.name)}" />
          <div class="uname">${esc(u.name)}</div>
          <div class="uhp">
            <div class="hp-bar ${isEnemy ? "enemy" : ""}"><i id="hp-i-${esc(u.id)}" style="width:${pct}%"></i></div>
            <div class="hp-label" id="hp-lab-${esc(u.id)}">${u.hp}/${u.maxHp}</div>
          </div>
        </div>`;
    }

    const enemyUnits = b.enemies.map((e) => slotHtml(e, "e")).join("");
    const playerUnits = b.players.map((p) => slotHtml(p, "p")).join("");
    const speedLabel = esc(speedButtonLabel(state.speed));
    root.innerHTML = `
      <div class="battle">
        <div class="impact-flash" id="impact-flash"></div>
        <div class="fx-layer" id="fx-layer"></div>
        <div class="battle-top">
          <span id="b-turn">回合 ${b.turn}/${MAX_TURNS}</span>
          <span style="color:var(--neon-pink);font-weight:900;letter-spacing:0.08em">後巷戰</span>
          <span id="b-spd" style="color:var(--neon-gold)">${state.speed}×</span>
        </div>
        <div class="battle-stage">
          <div class="team-row enemy-row">${enemyUnits}</div>
          <div class="vs-strip" aria-hidden="true">VS</div>
          <div class="team-row player-row">${playerUnits}</div>
        </div>
        <div class="battle-actions">
          <button class="btn small cyan" id="btn-speed" data-help="btn-speed">${speedLabel}</button>
          <button class="btn small danger" id="btn-forfeit" data-help="btn-forfeit">${esc(L["ui.forfeit"] || "放棄")}</button>
        </div>
      </div>
    `;
    $("#btn-speed", root).onclick = () => {
      ensureAudio();
      state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
      applySpeedToButton();
      saveGame();
      if (b.running && !b.paused) scheduleNext(280);
    };
    $("#btn-forfeit", root).onclick = () => {
      ensureAudio();
      requestForfeit();
    };

    root.querySelectorAll(".unit-slot.inspectable").forEach((el) => {
      wireBattleInspect(el, () => {
        const side = el.dataset.side;
        const id = el.dataset.id;
        return side === "enemy"
          ? b.enemies.find((e) => e.id === id)
          : b.players.find((p) => p.id === id);
      });
    });
  }

  // Esc closes inspect overlay during battle
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const b = state.battle;
    if (!b || !b.inspectOpen || state.screen !== "battle") return;
    closeCardInspect();
  });

  function viewResult(root) {
    const r = state.lastResult || { win: false, reward: 0 };
    const lifeDone = lifeDoneFlag();
    // 中途場次勝敗 ≠ 今世完結；「今世過關」只用於 lifeDone
    const banner = lifeDone
      ? (r.win
          ? esc(L["ui.life_win"] || L["ui.win"] || "本世過關")
          : esc(L["ui.life_lose"] || L["ui.lose"] || "謀生艱難。本世完結"))
      : (r.win
          ? esc(L["ui.battle_win"] || "這場勝利！")
          : esc(L["ui.battle_lose"] || "這場未能取勝"));
    const blurb = r.rewardBlurb
      ? esc(r.rewardBlurb)
      : r.win
        ? (lifeDone ? "今世跑完，茶記可以收枱。" : "這場過了，茶記可以加底。")
        : (lifeDone ? "今世完結，帳留下下世再算。" : "算了，帳未清也要走下去。");
    const goStory = () => {
      state.selectedEvent = null;
      state.lastResult = null;
      if (lifeDoneFlag()) {
        endLife();
        return;
      }
      state.screen = afterFateOrEventScreen();
      render();
    };
    /*
     * t387：結果頁唔再有「繼續」掣，所以 primaryLabel／primaryHelp／bubbleText 唔再需要。
     * 保留 `lifeDoneNote` 用嚟喺自動前進條上面講清楚下一步。
     */
    const lifeDoneNote = lifeDone
      ? (lifeOver() ? "壽命已到 · 結算今世" : "今世完結 · 結算今世")
      : "";
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="result-body soft-reveal">
        <div class="result-banner ${r.win ? "win" : "lose"}">${banner}</div>
        ${r.enemyArt ? `<img class="result-art" src="${esc(r.enemyArt)}" alt="" />` : ""}
        <div class="soft-panel result-panel">
          ${r.eventName ? `<div class="result-ev">${esc(r.eventName)}</div>` : ""}
          ${r.win ? `膠幣 <b style="color:var(--neon-gold)">+${r.reward}</b>${r.goldGain ? ` · 金幣 <b style="color:var(--neon-gold)">+${r.goldGain}</b>` : ""}${r.xpGain ? ` · 經驗 <b style="color:var(--neon-lime)">+${r.xpGain}</b>` : ""}` : "沒有賺到膠幣"}
          · ${blurb}<br/>
          <span style="color:var(--neon-cyan)">現在 ${state.age}歲 · 第 ${state.year} 年</span>
          · 膠幣 ${state.soul} · 已打 ${state.battlesThisLife} 場
          ${(() => {
            const notes = Array.isArray(r.cardXpNotes) ? r.cardXpNotes : [];
            if (!notes.length) return "";
            const bits = notes.map((n) => {
              const up = n.leveled ? ` → Lv.${n.toLv}` : `（Lv.${n.toLv}）`;
              return `${esc(n.name)} 卡經驗+${n.xpGain | 0}${up}`;
            });
            return `<br/><span style="color:var(--neon-lime)">卡牌成長：${bits.join(" · ")}</span>`;
          })()}
          ${(r.deadNames && r.deadNames.length) ? `<br/><span style="color:var(--neon-pink)">陣亡：${esc(r.deadNames.join("、"))}（技能一併不可再用）</span>` : ""}
          ${r.softRevive ? `<br/><span style="color:var(--neon-cyan)">教學期——出戰卡暫時倒下，下局可再出戰；本年遭遇可再揀。</span>` : ""}
          ${lifeDone ? `<br/><span style="color:var(--neon-pink)">${lifeOver() ? "壽命已到——" : "出戰卡已死光——"}可結算今世返主頁。</span>` : ""}
          ${lifeDone ? (() => {
            /*
             * t379：結算前明確講清楚膠幣會點變（唔好隱形回滾）。
             * 放棄／結算後 soul 會重置為 SOUL_START，玩家應該事先知道。
             */
            const cur = Math.max(0, state.soul | 0);
            const dl = SOUL_START - cur;
            const dlTxt = dl > 0 ? `+${dl}` : (dl < 0 ? String(dl) : "±0");
            const tone = dl < 0 ? "var(--neon-pink)" : "var(--neon-lime)";
            return `<br/><span style="color:${tone}">結算後膠幣：${cur} → 新一世 ${SOUL_START}（${dlTxt}）· 卡冊收藏保留</span>`;
          })() : ""}
        </div>
      </div>
      <div class="result-cta">
        ${autoAdvanceBarHtml(lifeDone ? lifeDoneNote : "下一歲")}
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    const primaryAction = lifeDone ? endLife : goStory;
    /*
     * t387：唔再需要撳「繼續」——戰鬥結果浮現之後自動前進。
     * 玩家想快啲，點畫面任何位置即可。今世完結時自動結算返主頁。
     */
    let done = false;
    const advance = () => {
      if (done) return;
      done = true;
      clearAutoAdvance();
      primaryAction();
    };
    wireTapToAdvance(root, advance);
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }

  // boot — load 存檔 → 收藏種子（尊重 demoSeedVersion）→ lifeSkills → loadout（有人生唔 force）
  loadGame();
  albumEnsureState();
  ensureLifeSkills();
  ensureDefaultLoadout(state.lifePrepped ? false : true);
  if (shouldResumeToResult()) state.screen = "result";
  else if (state.lifePrepped) state.screen = "home";
  wirePersistOnHide();
  render();
})();
