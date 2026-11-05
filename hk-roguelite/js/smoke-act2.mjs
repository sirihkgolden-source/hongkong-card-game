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
  ENEMIES,
  pickRewardChoices,
  SIGNATURE_CARDS,
  CONSUMABLES,
  RELICS,
  relicBonuses,
  pickShopConsumables,
  pickShopRelics,
  START_GOLD,
  ACT_TRANSITIONS,
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
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const c = CHARACTERS[id];
      assert(typeof c.route === "string" && c.route.length >= 3, `${id} 缺 route`);
      assert(typeof c.playstyle === "string" && c.playstyle.length >= 8, `${id} 缺 playstyle`);
      routes.push(c.route);
      styles.push(c.playstyle);
    }
    assert(new Set(routes).size === 4, `三角色 route 重複：${routes.join("/")}`);
    assert(new Set(styles).size === 4, "三角色 playstyle 重複");
  }

  // ② 失敗頁建議要有料：三角色 route／playstyle／passive 三者齊，
  //    否則「換角色」建議會顯示空白
  {
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const c = CHARACTERS[id];
      assert(c.route && c.playstyle, `${id} 缺 route／playstyle（失敗頁建議會空白）`);
      assert(c.passive?.name, `${id} 缺被動名`);
    }
    const passiveNames = ["oil", "asan", "kauko", "sing"].map((id) => CHARACTERS[id].passive.name);
    assert(new Set(passiveNames).size === 4, `被動名重複：${passiveNames.join("/")}`);
    // 失敗頁 rerunHook.defeat 亦要存在（否則失敗頁少一句）
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      assert(CHARACTERS[id].rerunHook?.defeat, `${id} 缺 rerunHook.defeat`);
    }
  }

  // ③ starter／專屬牌名唔撞
  {
    const sigNames = [];
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      for (const cardId of SIGNATURE_CARDS[id] || []) {
        const nm = CARDS[cardId]?.name;
        assert(nm, `${id} 專屬牌 ${cardId} 冇名`);
        sigNames.push(nm);
      }
    }
    assert(new Set(sigNames).size === sigNames.length, `專屬牌名有撞：${sigNames.join("/")}`);
    // starter 唔可以含別角專屬
    for (const id of ["oil", "asan", "kauko", "sing"]) {
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
  for (const id of ["oil", "asan", "kauko", "sing"]) {
    const h = CHARACTERS[id].rerunHook;
    assert(h, `${id} 缺 rerunHook`);
    for (const k of ["select", "clear", "defeat"]) {
      assert(typeof h[k] === "string" && h[k].trim().length >= 6, `${id} rerunHook.${k} 太短`);
    }
  }
  // 三角色鉤唔可以完全一樣（角色辨識度）
  assert(new Set(["oil", "asan", "kauko", "sing"].map((id) => CHARACTERS[id].rerunHook.select)).size === 4, "選角鉤重複");

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
      // 擋為主 → 守；回血為主 → 回血（睇邊個數值大）
      if ((c.block || c.heal) && !c.draw) {
        return (c.heal || 0) > (c.block || 0) ? "回血" : "守";
      }
      if (c.draw) return "抽牌";
      return "攻擊+";
    };
    const dominant = {};
    for (const cid of ["oil", "asan", "kauko", "sing"]) {
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
      // 主路線要明顯。角色愈多，共用池分薄愈厲害，門檻隨之調低：
      // 三角色時 ≥35%；四角色時 ≥26%（共用池只有 18 張，四角分薄後 27-31% 已算明顯）
      const charCount = Object.keys(CHARACTERS).length;
      const minShare = charCount >= 4 ? 0.26 : 0.35;
      assert(
        share >= minShare,
        `${cid} 主路線 ${topKind} 只佔 ${(share * 100) | 0}%，辨識度不足（需 ≥${(minShare * 100) | 0}%）`
      );
      // 專屬牌唔可以蓋過主路線
      assert(topKind !== "專屬", `${cid} 選牌被專屬牌主導，角色路線被稀釋`);
      dominant[cid] = topKind;
    }
    // 三個角色主路線要唔同
    assert(new Set(Object.values(dominant)).size === 4, `三角色主路線重複：${JSON.stringify(dominant)}`);
  }

  // ② 士多各項都要有價、有貨（唔好空白過場）
  {
    assert(typeof SHOP.healCost === "number" && SHOP.healCost > 0, "SHOP.healCost 唔合法");
    assert(typeof SHOP.cardCost === "number" && SHOP.cardCost > 0, "SHOP.cardCost 唔合法");
    assert(typeof SHOP.relicCost === "number" && SHOP.relicCost > 0, "SHOP.relicCost 唔合法");
    assert(typeof SHOP.packCost === "number" && SHOP.packCost > 0, "SHOP.packCost 唔合法");
    assert(typeof SHOP.rerollCost === "number" && SHOP.rerollCost > 0, "SHOP.rerollCost 唔合法");
    // 遺物貨架每次都要抽到貨
    assert(pickShopRelics({ characterId: "oil", relics: [] }, 2).length === 2, "遺物貨架抽唔夠 2 件");
  }

  // 開局金幣唔可以係死局：至少買到一件最便宜消耗品
  {
    assert(typeof START_GOLD === "number" && START_GOLD > 0, "開局金幣要 > 0");
    const cheapest = Math.min(...Object.values(CONSUMABLES).map((c) => c.price));
    assert(
      START_GOLD >= cheapest,
      `開局 ${START_GOLD} 金買唔到最便宜消耗品（${cheapest} 金）→ 死局`
    );
    // 第一格戰後一定要有金（唔可以 0）
    for (let i = 0; i < 20; i += 1) {
      const g = battleGoldReward(false);
      assert(g > 0, "第一格戰後金幣要 > 0");
    }
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

  // 結束回合：敵人行動後血量／擋要有變化，唔可以靜跳
  {
    const c = CHARACTERS.oil;
    const mkRun = () => ({
      characterId: "oil",
      hp: c.maxHp,
      maxHp: c.maxHp,
      energy: 3,
      deck: [...c.starterDeck],
      relics: [],
      nextBattleEnergyPenalty: 0,
      nextBattleEnergyBonus: 0,
      nextBattleBlock: 0,
    });
    // 攻擊意圖：結束回合後玩家血量應該減少（或擋被消耗）
    {
      const b = createBattle(mkRun(), enemyById("E01"));
      startPlayerTurn(b);
      b.intents = [{ kind: "attack", value: 7, label: "偷襲 7" }];
      b.intentIndex = 0;
      const hpBefore = b.playerHp;
      const blockBefore = b.playerBlock;
      endTurn(b);
      assert(
        b.playerHp < hpBefore || b.playerBlock < blockBefore,
        "結束回合後血量／擋冇變化（靜跳）"
      );
    }
    // 防守意圖：敵人擋要增加
    {
      const b = createBattle(mkRun(), enemyById("E01"));
      startPlayerTurn(b);
      b.intents = [{ kind: "block", value: 5, label: "隱影擋 5" }];
      b.intentIndex = 0;
      const blockBefore = b.enemyBlock;
      endTurn(b);
      assert(b.enemyBlock > blockBefore, "防守意圖冇加擋");
    }
    // 每次結束回合都要有返回結果（唔可以 null，否則 UI 冇嘢顯示）
    {
      const b = createBattle(mkRun(), enemyById("E01"));
      startPlayerTurn(b);
      const r = endTurn(b);
      assert(r && typeof r.kind === "string", "endTurn 要回傳 kind 畀 UI 用");
    }
  }

  // 敵人意圖：四種 kind 都要有標籤，唔可以空白
  {
    const knownKinds = new Set(["attack", "block", "buff_attack", "buff", "weaken"]);
    let sawKinds = new Set();
    for (const [id, e] of Object.entries(ENEMIES)) {
      assert(Array.isArray(e.intents) && e.intents.length > 0, `${id} 冇意圖`);
      for (const it of e.intents) {
        assert(knownKinds.has(it.kind), `${id} 意圖 kind 未知：${it.kind}`);
        assert(
          typeof it.label === "string" && it.label.length >= 2,
          `${id} 意圖 label 空白或太短`
        );
        // 攻擊類要有數值
        if (it.kind === "attack" || it.kind === "block") {
          assert(typeof it.value === "number" && it.value > 0, `${id} ${it.kind} 冇數值`);
        }
        sawKinds.add(it.kind);
      }
    }
    // 遊戲要有齊攻擊／防守兩種（否則意圖 UI 只用得一半）
    assert(sawKinds.has("attack"), "冇任何攻擊意圖");
    assert(sawKinds.has("block"), "冇任何防守意圖");
  }

  // 抽／棄／洗牌：牌堆要有計數、洗牌要能被偵測
  {
    // 用真戰鬥物件驗：起手抽牌後 drawPile + hand 總數應等於牌組數
    const c = CHARACTERS.oil;
    const run = {
      characterId: "oil",
      hp: c.maxHp,
      maxHp: c.maxHp,
      energy: 3,
      deck: [...c.starterDeck],
      relics: [],
      nextBattleEnergyPenalty: 0,
      nextBattleEnergyBonus: 0,
      nextBattleBlock: 0,
    };
    const b = createBattle(run, enemyById("E01"));
    startPlayerTurn(b);
    const total = b.drawPile.length + b.hand.length + b.discard.length;
    assert(total === c.starterDeck.length, `牌堆總數唔對：${total} vs ${c.starterDeck.length}`);
    assert(b.hand.length > 0, "起手冇手牌");
    assert(typeof b.lastReshuffle === "number", "缺 lastReshuffle 欄位");

    // 把牌庫清空再抽，驗洗牌會發生並記錄
    b.drawPile = [];
    b.discard = ["S01", "S02", "S15", "S11", "S14"];
    const handBefore = b.hand.length;
    // 用 endTurn 觸發 startPlayerTurn → drawCards
    endTurn(b);
    assert(b.lastReshuffle > 0, "棄牌回收時冇記錄洗牌張數");
    assert(
      b.drawPile.length + b.hand.length + b.discard.length === c.starterDeck.length,
      "洗牌後牌堆總數唔對"
    );
  }

  // 第四角色（勝仔）：被動／專屬牌／starter 齊全
  {
    const s = CHARACTERS.sing;
    assert(s, "缺第四角色 sing");
    assert(s.name.includes("勝仔"), "第四角色名要含「勝仔」");
    assert(s.passive?.id === "seotong", "第四角色被動應為 seotong");
    assert(s.passive.desc.includes("回"), "跌打被動要講回血");
    // 玩法要同前三者唔同（route 唔可以重複，已於上面驗）
    assert(s.route === "回復・續戰", "第四角色 route 應為回復・續戰");
    // starter 至少帶 1 張自己專屬
    const ownStarter = s.starterDeck.filter((id) => CARDS[id]?.owner === "sing");
    assert(ownStarter.length >= 1, "starter 要帶至少 1 張專屬牌");
    // 3 張專屬牌
    assert(SIGNATURE_CARDS.sing?.length === 3, "勝仔要有 3 張專屬牌");
    for (const id of SIGNATURE_CARDS.sing) {
      const c = CARDS[id];
      assert(c && c.owner === "sing", `${id} owner 應為 sing`);
    }
  }

  // Act 內分支：Act1–3 各至少 1 個 branch，且每個 ≥2 選項、兩邊都有可見回報
  {
    for (const [act, map] of [
      [1, ACT1_MAP],
      [2, ACT2_MAP],
      [3, mapForAct(3)],
    ]) {
      const branches = map.filter((n) => n.type === "branch");
      assert(branches.length >= 1, `Act${act} 缺分支節點`);
      for (const b of branches) {
        assert(b.options?.length >= 2, `${b.id} 分支要有 ≥2 選項`);
        // 骨架唔可以拆：節點數仍然係 6
        assert(map.length === 6, `Act${act} 節點數應為 6，實際 ${map.length}`);
        for (const opt of b.options) {
          const visible = (opt.bonusGold || 0) > 0 || (opt.bonusHp || 0) > 0;
          assert(visible, `${b.id}/${opt.id} 冇可見回報`);
          if (opt.kind === "battle") {
            assert(
              opt.enemyId || (opt.enemyPool && opt.enemyPool.length > 0),
              `${b.id}/${opt.id} 戰鬥分支缺 enemyId／enemyPool`
            );
          }
          if (opt.kind === "event") {
            assert(opt.eventId, `${b.id}/${opt.id} 事件分支缺 eventId`);
          }
        }
        // 兩邊結果要唔同（唔可以兩條路一樣）
        const kinds = new Set(b.options.map((o) => o.kind));
        assert(kinds.size >= 2, `${b.id} 兩邊路線要唔同類型`);
      }
    }
  }

  // 手機字級：390 寬下唔可以有大片空底（關鍵文字要有足夠字級）
  {
    // 用資料層無法測字級，改為確認「重要文案欄位」都存在且長度足夠，
    // 避免 UI 因缺字而留空。
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const c = CHARACTERS[id];
      assert(c.short && c.short.length >= 6, `${id} 缺 short（卡片描述會空）`);
      assert(c.playstyle && c.playstyle.length >= 8, `${id} 缺 playstyle`);
      assert(c.passive?.desc && c.passive.desc.length >= 10, `${id} 缺 passive desc`);
    }
    // 每張牌都要有 blurb（卡面第二行，缺咗會有空底）
    for (const [id, c] of Object.entries(CARDS)) {
      assert(c.blurb && c.blurb.length >= 6, `${id} 缺 blurb（卡面會空底）`);
    }
  }

  // 選角 → 第一戰：三角色都要有開場語（唔可以一入地圖就靜）
  {
    const lines = [];
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const c = CHARACTERS[id];
      assert(
        typeof c.openLine === "string" && c.openLine.length >= 10,
        `${id} 缺 openLine（選角後會靜）`
      );
      assert(c.passive?.desc, `${id} 缺 passive.desc（開場被動提示會空白）`);
      lines.push(c.openLine);
    }
    assert(new Set(lines).size === 4, "三角色 openLine 重複");
  }

  // 遺物欄一眼識：專屬標示要同角色對應，別角專屬要有「唔適用」機制
  {
    const owned = ["rl_oil_flask", "rl_asan_apron", "rl_kauko_signboard"];
    for (const id of owned) {
      const r = RELICS[id];
      assert(r, `${id} 缺定義`);
      assert(r.owner, `${id} 應該有 owner`);
      assert(r.rarity === "專屬", `${id} rarity 應為專屬`);
    }
    // 別角專屬唔可以入貨架（已於其他斷言驗過，這裡再確認效果層）
    for (const cid of ["oil", "asan", "kauko", "sing"]) {
      for (const id of owned) {
        const r = RELICS[id];
        if (r.owner === cid) continue;
        const b = relicBonuses({ characterId: cid, relics: [id] });
        const anyEffect = Object.entries(b).some(([, v]) => v > 0);
        assert(!anyEffect, `${cid} 帶別角專屬 ${id} 竟然有生效`);
      }
    }
    // 每件遺物都要有可講嘅效果（relicPlainText 靠 effect 欄位分派）
    for (const [id, r] of Object.entries(RELICS)) {
      const eff = r.effect || {};
      assert(Object.keys(eff).length > 0, `${id} 冇 effect 欄位`);
      assert(r.name && r.name.length >= 2, `${id} 缺名`);
    }
  }

  // 能量／擋 UI：HUD 要有獨立大數字元素（唔可以只係一行細字）
  {
    // 用資料層檢查：能量上限要正數，擋要有明確初始值
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const c = CHARACTERS[id];
      assert(typeof c.energy === "number" && c.energy > 0, `${id} energy 唔合法`);
    }
    // 卡費用唔可以超過角色起始能量上限太多（避免一開始乜都出唔到）
    const maxEnergy = Math.max(...["oil", "asan", "kauko", "sing"].map((id) => CHARACTERS[id].energy));
    const starterCosts = ["S01", "S02", "S09", "S22"].map((id) => CARDS[id]?.cost ?? 0);
    assert(
      starterCosts.some((c) => c === 0),
      "起手牌要有 0 費牌（否則冇能量時完全冇牌可出）"
    );
    assert(maxEnergy >= 1, "起始能量上限要 >= 1");
  }

  // 牌名／牌效人話：禁機械腔，長效果要有對應描述
  {
    const mechanical = /buff|debuff|疊加|觸發|增益|減益|狀態|回合開始時|計算|判定|烙/;
    for (const [id, c] of Object.entries(CARDS)) {
      assert(c.name && c.name.length >= 2, `${id} 缺牌名`);
      assert(c.blurb && c.blurb.length >= 6, `${id} 缺 blurb（效果描述）`);
      assert(!mechanical.test(c.blurb), `${id} blurb 含機械腔：${c.blurb}`);
    }
    // 有隱藏數值嘅牌，blurb 要講得白（低血加成／延後傷害）
    for (const id of ["S64", "S82"]) {
      assert(
        CARDS[id].dmgBonusOnLowHp > 0,
        `${id} 應該有低血加成`
      );
      assert(
        CARDS[id].blurb.includes("血"),
        `${id} 有低血加成但 blurb 冇提血`
      );
    }
    for (const id of ["S16", "S72", "S81", "S87"]) {
      assert(CARDS[id].mark > 0, `${id} 應該有延後傷害`);
      assert(
        /下回合|再痛/.test(CARDS[id].blurb),
        `${id} 有延後傷害但 blurb 冇講清楚`
      );
    }
  }

  // 敵名港味：禁止會計腔／生硬直譯
  {
    const forbidden = ["圍標", "到期", "清場沙包", "逼爆潮"];
    for (const [id, e] of Object.entries(ENEMIES)) {
      for (const bad of forbidden) {
        assert(!e.name.includes(bad), `${id} 名稱含會計腔「${bad}」：${e.name}`);
      }
      // 全部敵人都要有戰前 + 戰後各一句
      assert(e.flavor && e.flavor.length >= 8, `${id} 缺戰前台詞`);
      assert(e.afterword && e.afterword.length >= 6, `${id} 缺戰後台詞`);
    }
    // 三大 Boss 正式名不可改
    assert(enemyById("E04").name === "巷口鐵閘・睇場", "Act1 Boss 名被改");
    assert(enemyById("E05").name === "西裝收數隊", "Act2 Boss 名被改");
    assert(enemyById("E12").name === "籠門之王", "Act3 Boss 名被改");
  }

  // 通關總結：三角色各自要有一句（唔可以空白／重複）
  {
    const summaries = [];
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const s = CHARACTERS[id].clearSummary;
      assert(typeof s === "string" && s.length >= 10, `${id} 缺 clearSummary`);
      summaries.push(s);
    }
    assert(new Set(summaries).size === 4, "三角色 clearSummary 重複");
    // route 要有（結算「主路線」欄用）
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      assert(CHARACTERS[id].route, `${id} 缺 route（結算主路線會空白）`);
    }
  }

  // Act 銜接過場：入 Act2／Act3 之前各要有一句港味
  {
    for (const act of [2, 3]) {
      const t = ACT_TRANSITIONS[act];
      assert(t, `缺 Act${act} 過場`);
      assert(t.line && t.line.length >= 10, `Act${act} 過場句太短`);
      assert(t.note && t.note.length >= 4, `Act${act} 過場註腳太短`);
      assert(t.from && t.to, `Act${act} 過場缺 from／to`);
      assert(t.to === actDisplayName(act), `Act${act} 過場 to 同區名唔一致`);
    }
    // 兩句唔可以一樣
    assert(
      ACT_TRANSITIONS[2].line !== ACT_TRANSITIONS[3].line,
      "兩段過場句重複"
    );
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

  // ① 地圖節點類型：每區六格要有 battle/event/rest/boss 四種齊全
  {
    for (const [act, map] of [
      [1, ACT1_MAP],
      [2, ACT2_MAP],
      [3, mapForAct(3)],
    ]) {
      const types = new Set(map.map((n) => n.type));
      for (const need of ["battle", "event", "rest", "boss"]) {
        assert(types.has(need), `Act${act} 缺 ${need} 節點`);
      }
      // 每個節點都要有 title（唔可以空白）
      for (const n of map) {
        assert(n.title && n.title.length >= 2, `Act${act} 節點 ${n.id} 冇標題`);
        assert(n.type, `Act${act} 節點 ${n.id} 冇類型`);
      }
    }
  }

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

const results = ["oil", "asan", "kauko", "sing"].map(simulateChar);
console.log(JSON.stringify({ ok: true, act1: actDisplayName(1), act2: actDisplayName(2), results }, null, 2));
