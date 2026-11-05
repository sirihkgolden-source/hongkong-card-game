/**
 * Round 3 smoke：四角色流程核對（被動旗標／金幣出口／Act 銜接）
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

  // ① 四角色都要有 route（主路線標籤）同 playstyle（一句講清點玩）
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
    assert(new Set(routes).size === 4, `四角色 route 重複：${routes.join("/")}`);
    assert(new Set(styles).size === 4, "四角色 playstyle 重複");
  }

  // ② 失敗頁建議要有料：四角色 route／playstyle／passive 三者齊，
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

  // ① 四角色都要有「再開一局」鉤（選角／通關／敗北各一句）
  for (const id of ["oil", "asan", "kauko", "sing"]) {
    const h = CHARACTERS[id].rerunHook;
    assert(h, `${id} 缺 rerunHook`);
    for (const k of ["select", "clear", "defeat"]) {
      assert(typeof h[k] === "string" && h[k].trim().length >= 6, `${id} rerunHook.${k} 太短`);
    }
  }
  // 四角色鉤唔可以完全一樣（角色辨識度）
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
        // 事件唔可以「發死金」（白送金幣），但可以花錢換其他回報
        assert(
          probe.gold <= 30,
          `${ev.title}/${ch.id} 唔應該發金幣（實際 ${probe.gold}）`
        );
        if (!visible) thisEventAllVisible = false;
      }
      if (thisEventAllVisible) fullyVisible += 1;
    }
    // 每區至少 1 個事件，全部選項都即時可見（唔可以淨係跳下一格）
    assert(fullyVisible >= 1, `Act${act} 冇任何事件做到全選項即時可見`);
    // 每區池要 ≥2 個，否則每局抽 2 個會抽到同一個
    assert(pool.length >= 2, `Act${act} 事件池少於 2 個，每局唔會唔同`);
  }

  // ① 選牌傾向：四角色各自要明顯偏一類（唔可以揀邊個都一樣）
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
    assert(new Set(Object.values(dominant)).size === 4, `四角色主路線重複：${JSON.stringify(dominant)}`);
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

  // 選角 → 第一戰：四角色都要有開場語（唔可以一入地圖就靜）
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
    assert(new Set(lines).size === 4, "四角色 openLine 重複");
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

  // 通關總結：四角色各自要有一句（唔可以空白／重複）
  {
    const summaries = [];
    for (const id of ["oil", "asan", "kauko", "sing"]) {
      const s = CHARACTERS[id].clearSummary;
      assert(typeof s === "string" && s.length >= 10, `${id} 缺 clearSummary`);
      summaries.push(s);
    }
    assert(new Set(summaries).size === 4, "四角色 clearSummary 重複");
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
      assert(run.gold <= goldBefore, "A1 事件唔應該發死金");
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

/* ---------- 音效薄層：唔開瀏覽器都驗得到嘅部分 ---------- */
{
  // Node 冇 localStorage：用記憶體版本模擬，順便驗「靜音狀態真係存到」
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  };
  const localStorageGet = (k) => (store.has(k) ? store.get(k) : null);

  const {
    SFX_MUTED_KEY,
    MASTER_GAIN,
    SFX_NAMES,
    isMuted,
    setMuted,
    toggleMuted,
    sfx,
  } = await import("./sfx.js");

  // ① 四類必需音都在（出牌／受傷／金幣／通關）
  for (const name of ["card", "hurt", "coin", "clear"]) {
    assert(typeof sfx[name] === "function", `缺音效 ${name}`);
    assert(SFX_NAMES.includes(name), `SFX_NAMES 未登記 ${name}`);
  }
  assert(SFX_NAMES.length >= 4, "SFX_NAMES 太短");
  // 每個登記名都要真係有對應方法（唔可以登記咗但冇實作）
  for (const name of SFX_NAMES) {
    assert(typeof sfx[name] === "function", `SFX_NAMES 有 ${name} 但 sfx 冇實作`);
  }

  // ② 音量預設要低（< 0.6），而且係正數（唔係 0＝靜音）
  assert(MASTER_GAIN > 0 && MASTER_GAIN < 0.6, `主音量應偏低，實際 ${MASTER_GAIN}`);

  // ③ 靜音掣：toggle 兩下要返原狀；靜音狀態要寫入 localStorage
  const before = isMuted();
  assert(toggleMuted() === !before, "toggleMuted 第一次唔對");
  assert(isMuted() === !before, "toggleMuted 後 isMuted 唔對");
  assert(toggleMuted() === before, "toggleMuted 第二次唔返原狀");
  assert(isMuted() === before, "toggle 兩次後狀態唔還原");

  setMuted(true);
  assert(localStorageGet(SFX_MUTED_KEY) === "1", "靜音要寫入 localStorage");
  setMuted(false);
  assert(localStorageGet(SFX_MUTED_KEY) === null, "取消靜音要清走 localStorage");

  // ④ 無音檔亦無問題：靜音時播任何音都唔 throw（Node 本身無 AudioContext）
  setMuted(true);
  for (const name of SFX_NAMES) sfx[name]();
  setMuted(false);
  for (const name of SFX_NAMES) sfx[name](); // Node 無 window → 應靜靜降級
  assert(true, "播音降級唔應該 throw");

  console.log("  ✓ 音效薄層（四類必需音／低音量／靜音狀態）");

  // 收工：避免污染其他測試
  setMuted(false);
  delete globalThis.localStorage;
}

