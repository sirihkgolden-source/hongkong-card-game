/**
 * 《香江小風波》戰鬥邏輯（垂直切片・簡化可輸可贏）
 * 回傳明細供手感層動畫（打擊數字／快手／檔口／招牌眼／擋）
 */

import { CARDS, characterById, relicBonuses } from "./data.js";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {object} run
 * @param {object} enemyDef
 */
export function createBattle(run, enemyDef) {
  const char = characterById(run.characterId);
  const drawPile = shuffle([...run.deck]);
  const relics = relicBonuses(run);
  const energyPenalty = run.nextBattleEnergyPenalty || 0;
  const energyBonus = run.nextBattleEnergyBonus || 0;
  // 遺物開場擋 + 事件暫存擋
  const startBlock = (run.nextBattleBlock || 0) + relics.startBlock;
  run.nextBattleEnergyPenalty = 0;
  run.nextBattleEnergyBonus = 0;
  run.nextBattleBlock = 0;

  // 遺物加能量上限（每場都生效）
  const maxEnergy = char.energy + relics.startEnergy;
  const startEnergy = Math.max(0, maxEnergy - energyPenalty + energyBonus);

  return {
    characterId: char.id,
    passiveId: char.passive.id,
    passiveName: char.passive.name,

    enemyId: enemyDef.id,
    enemyName: enemyDef.name,
    enemyArt: enemyDef.art,
    enemyFlavor: enemyDef.flavor,
    /** Boss 戰後一句（區 Boss／最終 Boss 先有） */
    afterword: enemyDef.afterword || "",
    enemyMaxHp: enemyDef.hp,
    enemyHp: enemyDef.hp,
    enemyBlock: 0,
    enemyAtkBonus: 0,
    intentIndex: 0,
    intents: enemyDef.intents,
    isBoss: !!enemyDef.isBoss,
    isFinalBoss: !!enemyDef.isFinalBoss,
    isElite: !!enemyDef.isElite,

    playerHp: run.hp,
    playerMaxHp: run.maxHp,
    playerBlock: startBlock,
    energy: startEnergy,
    maxEnergy,
    energyPenalty,
    energyBonus,

    drawPile,
    hand: [],
    discard: [],

    /** 遺物：開場多抽＋攻擊加成 */
    relicDraw: relics.startDraw,
    relicAttackBonus: relics.attackBonus,
    /** 遺物：每回合額外抽牌（涼茶碗／招牌眼鏡） */
    relicDrawPerTurn: relics.drawPerTurn,
    /** 遺物：每張攻擊牌額外加傷（鐵指虎） */
    relicAttackPerCard: relics.attackPerCard,
    /** 遺物：每場首次回血額外加成（跌打藥箱） */
    relicHealBonusFirst: relics.healBonusFirst,
    /** 遺物：首回合額外能量（叮叮車票） */
    relicFirstTurnEnergy: relics.firstTurnEnergy || 0,
    /** 標記本場是否已用過首次回血加成 */
    healBonusUsed: false,

    attacksPlayed: 0,
    kuaisouReady: false,
    dangkouUsed: false,
    zhaopaiyanUsed: false,
    seotongUsed: false,
    playerWeaken: 0,
    enemyMark: 0,
    /** 上次抽牌洗牌回收咗幾多張（0 = 冇洗過） */
    lastReshuffle: 0,

    log: [],
    turn: 1,
    over: null, // "win" | "lose" | null
  };
}

function currentIntent(b) {
  return b.intents[b.intentIndex % b.intents.length];
}

export function getIntent(b) {
  return currentIntent(b);
}

function pushLog(b, text) {
  b.log.unshift(text);
  if (b.log.length > 8) b.log.pop();
}

function drawCards(b, n) {
  let reshuffled = 0;
  for (let i = 0; i < n; i++) {
    if (b.drawPile.length === 0) {
      if (b.discard.length === 0) break;
      const recycled = b.discard.length;
      b.drawPile = shuffle(b.discard);
      b.discard = [];
      reshuffled = recycled;
      pushLog(b, "洗返牌堆……袋口翻新一輪。");
    }
    const id = b.drawPile.shift();
    if (id) b.hand.push(id);
  }
  // 畀上層知道有冇洗過牌（用嚟出「洗牌」提示）
  b.lastReshuffle = reshuffled;
  return reshuffled;
}

