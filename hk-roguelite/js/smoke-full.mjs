/**
 * 封測包：一次跑完所有關鍵流程，做為推 PR 前嘅總檢查。
 *
 * 覆蓋：
 *   1. 四角開局（HP／能量／starter／專屬牌／路線不重複）
 *   2. Act 內分支（三區各 1 個，兩路都試，結果差異可見）
 *   3. 便利店（金幣出口、遺物貨架、消耗品）
 *   4. 遺物（效果接到局況、錯角無效、專屬標示）
 *   5. near-miss（敗北診斷四種情況都有文案）
 *   6. 再開一局（通關／敗北都有大掣）
 *
 * 用法：node js/smoke-full.mjs
 */
import {
  CHARACTERS,
  CARDS,
  RELICS,
  CONSUMABLES,
  ACT1_MAP,
  ACT2_MAP,
  ACT3_MAP,
  EVENT_POOLS,
  EVENTS,
  ENEMIES,
  SHOP,
  START_GOLD,
  SIGNATURE_CARDS,
  ACT_TRANSITIONS,
  REST_SHOP_BY_ACT,
  mapForAct,
  actDisplayName,
  enemyById,
  relicBonuses,
  unownedRelics,
  pickShopRelics,
  pickShopConsumables,
  pickRewardChoices,
  branchOptionById,
  battleGoldReward,
  pickEventId,
  restShopForAct,
  shopCardIdForAct,
  REWARD_POOL,
  classifyRewardCard,
  EXPECTED_REWARD_ROUTE,
} from "./data.js";
import { createBattle, playCard, endTurn, startPlayerTurn } from "./battle.js";
import { readFileSync } from "node:fs";

let checks = 0;
const failures = [];

function assert(cond, msg) {
  checks += 1;
  if (!cond) {
    failures.push(msg);
    throw new Error(msg);
  }
}

function section(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.log(`  ✗ ${name}：${e.message}`);
    throw e;
  }
}

const CHAR_IDS = Object.keys(CHARACTERS);

function mkRun(charId) {
  const c = CHARACTERS[charId];
  return {
    characterId: charId,
    act: 1,
    hp: c.maxHp,
    maxHp: c.maxHp,
    energy: c.energy,
    gold: START_GOLD,
    deck: [...c.starterDeck],
    relics: [],
    encounters: [],
    victories: 0,
    nextBattleEnergyPenalty: 0,
    nextBattleEnergyBonus: 0,
    nextBattleBlock: 0,
  };
}

console.log("\n=== 香江小風波・封測包 ===\n");

/* ---------- 1. 四角開局 ---------- */
section("四角開局", () => {
  assert(CHAR_IDS.length === 4, `角色數應為 4，實際 ${CHAR_IDS.length}`);

  const routes = [];
  for (const id of CHAR_IDS) {
    const c = CHARACTERS[id];
    assert(c.name && c.name.length >= 3, `${id} 缺名`);
    assert(c.passive?.name && c.passive?.desc, `${id} 缺被動`);
    assert(c.starterDeck.length >= 9, `${id} starter 太薄（${c.starterDeck.length}）`);
    assert(c.route, `${id} 缺 route`);
    assert(c.playstyle, `${id} 缺 playstyle`);
    assert(c.openLine, `${id} 缺 openLine`);
    routes.push(c.route);

    // starter 至少 1 張自己專屬
    const own = c.starterDeck.filter((cid) => CARDS[cid]?.owner === id);
    assert(own.length >= 1, `${id} starter 冇自己專屬牌`);

    // 專屬 3 張且 owner 正確
    const sig = SIGNATURE_CARDS[id] || [];
    assert(sig.length === 3, `${id} 專屬應為 3 張，實際 ${sig.length}`);
    for (const cid of sig) {
      assert(CARDS[cid]?.owner === id, `${cid} owner 唔係 ${id}`);
    }

    // 開局金幣夠買最便宜消耗品
    const cheapest = Math.min(...Object.values(CONSUMABLES).map((x) => x.price));
    assert(START_GOLD >= cheapest, `開局 ${START_GOLD} 金買唔到 ${cheapest} 金消耗品`);
  }
  // 四角路線互不相同
  assert(new Set(routes).size === 4, `角色路線重複：${routes.join("/")}`);
});

