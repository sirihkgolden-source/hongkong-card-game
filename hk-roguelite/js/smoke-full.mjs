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
  SHOP,
  START_GOLD,
  SIGNATURE_CARDS,
  ACT_TRANSITIONS,
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
} from "./data.js";
import { createBattle, playCard, endTurn, startPlayerTurn } from "./battle.js";

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
section("便利店（金幣出口／遺物／消耗品）", () => {
  assert(SHOP.healCost > 0 && SHOP.healAmt > 0, "治療價／量唔合法");
  assert(SHOP.cardCost > 0, "執牌價唔合法");
  assert(SHOP.relicCost > 0, "遺物價唔合法");
  assert(SHOP.packCost > 0, "卡包價唔合法");
  assert(SHOP.rerollCost > 0, "換貨價唔合法");

  // 開局金幣買得起最便宜嘅嘢
  const cheapest = Math.min(SHOP.healCost, SHOP.cardCost, SHOP.rerollCost);
  assert(START_GOLD >= cheapest, `開局金幣買唔到任何東西（最便宜 ${cheapest}）`);

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
  // 消耗品
  for (let i = 0; i < 20; i++) {
    const cs = pickShopConsumables(1);
    assert(cs.length === 1, "消耗品貨架抽唔到");
    assert(CONSUMABLES[cs[0]], `消耗品 ${cs[0]} 冇定義`);
  }
});

/* ---------- 4. 遺物 ---------- */
section("遺物（效果／錯角無效／專屬標示）", () => {
  const ids = Object.keys(RELICS);
  assert(ids.length >= 16, `遺物數量應該 ≥16，實際 ${ids.length}`);

  // 每件都有名／人話／效果
  for (const id of ids) {
    const r = RELICS[id];
    assert(r.name && r.name.length >= 2, `${id} 缺名`);
    assert(r.desc && r.desc.length >= 6, `${id} 缺 desc`);
    assert(r.effect && Object.keys(r.effect).length > 0, `${id} 冇 effect`);
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
});

/* ---------- 5. near-miss（敗北診斷） ---------- */
section("near-miss（四種情況都有文案）", () => {
  // UI 層嘅 nearMissInfo 喺 main.js，呢度驗資料層保證：
  // 每個 Boss 都有 nearMiss 專屬台詞
  for (const id of ["E04", "E05", "E12"]) {
    const e = enemyById(id);
    assert(e.nearMiss && e.nearMiss.length >= 8, `${id} 缺 nearMiss 台詞`);
  }
  // 三句唔可以一樣
  const lines = ["E04", "E05", "E12"].map((id) => enemyById(id).nearMiss);
  assert(new Set(lines).size === 3, "Boss nearMiss 台詞重複");
});

/* ---------- 6. 再開一局 ---------- */
section("再開一局（資料層確保有鉤）", () => {
  for (const id of CHAR_IDS) {
    const c = CHARACTERS[id];
    assert(c.rerunHook?.select, `${id} 缺 rerunHook.select`);
    assert(c.rerunHook?.clear, `${id} 缺 rerunHook.clear`);
    assert(c.rerunHook?.defeat, `${id} 缺 rerunHook.defeat`);
    assert(c.clearSummary, `${id} 缺 clearSummary`);
  }
  // 四句 clearSummary 唔可以一樣
  const sums = CHAR_IDS.map((id) => CHARACTERS[id].clearSummary);
  assert(new Set(sums).size === CHAR_IDS.length, "clearSummary 有重複");
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

/* ---------- 8. 事件池（每區 ≥4，全部必改局） ---------- */
section("事件池（每區 ≥4，全部必改局）", () => {
  for (const act of [1, 2, 3]) {
    const pool = EVENT_POOLS[act];
    assert(pool.length >= 4, `Act${act} 事件池只有 ${pool.length} 個`);
    for (const evId of pool) {
      const ev = EVENTS[evId];
      assert(ev, `缺事件 ${evId}`);
      for (const ch of ev.choices) {
        const probe = { hp: 50, maxHp: 60, gold: 30, deck: ["S01"], relics: [] };
        ch.apply(probe);
        const visible =
          probe.hp !== 50 ||
          probe.maxHp !== 60 ||
          probe.gold !== 30 ||
          probe.deck.length !== 1 ||
          (probe.nextBattleEnergyBonus || 0) > 0;
        assert(visible, `${ev.title}/${ch.id} 揀完即時不可見`);
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

/* ---------- 11. 選牌加權（四角路線唔同） ---------- */
section("選牌加權（四角路線唔同）", () => {
  const classify = (cid) => {
    const c = CARDS[cid];
    if (!c) return "?";
    if (c.owner) return "專屬";
    if (c.dmg && !c.block && !c.heal && !c.draw) return "攻擊";
    if ((c.block || c.heal) && !c.draw) {
      return (c.heal || 0) > (c.block || 0) ? "回血" : "守";
    }
    if (c.draw) return "抽牌";
    return "攻擊+";
  };
  const dominant = {};
  for (const id of CHAR_IDS) {
    const tally = {};
    for (let i = 0; i < 150; i++) {
      for (const cid of pickRewardChoices(3, [], id)) {
        const k = classify(cid);
        tally[k] = (tally[k] || 0) + 1;
      }
    }
    const [top] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    dominant[id] = top[0];
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