export function startPlayerTurn(b) {
  // 首回合保留事件暫存擋；之後回合開場清擋
  if (b.turn > 1) b.playerBlock = 0;
  b.energy = Math.max(
    0,
    b.maxEnergy -
      (b.turn === 1 ? b.energyPenalty : 0) +
      (b.turn === 1 ? b.energyBonus : 0) +
      (b.turn === 1 ? b.relicFirstTurnEnergy || 0 : 0)
  );
  b.discard.push(...b.hand);
  b.hand = [];
  drawCards(b, 5 + (b.turn === 1 ? b.relicDraw || 0 : 0) + (b.relicDrawPerTurn || 0));
  pushLog(b, b.turn === 1 ? "開波——輪到你出手，街口睇住。" : `第 ${b.turn} 回合——輪到你出手，繼續撑住。`);

  if (b.enemyMark > 0) {
    const markDmg = b.enemyMark;
    b.enemyHp = Math.max(0, b.enemyHp - markDmg);
    pushLog(b, `跳電發作——對面再痛 ${markDmg}——數簿未埋`);
    b.enemyMark = 0;
    if (b.enemyHp <= 0) {
      b.over = "win";
      pushLog(b, "對手仆低——呢鋪收工，街口行得過！");
    }
  }
}

export function effectiveCost(b, cardId) {
  const card = CARDS[cardId];
  if (!card) return 99;
  let cost = card.cost;
  if (b.kuaisouReady && card.type === "attack") {
    cost = Math.max(0, cost - 1);
  }
  return cost;
}

/**
 * @returns {{
 *   ok: boolean,
 *   reason?: string,
 *   cardId?: string,
 *   cardType?: string,
 *   dealt?: number,
 *   enemyBlocked?: number,
 *   blockGained?: number,
 *   healed?: number,
 *   usedKuaisou?: boolean,
 *   kuaisouArmed?: boolean,
 *   zhaopaiyanDrew?: boolean,
 *   drawnExtra?: number,
 *   target?: "enemy"|"self"
 * }}
 */
export function playCard(b, handIndex) {
  if (b.over) return { ok: false, reason: "戰鬥已結束" };
  const cardId = b.hand[handIndex];
  const card = CARDS[cardId];
  if (!card) return { ok: false, reason: "無效牌" };

  const cost = effectiveCost(b, cardId);
  if (b.energy < cost) return { ok: false, reason: "能量不足" };

  b.energy -= cost;
  b.hand.splice(handIndex, 1);
  b.discard.push(cardId);

  let usedKuaisou = false;
  if (b.kuaisouReady && card.type === "attack") {
    usedKuaisou = true;
    b.kuaisouReady = false;
  }

  let dmg = card.dmg || 0;
  if (card.dmgBonusOnLowHp && b.playerHp * 2 <= b.playerMaxHp) {
    dmg += card.dmgBonusOnLowHp;
  }
  if (usedKuaisou) dmg += 3;
  // 遺物：所有攻擊 +傷害（只計攻擊牌，且本身有傷害）
  if (card.type === "attack" && dmg > 0) {
    dmg += b.relicAttackBonus || 0;
    dmg += b.relicAttackPerCard || 0;
  }
  if (b.playerWeaken > 0 && card.type === "attack") {
    dmg = Math.max(0, dmg - b.playerWeaken);
  }

  let dealt = 0;
  let enemyBlocked = 0;
  let blockGained = 0;
  let healed = 0;
  /** @type {"enemy"|"self"} */
  let target = card.type === "attack" ? "enemy" : "self";

  if (card.type === "attack" && dmg > 0) {
    enemyBlocked = Math.min(b.enemyBlock, dmg);
    b.enemyBlock -= enemyBlocked;
    dealt = dmg - enemyBlocked;
    b.enemyHp = Math.max(0, b.enemyHp - dealt);
    pushLog(
      b,
      `落「${card.name}」——打落 ${dealt} 傷${enemyBlocked ? `（擋走 ${enemyBlocked}）` : ""}${usedKuaisou ? "【快手加碼】" : ""}——出手`
    );
  }

  if (card.block) {
    b.playerBlock += card.block;
    blockGained = card.block;
    target = "self";
    pushLog(b, `落「${card.name}」——擋上 ${card.block}——先頂住`);
  }
  if (card.heal) {
    const before = b.playerHp;
    let amount = card.heal;
    // 遺物：每場首次回血額外加成（跌打藥箱）
    if (!b.healBonusUsed && (b.relicHealBonusFirst || 0) > 0) {
      amount += b.relicHealBonusFirst;
      b.healBonusUsed = true;
      pushLog(b, `【跌打藥箱】首次回血多 ${b.relicHealBonusFirst}——一劑頂兩劑`);
    }
    b.playerHp = Math.min(b.playerMaxHp, b.playerHp + amount);
    healed = b.playerHp - before;
    target = "self";
    pushLog(b, `落「${card.name}」——回 ${healed} HP——身子骨駁返`);
  }
  if (card.draw) {
    drawCards(b, card.draw);
    pushLog(b, `袋口摸 ${card.draw} 張——再開一輪`);
  }
  if (card.mark) {
    b.enemyMark += card.mark;
    pushLog(b, `留低 ${card.mark} 點——下回合再痛一截`);
  }

  let kuaisouArmed = false;
  if (b.passiveId === "kuaisou" && card.type === "attack") {
    b.attacksPlayed += 1;
    if (b.attacksPlayed % 3 === 0) {
      b.kuaisouReady = true;
      kuaisouArmed = true;
      pushLog(b, "【快手】下一記平一費兼多 3 傷——節奏嚟！");
    }
  }

  let zhaopaiyanDrew = false;
  let drawnExtra = 0;
  if (b.passiveId === "zhaopaiyan" && card.type === "skill" && !b.zhaopaiyanUsed) {
    b.zhaopaiyanUsed = true;
    drawCards(b, 1);
    zhaopaiyanDrew = true;
    drawnExtra = 1;
    pushLog(b, "【招牌眼】首次技能——袋口多摸 1——睇得通！");
  }

  // 跌打：每場首次打技能牌即刻回 4 HP
  let seotongHealed = 0;
  if (b.passiveId === "seotong" && card.type === "skill" && !b.seotongUsed) {
    b.seotongUsed = true;
    const before = b.playerHp;
    b.playerHp = Math.min(b.playerMaxHp, b.playerHp + 4);
    seotongHealed = b.playerHp - before;
    pushLog(b, `【跌打】首次技能——回 ${seotongHealed} HP——藥油見效！`);
  }

  if (b.enemyHp <= 0) {
    b.over = "win";
    pushLog(b, "對手仆低——呢鋪收工，街口行得過！");
  }

  return {
    ok: true,
    cardId,
    cardType: card.type,
    dealt,
    enemyBlocked,
    blockGained,
    healed,
    /** 呢張卡本身抽咗幾多張（唔計被動） */
    drew: card.draw || 0,
    usedKuaisou,
    kuaisouArmed,
    zhaopaiyanDrew,
    drawnExtra,
    /** 跌打被動回咗幾多 HP（0 = 未觸發） */
    seotongHealed,
    target,
  };
}