/* ---------- 2. Act 內分支 ---------- */
section("Act 內分支（三區各一，兩路都試）", () => {
  const maps = [
    [1, ACT1_MAP],
    [2, ACT2_MAP],
    [3, ACT3_MAP],
  ];
  for (const [act, map] of maps) {
    assert(map.length === 6, `Act${act} 節點數應為 6`);
    const branch = map.find((n) => n.type === "branch");
    assert(branch, `Act${act} 缺分支節點`);
    assert(branch.options.length >= 2, `${branch.id} 分支選項不足`);
    assert(new Set(branch.options.map((o) => o.kind)).size >= 2, `${branch.id} 兩路要唔同類型`);

    // 模擬兩邊
    const results = [];
    for (const opt of branch.options) {
      const run = mkRun("oil");
      const before = { hp: run.hp, gold: run.gold };
      if (opt.bonusGold) run.gold += opt.bonusGold;
      if (opt.bonusHp) run.hp = Math.min(run.maxHp, run.hp + opt.bonusHp);
      const changed = run.hp !== before.hp || run.gold !== before.gold;
      assert(changed, `${branch.id}/${opt.id} 揀完冇可見改動`);
      results.push({ kind: opt.kind, hp: run.hp, gold: run.gold });
    }
    // 兩邊結果要摸得到差（唔可以完全一樣）
    const sig = results.map((r) => `${r.kind}:${r.hp}:${r.gold}`);
    assert(new Set(sig).size >= 2, `${branch.id} 兩邊結果一樣，摸唔到差`);
  }
});

/* ---------- 3. 便利店 ---------- */
section("便利店（金幣出口／遺物／消耗品／Act 差異）", () => {
  assert(SHOP.healCost > 0 && SHOP.healAmt > 0, "治療價／量唔合法");
  assert(SHOP.cardCost > 0, "執牌價唔合法");
  assert(SHOP.relicCost > 0, "遺物價唔合法");
  assert(SHOP.packCost > 0, "卡包價唔合法");
  assert(SHOP.rerollCost > 0, "換貨價唔合法");

  // 開局金幣買得起最便宜嘅嘢
  const cheapest = Math.min(SHOP.healCost, SHOP.cardCost, SHOP.rerollCost);
  assert(START_GOLD >= cheapest, `開局金幣買唔到任何東西（最便宜 ${cheapest}）`);

  // Act 差異化：三區副標／執牌貨／休息升級牌都唔可以一樣
  const cards = [1, 2, 3].map((a) => shopCardIdForAct(a));
  assert(new Set(cards).size === 3, `三區執牌貨應互異，實際 ${cards.join(",")}`);
  const upgrades = [1, 2, 3].map((a) => restShopForAct(a).restUpgradeCardId);
  assert(new Set(upgrades).size === 3, `三區磨刀牌應互異，實際 ${upgrades.join(",")}`);
  const subs = [1, 2, 3].map((a) => restShopForAct(a).subtitle);
  assert(new Set(subs).size === 3, "三區便利店副標重複");
  const healLabels = [1, 2, 3].map((a) => restShopForAct(a).shopHealLabel);
  assert(new Set(healLabels).size === 3, "三區回血標籤重複");
  assert(Object.keys(REST_SHOP_BY_ACT).length >= 3, "REST_SHOP_BY_ACT 缺區");

  // 遺物貨架每次都抽夠
  const run = { characterId: "oil", relics: [] };
  for (let i = 0; i < 20; i++) {
    const stock = pickShopRelics(run, 2);
    assert(stock.length === 2, `遺物貨架抽唔夠：${stock.length}`);
    // 唔可以抽到別角專屬
    for (const rid of stock) {
      const owner = RELICS[rid]?.owner;
      assert(!owner || owner === "oil", `貨架出現別角專屬 ${rid}`);
    }
  }
  // 消耗品（含 Act 專屬）
  assert(Object.keys(CONSUMABLES).length >= 7, "消耗品應 ≥7（含三區專屬）");
  for (const act of [1, 2, 3]) {
    const exclusive = Object.values(CONSUMABLES).filter(
      (c) => Array.isArray(c.acts) && c.acts.length === 1 && c.acts[0] === act
    );
    assert(exclusive.length >= 1, `Act${act} 缺專屬消耗品`);
  }
  for (let i = 0; i < 20; i++) {
    const cs = pickShopConsumables(1, Math.random, (i % 3) + 1);
    assert(cs.length === 1, "消耗品貨架抽唔到");
    assert(CONSUMABLES[cs[0]], `消耗品 ${cs[0]} 冇定義`);
  }
});

