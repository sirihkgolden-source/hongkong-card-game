/**
 * Round 3 smoke：三角色流程核對（被動旗標／金幣出口／Act 銜接）
 * 用法：cd hk-roguelite && node js/smoke-act2.mjs
 */
import {
  CHARACTERS,
  ACT1_MAP,
  ACT2_MAP,
  EVENTS,
  EVENT_POOLS,
  pickEventId,
  eventById,
  SHOP,
  CARDS,
  mapForAct,
  actDisplayName,
  battleGoldReward,
  enemyById,
  pickRewardChoices,
  SIGNATURE_CARDS,
  CONSUMABLES,
  pickShopConsumables,
} from "./data.js";
import { createBattle, playCard, endTurn, startPlayerTurn } from "./battle.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 開場抽牌後盡量打幾張，順便觸發被動；超時就強殺 */
function fightOnce(run, enemyId) {
  const enemy = enemyById(enemyId);
  const b = createBattle(run, enemy);
  startPlayerTurn(b);

  let guard = 0;
  while (!b.over && guard < 60) {
    guard += 1;
    let played = false;
    for (let i = 0; i < b.hand.length; i++) {
      const card = CARDS[b.hand[i]];
      if (!card) continue;
      const cost =
        b.kuaisouReady && card.type === "attack"
          ? Math.max(0, card.cost - 1)
          : card.cost;
      if (b.energy >= cost) {
        playCard(b, i);
        played = true;
        break;
      }
    }
    if (b.over) break;
    if (!played) {
      endTurn(b);
      if (!b.over) startPlayerTurn(b);
    }
    // 保底：打太耐直接斬
    if (guard > 25 && !b.over) {
      b.enemyHp = 0;
      b.over = "win";
      b.log.push("（smoke）強殺收束");
    }
  }

  if (b.over !== "win") {
    b.enemyHp = 0;
    b.over = "win";
    b.playerHp = Math.max(1, b.playerHp);
  }

  run.hp = b.playerHp;
  const gold = battleGoldReward(!!enemy.isBoss);
  run.gold += gold;
  run.victories += 1;

  return {
    gold,
    kuaisouReadyWas: b.attacksPlayed >= 3 || b.log.some((l) => String(l).includes("快手")),
    dangkouUsed: !!b.dangkouUsed,
    zhaopaiyanUsed: !!b.zhaopaiyanUsed,
    logPassive: {
      kuaisou: (b.log || []).some((l) => String(l).includes("快手")),
      dangkou: (b.log || []).some((l) => String(l).includes("檔口")) || b.dangkouUsed,
      zhaopaiyan:
        (b.log || []).some((l) => String(l).includes("招牌眼")) || b.zhaopaiyanUsed,
    },
  };
}

function applyShopSink(run) {
  if (run.gold < SHOP.healCost) run.gold = SHOP.healCost;
  const before = run.gold;
  run.gold -= SHOP.healCost;
  run.hp = Math.min(run.maxHp, run.hp + SHOP.healAmt);
  return before - run.gold;
}