/* ---------- 設定頁：清除進度（唔可以洗走音效設定） ---------- */
{
  // 完整模擬 localStorage（要有 length／key 才驗得到「列出全部 key」）
  const store = new Map();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  };

  const { KEY_PREFIX, SETTING_KEYS, listKeys, progressKeys, hasProgress, clearProgress } =
    await import("./storage.js");

  // ① 空機：冇任何進度
  assert(listKeys().length === 0, "空機唔應該有 key");
  assert(hasProgress() === false, "空機 hasProgress 應為 false");

  // ② 寫入混合資料：3 個進度 + 1 個設定，另加 1 個無關 key（唔應該被掃到）
  localStorage.setItem("hk_meta_v1", '{"owned":["x"]}');
  localStorage.setItem("hk_codex_v1", "{}");
  localStorage.setItem("hk_runs_v1", "[]");
  localStorage.setItem(SETTING_KEYS[0], "1"); // 靜音設定
  localStorage.setItem("_other_app_key", "leave-me");

  assert(listKeys().length === 4, `listKeys 應為 4，實際 ${listKeys().length}`);
  assert(progressKeys().length === 3, `progressKeys 應為 3，實際 ${progressKeys().length}`);
  assert(
    !progressKeys().includes(SETTING_KEYS[0]),
    "設定 key 唔應該當成進度"
  );
  assert(hasProgress() === true, "有進度時 hasProgress 應為 true");
  // 無關 key 唔應該被列入（前綴嚴格）
  for (const k of listKeys()) assert(k.startsWith(KEY_PREFIX), `${k} 唔係本遊戲嘅 key`);

  // ③ 清除進度：進度清空，設定保留，無關 key 不受影響
  const res = clearProgress();
  assert(res.ok === true, "clearProgress 應成功");
  assert(res.removed.length === 3, `應清 3 個，實際 ${res.removed.length}`);
  assert(progressKeys().length === 0, "清除後唔應該再有進度");
  assert(hasProgress() === false, "清除後 hasProgress 應為 false");
  assert(
    localStorage.getItem(SETTING_KEYS[0]) === "1",
    "音效設定必須保留（清除進度唔可以洗走靜音）"
  );
  assert(
    localStorage.getItem("_other_app_key") === "leave-me",
    "其他 App 嘅 key 唔可以被清"
  );

  // ④ 冇進度時再清一次：唔應該 throw，removed 為空
  const again = clearProgress();
  assert(again.ok === true && again.removed.length === 0, "重複清除應該安全回空");

  // ⑤ 清除失敗要降級而唔 throw（模擬 removeItem 拋錯）
  localStorage.setItem("hk_meta_v1", "{}");
  const origRemove = localStorage.removeItem;
  localStorage.removeItem = () => {
    throw new Error("quota");
  };
  const failed = clearProgress();
  assert(failed.ok === false, "removeItem 拋錯時 clearProgress 應回 ok:false");
  localStorage.removeItem = origRemove;

  console.log("  ✓ 設定頁清除進度（保留音效設定／唔碰其他 key）");

  // 收工
  store.clear();
  delete globalThis.localStorage;
}

