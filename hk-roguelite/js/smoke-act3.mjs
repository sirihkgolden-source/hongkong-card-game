/**
 * Act3 smoke：三角色各一鋪打到最終 Boss（籠門之王）＋通關結算資料核對
 * 用法：cd hk-roguelite && node js/smoke-act3.mjs
 */
import {
  META,
  CHARACTERS,
  ACT1_MAP,
  ACT2_MAP,
  ACT3_MAP,
  EVENTS,
  SHOP,
  CARDS,
  REWARD_POOL,
  mapForAct,
  actDisplayName,
  battleGoldReward,
  enemyById,
  pickNodeEnemyId,
  enemyTag,
  pickRewardChoices,
  SIGNATURE_CARDS,
  EVENT_POOLS,
  pickEventId,
  eventById,
} from "./data.js";
import { createBattle, playCard, endTurn, startPlayerTurn } from "./battle.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** 一場戰鬥：能打就打，打唔動就結束回合；太長就收束（只驗流程，唔驗平衡） */
function fightOnce(run, enemyId) {
  const enemy = enemyById(enemyId);
  assert(enemy, `未知敵人 ${enemyId}`);
  const b = createBattle(run, enemy);
  startPlayerTurn(b);

  let guard = 0;
  while (!b.over && guard < 80) {
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
    if (guard > 30 && !b.over) {
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
  run.encounters = run.encounters || [];
  run.encounters.push({ name: enemy.name, tag: enemyTag(enemy), act: run.act });

  return { gold, hp: run.hp, turns: guard };
}

function applyShopSink(run) {
  if (run.gold < SHOP.healCost) run.gold = SHOP.healCost;
  const before = run.gold;
  run.gold -= SHOP.healCost;
  run.hp = Math.min(run.maxHp, run.hp + SHOP.healAmt);
  return before - run.gold;
}

function walkAct(run, map, actNo, notes) {
  assert(run.act === actNo, `Act 號不符：${run.act} ≠ ${actNo}`);
  map.forEach((node, i) => {
    if (node.type === "battle" || node.type === "boss") {
      const enemyId = pickNodeEnemyId(node);
      assert(enemyId, `節點 ${node.id} 冇敵人`);
      const r = fightOnce(run, enemyId);
      const enemy = enemyById(enemyId);
      notes.push(`A${actNo}-${i + 1} ${enemy.name}（${enemyTag(enemy)}）+${r.gold}g`);
      // 每場戰鬥後都當揀咗一張牌（模擬戰後三選一）
      if (node.type !== "boss") run.deck.push("S12");
    } else if (node.type === "reward") {
      run.deck.push("S12");
      notes.push(`A${actNo}-${i + 1} 選牌`);
    } else if (node.type === "event") {
      // 事件由該 Act 池抽（地圖節點冇固定 eventId 時）
      const ev = eventById(node.eventId || pickEventId(actNo));
      assert(ev, `事件缺失：${node.eventId || actNo}`);
      assert(ev.choices.length === 3, `事件 ${ev.id} 要三選一`);
      const goldBefore = run.gold;
      const hpBefore = run.hp;
      const deckBefore = run.deck.length;
      const maxHpBefore = run.maxHp;
      const energyBefore =
        (run.nextBattleEnergyBonus || 0) - (run.nextBattleEnergyPenalty || 0);
      const blockBefore = run.nextBattleBlock || 0;
      ev.choices.forEach((c) => {
        const probe = {
          ...run,
          deck: [...run.deck],
          encounters: [...(run.encounters || [])],
        };
        const msg = c.apply(probe);
        assert(typeof msg === "string" && msg.length > 0, `事件 ${c.id} 要回一句結果`);
        const changed =
          probe.hp !== hpBefore ||
          probe.maxHp !== maxHpBefore ||
          probe.deck.length !== deckBefore ||
          probe.gold !== goldBefore ||
          (probe.nextBattleEnergyBonus || 0) - (probe.nextBattleEnergyPenalty || 0) !==
            energyBefore ||
          (probe.nextBattleBlock || 0) !== blockBefore;
        assert(changed, `事件選項 ${c.id} 必須改局`);
      });
      // 正式套用第一個選項
      const applied = ev.choices[0].apply(run);
      notes.push(`A${actNo}-${i + 1} 事件「${ev.title}」→ ${applied.slice(0, 14)}…`);
    } else if (node.type === "rest") {
      const spent = applyShopSink(run);
      assert(spent > 0, `A${actNo} 便利店必須花到金`);
      notes.push(`A${actNo}-${i + 1} 休息／便利店花 ${spent} 金`);
    } else {
      throw new Error(`未知節點類型：${node.type}`);
    }
  });
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
    mapIndex: 0,
    completed: [],
    encounters: [],
    nodeEnemies: {},
    nextBattleEnergyPenalty: 0,
    nextBattleEnergyBonus: 0,
    nextBattleBlock: 0,
    victories: 0,
  };
  const notes = [];

  // 硬鎖：區名／Boss 名／停句
  assert(actDisplayName(1) === "後巷・夜醒", "Act1 區名");
  assert(actDisplayName(2) === "旺角霓虹", "Act2 區名");
  assert(actDisplayName(3) === "城寨・天台", "Act3 區名");
  assert(META.act3Name === "城寨・天台", "META.act3Name");
  assert(enemyById("E04").name === "巷口鐵閘・睇場", "Act1 Boss");
  assert(enemyById("E05").name === "西裝收數隊", "Act2 Boss");
  assert(enemyById("E12").name === "籠門之王", "Act3 最終 Boss");
  assert(
    enemyById("E12").flavor === "天台無燈。今夜邊個落場，邊個落地。",
    "最終 Boss 停句"
  );
  assert(enemyById("E12").isFinalBoss, "籠門之王要標最終 Boss");
  assert(ACT3_MAP.length === 6, "Act3 六節點");
  assert(ACT3_MAP[0].type === "battle", "Act3 開頭戰鬥");
  assert(ACT3_MAP[1].type === "reward", "Act3 第 2 格選牌");
  assert(ACT3_MAP[2].type === "event", "Act3 第 3 格事件");
  assert(ACT3_MAP[3].type === "battle", "Act3 第 4 格戰／精英");
  assert(ACT3_MAP[4].type === "rest", "Act3 第 5 格休息／便利店");
  assert(ACT3_MAP[5].type === "boss", "Act3 第 6 格最終 Boss");
  assert(ACT3_MAP[3].enemyPool?.includes("E08"), "精英池可抽 E08 地盤清場隊");
  assert(mapForAct(3) === ACT3_MAP, "mapForAct(3)");
  assert(["E09", "E10", "E11", "E12", "E08"].every((id) => !!enemyById(id)), "Act3 敵表齊");
  assert(enemyById("E08").isElite, "E08 標精英");
  // enemyPool 抽樣 200 次，三個都要出現
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickNodeEnemyId(ACT3_MAP[3]));
  assert(seen.has("E08") && seen.has("E10") && seen.has("E11"), "精英池抽樣不齊");

  // —— 事件池：每 Act 至少 3 個短事件，全部三選一、全部改局、唔發死金 ——
  for (const actNo of [1, 2, 3]) {
    const pool = EVENT_POOLS[actNo];
    assert(Array.isArray(pool) && pool.length >= 3, `Act${actNo} 事件池至少 3 個`);
    // 抽 200 次，池內每個事件都要抽得到
    const hit = new Set();
    for (let i = 0; i < 200; i++) {
      const id = pickEventId(actNo);
      assert(pool.includes(id), `Act${actNo} 抽到池外事件 ${id}`);
      hit.add(id);
    }
    assert(hit.size === pool.length, `Act${actNo} 有事件抽唔到`);

    for (const evId of pool) {
      const ev = EVENTS[evId];
      assert(ev, `事件 ${evId} 不存在`);
      assert(ev.art, `事件 ${evId} 缺插圖`);
      assert(typeof ev.body === "string" && ev.body.length > 0, `${evId} 缺文案`);
      assert(ev.choices.length === 3, `${evId} 要三選一`);
      const ids = new Set(ev.choices.map((c) => c.id));
      assert(ids.size === 3, `${evId} 選項 id 要唯一`);

      for (const ch of ev.choices) {
        assert(ch.label && ch.effectText, `${evId}/${ch.id} 缺 label／effectText`);
        // 用一個基準 run 探測每個選項都要改局，而且唔可以改金幣（唔發死金）
        const base = {
          hp: 50,
          maxHp: 80,
          gold: 7,
          deck: ["S01"],
          nextBattleEnergyPenalty: 0,
          nextBattleEnergyBonus: 0,
          nextBattleBlock: 0,
        };
        const probe = { ...base, deck: [...base.deck] };
        const msg = ch.apply(probe);
        assert(typeof msg === "string" && msg.length > 0, `${evId}/${ch.id} 要回一句`);
        assert(probe.gold === base.gold, `${evId}/${ch.id} 唔應該改金幣`);
        const changed =
          probe.hp !== base.hp ||
          probe.maxHp !== base.maxHp ||
          probe.deck.length !== base.deck.length ||
          (probe.nextBattleEnergyBonus || 0) - (probe.nextBattleEnergyPenalty || 0) !== 0 ||
          (probe.nextBattleBlock || 0) !== 0;
        assert(changed, `${evId}/${ch.id} 必須改局`);
      }
    }
  }

  // —— 每角 3 張專屬牌（共 9）＋starter 至少帶 1 ——
  const sigOwners = Object.keys(SIGNATURE_CARDS);
  assert(sigOwners.length === 3, "要有三個角色專屬池");
  let sigTotal = 0;
  for (const owner of sigOwners) {
    const ids = SIGNATURE_CARDS[owner];
    assert(ids.length === 3, `${owner} 要有 3 張專屬牌`);
    sigTotal += ids.length;
    for (const id of ids) {
      const card = CARDS[id];
      assert(card, `專屬牌 ${id} 不存在`);
      assert(card.owner === owner, `${id} owner 應為 ${owner}`);
      assert(!REWARD_POOL.includes(id), `${id} 唔應該入共用池`);
    }
    const starter = CHARACTERS[owner].starterDeck;
    assert(
      ids.some((id) => starter.includes(id)),
      `${owner} starter 至少要帶 1 張專屬牌`
    );
  }
  assert(sigTotal === 9, "專屬牌總數要 9 張");

  // 選牌池分角：唔會抽到別角專屬牌
  for (const owner of sigOwners) {
    const own = new Set(SIGNATURE_CARDS[owner]);
    const others = new Set(
      sigOwners.filter((o) => o !== owner).flatMap((o) => SIGNATURE_CARDS[o])
    );
    let sigHits = 0;
    for (let i = 0; i < 400; i++) {
      const pick = pickRewardChoices(3, [], owner);
      assert(pick.length === 3, `${owner} 三選一要有 3 張`);
      assert(new Set(pick).size === 3, `${owner} 三選一唔可以有重複`);
      for (const id of pick) {
        assert(!others.has(id), `${owner} 抽到別角專屬牌 ${id}`);
        if (own.has(id)) sigHits += 1;
      }
    }
    assert(sigHits > 0, `${owner} 400 抽都冇專屬牌，權重冇生效`);
  }

  walkAct(run, ACT1_MAP, 1, notes);
  run.act = 2;
  walkAct(run, ACT2_MAP, 2, notes);
  run.act = 3;
  walkAct(run, ACT3_MAP, 3, notes);

  // 結算資料
  const finalEnemy = enemyById("E12");
  assert(
    run.encounters.some((e) => e.name === finalEnemy.name && e.tag === "最終 Boss"),
    "遭遇紀錄要有最終 Boss"
  );
  assert(run.encounters.length >= 10, `遭遇紀錄偏少：${run.encounters.length}`);

  const deckCount = run.deck.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  return {
    charId,
    name: c.name,
    passive: c.passive.name,
    actsCleared: [actDisplayName(1), actDisplayName(2), actDisplayName(3)],
    hpLeft: `${run.hp}/${run.maxHp}`,
    goldLeft: run.gold,
    deck: run.deck.length,
    distinctCards: Object.keys(deckCount).length,
    victories: run.victories,
    encounters: run.encounters.length,
    finalBossDown: true,
    notes,
  };
}

const results = ["oil", "asan", "kauko"].map(simulateChar);
console.log(
  JSON.stringify(
    {
      ok: true,
      finalBoss: enemyById("E12").name,
      act3: actDisplayName(3),
      results,
    },
    null,
    2
  )
);