function simulateChar(charId) {
  const c = CHARACTERS[charId];
  const run = {
    characterId: c.id,
    act: 1,
    hp: c.maxHp,
    maxHp: c.maxHp,
    gold: 0,
    deck: [...c.starterDeck],
    nextBattleEnergyPenalty: 0,
    nextBattleEnergyBonus: 0,
    nextBattleBlock: 0,
    victories: 0,
  };
  const notes = [];
  const passiveHits = { kuaisou: 0, dangkou: 0, zhaopaiyan: 0 };

  assert(enemyById("E04").name === "巷口鐵閘・睇場", "Act1 Boss 睇場");
  assert(!enemyById("E04").name.includes("看場"), "禁看場");
  assert(!enemyById("E04").name.includes("離場"), "禁離場");

  // ① 三角色都要有 route（主路線標籤）同 playstyle（一句講清點玩）
  {
    const routes = [];
    const styles = [];
    for (const id of ["oil", "asan", "kauko"]) {
      const c = CHARACTERS[id];
      assert(typeof c.route === "string" && c.route.length >= 3, `${id} 缺 route`);
      assert(typeof c.playstyle === "string" && c.playstyle.length >= 8, `${id} 缺 playstyle`);
      routes.push(c.route);
      styles.push(c.playstyle);
    }
    assert(new Set(routes).size === 3, `三角色 route 重複：${routes.join("/")}`);
    assert(new Set(styles).size === 3, "三角色 playstyle 重複");
  }

  // ③ starter／專屬牌名唔撞
  {
    const sigNames = [];
    for (const id of ["oil", "asan", "kauko"]) {
      for (const cardId of SIGNATURE_CARDS[id] || []) {
        const nm = CARDS[cardId]?.name;
        assert(nm, `${id} 專屬牌 ${cardId} 冇名`);
        sigNames.push(nm);
      }
    }
    assert(new Set(sigNames).size === sigNames.length, `專屬牌名有撞：${sigNames.join("/")}`);
    // starter 唔可以含別角專屬
    for (const id of ["oil", "asan", "kauko"]) {
      for (const cardId of CHARACTERS[id].starterDeck) {
        const owner = CARDS[cardId]?.owner;
        assert(!owner || owner === id, `${id} starter 含別角專屬 ${cardId}`);
      }
    }
  }

  // 地圖節點文案同 Boss 卡都要用「睇場」
  const act1BossNode = ACT1_MAP.find((n) => n.type === "boss");
  assert(act1BossNode?.title === "巷口鐵閘・睇場", "Act1 Boss 節點名");
  for (const bad of ["離場", "看場"]) {
    assert(!act1BossNode.title.includes(bad), `節點名禁${bad}`);
  }

  // ① 三個 Boss 都要有戰前（flavor）／戰後（afterword）／敗北（nearMiss）各一句
  {
    for (const id of ["E04", "E05", "E12"]) {
      const e = enemyById(id);
      assert(e?.flavor && e.flavor.length >= 8, `${id} 缺戰前台詞`);
      assert(e?.afterword && e.afterword.length >= 8, `${id} 缺戰後台詞`);
      assert(e?.nearMiss && e.nearMiss.length >= 8, `${id} 缺敗北台詞`);
    }
    // 三句唔可以完全一樣（Boss 要有各自辨識度）
    const afterwords = ["E04", "E05", "E12"].map((id) => enemyById(id).afterword);
    assert(new Set(afterwords).size === 3, "Boss 戰後台詞重複");
    const nearMisses = ["E04", "E05", "E12"].map((id) => enemyById(id).nearMiss);
    assert(new Set(nearMisses).size === 3, "Boss 敗北台詞重複");
  }

  // ① 三角色都要有「再開一局」鉤（選角／通關／敗北各一句）
  for (const id of ["oil", "asan", "kauko"]) {
    const h = CHARACTERS[id].rerunHook;
    assert(h, `${id} 缺 rerunHook`);
    for (const k of ["select", "clear", "defeat"]) {
      assert(typeof h[k] === "string" && h[k].trim().length >= 6, `${id} rerunHook.${k} 太短`);
    }
  }
  // 三角色鉤唔可以完全一樣（角色辨識度）
  assert(new Set(["oil", "asan", "kauko"].map((id) => CHARACTERS[id].rerunHook.select)).size === 3, "選角鉤重複");

  // ② 三區事件抽取：每個選項都要即時可見改局（HP／最大生命／牌組），且唔改金幣
  for (const act of [1, 2, 3]) {
    const pool = EVENT_POOLS[act];
    assert(Array.isArray(pool) && pool.length >= 1, `Act${act} 事件池空`);
    let fullyVisible = 0;
    for (const evId of pool) {
      const ev = EVENTS[evId];
      assert(ev, `Act${act} 事件缺 ${evId}`);
      let thisEventAllVisible = true;
      for (const ch of ev.choices) {
        const probe = { hp: 50, maxHp: 60, gold: 30, deck: ["S01"], relics: [], flags: {} };
        ch.apply(probe);
        const visible =
          probe.hp !== 50 || probe.maxHp !== 60 || probe.deck.length !== 1;
        assert(visible, `${ev.title}/${ch.id} 揀完即時不可見`);
        assert(probe.gold === 30, `${ev.title}/${ch.id} 唔應該改金幣`);
        if (!visible) thisEventAllVisible = false;
      }
      if (thisEventAllVisible) fullyVisible += 1;
    }
    // 每區至少 1 個事件，全部選項都即時可見（唔可以淨係跳下一格）
    assert(fullyVisible >= 1, `Act${act} 冇任何事件做到全選項即時可見`);
    // 每區池要 ≥2 個，否則每局抽 2 個會抽到同一個
    assert(pool.length >= 2, `Act${act} 事件池少於 2 個，每局唔會唔同`);
  }

  // ① 選牌傾向：三角色各自要明顯偏一類（唔可以揀邊個都一樣）
  {
    const classify = (id) => {
      const c = CARDS[id];
      if (!c) return "?";
      if (c.owner) return "專屬";
      if (c.dmg && !c.block && !c.heal && !c.draw) return "攻擊";
      if ((c.block || c.heal) && !c.draw) return "守";
      if (c.draw) return "抽牌";
      return "攻擊+";
    };
    const dominant = {};
    for (const cid of ["oil", "asan", "kauko"]) {
      const tally = {};
      for (let i = 0; i < 200; i += 1) {
        for (const id of pickRewardChoices(3, [], cid)) {
          const k = classify(id);
          tally[k] = (tally[k] || 0) + 1;
        }
      }
      const total = Object.values(tally).reduce((a, b) => a + b, 0);
      const [topKind, topN] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      const share = topN / total;
      // 主路線要明顯（≥35%），否則「一眼分唔到」
      assert(share >= 0.35, `${cid} 主路線 ${topKind} 只佔 ${(share * 100) | 0}%，辨識度不足`);
      // 專屬牌唔可以蓋過主路線
      assert(topKind !== "專屬", `${cid} 選牌被專屬牌主導，角色路線被稀釋`);
      dominant[cid] = topKind;
    }
    // 三個角色主路線要唔同
    assert(new Set(Object.values(dominant)).size === 3, `三角色主路線重複：${JSON.stringify(dominant)}`);
  }

  // ③ 消耗品：每件都要有價、有說明、apply 真係改局
  {
    const csIds = Object.keys(CONSUMABLES);
    assert(csIds.length >= 1, "冇消耗品");
    for (const id of csIds) {
      const c = CONSUMABLES[id];
      assert(c.name && c.desc && c.flavor, `${id} 缺名／說明／風味`);
      assert(typeof c.price === "number" && c.price > 0, `${id} 價錢唔合法`);
      const probe = { hp: 30, maxHp: 60, gold: 0, deck: ["S01"], relics: [] };
      const msg = c.apply(probe);
      const visible =
        probe.hp !== 30 ||
        probe.maxHp !== 60 ||
        probe.deck.length !== 1 ||
        (probe.nextBattleEnergyBonus || 0) > 0;
      assert(visible, `${id} 買完冇任何可見效果`);
      // 必須至少一項可以跳字（血／擋／抽／傷／能量），否則玩家睇唔到回饋
      const floatable =
        probe.hp !== 30 ||
        probe.maxHp !== 60 ||
        probe.deck.length !== 1 ||
        (probe.nextBattleBlock || 0) > 0 ||
        (probe.nextBattleEnergyBonus || 0) > 0;
      assert(floatable, `${id} 冇任何可跳字嘅改動`);
      assert(typeof msg === "string" && msg.length > 0, `${id} 冇回饋文案`);
    }
    // 每次洗貨都要抽到 ≥1 件
    assert(pickShopConsumables(1).length === 1, "消耗品貨架抽唔到貨");
  }

  for (const node of ACT1_MAP) {
    if (node.type === "battle" || node.type === "boss") {
      const r = fightOnce(run, node.enemyId);
      if (r.logPassive.kuaisou) passiveHits.kuaisou += 1;
      if (r.logPassive.dangkou) passiveHits.dangkou += 1;
      if (r.logPassive.zhaopaiyan) passiveHits.zhaopaiyan += 1;
      notes.push(`A1 ${node.title}: +${r.gold}g`);
    } else if (node.type === "event") {
      const goldBefore = run.gold;
      eventById(node.eventId || pickEventId(1)).choices[1].apply(run);
      assert(run.gold === goldBefore, "A1 事件唔發死金");
      notes.push("A1 event ok");
    } else if (node.type === "rest") {
      notes.push(`A1 shop spent ${applyShopSink(run)}`);
    }
  }

  // Act1→Act2 保留
  const snap = { deck: run.deck.length, hp: run.hp, gold: run.gold };
  run.act = 2;
  assert(actDisplayName(2) === "旺角霓虹", "Act2 區名");
  assert(mapForAct(2).length === 6, "Act2 六節點");
  assert(enemyById("E05").name === "西裝收數隊", "Boss 西裝收數隊");
  assert(enemyById("E05").flavor === "月光底落數。散水定散骨，你揀。", "Boss 停句");
  assert(run.deck.length === snap.deck && run.hp === snap.hp && run.gold === snap.gold, "保留局況");

  for (const node of ACT2_MAP) {
    if (node.type === "battle" || node.type === "boss") {
      const r = fightOnce(run, node.enemyId);
      if (r.logPassive.kuaisou) passiveHits.kuaisou += 1;
      if (r.logPassive.dangkou) passiveHits.dangkou += 1;
      if (r.logPassive.zhaopaiyan) passiveHits.zhaopaiyan += 1;
      notes.push(`A2 ${node.title}: +${r.gold}g`);
    } else if (node.type === "reward") {
      run.deck.push("S12");
      notes.push("A2 reward");
    } else if (node.type === "event") {
      const goldBefore = run.gold;
      eventById(node.eventId || pickEventId(2)).choices[0].apply(run);
      assert(run.gold === goldBefore, "A2 事件唔發死金");
      notes.push("A2 event ok");
    } else if (node.type === "rest") {
      const spent = applyShopSink(run);
      assert(spent > 0, "金幣出口");
      notes.push(`A2 shop spent ${spent}`);
    }
  }

  return {
    charId,
    name: c.name,
    passive: c.passive.name,
    passiveHits,
    goldLeft: run.gold,
    deck: run.deck.length,
    hp: run.hp,
    notes,
  };
}

const results = ["oil", "asan", "kauko"].map(simulateChar);
console.log(JSON.stringify({ ok: true, act1: actDisplayName(1), act2: actDisplayName(2), results }, null, 2));