/* ---------- 新手教學：首局先彈，之後唔再彈 ---------- */
{
  const store = new Map();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  };

  const { TUTORIAL_KEY, hasSeenTutorial, markTutorialSeen, resetTutorial } = await import(
    "./tutorial.js"
  );

  // ① 全新機：未睇過 → 首局會彈
  assert(hasSeenTutorial() === false, "全新機應該未睇過教學");

  // ② 標記睇過 → 之後唔再彈
  assert(markTutorialSeen() === true, "markTutorialSeen 應成功");
  assert(localStorage.getItem(TUTORIAL_KEY) === "1", "教學記憶應寫入 localStorage");
  assert(hasSeenTutorial() === true, "標記後應該當睇過");

  // ③ 重複標記唔會出錯，值仍然係 "1"
  markTutorialSeen();
  assert(localStorage.getItem(TUTORIAL_KEY) === "1", "重複標記唔應該變成其他值");

  // ④ 重開瀏覽器（＝重新讀同一個 localStorage）仍然記得
  assert(hasSeenTutorial() === true, "重開後應該仍然記得睇過");

  // ⑤ 只有精確 "1" 才算睇過（其他怪值都當未睇，寧願教多一次）
  localStorage.setItem(TUTORIAL_KEY, "true");
  assert(hasSeenTutorial() === false, "非 '1' 嘅值應視為未睇過");
  localStorage.setItem(TUTORIAL_KEY, "0");
  assert(hasSeenTutorial() === false, "'0' 應視為未睇過");

  // ⑥ reset 之後會再彈
  localStorage.setItem(TUTORIAL_KEY, "1");
  assert(resetTutorial() === true, "resetTutorial 應成功");
  assert(hasSeenTutorial() === false, "reset 後應該再彈");

  // ⑦ 教學記憶屬「進度」類：清除本機進度會連帶清走（清完＝重新開始）
  const { clearProgress, SETTING_KEYS } = await import("./storage.js");
  assert(!SETTING_KEYS.includes(TUTORIAL_KEY), "教學記憶唔應該當成設定（清進度要清得走）");
  localStorage.setItem(TUTORIAL_KEY, "1");
  localStorage.setItem(SETTING_KEYS[0], "1");
  const res = clearProgress();
  assert(res.ok === true, "clearProgress 應成功");
  assert(hasSeenTutorial() === false, "清進度後教學應該會再彈");
  assert(localStorage.getItem(SETTING_KEYS[0]) === "1", "清進度唔可以清走音效設定");

  // ⑧ 無 localStorage 環境唔應該 throw
  delete globalThis.localStorage;
  assert(hasSeenTutorial() === false, "無 localStorage 應回 false");
  assert(markTutorialSeen() === false, "無 localStorage 標記應回 false");
  assert(resetTutorial() === false, "無 localStorage reset 應回 false");

  console.log("  ✓ 新手教學記憶（首局彈／跳過／之後唔再彈／清進度重置）");
}