/* ---------- 4. 遺物 ---------- */
section("遺物（效果／錯角無效／專屬標示／缺項）", () => {
  const ids = Object.keys(RELICS);
  assert(ids.length >= 18, `遺物數量應該 ≥18，實際 ${ids.length}`);

  // 每件都有名／人話／效果
  for (const id of ids) {
    const r = RELICS[id];
    assert(r.name && r.name.length >= 2, `${id} 缺名`);
    assert(r.desc && r.desc.length >= 6, `${id} 缺 desc`);
    assert(r.effect && Object.keys(r.effect).length > 0, `${id} 冇 effect`);
  }

  // 已接線效果鍵都要有至少一件遺物用（唔好留死欄位）
  const wiredKeys = [
    "startEnergy",
    "startBlock",
    "startDraw",
    "attackBonus",
    "healOnWin",
    "goldBonus",
    "drawPerTurn",
    "attackPerCard",
    "healBonusFirst",
    "firstTurnEnergy",
    "healOnWinBonus",
    "instantMaxHp",
    "instantGold",
  ];
  for (const key of wiredKeys) {
    const hit = ids.some((id) => (RELICS[id].effect || {})[key]);
    assert(hit, `效果鍵 ${key} 冇任何遺物使用（缺項）`);
  }

  // 消耗品：要有清能量懲罰出口
  assert(CONSUMABLES.cs_twenty_four, "缺消耗品「廿四味」");
  {
    const probe = {
      hp: 40,
      maxHp: 60,
      nextBattleEnergyPenalty: 2,
      deck: [],
    };
    CONSUMABLES.cs_twenty_four.apply(probe);
    assert(probe.nextBattleEnergyPenalty === 0, "廿四味清唔到能量懲罰");
    assert(probe.hp > 40, "廿四味應該回血");
  }

  // 專屬：自己食到，別角食唔到
  const owned = ids.filter((id) => RELICS[id].owner);
  assert(owned.length >= 4, `專屬遺物應 ≥4 件，實際 ${owned.length}`);
  for (const id of owned) {
    const owner = RELICS[id].owner;
    const self = relicBonuses({ characterId: owner, relics: [id] });
    assert(
      Object.values(self).some((v) => v > 0),
      `${id} 對自己角色冇效果`
    );
    for (const other of CHAR_IDS.filter((c) => c !== owner)) {
      const diff = relicBonuses({ characterId: other, relics: [id] });
      assert(
        !Object.values(diff).some((v) => v > 0),
        `${id} 對 ${other} 竟然生效`
      );
    }
  }

  // 叮叮車票：首回合能量真係入戰鬥
  {
    const run = {
      characterId: "oil",
      hp: 50,
      maxHp: 68,
      deck: ["S01", "S01", "S15", "S15", "S02", "S02", "S11", "S14"],
      relics: ["rl_tram_token"],
      nextBattleEnergyPenalty: 0,
      nextBattleEnergyBonus: 0,
      nextBattleBlock: 0,
    };
    const b = createBattle(run, enemyById("E01"));
    startPlayerTurn(b);
    assert(b.energy >= 4, `叮叮車票首回合能量應 ≥4，實際 ${b.energy}`);
  }
});

/* ---------- 5. near-miss（敗北診斷） ---------- */
section("near-miss（四種情況都有文案）", () => {
  // UI 層嘅 nearMissInfo 喺 main.js，呢度驗資料層保證：
  // 每個 Boss／精英都有 nearMiss 專屬台詞
  for (const id of ["E04", "E05", "E12", "E08"]) {
    const e = enemyById(id);
    assert(e.nearMiss && e.nearMiss.length >= 8, `${id} 缺 nearMiss 台詞`);
  }
  // 唔可以一樣（Boss 三句＋精英）
  const lines = ["E04", "E05", "E12", "E08"].map((id) => enemyById(id).nearMiss);
  assert(new Set(lines).size === 4, "Boss／精英 nearMiss 台詞重複");
  // 結算提示用嘅標籤字串要喺 main 出現（靜態掃描）
  const mainSrc = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  for (const label of ["差喺 Boss", "差喺血量", "差喺能量", "差喺牌組", "差喺遺物"]) {
    assert(mainSrc.includes(label), `main.js 缺近失標籤「${label}」`);
  }
  assert(mainSrc.includes("near-miss-stats"), "敗北頁缺數字統計列");
  assert(mainSrc.includes("再開一局 · 可以咁試"), "敗北頁缺再開一局標題");
});

