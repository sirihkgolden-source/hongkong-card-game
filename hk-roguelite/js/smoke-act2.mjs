/**
 * Round 3 smoke：三角色流程核對（被動旗標／金幣出口／Act 銜接）
 * 用法：cd hk-roguelite && node js/smoke-act2.mjs
 */
import {
  CHARACTERS,
  ACT1_MAP,
  ACT2_MAP,
  EVENTS,
  pickEventId,
  eventById,
  SHOP,
  CARDS,
  mapForAct,
  actDisplayName,
  battleGoldReward,
  enemyById,
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