/**
 * 檔口：首次受到實際傷害後立刻獲得護盾
 * @returns {{ triggered: boolean, block: number }}
 */
export function tryDangkou(b, damageTaken) {
  if (b.passiveId !== "dangkou" || b.dangkouUsed || damageTaken <= 0) {
    return { triggered: false, block: 0 };
  }
  b.dangkouUsed = true;
  const block = 8;
  b.playerBlock += block;
  pushLog(b, `【檔口】首次捱打——擋上 ${block}——守住先！`);
  return { triggered: true, block };
}

/**
 * @returns {{
 *   intent: object,
 *   dealt?: number,
 *   blocked?: number,
 *   kind: string,
 *   dangkou?: { triggered: boolean, block: number }
 * } | null}
 */
export function endTurn(b) {
  if (b.over) return null;

  b.playerWeaken = 0;
  const intent = currentIntent(b);
  b.enemyBlock = 0;

  /** @type {{ intent: object, dealt?: number, blocked?: number, kind: string, dangkou?: { triggered: boolean, block: number } }} */
  const result = { intent, kind: intent.kind, dealt: 0, blocked: 0 };

  if (intent.kind === "attack") {
    const raw = intent.value + b.enemyAtkBonus;
    const blocked = Math.min(b.playerBlock, raw);
    b.playerBlock -= blocked;
    const dealt = raw - blocked;
    b.playerHp = Math.max(0, b.playerHp - dealt);
    result.dealt = dealt;
    result.blocked = blocked;
    pushLog(b, `${b.enemyName}：${intent.label} → 你捱咗 ${dealt} 傷——街口記低`);
    // 捱打＝對方出手攻擊（全擋都算受擊）
    result.dangkou = tryDangkou(b, raw);
  } else if (intent.kind === "block") {
    b.enemyBlock += intent.value;
    pushLog(b, `${b.enemyName}：${intent.label}——對面守緊層擋`);
  } else if (intent.kind === "buff_attack") {
    b.enemyAtkBonus += intent.value;
    pushLog(b, `${b.enemyName}：${intent.label}（攻勢 +${b.enemyAtkBonus}）——對面蓄勢`);
  } else if (intent.kind === "weaken") {
    b.playerWeaken = intent.value;
    pushLog(b, `${b.enemyName}：${intent.label}——你下擊會鈍一截`);
  }

  if (b.playerHp <= 0) {
    b.over = "lose";
    pushLog(b, "你仆街……街口靜咗一陣，燈都淡咗。");
    return result;
  }

  b.intentIndex += 1;
  b.turn += 1;
  startPlayerTurn(b);
  return result;
}