/* ---------- 5b. 敵人戰前句／意圖 ---------- */
section("敵人戰前句／意圖齊全", () => {
  const ENEMY_IDS = Object.keys(ENEMIES);
  assert(ENEMY_IDS.length >= 11, `敵人數應 ≥11，實際 ${ENEMY_IDS.length}`);
  const flavors = [];
  for (const id of ENEMY_IDS) {
    const e = ENEMIES[id];
    assert(e.flavor && e.flavor.length >= 8, `${id} 缺戰前句`);
    assert(e.afterword && e.afterword.length >= 6, `${id} 缺戰後句`);
    assert(e.intents?.length >= 3, `${id} 意圖 < 3`);
    flavors.push(e.flavor);
  }
  assert(new Set(flavors).size === flavors.length, "戰前句重複");
});

/* ---------- 5c. 精英閘口 ---------- */
section("精英閘口（地盤清場隊先停一句）", () => {
  const e08 = enemyById("E08");
  assert(e08?.isElite, "E08 應標 isElite");
  assert(e08.flavor && e08.flavor.length >= 8, "E08 缺戰前 flavor");
  assert(!e08.isBoss, "E08 唔應該係 Boss（用精英閘，唔改三大 Boss）");
  // beginBattle 要對精英同 Boss 一齊閘
  const mainSrc = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert(
    /isBoss\s*\|\|\s*enemy\.isElite|enemy\.isElite\s*\|\|\s*enemy\.isBoss/.test(mainSrc) ||
      mainSrc.includes("enemy.isBoss || enemy.isElite"),
    "beginBattle 未對精英開閘口"
  );
  assert(mainSrc.includes("is-elite"), "精英閘口缺 is-elite 樣式鉤");
  assert(mainSrc.includes("精英遭遇"), "精英閘口缺「精英遭遇」眉標");
  assert(mainSrc.includes("硬上"), "精英閘口缺 CTA「硬上」");
  // Act3 分支硬路要有機會抽到 E08
  const branch = ACT3_MAP.find((n) => n.type === "branch");
  assert(branch, "Act3 缺分支");
  const hard = (branch.options || []).find((o) => o.id === "hard");
  assert(hard?.enemyPool?.includes("E08"), "Act3 硬路池缺 E08");
});

/* ---------- 6. 再開一局 ---------- */
section("再開一局（資料層確保有鉤）", () => {
  for (const id of CHAR_IDS) {
    const c = CHARACTERS[id];
    assert(c.rerunHook?.select, `${id} 缺 rerunHook.select`);
    assert(c.rerunHook?.clear, `${id} 缺 rerunHook.clear`);
    assert(c.rerunHook?.defeat, `${id} 缺 rerunHook.defeat`);
    assert(c.clearSummary, `${id} 缺 clearSummary`);
    assert(c.route && c.route.length >= 2, `${id} 缺 route（結算要用）`);
    assert(c.playstyle && c.playstyle.length >= 6, `${id} 缺 playstyle`);
  }
  // 四句 clearSummary／defeat 鉤唔可以一樣
  const sums = CHAR_IDS.map((id) => CHARACTERS[id].clearSummary);
  assert(new Set(sums).size === CHAR_IDS.length, "clearSummary 有重複");
  const defeats = CHAR_IDS.map((id) => CHARACTERS[id].rerunHook.defeat);
  assert(new Set(defeats).size === CHAR_IDS.length, "rerunHook.defeat 有重複");
});

/* ---------- 7. Act 銜接 ---------- */
section("Act 銜接（兩段過場）", () => {
  for (const act of [2, 3]) {
    const t = ACT_TRANSITIONS[act];
    assert(t, `缺 Act${act} 過場`);
    assert(t.line && t.line.length >= 10, `Act${act} 過場句太短`);
    assert(t.to === actDisplayName(act), `Act${act} 過場 to 唔一致`);
  }
});

