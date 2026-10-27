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

  /** 極簡港式身世 stub（prep 後揀一次；四揀一 2增益＋2減益；微調六維） */
  const ORIGINS = [
    { id: "tea_apprentice", name: "茶記學徒", kind: "buff", blurb: "幸運＋2 · 軟事件膠幣＋10%", bonus_soul: 0.1, attrs: { luck: 2 }, art: "assets/events/ev-yum-cha.jpg" },
    { id: "walled_kid", name: "城寨細路", kind: "buff", blurb: "力量＋2 · 開戰物攻再＋1", bonus_atk: 1, attrs: { str: 2 }, art: "assets/events/ev-alley-wake.jpg" },
    { id: "rooftop_youth", name: "天台夜青", kind: "debuff", blurb: "敏捷－2 · 壽命－5 · 夜夜熬夜傷身", attrs: { agi: -2, life: -5 }, art: "assets/story-packs/neon-mei-wan.jpg" },
    { id: "paper_stall_kid", name: "報紙檔細路", kind: "debuff", blurb: "幸運－1 · 統率－1 · 街邊叫賣沒有人聽", attrs: { luck: -1, lead: -1 }, art: "assets/events/ev-mtr-crowd.jpg" },
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
  function ensureActiveStoryPack() {
    const packs = storyPacksList();
    const available = packs.filter((p) => p.status === "available");
    if (state.activeStoryPackId && storyPackById(state.activeStoryPackId)) {
      const cur = storyPackById(state.activeStoryPackId);
      if (cur && cur.status === "available") return state.activeStoryPackId;
    }
    if (available.length >= 1) {
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

  /** 人生六維溫和 demo 預設（身世可 ±） */
  function defaultAttrs() {
    return { str: 12, agi: 10, intel: 8, luck: 8, lead: 5, life: 70 };
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
    selectedEvent: null,
    /** 今世戰鬥卡口袋名單（prep 放入；唔等於當場出戰） */
    team: [...(DATA.default_team || [])].slice(0, TEAM_SIZE),
    /** 本場出戰位（最多 TEAM_SIZE）；每次入 encounter 清空 */
    deploy: [],
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
  };

  const fighterById = Object.fromEntries(DATA.fighters.map((f) => [f.id, f]));
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
      `<div class="ht-line">Lv.${lv}｜★${star}｜稀有 ${esc(rare)}｜${esc(bits.join(" "))}</div>`,
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
  function enemyHelpRichHtml(e) {
    if (!e) return null;
    const def = enemyById[e.defId || e.id] || e;
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
      `<div class="ht-line">稀有 ${esc(rare)}｜攻${atk ?? "?"} 速${spd ?? "?"} 血${hp ?? "?"}</div>`,
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

  /**
   * 每年四揀一：
   * - 自由年>=5 && 自由年%5===0 → 全從 special_battle（宿敵）池抽 4（不足則重複）
   *   （命運 Y1–3 唔計入自由年；曆年4＝自由年1）
   * - 否則從非 special_battle 池抽 4，盡量類型唔重複（每 category 最多 1，再填滿）
   * 回傳 4 個 event 物件；同年緩存於 state.yearEventOffer
   */
  function rollYearEvents(year) {
    const y = Math.max(1, year | 0);
    if ((state.yearEventYear | 0) === y && state.yearEventOffer && state.yearEventOffer.length === 4) {
      return state.yearEventOffer
        .map((id) => (DATA.events || []).find((e) => e.id === id))
        .filter(Boolean);
    }
    const all = DATA.events || [];
    let picked = [];
    if (isSpecialBattleYear(y)) {
      const pool = all.filter((e) => e.category === "special_battle");
      const src = pool.length ? pool : all.filter((e) => e.battle);
      const sh = shuffleCopy(src);
      for (let i = 0; i < 4; i++) {
        picked.push(sh[i % Math.max(1, sh.length)]);
      }
    } else {
      const pool = all.filter((e) => e.category !== "special_battle" && eventFactionEligible(e));
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
      injectLifeSide("card_trade", 0.4);
      injectLifeSide("star_up", 0.4);
    }
    picked = picked.slice(0, 4);
    state.yearEventOffer = picked.map((e) => e.id);
    state.yearEventYear = y;
    return picked;
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

  function claimDailyMission(id) {
    ensureDaily();
    const m = dailyMissionList().find((x) => x.id === id);
    if (!m) return false;
    if (state.daily.claimed[id]) return false;
    const cur = state.daily.progress[id] | 0;
    if (cur < Math.max(1, m.target | 0)) return false;
    const r = m.reward || {};
    if (r.soul) state.soul = (state.soul | 0) + (r.soul | 0);
    if (r.gold) state.gold = (state.gold | 0) + (r.gold | 0);
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
    if (r.gold) bits.push("金幣+" + r.gold);
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

  function shopRarityLabel(rarity) {
    const key = String(rarity == null ? "" : rarity).trim();
    if (!key) return "無法辨識";
    const map = {
      common: "普通",
      rare: "稀有",
      epic: "史詩",
      legend: "最高級",
      "普通": "普通",
      "稀有": "稀有",
      "史詩": "史詩",
      "最高級": "最高級",
      "傳奇": "最高級",
    };
    if (map[key]) return map[key];
    const low = key.toLowerCase();
    return map[low] || "無法辨識";
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
      let withArt = (DATA.fighters || []).filter(
        (f) => f && f.id && f.art && !String(f.art).includes("pending-manus")
      );
      if (!withArt.length) withArt = (DATA.fighters || []).filter((f) => f && f.id);
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
      const slotId = offer.slot || pick.slot || pick.slot_id || null;
      const emptySlots = GEAR_SLOTS.filter((s) => !state.accountGear[s.id]);
      const match = slotId ? emptySlots.find((s) => s.id === slotId) : null;
      if (match) {
        state.accountGear[match.id] = pick.id;
        bumpEquipStar(1);
        return `已裝上${match.label}槽`;
      }
      return "";
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
    return lifeOver() || state.year > MAX_YEARS || !!state.lifeWiped;
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
    const wiped = !!state.lifeWiped;
    const over = lifeOver();
    state.lastResult = {
      win: false,
      reward: 0,
      rewardBlurb: wiped
        ? "出戰卡已死光——今世完結。"
        : (over ? "壽命已到——今世歲數上限。" : "人生切片已跑完。"),
      eventName: wiped ? "全軍覆沒" : (over ? "壽命到限" : "切片完結"),
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
  function rollFateOffer() {
    const picked = new Set(state.fatePicks || []);
    let pool = FATES.filter((f) => f && f.id && !picked.has(f.id));
    if (!pool.length) pool = FATES.slice();
    const offer = [];
    const used = new Set();
    const bag = shuffleInPlace(pool.slice());
    for (const f of bag) {
      if (offer.length >= 4) break;
      if (used.has(f.id)) continue;
      offer.push(f.id);
      used.add(f.id);
    }
    // 不足 4：從未揀池（或全池）允許重複補滿
    while (offer.length < 4) {
      const src = pool.length ? pool : FATES;
      if (!src.length) break;
      const f = src[Math.floor(Math.random() * src.length)];
      offer.push(f.id);
    }
    state.fateOffer = offer.slice(0, 4);
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

  function afterFateOrEventScreen() {
    if ((state.fateYearIndex | 0) < 3) {
      if (!(state.fateOffer && state.fateOffer.length)) rollFateOffer();
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
      battlesThisLife: state.battlesThisLife | 0,
      team: Array.isArray(state.team) ? state.team.slice() : [],
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
      cardCounts: cloneObj(state.cardCounts, {}),
      demoSeedVersion: state.demoSeedVersion,
      fighterStars: cloneObj(state.fighterStars, {}),
      skillStars: cloneObj(state.skillStars, {}),
      fighterLevels: cloneObj(state.fighterLevels, {}),
      fighterXp: cloneObj(state.fighterXp, {}),
      equipStars: cloneObj(state.equipStars, {}),
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
      state.battlesThisLife = Math.max(0, num(data.battlesThisLife, 0) | 0);

      const teamIn = Array.isArray(data.team) ? data.team : [];
      state.team = teamIn.filter((id) => id && fighterById[id]).slice(0, Math.max(TEAM_SIZE, 25));
      if (!state.team.length) {
        state.team = [...(DATA.default_team || [])].slice(0, TEAM_SIZE);
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
      state.fateOffer = (Array.isArray(data.fateOffer) ? data.fateOffer : [])
        .filter((id) => id && fateById[id]);
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

      if (data.cardCounts && typeof data.cardCounts === "object") state.cardCounts = { ...data.cardCounts };
      if (data.demoSeedVersion != null) state.demoSeedVersion = data.demoSeedVersion;
      if (data.fighterStars && typeof data.fighterStars === "object") state.fighterStars = { ...data.fighterStars };
      if (data.skillStars && typeof data.skillStars === "object") state.skillStars = { ...data.skillStars };
      if (data.fighterLevels && typeof data.fighterLevels === "object") state.fighterLevels = { ...data.fighterLevels };
      if (data.fighterXp && typeof data.fighterXp === "object") state.fighterXp = { ...data.fighterXp };
      if (data.equipStars && typeof data.equipStars === "object") state.equipStars = { ...data.equipStars };
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

  function requestAbandonLife() {
    if (!confirm("確定放棄今世？進度會重置，返主頁 hub。")) return;
    abandonLife();
  }

  const $ = (sel, el = document) => el.querySelector(sel);
  const screenEl = () => document.getElementById("screen");

  function fighterHp(f) {
    return (f.slots || 4) * 20 + 40;
  }

  /** 敵方跟年加乘：血／攻 ×(1+(年−1)×0.12)；special_battle 再 ×1.35（t303 加難） */
  function enemyScaleMult() {
    const year = Math.max(1, (state.year | 0) || 1);
    let m = 1 + (year - 1) * 0.12;
    const ev = state.selectedEvent;
    if (ev && ev.category === "special_battle") m *= 1.35;
    return m;
  }

  /** Demo encounter roster: up to 3 enemies, aligned with player slots. */
  function buildEnemyRoster(primaryId) {
    const primary = enemyById[primaryId];
    if (!primary) return [];

    // Named demo lineups per primary encounter (reuse art when needed).
    const templates = {
      E01: [
        { defId: "E01", id: "E01a", name: "後巷影", hp: 55, atk: 8, spd: 11, basic: "暗角刮", skill: "壁影閃", skill_cd: 4 },
        { defId: "E01", id: "E01b", name: "後巷影", hp: 80, atk: 10, spd: 10, basic: "舊帳一擊", skill: "舊帳清算", skill_cd: 4 },
        { defId: "E01", id: "E01c", name: "後巷影", hp: 55, atk: 8, spd: 9, basic: "巷尾撲", skill: "三重影", skill_cd: 4 },
      ],
      E02: [
        { defId: "E02", id: "E02a", name: "到期罐頭客", hp: 100, atk: 12, spd: 9, basic: "罐蓋劈", skill: "過期噴霧", skill_cd: 4 },
        { defId: "E01", id: "E02b", name: "後巷影", hp: 60, atk: 9, spd: 11, basic: "暗角刮", skill: "壁影閃", skill_cd: 4 },
        { defId: "E03", id: "E02c", name: "逼爆潮", hp: 70, atk: 10, spd: 13, basic: "擠擁撞", skill: "潮湧", skill_cd: 3 },
      ],
      E03: [
        { defId: "E03", id: "E03a", name: "逼爆潮", hp: 75, atk: 10, spd: 14, basic: "擠擁撞", skill: "潮湧", skill_cd: 3 },
        { defId: "E03", id: "E03b", name: "逼爆潮", hp: 100, atk: 11, spd: 14, basic: "月台湧", skill: "逼爆全線", skill_cd: 4 },
        { defId: "E03", id: "E03c", name: "逼爆潮", hp: 75, atk: 10, spd: 13, basic: "車門夾", skill: "潮湧", skill_cd: 3 },
      ],
      E04: [
        { defId: "E04", id: "E04a", name: "舊帳・睇門口", hp: 160, atk: 15, spd: 11, basic: "睇場拳", skill: "舊帳清算", skill_cd: 4 },
        { defId: "E02", id: "E04b", name: "到期罐頭客", hp: 80, atk: 11, spd: 9, basic: "罐蓋劈", skill: "過期噴霧", skill_cd: 4 },
        { defId: "E01", id: "E04c", name: "後巷影", hp: 70, atk: 10, spd: 12, basic: "舊帳一擊", skill: "壁影閃", skill_cd: 4 },
      ],
    };

    const list = templates[primaryId] || [
      {
        defId: primary.id,
        id: primary.id + "a",
        name: primary.name,
        hp: Math.round(primary.hp * 0.7),
        atk: Math.max(1, Math.round(primary.atk * 0.85)),
        spd: primary.spd + 1,
        basic: "舊帳一擊",
        skill: "舊帳清算",
        skill_cd: 4,
      },
      {
        defId: primary.id,
        id: primary.id + "b",
        name: primary.name,
        hp: primary.hp,
        atk: primary.atk,
        spd: primary.spd,
        basic: "舊帳一擊",
        skill: "舊帳清算",
        skill_cd: 4,
      },
      {
        defId: primary.id,
        id: primary.id + "c",
        name: primary.name,
        hp: Math.round(primary.hp * 0.7),
        atk: Math.max(1, Math.round(primary.atk * 0.85)),
        spd: Math.max(1, primary.spd - 1),
        basic: "舊帳一擊",
        skill: "舊帳清算",
        skill_cd: 4,
      },
    ];

    const mult = enemyScaleMult();
    return list.slice(0, TEAM_SIZE).map((t) => {
      const def = enemyById[t.defId] || primary;
      const atk = Math.max(1, Math.round((t.atk | 0) * mult));
      const hp = Math.max(1, Math.round((t.hp | 0) * mult));
      const spd = Math.max(1, Math.round((t.spd | 0) * (1 + Math.max(0, ((state.year | 0) - 1) * 0.03))));
      return {
        side: "enemy",
        id: t.id,
        defId: t.defId,
        name: def.name, // 同名：唔用左／右／跟班後綴
        atk,
        spd,
        basic: t.basic,
        skill: t.skill,
        skill_cd: t.skill_cd || 4,
        art: def.art,
        basic_power: fighterBasicPower(
          t.basic_power != null ? t : def
        ),
        maxHp: hp,
        hp,
        turnsTaken: 0,
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
    // 物防／魔防：每點減 1 傷（下限 1）；魔攻技扣 mdef，其餘扣 def
    const flatDef =
      power === "magic"
        ? (target && (target.mdef | 0)) || 0
        : (target && (target.def | 0)) || 0;
    dmg = Math.max(1, dmg - flatDef);
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
      if (Date.now() < helpBlockClickUntil) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      // 短點唔開 inspect，避免誤觸
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
    const lines = [`「${f.name || ""}」`, `Lv.${lv}｜★${star}｜稀有 ${rare}｜${bits.join(" ")}`];
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

  function equipHelpText(item, slotMeta) {
    if (!item) {
      const label = (slotMeta && slotMeta.label) || "裝備槽";
      const hint = (slotMeta && slotMeta.hint) || "";
      return hint ? `${label}——${hint}` : `${label}——點選槽位循環裝／卸`;
    }
    const eff = effectiveEquipStats(item);
    const star = equipStarOf(item);
    const maxStar = Number(item.max_star) || 5;
    const starTxt = "★".repeat(star) + "☆".repeat(Math.max(0, maxStar - star));
    const rare = rarityEquipLabel(item.rarity) || item.rarity || "";
    const bits = [];
    if (eff.atk) bits.push("攻+" + eff.atk);
    if (eff.spd) bits.push("速+" + eff.spd);
    if (eff.hp) bits.push("血+" + eff.hp);
    if (eff.def) bits.push("防+" + eff.def);
    const blurb = item.flavor || item.blurb || "";
    const lines = [`「${item.name || ""}」`];
    lines.push(`${rare ? "稀有 " + rare + "｜" : ""}${starTxt}`);
    if (bits.length) lines.push(bits.join(" "));
    if (blurb) lines.push(blurb);
    return lines.join("\n");
  }

  function enemyHelpPayloadAttr(e) {
    if (!e) return "";
    const def = enemyById[e.defId || e.id] || e;
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
    const def = enemyById[e.defId || e.id] || e;
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
      `稀有 ${rare}｜攻${atk ?? "?"} 速${spd ?? "?"} 血${hp ?? "?"}`,
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
    "btn-ok": "確認收取獎勵，繼續今次故事遭遇（留在故事流）。",
    "btn-abandon": "放棄今世——確認後重置今世進度並返回外層主頁 hub。進入故事後不可以只返回主頁而保留進度。",
    "btn-reset": "清空今世戰鬥卡隊與帶入技能（lifeSkills 清空）；主人裝備不清空。要重新選取後再「準備好了」。",
    "btn-confirm": "確認口袋帶入（最少 1 張）；準備出發後再揀身世同人生命運。",
    "btn-ready": "準備出發——確認今世帶入的主人裝備＋戰鬥卡口袋＋技能（每世一次）。確認後先選身世，再進入人生命運（第1–3年），之後才一般遭遇。口袋最少 1 張。",
    "prep-fighter": "戰鬥卡：面板只顯示已選隊（大圖＋星）。點選面板／空位＋ →「選擇初始戰鬥卡」由已獲得戰鬥卡選入／剔出；上限＝統率（硬頂 25）。每場最多 3 張部署。長按查看卡內容。",
    "gear-slot": "帳號裝備（頭／身／武／副／飾／足）——點選槽位或「更換裝備」開啟「選擇初始裝備卡」；選擇裝上／取消卸下；數值加乘套用全體出戰卡。",
    "btn-equip-star": "為已裝裝備各升 1 星（上限 5）；有效數值 = 底數 + 每星加成×(星-1)。",
    "btn-fight": "開始戰鬥——全自動戰，可加速／放棄。",
    "btn-speed": "切換 ×1／×2／×3 播放速度。",
    "btn-forfeit": "放棄本場＝敗北結算後仍留故事流；只鎖定已經陣亡的出戰卡與其技能，仍存活的不鎖定。",
    "btn-ding": "確認結算，繼續今次故事遭遇（不返回主頁）。",
    "btn-again": "繼續故事——留在故事流，再進入今次遭遇。",
    "tab-life": "今世：人生 hub、開始／繼續人生。",
    "tab-book": "卡冊（收藏／升星）——戰鬥卡／技能卡／裝備卡。",
    "tab-teahouse": "茶記：街市／商人向休閒福利據點（無廣告）。",
    "tab-jobs": "差事：每日任務板——宿敵／戰鬥／奇遇／升星等，每日重置。",
    "tab-more": "更多：設定等。",
    "event-battle": "遇敵類事件——確認後編隊再開打。",
    "event-soft": "人情／搵食／節慶向——不必戰鬥，收取膠幣即可。",
    "event-minigame": "小遊戲關——點選後進入短場破關（約數十秒）。通過領滿獎；失敗半獎或輕懲，人生繼續、不會卡死。",
    "event-faction": "勢力支線——點選後短暫選邊（幫忙／中立／婉拒）。改今世好感（0–5），可換人情回報；人生不停、不會卡死。",
    "btn-equip": "技能卡：今世最多帶入 10 張。點選面板／＋ →「選擇初始技能卡」由已獲得技能選入 lifeSkills；裝備／預設裝技只可用這 10 張。長按查看技能內容。",
    "btn-equip-next": "配技完成——有戰鬥就入遇敵，否則返今次遭遇（故事流）。",
    "btn-unequip": "卸下此格技能。",
    "skill-pick": "今世技能口袋（最多 10）：點選更換在彈窗選取帶入人生的技能；之後出戰裝技只可以由這批選取。",
    "deploy-slot": "出戰位——短按開啟選卡；已填則長按查看該出戰卡內容；空位＝＋選出戰卡。",
    "origin-pick": "選擇身世——四揀一（2×2 有圖）：兩張增益、兩張減益；揀一張套用六維加減，再進入人生命運。",
    "fate-pick": "人生命運——四揀一（增益／減益／混合）；揀一張結算後＋1歲。",
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
    const hr = host.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const left = Math.max(8, (hr.width - tw) / 2);
    tip.style.left = left + "px";
    tip.style.top = "10px";
    tip.classList.add("help-tip-top");

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


  function render() {
    hideHelpTip();
    dismissForfeitConfirm();
    const root = screenEl();
    root.innerHTML = "";
    const bgMap = {
      title: "bg-title",
      home: "bg-home",
      missions: "bg-home",
      storyPacks: "bg-home",
      storyPackDetail: "bg-home",
      album: "bg-home",
      events: "bg-events",
      soft: "bg-soft",
      minigame: "bg-soft",
      faction: "bg-soft",
      shop: "bg-soft",
      trade: "bg-soft",
      starup: "bg-soft",
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
    const map = {
      title: viewTitle,
      home: viewHome,
      gacha: viewGacha,
      missions: viewMissions,
      storyPacks: viewStoryPacks,
      storyPackDetail: viewStoryPackDetail,
      album: viewAlbum,
      events: viewEvents,
      soft: viewSoft,
      minigame: viewMinigame,
      faction: viewFaction,
      shop: viewShop,
      trade: viewTrade,
      starup: viewStarUp,
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


  function viewMissions(root) {
    ensureDaily();
    const list = dailyMissionList();
    const d = state.daily;
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
        btn = `<button type="button" class="btn small ghost dm-claim" disabled>未完成</button>`;
      }
      return `
        <div class="dm-row${claimed ? " claimed" : ""}${done && !claimed ? " ready" : ""}" data-mid="${esc(m.id)}">
          <div class="dm-main">
            <div class="dm-name">${esc(m.name)}</div>
            <div class="dm-desc">${esc(m.desc || "")}</div>
            <div class="dm-bar"><span style="width:${pct}%"></span></div>
            <div class="dm-meta"><span class="dm-prog">${cur}/${tgt}</span><span class="dm-reward">${esc(rewardBlurbOf(m))}</span></div>
          </div>
          <div class="dm-act">${btn}</div>
        </div>`;
    }).join("");
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>差事 · ${esc(d.dateKey)}</span>
        <span class="chip soul"><span class="dot"></span>${esc(L["ui.resource"] || "膠幣")} ${state.soul}</span>
        <span class="chip gold"><span class="dot"></span>金幣 ${state.gold | 0}</span>
      </div>
      <div class="ribbon">每日差事</div>
      <p class="sub">每日重置（Asia/Hong_Kong）· 跨世保留甲子／升星總計</p>
      <div class="dm-list">${rows || "<div class='soft-panel'>未有任務模板</div>"}</div>
      <div class="spacer"></div>
      <button class="btn ghost" id="btn-dm-back" type="button">返主頁</button>
      <nav class="tab-bar" aria-label="主選單">
        <button class="tab" type="button" id="tab-book" data-help="tab-book"><span class="ico">📖</span>卡冊</button>
        <button class="tab" type="button" id="tab-life" data-help="tab-life"><span class="ico">🏠</span>今世</button>
        <button class="tab" type="button" id="tab-teahouse" aria-disabled="true" data-help="tab-teahouse"><span class="ico">🍜</span>茶記</button>
        <button class="tab on" type="button" id="tab-jobs" data-help="tab-jobs"><span class="ico">📋</span>差事</button>
        <button class="tab" type="button" id="tab-more" aria-disabled="true" data-help="tab-more"><span class="ico">⋯</span>更多</button>
      </nav>
      <div id="home-toast" class="home-toast" hidden></div>
    `;
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
    $("#btn-dm-back", root).onclick = () => { state.screen = "home"; render(); };
    $("#tab-life", root).onclick = () => { state.screen = "home"; render(); };
    $("#tab-jobs", root).onclick = () => { ensureDaily(); state.screen = "missions"; render(); };
    ["tab-teahouse","tab-more"].forEach((id) => {
      const el = $("#"+id, root);
      if (el) el.onclick = () => toast("這個位置尚未開放。");
    });
    const tabBookM = $("#tab-book", root);
    if (tabBookM) tabBookM.onclick = () => { state.screen = "album"; render(); };
    const tabLifeM = $("#tab-life", root);
    if (tabLifeM) tabLifeM.onclick = () => { state.screen = "home"; render(); };
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
        return `
        <button type="button" class="pack-card${soon ? " coming" : ""}${on ? " active-pack" : ""}" data-pack="${esc(p.id)}" data-help="btn-story">
          <img src="${esc(p.cover || "")}" alt="${esc(p.name)}" />
          <div class="pack-meta">
            <div class="pack-name">${esc(p.name)}</div>
            <div class="pack-blurb">${esc(p.blurb || "")}</div>
            <span class="pack-status ${soon ? "soon" : "ok"}">${soon ? "即將" : (on ? "使用中" : "可選")}</span>
          </div>
        </button>`;
      }).join("")}</div>`;
    }
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>故事包</span>
        <span class="chip soul"><span class="dot"></span>模組 · 非直線劇</span>
      </div>
      <div class="ribbon">故事包</div>
      <p class="sub">可選模組注入主線氣氛——人生骨架永遠非直線</p>
      ${body}
      <div class="spacer"></div>
      <button class="btn ghost" id="btn-pack-back" type="button" data-help="btn-back">返主頁</button>
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
    const evNames = (DATA.events || [])
      .filter((e) => boost.has(e.id) || (pack.event_ids || []).includes(e.id))
      .map((e) => e.name);
    const listHtml = evNames.length
      ? `<ul class="pack-ev-list">${evNames.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : `<p class="sub">此包未掛事件——人生照常進行。</p>`;
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
        <div class="soft-panel pack-detail-note">故事包只是氣氛模組；進入故事後仍是命運／四揀一混其他類型，不會變成單一條直線劇。</div>
        <div class="pack-ev-title">含事件</div>
        ${listHtml}
      </div>
      <div class="btn-row pack-detail-actions">
        <button class="btn ghost" id="btn-pack-list" type="button" data-help="btn-back">返列表</button>
        <button class="btn pink" id="btn-pack-use" type="button" data-help="btn-story-pick">${active ? "已用此包氣氛" : "以此包氣氛入故事"}</button>
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
    $("#btn-pack-use", root).onclick = () => {
      if (pack.status !== "available") {
        toast("稍後開放——此包尚未到");
        return;
      }
      state.activeStoryPackId = pack.id;
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
        <button type="button" class="chip gacha-entry" id="btn-gacha-entry" data-gacha-entry title="廟街霓虹扭蛋機">霓虹扭蛋</button>
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
        <button class="tab" type="button" id="tab-teahouse" aria-disabled="true" data-help="tab-teahouse"><span class="ico">🍜</span>茶記</button>
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
        if (!(state.fateOffer && state.fateOffer.length)) rollFateOffer();
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
    ["side-spin","side-welfare","side-path","tab-teahouse","tab-more"].forEach((id) => {
      const el = $("#"+id, root);
      if (el) el.onclick = () => toast("這個位置尚未開放——請點選「舊帳」或「開始人生／繼續上次未完人生」繼續。");
    });
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

  function viewEvents(root) {
    if ((state.fateYearIndex | 0) < 3) {
      if (!(state.fateOffer && state.fateOffer.length)) rollFateOffer();
      state.screen = "fate";
      viewFate(root);
      return;
    }
    const yearEvs = rollYearEvents(state.year);
    const cards = yearEvs
      .map((ev) => {
        const catLabel = eventCategoryLabel(ev);
        const catCls = CATEGORY_PILL_CLASS[ev.category] || "cat-default";
        const isMinigame = ev.category === "minigame";
        const isFaction = ev.category === "faction";
        const cat = ev.category || "";
        const isShop = cat === "shop_equip" || cat === "shop_fighter" || cat === "shop_skill";
        const isTrade = cat === "card_trade";
        const isStarUp = cat === "star_up";
        const outcome = isMinigame ? "須破關"
          : (isFaction ? "選邊站"
          : (isShop ? "金幣選購"
          : (isTrade ? "以物易物"
          : (isStarUp ? "金幣升星"
          : (ev.battle ? "可能開打" : "直接收工")))));
        const tagCls = ev.battle ? "fight" : (isMinigame ? "minigame" : (isFaction ? "faction" : ""));
        const helpKey = isMinigame ? "event-minigame" : (isFaction ? "event-faction" : (ev.battle ? "event-battle" : "event-soft"));
        // Reward chips: +經驗/+魂焰/etc. Dedupe「可能開打」— tag already says it.
        const rawRewards = (ev.rewards_preview && ev.rewards_preview.length)
          ? ev.rewards_preview
          : [];
        const rewards = rawRewards.filter((r) => {
          const t = String(r || "").trim();
          if (!t) return false;
          if (t === "可能開打" || t === "直接收工" || t === "須破關" || t === "選邊站") return false;
          if (t.includes("可能開打")) return false;
          return true;
        });
        let chips = rewards.slice(0, 3);
        if (!chips.length) {
          if (ev.reward_xp) chips.push(`+${ev.reward_xp | 0} 經驗`);
          if (ev.reward_soul) chips.push(`+${ev.reward_soul | 0} 膠幣`);
        }
        const rewardRow = chips
          .map((r) => `<span class="ev-reward">${esc(r)}</span>`)
          .join("");
        const blurbText = String(ev.reward_blurb || "").trim();
        const blurbHtml = blurbText
          ? `<div class="ev-card-blurb">${esc(blurbText)}</div>`
          : "";
        return `
        <button class="event-card" type="button" data-id="${esc(ev.id)}" data-help="${helpKey}" aria-label="${esc(ev.name)}">
          <span class="ev-cat-pill ${catCls}"><i class="ev-cat-dot" aria-hidden="true"></i>${esc(catLabel)}</span>
          <img src="${esc(ev.art)}" alt="${esc(ev.name)}" />
          <div class="label">
            <div class="ev-name">${esc(ev.name)}</div>
            <span class="tag ${tagCls}">${esc(catLabel)} · ${outcome}</span>
            <div class="ev-rewards">${rewardRow}</div>
            ${blurbHtml}
          </div>
        </button>`;
      })
      .join("");

    let confirmModal = "";
    if (state.eventConfirmOpen && state.selectedEvent && state.selectedEvent.battle) {
      const ev = state.selectedEvent;
      const roster = buildEnemyRoster(ev.battle);
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
        <div class="modal-mask" id="event-confirm-mask" role="dialog" aria-modal="true" aria-label="開始事件？">
          <div class="modal-sheet event-confirm-sheet" id="event-confirm-sheet">
            <div class="modal-title">開始事件？</div>
            <div class="ec-name">${esc(ev.name)}</div>
            <p class="ec-desc">${esc(ev.desc || "")}</p>
            <div class="ec-enemy-row">${preview || "<span class=\"muted\">敵方預覽</span>"}</div>
            <div class="modal-actions">
              <button type="button" class="btn ghost" id="btn-ec-cancel">我改主意了</button>
              <button type="button" class="btn gold" id="btn-ec-go">開始吧</button>
            </div>
          </div>
        </div>`;
    }

    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("今次遭遇")}</div>
      <div class="speed-strip"></div>
      <p class="sub">本年 ${yearEvs.length} 張揀一 · ${isSpecialBattleYear(state.year) ? "五年一劫・宿敵" : "多類型遭遇"}</p>
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
        state.eventConfirmOpen = false;
        state.deploy = [];
        state.selectAllySlot = null;
        state.fighterDetailId = null;
        state.detailSkillPick = null;
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
    // 升星攤：金幣升戰鬥卡星（唔燒合卡複本）
    if (cat === "star_up") {
      state.eventConfirmOpen = false;
      state.shopLeftEmpty = false;
      state.starUp = { focusId: null };
      state.screen = "starup";
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
    // main／side／trial／adventure／special_battle：有戰→確認；無戰→soft
    if (ev.battle) {
      state.eventConfirmOpen = true;
      state.screen = "events";
      render();
    } else {
      state.eventConfirmOpen = false;
      state.screen = "soft";
      render();
    }
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
      <div class="soft-scroll">
        <img class="result-art soft-art" src="${esc(ev.art)}" alt="" />
        <div class="bubble neon">${esc(result.choiceLabel || "已選擇")}</div>
        <div class="soft-panel">${favorBits}${extraBits}${esc(noteText)}
          <br/>今世賺了 <b style="color:var(--neon-gold)">+${result.soul | 0}</b> 膠幣${(result.xp | 0) ? ` · 經驗 +${result.xp | 0}` : ""}${(result.gold | 0) ? ` · 金幣 +${result.gold | 0}` : ""}
          · <span style="color:var(--neon-cyan)">${esc(fname)} ${curFavorNow}/${FACTION_FAVOR_MAX}</span>
          · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span>
        </div>
      </div>
      <div class="soft-cta">
        <button class="btn gold" id="btn-fac-ok" data-help="btn-ok">繼續</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
      $("#btn-fac-ok", root).onclick = () => {
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
            rewardBlurb: lifeOver() ? "壽命已到——今世歲數上限。" : "人生切片已跑完。",
            eventName: lifeOver() ? "壽命到限" : "切片完結",
            deadNames: [],
          };
          state.screen = "result";
        } else {
          state.screen = afterFateOrEventScreen();
        }
        render();
      };
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
    const btns = choices
      .map((c) => {
        const fd = c.favor_delta | 0;
        const hint = fd > 0 ? `好感＋${fd}` : (fd < 0 ? `好感${fd}` : "好感不變");
        return `<button type="button" class="btn fac-choice" data-choice="${esc(c.id)}" data-help="event-faction">
          <span class="fac-choice-label">${esc(c.label)}</span>
          <span class="fac-choice-hint">${esc(hint)} · 膠幣 +${c.soul | 0}</span>
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
          · 現時好感 <b>${curFavor}/${FACTION_FAVOR_MAX}</b>
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
        // 幸運只加成魂焰顯示／入帳
        let soul = c.soul | 0;
        const beforeLuck = soul;
        soul = applyLuckToReward(Math.max(1, soul));
        if (soul !== beforeLuck) extraNotes.push(`幸運×${luckRewardMult().toFixed(2)}`);
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

  function buildTradeTakeOffers(excludeId) {
    albumEnsureState();
    let withArt = (DATA.fighters || []).filter(
      (f) => f && f.id && f.id !== excludeId && f.art && !String(f.art).includes("pending-manus")
    );
    if (!withArt.length) {
      withArt = (DATA.fighters || []).filter((f) => f && f.id && f.id !== excludeId);
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
    const cands = tradeGiveCandidates();
    const cards = cands.map((f) => {
      const inPocket = (state.team || []).includes(f.id);
      const rare = shopRarityLabel(f.rarity);
      const star = albumFighterStar(f.id);
      return `
        <button type="button" class="shop-card" data-give-id="${esc(f.id)}">
          <img src="${esc(f.art || "")}" alt="${esc(f.name || "")}" />
          <div class="shop-card-body">
            <div class="shop-card-name">${esc(f.name || f.id)}</div>
            <div class="shop-card-rare">${esc(rare)} · ★${star}${inPocket ? " · 口袋" : ""}</div>
            <div class="shop-price trade-tag">交出交換</div>
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

  function viewSoft(root) {
    const ev = state.selectedEvent;
    const noReward = !!state.shopLeftEmpty;
    let gain = 0;
    let luckNote = "";
    if (!noReward) {
      gain = ev.reward_soul || 10;
      const og = state.originId ? originById[state.originId] : null;
      if (og && og.bonus_soul) gain = Math.max(1, Math.round(gain * (1 + og.bonus_soul)));
      // 幸運：軟事件／奇遇 reward × (1 + luck*0.01)
      const beforeLuck = gain;
      gain = applyLuckToReward(gain);
      luckNote = gain !== beforeLuck ? `（幸運×${luckRewardMult().toFixed(2)}）` : "";
    }
    const rewardLine = noReward
      ? `未獲取額外膠幣／經驗 · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span>`
      : `今世賺了 <b style="color:var(--neon-gold)">+${gain}</b> ${esc(L["ui.resource"] || "膠幣")}${luckNote}${(ev.reward_xp|0) ? ` · 經驗 +${ev.reward_xp|0}` : ""} · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span>`;
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon(esc(ev.name))}</div>
      <div class="soft-scroll">
        <img class="result-art soft-art" src="${esc(ev.art)}" alt="" />
        <div class="bubble neon">${esc(ev.desc)}</div>
        <div class="soft-panel">${state.softNote ? `<span style="color:var(--neon-pink);font-weight:800">${esc(state.softNote)}</span><br/>` : ""}${esc(ev.reward_blurb || eventCategoryLabel(ev) || "日常")}<br/>${rewardLine}</div>
      </div>
      <div class="soft-cta">
        <button class="btn gold" id="btn-ok" data-help="btn-ok">${esc(L["ui.next_year"] || "繼續")}</button>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    const settleTo = (screen) => {
      if (!noReward) {
        state.soul += gain;
        if ((ev.reward_xp | 0) > 0) gainXp(ev.reward_xp | 0);
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
          rewardBlurb: lifeOver() ? "壽命已到——今世歲數上限。" : "人生切片已跑完。",
          eventName: lifeOver() ? "壽命到限" : "切片完結",
          deadNames: [],
        };
        state.screen = "result";
      } else {
        state.screen = screen;
      }
      render();
    };
    $("#btn-ok", root).onclick = () => settleTo(afterFateOrEventScreen());
    $("#btn-abandon", root).onclick = () => requestAbandonLife();
    wireStoryDock(root);
  }


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
    };

    const baseSoul = () => {
      let g = ev.reward_soul || 10;
      const og = state.originId ? originById[state.originId] : null;
      if (og && og.bonus_soul) g = Math.max(1, Math.round(g * (1 + og.bonus_soul)));
      return applyLuckToReward(g);
    };
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
      const pads = [];
      for (let i = 0; i < padCount; i++) {
        const lit = mg.flashIdx === i ? " lit" : "";
        const disabled = (mg.phase !== "input") ? " disabled" : "";
        pads.push(
          `<button type="button" class="mg-pad${lit}${disabled}" data-pad="${i}" style="--mg-c:${PAD_COLORS[i]}" ${mg.phase !== "input" ? "disabled" : ""} aria-label="${PAD_LABELS[i]}">` +
          `<span class="mg-pad-label">${PAD_LABELS[i]}</span></button>`
        );
      }
      let cta = "";
      if (mg.phase === "intro") {
        cta = `<button class="btn gold" id="btn-mg-start" type="button">開始破關</button>
          <button class="btn ghost" id="btn-mg-skip" type="button">放棄（半獎）</button>`;
      } else if (mg.phase === "won" || mg.phase === "lost") {
        cta = `<button class="btn gold" id="btn-mg-ok" type="button" data-help="btn-ok">繼續</button>
          <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>`;
      } else {
        cta = `<button class="btn ghost" id="btn-mg-skip" type="button">放棄（半獎）</button>`;
      }
      const rewardLine = (mg.phase === "won" || mg.phase === "lost")
        ? `<div class="soft-panel">${esc(mg.message)}<br/>今世賺了 <b style="color:var(--neon-gold)">+${mg.rewardSoul}</b> 膠幣` +
          `${mg.rewardXp ? ` · 經驗 +${mg.rewardXp}` : ""}` +
          `${mg.rewardGold ? ` · 金幣 +${mg.rewardGold}` : ""}` +
          `${mg.won && ev.attrs_delta ? ` · ${esc(formatAttrsDelta(ev.attrs_delta).join("、") || "")}` : ""}` +
          ` · <span style="color:var(--neon-cyan)">下一歲 ${state.age + 1}歲（第 ${state.year + 1} 年）</span></div>`
        : `<div class="mg-hud"><span>第 ${mg.round}/${maxRounds} 關</span><span>剩餘 ${remain}s</span><span>${esc(phaseLabel)}</span></div>
           <div class="bubble neon mg-msg">${esc(mg.message)}</div>`;

      root.innerHTML = `
        ${lifeHudHtml()}
        <div class="ribbon">${ageRibbon(esc(ev.name) + " · 小遊戲")}</div>
        <div class="mg-wrap">
          <p class="sub mg-sub">${esc(ev.desc || "記憶破關")}</p>
          ${rewardLine}
          <div class="mg-pads" style="--mg-n:${padCount}">${pads.join("")}</div>
        </div>
        <div class="soft-cta mg-cta">${cta}</div>
        ${storyDockHtml()}
      `;
      wireStoryDock(root);
      const startBtn = $("#btn-mg-start", root);
      if (startBtn) startBtn.onclick = () => beginRun();
      const skipBtn = $("#btn-mg-skip", root);
      if (skipBtn) skipBtn.onclick = () => endRun(false, "已放棄破關——半獎，人生繼續。");
      const okBtn = $("#btn-mg-ok", root);
      if (okBtn) okBtn.onclick = () => settleMinigameToLife();
      const ab = $("#btn-abandon", root);
      if (ab) ab.onclick = () => requestAbandonLife();
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
          mg.inputDeadlineAt = Date.now() + 10000;
          paint();
          schedule(() => {
            if (mg.phase === "input") endRun(false, "輸入逾時——半獎，人生繼續。");
          }, 10000);
          return;
        }
        mg.flashIdx = mg.sequence[step];
        paint();
        schedule(() => {
          mg.flashIdx = -1;
          paint();
          step += 1;
          schedule(flashNext, 220);
        }, 480);
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
        endRun(false, "順序有誤——半獎，人生繼續。");
        return;
      }
      mg.inputIdx += 1;
      mg.flashIdx = idx;
      paint();
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
          rewardBlurb: lifeOver() ? "壽命已到——今世歲數上限。" : "人生切片已跑完。",
          eventName: lifeOver() ? "壽命到限" : "切片完結",
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

  function rarityEquipLabel(r) {
    const map = { common: "普通", rare: "稀有", legend: "傳奇", epic: "稀有" };
    return map[r] || r || "";
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
        <div class="lh-attrs" role="list">
          <span class="lh-a" role="listitem" title="力量：每 1 點＝所有戰鬥卡 +1 物攻、+5 HP">💪${a.str}</span>
          <span class="lh-a" role="listitem" title="敏捷：每 1 點＝所有戰鬥卡 +1 物防、+1 魔防">⚡${a.agi}</span>
          <span class="lh-a" role="listitem" title="智力：每 1 點＝所有戰鬥卡 +1 魔攻、+5 HP">🧠${a.intel}</span>
          <span class="lh-a" role="listitem" title="幸運：用於人生事件或奇遇事件獎勵">🍀${a.luck}</span>
          <span class="lh-a" role="listitem" title="統率：今世戰鬥卡數量上限">👑${a.lead}</span>
          <span class="lh-a" role="listitem" title="壽命：今次人生歲數上限">⏳${a.life}</span>
        </div>
        <div class="lh-right">
          <span class="chip soul" title="膠幣"><span class="dot"></span>${state.soul}</span>
          <span class="chip gold" title="金幣"><span class="dot"></span>${state.gold | 0}</span>
          <button type="button" class="chip gacha-entry" id="btn-gacha-entry" data-gacha-entry title="廟街霓虹扭蛋機">霓虹扭蛋</button>
        </div>
        <div class="lh-factions" title="今世勢力好感（0–5；隨人生重置）">${esc(factionFavorLine() || "勢力好感未開")}</div>
      </div>`;
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
          const cap = fighterPocketCap();
          const names = (state.team || [])
            .map((id) => (fighterById[id] && fighterById[id].name) || id)
            .filter(Boolean);
          storyToast(root, `盟友口袋 ${names.length}/${cap}：${names.join("、") || "（空）"} · 故事中管理後補`);
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
        return `<button type="button" class="prep-gear-slot filled${foc}" data-gear="${esc(slot.id)}" data-help="gear-slot" data-help-text="${helpTextAttr(helpGear)}" aria-label="${esc(slot.label)} ${esc(item.name)} ${star}星">
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
        ? `<img src="${artSrc}" alt="${esc(ff.name)}" />`
        : `<span class="pf-placeholder">無圖</span>`;
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
          ? `<img src="${esc(ff.art)}" alt="${esc(ff.name)}" />`
          : `<span class="pf-placeholder">無圖</span>`;
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
        return `<div class="pick-card gear${on ? " selected" : ""}" data-help="gear-slot" data-help-text="${helpTextAttr(helpText)}">
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
        <button type="button" class="chip gacha-entry" id="btn-gacha-entry" data-gacha-entry title="廟街霓虹扭蛋機">霓虹扭蛋</button>
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

  function raiseEquippedStarsToast(root, toastFn) {
    ensureGearShape();
    const byId = itemByIdLookup();
    const filledIds = GEAR_SLOTS.map((s) => state.accountGear[s.id]).filter(Boolean);
    if (!filledIds.length) {
      toastFn(root, "未有裝備可升星——先在店裡取得一件或在準備出發裝上");
      return;
    }
    let raised = 0;
    let lastName = "";
    filledIds.forEach((iid) => {
      const item = byId[iid];
      if (!item) return;
      const maxS = Math.max(1, Number(item.max_star) || 5);
      const cur = equipStarOf(item);
      if (cur >= maxS) return;
      state.equipStars[iid] = cur + 1;
      raised += 1;
      lastName = item.name;
    });
    if (!raised) {
      toastFn(root, "已裝裝備全部滿星（最多 ★5）");
      return;
    }
    bumpEquipStar(raised);
    toastFn(root, `升星＋${raised}${lastName ? " · " + lastName : ""}（累計 ${state.accountStats.equipStarsTotal}）`);
    render();
  }

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
    const key = String(raw == null ? "" : raw).trim();
    if (!key) return null;
    const map = {
      common: "普通",
      rare: "稀有",
      epic: "史詩",
      legend: "最高級",
      "普通": "普通",
      "稀有": "稀有",
      "史詩": "史詩",
      "最高級": "最高級",
      "傳奇": "最高級",
    };
    if (map[key]) return map[key];
    const low = key.toLowerCase();
    return map[low] || null;
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
   * 入冊／複本升星／滿星退焰。
   * - 新卡：albumSetCount(id,1) →「新獲得」
   * - 已擁有未滿星：★＋1、淨持有不變（扭中當材料）→「升星至★N」
   * - 已擁有且 ★＝ALBUM_MAX_STAR：唔加複本、唔升星；退 gachaPriceSingle →「已滿星，退回 N 膠幣」（封測單抽價）
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
    const starBefore = albumStarOf(kind, id, item);

    if (before <= 0) {
      albumSetCount(id, 1);
      albumMarkNewCardStar1(kind, id); // t322 新卡預設 ★1
      return {
        kind, id, name, art, rarity,
        flag: "new",
        flagLabel: "新獲得",
        star: albumStarOf(kind, id, item),
        count: albumCardCount(id),
        refund: 0,
      };
    }

    if (starBefore >= maxS) {
      const refund = gachaPriceSingle;
      state.soul = (state.soul | 0) + refund;
      return {
        kind, id, name, art, rarity,
        flag: "refund",
        flagLabel: "已滿星，退回 " + refund + " 膠幣",
        star: starBefore,
        count: before,
        refund,
      };
    }

    // 未滿星複本：直接 ★＋1，唔增加淨持有（材料已燒）
    if (kind === "fighters") state.fighterStars[id] = starBefore + 1;
    else if (kind === "skills") state.skillStars[id] = starBefore + 1;
    else {
      state.equipStars[id] = starBefore + 1;
      bumpEquipStar(1);
    }
    const starAfter = albumStarOf(kind, id, item);
    return {
      kind, id, name, art, rarity,
      flag: "starup",
      flagLabel: "升星至★" + starAfter,
      star: starAfter,
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
    if (!r || r.kind !== "fighters") return null;
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

  function gachaCardHtml(r, idx, opts) {
    opts = opts || {};
    const rareLabel = gachaNormalizeRarity(r.rarity) || "普通";
    const art = r.art
      ? ("<img src=\"" + esc(r.art) + "\" alt=\"" + esc(r.name) + "\" />")
      : "<span class=\"gacha-ph\">無圖</span>";
    const flagCls = r.flag === "new"
      ? "new"
      : (r.flag === "starup" ? "starup" : (r.flag === "refund" ? "refund" : "dupe"));
    const eggCls = "egg-" + ((idx % 5) + 1);
    const finale = opts.finale ? " gacha-finale" : "";
    const big = opts.big ? " gacha-card-big" : "";
    const particles =
      "<div class=\"gacha-card-particles\" aria-hidden=\"true\">" +
        "<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>" +
      "</div>";
    const kind = r.kind || "";
    const id = r.id || "";
    return (
      "<div class=\"gacha-card rarity-" + esc(rareLabel) + finale + big +
        "\" role=\"button\" tabindex=\"0\" title=\"點擊查看說明\"" +
        " data-rarity=\"" + esc(rareLabel) + "\"" +
        " data-id=\"" + esc(id) + "\" data-kind=\"" + esc(kind) + "\"" +
        " data-gacha-idx=\"" + (idx | 0) + "\" data-gacha-help=\"1\">" +
        "<div class=\"gacha-card-beam\" aria-hidden=\"true\"></div>" +
        "<div class=\"gacha-card-sparkles\" aria-hidden=\"true\"></div>" +
        particles +
        "<div class=\"gacha-card-shell " + eggCls + "\" aria-hidden=\"true\"></div>" +
        "<div class=\"gacha-card-art\">" + art + "</div>" +
        "<div class=\"gacha-card-meta\">" +
          "<div class=\"gacha-card-name\">" + esc(r.name) + "</div>" +
          "<div class=\"gacha-card-rare\">" + esc(rareLabel || "普通") + " · ★" + Math.max(1, r.star | 0) + "</div>" +
          "<div class=\"gacha-card-flag " + flagCls + "\">" + esc(r.flagLabel || "") + "</div>" +
          "<div class=\"gacha-card-hint\">點擊查看說明</div>" +
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
          "<img class=\"gm-art\" src=\"assets/gacha/machine-ref.webp?v=t326-1\" width=\"281\" height=\"500\" alt=\"廟街霓虹扭蛋機\" draggable=\"false\" />" +
        "</div>" +
        /* 純 CSS 示意機保留 DOM 但 display:none（.gm-css-schematic）——方便日後回退 */
        "<div class=\"gm-css-schematic\" hidden>" +
          "<div class=\"gm-dome\"></div>" +
          "<div class=\"gm-lightbox\"></div>" +
          "<div class=\"gm-cabinet\"><div class=\"gm-knob\"></div><div class=\"gm-chute\"></div></div>" +
          "<div class=\"gm-base\"></div>" +
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
      stage.innerHTML =
        (results.length
          ? ("<div class=\"gacha-results revealed " + gridCls + "\">" +
              results.map((r, i) => gachaCardHtml(r, i, {
                finale: isTen && i === results.length - 1,
                big: !isTen,
              })).join("") +
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

  function wireGachaEntry(root) {
    if (!root) return;
    root.querySelectorAll("#btn-gacha-entry, [data-gacha-entry]").forEach((btn) => {
      btn.onclick = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        enterGachaScreen();
      };
    });
  }

  function viewGacha(root) {
    ensureGachaPity();
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
    if (kind === "gear") {
      const map = { common: "普通", rare: "稀有", legend: "最高級", epic: "史詩" };
      return map[item.rarity] || item.rarity || "";
    }
    return item.rarity || "";
  }

  function albumRarityClass(kind, item) {
    const r = albumRarityKey(kind, item);
    if (r === "普通" || r === "common") return "r-common";
    if (r === "稀有" || r === "rare") return "r-rare";
    if (r === "史詩" || r === "epic") return "r-epic";
    if (r === "最高級" || r === "legend") return "r-legend";
    return "r-common";
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

  function albumArtHtml(art, name, phClass) {
    if (art) {
      return `<img src="${esc(art)}" alt="${esc(name || "")}" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${phClass || "album-cell-ph"}',textContent:'無圖'}))" />`;
    }
    return `<span class="${phClass || "album-cell-ph"}">無圖</span>`;
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
          <button type="button" class="btn album-starup-btn${canUp ? " ready" : ""}" id="album-btn-starup" ${canUp ? "" : "disabled"}>升星</button>
        </div>
        <p class="album-detail-foot">點擊彈窗以外的任意位置，可以關閉彈窗</p>
      </div>`;
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
        return `<button type="button" class="album-cell ${rareCls}" data-album-id="${esc(e.id)}" data-album-kind="${esc(e.kind)}" aria-label="${esc(e.name)} x${count}">
          <div class="album-cell-art" data-album-open="1">${albumArtHtml(e.art, e.name)}${lvBadge}<div class="album-cell-stars">${albumStarsHtml(star, Math.min(maxS, 5))}</div></div>
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
      const kind = o.kind || "buff";
      const art = o.art || "assets/events/ev-alley-wake.jpg";
      return `
      <button type="button" class="event-card fate-card origin-card kind-${esc(kind)}" data-oid="${esc(o.id)}" data-help="origin-pick" aria-label="${esc(o.name)}">
        <span class="ev-cat-pill cat-default"><i class="ev-cat-dot" aria-hidden="true"></i>${esc(fateKindLabel(kind))}</span>
        <img src="${esc(art)}" alt="${esc(o.name)}" />
        <div class="label">
          <div class="ev-name">${esc(o.name)}</div>
          <span class="tag fate-tag ${esc(kind)}">${esc(fateKindLabel(kind))}</span>
          <div class="ev-rewards"><span class="ev-reward fate-blurb-line">${esc(o.blurb || "")}</span></div>
        </div>
      </button>`;
    }).join("");
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("選擇身世")}</div>
      <div class="speed-strip"></div>
      <p class="sub">進人生第一年 · 預設 ${state.age | 0} 歲 · 四揀一 · 兩增益兩減益</p>
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
    if (!(state.fateOffer && state.fateOffer.length)) rollFateOffer();
    const n = Math.min(3, (state.fateYearIndex | 0) + 1);
    const cards = (state.fateOffer || []).map((fid) => {
      const f = fateById[fid] || { id: fid, name: fid, blurb: "", kind: "mixed" };
      const kind = f.kind || "mixed";
      const art = (f.art) || fateArt(f);
      return `
      <button type="button" class="event-card fate-card kind-${esc(kind)}" data-fid="${esc(f.id)}" data-help="fate-pick" aria-label="${esc(f.name)}">
        <span class="ev-cat-pill cat-default"><i class="ev-cat-dot" aria-hidden="true"></i>${esc(fateKindLabel(kind))}</span>
        <img src="${esc(art)}" alt="${esc(f.name)}" />
        <div class="label">
          <div class="ev-name">${esc(f.name)}</div>
          <span class="tag fate-tag ${esc(kind)}">${esc(fateKindLabel(kind))}</span>
          <div class="ev-rewards"><span class="ev-reward fate-blurb-line">${esc(f.blurb || "")}</span></div>
        </div>
      </button>`;
    }).join("");
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="ribbon">${ageRibbon("人生命運")}</div>
      <div class="speed-strip"></div>
      <p class="sub">第${n}／3年 · 四揀一 · 結算後＋1歲</p>
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
    const roster = buildEnemyRoster(ev.battle);
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
      const choices = (state.team || [])
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
          if (act === "cancel") setDeploySlot(slot, null);
          else setDeploySlot(slot, fid);
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

  function startBattle() {
    const deployIds = (state.deploy || []).filter((id) => id && !isDeadFighter(id));
    if (!deployIds.length) return;
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
    const enemies = buildEnemyRoster(ev.battle);
    if (enemyDef && enemyDef.id === "E03") {
      players.forEach((p) => {
        p.spd = Math.max(1, p.spd - 1);
      });
    }
    state.speed = 1;
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
      reward: applyLuckToReward(ev.reward_soul || 10),
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
    const useSkill = actor.turnsTaken % cd === 0;
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
      // 敵方暫無結構化技卡：沿用自帶欄（若有）否則 ×1.5
      if (actor.dmg_mult == null && !actor.heal_mult) {
        moveSpec = { dmg_mult: 1.5, hits: 1, target: "single", power: "phys" };
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
      state.soul += b.reward;
      // 勝場經驗：4＋幸運微調
      const luck = (state.attrs && state.attrs.luck) | 0;
      const xpGain = Math.max(1, 4 + Math.floor(luck / 5));
      gainXp(xpGain);
      if (state.lastResult) state.lastResult.xpGain = xpGain;
      // 卡經驗：本場參戰卡各＋FIGHTER_BATTLE_XP（帳號級；存活／陣亡同得）
      const cardXpNotes = grantDeployedCardXpFromBattle(b);
      if (state.lastResult) state.lastResult.cardXpNotes = cardXpNotes;
      trackEventMission(ev, { battleWin: true });
    }
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

  function lookupDef(unit) {
    if (!unit) return null;
    if (unit.side === "enemy") return enemyById[unit.defId || unit.id] || null;
    return fighterById[unit.id] || null;
  }

  function closeCardInspect() {
    const b = state.battle;
    const overlay = document.getElementById("card-inspect");
    if (overlay) overlay.remove();
    if (b) b.inspectOpen = false;
    resumeBattle();
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
        <div class="unit-slot ${isEnemy ? "enemy" : ""} inspectable ${u.alive ? "" : "down"}" data-unit="${sidePrefix}:${esc(u.id)}" data-side="${esc(u.side)}" data-id="${esc(u.id)}" title="長按查看卡・暫停" role="button" tabindex="0">
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
    const speedLabel =
      state.speed === 1
        ? esc(L["ui.speed2"] || "加速・兩倍")
        : state.speed === 2
          ? "再快・四倍"
          : "回復・一倍";
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
      const spd = document.getElementById("b-spd");
      if (spd) spd.textContent = state.speed + "×";
      const btn = document.getElementById("btn-speed");
      if (btn) {
        btn.textContent =
          state.speed === 1
            ? L["ui.speed2"] || "加速・兩倍"
            : state.speed === 2
              ? "再快・四倍"
              : "回復・一倍";
      }
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
    const primaryLabel = lifeDone
      ? "結算今世／返主頁"
      : esc(L["ui.next_year"] || "繼續");
    const primaryHelp = lifeDone ? "btn-abandon" : "btn-ding";
    const bubbleText = lifeDone
      ? (lifeOver()
          ? "壽命已到。結算返主頁？"
          : (r.win ? "今世跑完。結算返回主頁？" : "今世完結。結算返回主頁？"))
      : (r.win ? "茶記再加底！繼續故事遭遇？" : "謀生艱難。繼續故事再查看？");
    root.innerHTML = `
      ${lifeHudHtml()}
      <div class="result-body">
        <div class="result-banner ${r.win ? "win" : "lose"}">${banner}</div>
        ${r.enemyArt ? `<img class="result-art" src="${esc(r.enemyArt)}" alt="" />` : ""}
        <div class="soft-panel result-panel">
          ${r.eventName ? `<div class="result-ev">${esc(r.eventName)}</div>` : ""}
          ${r.win ? `膠幣 <b style="color:var(--neon-gold)">+${r.reward}</b>${r.xpGain ? ` · 經驗 <b style="color:var(--neon-lime)">+${r.xpGain}</b>` : ""}` : "沒有賺到膠幣"}
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
          ${lifeDone ? `<br/><span style="color:var(--neon-pink)">${lifeOver() ? "壽命已到——" : (state.lifeWiped ? "出戰卡已死光——" : "人生切片已跑完——")}可結算今世返主頁。</span>` : ""}
        </div>
      </div>
      <div class="result-cta">
        <button type="button" class="bubble result-bubble" id="btn-bubble" data-help="${primaryHelp}">${bubbleText}</button>
        <div class="result-btns">
          <button class="btn gold" id="btn-ding" data-help="${primaryHelp}">${primaryLabel}</button>
        </div>
        <button class="btn ghost danger btn-abandon-compact" id="btn-abandon" data-help="btn-abandon">放棄今世</button>
      </div>
      ${storyDockHtml()}
    `;
    const primaryAction = lifeDone ? endLife : goStory;
    $("#btn-ding", root).onclick = primaryAction;
    $("#btn-bubble", root).onclick = primaryAction;
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