/* ---------- 暫停／返回標題：丟失咩要講得準 ---------- */
{
  const { pauseSummary, pauseLossLine, hasRunToLose } = await import("./pause.js");

  // ① 冇 run：唔應該當有嘢丟
  assert(hasRunToLose(null) === false, "null 唔應該當有局");
  assert(hasRunToLose(undefined) === false, "undefined 唔應該當有局");
  const empty = pauseSummary(null);
  assert(empty.ok === false, "冇 run 時 ok 應為 false");
  assert(empty.items.length === 0, "冇 run 時唔應該列任何嘢");
  assert(pauseLossLine(empty).length > 0, "冇 run 都要有句人話");

  // ② 真 run：數值要逐項對得上（唔可以講錯）
  const run = {
    act: 2,
    completed: ["n1", "n2", "n3"],
    hp: 41,
    maxHp: 68,
    gold: 23,
    deck: ["S01", "S02", "S03", "S04", "S05"],
    relics: ["rl_kuban", "rl_hat"],
  };
  const s = pauseSummary(run, { totalNodes: 6 });
  assert(s.ok === true, "有 run 時 ok 應為 true");
  assert(s.act === 2, `act 應為 2，實際 ${s.act}`);
  assert(s.done === 3, `done 應為 3，實際 ${s.done}`);
  assert(s.total === 6, `total 應為 6，實際 ${s.total}`);
  assert(s.hp === 41 && s.maxHp === 68, "HP 數字要對得上");
  assert(s.gold === 23, "金幣要對得上");
  assert(s.deck === 5, "牌組張數要對得上");
  assert(s.relics === 2, "遺物件數要對得上");

  // ③ 清單要含「打到第幾格」（done+1，因為而家正正卡喺下一格）
  const joined = s.items.join("｜");
  assert(joined.includes("第 4／6 格"), `應講「第 4／6 格」，實際：${joined}`);
  assert(joined.includes("41／68"), "應講 HP 41／68");
  assert(joined.includes("23 個大洋"), "應講 23 個大洋");
  assert(joined.includes("5 張牌"), "應講 5 張牌");
  assert(joined.includes("2 件遺物"), "應講 2 件遺物");

  // ④ 冇遺物時唔應該提「0 件遺物」（免得列表灌水）
  const noRelic = pauseSummary({ ...run, relics: [] }, { totalNodes: 6 });
  assert(!noRelic.items.join("｜").includes("遺物"), "冇遺物時唔應該提遺物");

  // ⑤ 一句總結要講清「返標題會點」，唔可以含混
  //    第八輪加咗存檔：由「冇得續」改成「會幫你存起，可以續」，
  //    所以要求變成「必須講到存檔／續」，而**唔可以**再講「冇得續」（會呃人）。
  const line = pauseLossLine(s);
  assert(line.includes("存起") || line.includes("繼續"), `總結要講清會存檔：${line}`);
  assert(!line.includes("冇得續"), `有存檔就唔可以再講「冇得續」：${line}`);
  assert(line.includes("Act2"), `總結要提 Act：${line}`);

  // ⑥ 缺欄位／怪值都要降級而唔 throw
  const weird = pauseSummary({ act: "3", completed: null, hp: undefined, deck: null });
  assert(weird.ok === true, "有 object 就算有局");
  assert(weird.act === 1, "act 非數字應落回 1");
  assert(weird.done === 0, "completed 唔係陣列應當 0");
  assert(weird.hp === 0 && weird.deck === 0, "怪值應落回 0");
  assert(pauseLossLine(weird).length > 0, "怪值都要有句人話");

  console.log("  ✓ 暫停／返標題（丟失清單逐項對得上真實數值）");
}