/* ---------- 7b. 地圖副標港味 ---------- */
section("地圖副標港味（唔用機械腔）", () => {
  const forbidden = ["短事件", "分支路線", "戰鬥 → 選牌", "休息／便利店"];
  const all = [];
  for (const [act, map] of [
    [1, ACT1_MAP],
    [2, ACT2_MAP],
    [3, ACT3_MAP],
  ]) {
    assert(map.length === 6, `Act${act} 應維持六節點`);
    for (const n of map) {
      assert(n.subtitle && n.subtitle.length >= 4, `${n.id} 缺港味副標`);
      for (const bad of forbidden) {
        assert(n.subtitle !== bad, `${n.id} 副標仍係機械腔「${bad}」`);
      }
      all.push(n.subtitle);
    }
  }
  // 十八格副標盡量唔重複（允許少數跨 Act 同類型相近，但唔好完全一樣）
  assert(new Set(all).size >= 16, `地圖副標重複太多：${new Set(all).size}/18`);
  // Boss 正式名未改
  assert(ACT1_MAP[5].title === "巷口鐵閘・睇場", "Act1 Boss 名被改");
  assert(ACT2_MAP[5].title === "西裝收數隊", "Act2 Boss 名被改");
  assert(ACT3_MAP[5].title === "籠門之王", "Act3 Boss 名被改");
});

/* ---------- 7b2. 地圖主標港味（非 Boss） ---------- */
section("地圖主標港味（非 Boss）", () => {
  const forbidden = [
    "街頭閒事",
    "路口二揀一",
    "旺角閒事",
    "旺角路口",
    "天台閒事",
    "上天台前",
  ];
  const titles = [];
  for (const map of [ACT1_MAP, ACT2_MAP, ACT3_MAP]) {
    for (const n of map) {
      if (n.type === "boss") continue;
      assert(n.title && n.title.length >= 2, `${n.id} 缺主標`);
      for (const bad of forbidden) {
        assert(n.title !== bad, `${n.id} 主標仍係機械腔「${bad}」`);
      }
      titles.push(n.title);
    }
  }
  assert(new Set(titles).size === titles.length, "非 Boss 地圖主標有重複");
  assert(ACT1_MAP[5].title === "巷口鐵閘・睇場", "Act1 Boss 名被改");
  assert(ACT2_MAP[5].title === "西裝收數隊", "Act2 Boss 名被改");
  assert(ACT3_MAP[5].title === "籠門之王", "Act3 Boss 名被改");
});

/* ---------- 7c. 事件頁眉港味（唔用機械腔） ---------- */
section("事件頁眉港味（唔用機械腔）", () => {
  const mainSrc = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert(!mainSrc.includes("短事件 · 選項改機械效果"), "事件頁仍掛機械腔 tagline");
  assert(!mainSrc.includes("選項改機械效果"), "事件頁仍寫「機械效果」");
  for (const line of [
    "巷口一事 · 點揀都會改局",
    "霓虹底一事 · 點揀都會改局",
    "天台一事 · 點揀都會改局",
  ]) {
    assert(mainSrc.includes(line), `事件頁缺港味副句「${line}」`);
  }
});

/* ---------- 8. 事件池（每區 ≥5，全部必改局；可見 HP／牌／金／能量／擋） ---------- */
section("事件池（每區 ≥5，全部必改局）", () => {
  const titles = new Set();
  for (const act of [1, 2, 3]) {
    const pool = EVENT_POOLS[act];
    assert(pool.length >= 5, `Act${act} 事件池只有 ${pool.length} 個`);
    for (const evId of pool) {
      const ev = EVENTS[evId];
      assert(ev, `缺事件 ${evId}`);
      assert(ev.title && ev.title.length >= 2, `${evId} 缺標題`);
      assert(!titles.has(ev.title), `事件標題重複：${ev.title}`);
      titles.add(ev.title);
      assert(ev.choices?.length === 3, `${evId} 要三選一`);
      for (const ch of ev.choices) {
        const probe = {
          hp: 50,
          maxHp: 60,
          gold: 30,
          deck: ["S01"],
          relics: [],
          nextBattleEnergyBonus: 0,
          nextBattleEnergyPenalty: 0,
          nextBattleBlock: 0,
        };
        ch.apply(probe);
        const visible =
          probe.hp !== 50 ||
          probe.maxHp !== 60 ||
          probe.gold !== 30 ||
          probe.deck.length !== 1 ||
          (probe.nextBattleEnergyBonus || 0) > 0 ||
          (probe.nextBattleEnergyPenalty || 0) > 0 ||
          (probe.nextBattleBlock || 0) > 0;
        assert(visible, `${ev.title}/${ch.id} 揀完即時不可見（HP／牌／金／能量／擋）`);
        // 唔發死金（可花錢）
        assert(probe.gold <= 30, `${ev.title}/${ch.id} 唔應該發金幣`);
        assert(typeof ch.effectText === "string" && ch.effectText.length >= 4, `${evId}/${ch.id} 缺 effectText`);
      }
    }
  }
});

/* ---------- 9. 戰鬥核心（起手／抽牌／結束回合） ---------- */
section("戰鬥核心（四角各打一場）", () => {
  for (const id of CHAR_IDS) {
    const run = mkRun(id);
    const b = createBattle(run, enemyById("E01"));
    startPlayerTurn(b);
    assert(b.hand.length > 0, `${id} 起手冇手牌`);
    const total = b.drawPile.length + b.hand.length + b.discard.length;
    assert(total === run.deck.length, `${id} 牌堆總數唔對`);

    // 結束回合：敵人要有行動（血量或擋有變）
    const hp0 = b.playerHp;
    const blk0 = b.playerBlock;
    const eblk0 = b.enemyBlock;
    endTurn(b);
    const changed =
      b.playerHp < hp0 || b.playerBlock < blk0 || b.enemyBlock > eblk0;
    assert(changed, `${id} 結束回合後乜都冇變（靜跳）`);
  }
});

/* ---------- 10. 經濟（第一格戰後必有金） ---------- */
section("經濟（第一格戰後有金）", () => {
  for (let i = 0; i < 30; i++) {
    assert(battleGoldReward(false) > 0, "小怪戰後金幣為 0");
  }
  assert(battleGoldReward(true) === 0, "Boss 戰後唔應該畀金（走商店邏輯）");
});

/* ---------- 11. 選牌加權（四角路線唔同＋預期主線） ---------- */
section("選牌加權（四角路線唔同＋預期主線）", () => {
  // bias 衛生：唔可以指向池外死牌
  for (const id of CHAR_IDS) {
    const sigs = new Set(SIGNATURE_CARDS[id] || []);
    for (const bid of CHARACTERS[id].rewardBias || []) {
      assert(CARDS[bid], `${id} bias 缺牌 ${bid}`);
      assert(
        sigs.has(bid) || REWARD_POOL.includes(bid),
        `${id} bias ${bid} 唔喺專屬／REWARD_POOL`
      );
    }
  }
  const dominant = {};
  for (const id of CHAR_IDS) {
    const tally = {};
    for (let i = 0; i < 600; i++) {
      for (const cid of pickRewardChoices(3, [], id)) {
        const k = classifyRewardCard(cid);
        tally[k] = (tally[k] || 0) + 1;
      }
    }
    const [topKind, topN] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    const share = topN / total;
    assert(share >= 0.28, `${id} 主路線 ${topKind} 只佔 ${(share * 100) | 0}%`);
    assert(topKind !== "專屬", `${id} 被專屬主導`);
    assert(
      topKind === EXPECTED_REWARD_ROUTE[id],
      `${id} 應為「${EXPECTED_REWARD_ROUTE[id]}」，實際「${topKind}」`
    );
    dominant[id] = topKind;
  }
  const vals = Object.values(dominant);
  assert(new Set(vals).size === 4, `四角主路線有重複：${JSON.stringify(dominant)}`);
});

/* ---------- 結果 ---------- */
console.log("");
if (failures.length) {
  console.log(`✗ 封測失敗：${failures.length} 項`);
  process.exit(1);
}
console.log(`✓ 封測全過（${checks} 項檢查）`);
console.log(JSON.stringify({ ok: true, checks, chars: CHAR_IDS }, null, 2));