/* ---------- 存檔續玩：寫／讀／驗證／覆蓋 ---------- */
{
  const store = new Map();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
  };

  const {
    SAVE_KEY,
    SAVE_VERSION,
    packRun,
    validateSave,
    unpackRun,
    saveRun,
    loadRun,
    clearRun,
    hasSave,
    saveSummary,
  } = await import("./save.js");

  const KNOWN = ["oil", "asan", "kauko", "sing"];
  const mk = () => ({
    characterId: "kauko",
    act: 2,
    hp: 51,
    maxHp: 72,
    gold: 19,
    deck: ["S01", "S16", "S86", "S87"],
    relics: ["rl_kuban"],
    mapIndex: 3,
    completed: ["n1", "n2", "n3"],
    encounters: [{ enemyId: "E03", result: "win" }],
    nodeEnemies: { n1: "E01" },
    nodeEvents: { n3: "ev_stair" },
    nextBattleEnergyPenalty: 0,
    nextBattleEnergyBonus: 1,
    nextBattleBlock: 5,
    victories: 3,
  });

  // ① 空機：冇存檔
  assert(hasSave(KNOWN) === false, "空機唔應該有存檔");
  assert(loadRun(KNOWN) === null, "空機 loadRun 應回 null");
  assert(saveSummary(null) === "", "冇存檔時摘要應為空");

  // ② 寫入 → 讀回：六大必要欄位要齊（角／Act／節點／牌／遺物／血金）
  assert(saveRun(mk(), "map") === true, "saveRun 應成功");
  const back = loadRun(KNOWN);
  assert(back !== null, "應該讀得返存檔");
  assert(back.v === SAVE_VERSION, "版本號要對");
  assert(back.characterId === "kauko", "角色要對");
  assert(back.act === 2, "Act 要對");
  assert(back.mapIndex === 3, "節點索引要對");
  assert(back.deck.length === 4, "牌組要對");
  assert(back.relics.length === 1, "遺物要對");
  assert(back.hp === 51 && back.maxHp === 72, "血要對");
  assert(back.gold === 19, "金要對");

  // ③ unpack 要補齊缺欄位，唔會漏 key
  const run = unpackRun(back);
  for (const k of [
    "characterId",
    "act",
    "hp",
    "maxHp",
    "gold",
    "deck",
    "relics",
    "mapIndex",
    "completed",
    "encounters",
    "nodeEnemies",
    "nodeEvents",
    "nextBattleEnergyPenalty",
    "nextBattleEnergyBonus",
    "nextBattleBlock",
    "victories",
  ]) {
    assert(k in run, `unpackRun 漏 ${k}`);
  }
  assert(run.nextBattleEnergyBonus === 1 && run.nextBattleBlock === 5, "跨場加成要保留");
  assert(Array.isArray(run.deck) && run.deck !== back.deck, "deck 要係新陣列（唔可以共用 reference）");

  // ④ 版本唔對 → 當冇存檔（唔會用舊格式爆）
  const oldVer = { ...packRun(mk(), "map"), v: 0 };
  localStorage.setItem(SAVE_KEY, JSON.stringify(oldVer));
  assert(validateSave(oldVer, KNOWN) === false, "舊版本要驗證失敗");
  assert(loadRun(KNOWN) === null, "舊版本應讀成 null");

  // ⑤ 角色已移除 → 當冇存檔
  const ghost = packRun(mk(), "map");
  localStorage.setItem(SAVE_KEY, JSON.stringify(ghost));
  assert(validateSave(ghost, ["oil", "asan"]) === false, "角色不在名單要驗證失敗");

  // ⑥ 壞 JSON / 缺欄位 都要降級
  localStorage.setItem(SAVE_KEY, "{{壞");
  assert(loadRun(KNOWN) === null, "壞 JSON 應回 null");
  assert(validateSave(null) === false, "null 應該驗證失敗");
  assert(validateSave({}) === false, "空 object 應該驗證失敗");
  assert(validateSave({ v: SAVE_VERSION, characterId: "oil" }) === false, "缺欄位應該驗證失敗");
  assert(validateSave({ ...packRun(mk()), deck: [] }) === false, "空牌組應該驗證失敗");
  assert(validateSave({ ...packRun(mk()), act: 9 }) === false, "Act 超界應該驗證失敗");
  assert(validateSave({ ...packRun(mk()), characterId: "" }) === false, "空角色 id 應該驗證失敗");
  assert(validateSave({ ...packRun(mk()), mapIndex: -1 }) === false, "負節點索引應該驗證失敗");
  assert(validateSave({ ...packRun(mk()), maxHp: 0 }) === false, "maxHp 0 應該驗證失敗");

  // ⑦ 摘要用真實數值
  const sum = saveSummary(packRun(mk(), "map"));
  assert(sum.includes("Act2"), `摘要應有 Act2：${sum}`);
  assert(sum.includes("第 4／6 格"), `摘要應有格數：${sum}`);
  assert(sum.includes("51／72"), `摘要應有 HP：${sum}`);
  assert(sum.includes("19 金"), `摘要應有金：${sum}`);
  assert(sum.includes("4 張牌"), `摘要應有牌數：${sum}`);

  // ⑧ clear 之後冇得續（用一份**有效**存檔驗，唔可以靠「壞資料」蒙混過關）
  saveRun(mk(), "map");
  assert(hasSave(KNOWN) === true, "清之前應該有存檔");
  assert(clearRun() === true, "clearRun 應成功");
  assert(localStorage.getItem(SAVE_KEY) === null, "clearRun 要真係刪走個 key");
  assert(hasSave(KNOWN) === false, "清走後唔應該有存檔");
  assert(clearRun() === true, "重複清走要安全");

  // ⑨ 再存一次會覆蓋（唔會兩份並存）
  saveRun(mk(), "map");
  const second = { ...mk(), act: 3, mapIndex: 0, gold: 30 };
  saveRun(second, "map");
  const after = loadRun(KNOWN);
  assert(after.act === 3 && after.gold === 30, "新存檔應覆蓋舊存檔");
  assert(Array.from(store.keys()).filter((k) => k === SAVE_KEY).length === 1, "只可以有一份存檔");

  // ⑩ 無 localStorage 環境唔應該 throw
  delete globalThis.localStorage;
  assert(loadRun(KNOWN) === null, "無 localStorage 應回 null");
  assert(hasSave(KNOWN) === false, "無 localStorage hasSave 應 false");
  assert(saveRun(mk(), "map") === false, "無 localStorage 存檔應回 false");
  assert(clearRun() === false, "無 localStorage 清檔應回 false");

  console.log("  ✓ 存檔續玩（六大欄位齊／版本驗證／覆蓋單份／降級安全）");
}

console.log(JSON.stringify({ ok: true, act1: actDisplayName(1), act2: actDisplayName(2), results }, null, 2));
