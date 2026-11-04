/**
 * 《香江小風波》戰鬥邏輯（垂直切片・簡化可輸可贏）
 */

import { CARDS, CHARACTER } from "./data.js";

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
  const drawPile = shuffle([...run.deck]);
  const energyPenalty = run.nextBattleEnergyPenalty || 0;
  run.nextBattleEnergyPenalty = 0;

  return {
    enemyId: enemyDef.id,
    enemyName: enemyDef.name,
    enemyArt: enemyDef.art,
    enemyFlavor: enemyDef.flavor,
    enemyMaxHp: enemyDef.hp,
    enemyHp: enemyDef.hp,
    enemyBlock: 0,
    enemyAtkBonus: 0,
    intentIndex: 0,
    intents: enemyDef.intents,
    isBoss: !!enemyDef.isBoss,

    playerHp: run.hp,
    playerMaxHp: run.maxHp,
    playerBlock: 0,
    energy: Math.max(0, CHARACTER.energy - energyPenalty),
    maxEnergy: CHARACTER.energy,
    energyPenalty,

    drawPile,
    hand: [],
    discard: [],

    attacksPlayed: 0,
    kuaisouReady: false,
    playerWeaken: 0,
    enemyMark: 0,

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
  for (let i = 0; i < n; i++) {
    if (b.drawPile.length === 0) {
      if (b.discard.length === 0) break;
      b.drawPile = shuffle(b.discard);
      b.discard = [];
      pushLog(b, "洗牌……");
    }
    const id = b.drawPile.shift();
    if (id) b.hand.push(id);
  }
}

export function startPlayerTurn(b) {
  b.playerBlock = 0;
  b.energy = Math.max(0, b.maxEnergy - (b.turn === 1 ? b.energyPenalty : 0));
  // discard leftover hand
  b.discard.push(...b.hand);
  b.hand = [];
  drawCards(b, 5);

  if (b.enemyMark > 0) {
    b.enemyHp = Math.max(0, b.enemyHp - b.enemyMark);
    pushLog(b, `跳電烙住造成 ${b.enemyMark} 傷害`);
    b.enemyMark = 0;
    if (b.enemyHp <= 0) {
      b.over = "win";
      pushLog(b, "對手倒下！");
    }
  }
}

/**
 * Effective cost for a card in hand (快手 −1)
 */
export function effectiveCost(b, cardId) {
  const card = CARDS[cardId];
  if (!card) return 99;
  let cost = card.cost;
  if (b.kuaisouReady && card.type === "attack") {
    cost = Math.max(0, cost - 1);
  }
  return cost;
}

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
  if (b.playerWeaken > 0 && card.type === "attack") {
    dmg = Math.max(0, dmg - b.playerWeaken);
  }

  if (card.type === "attack" && dmg > 0) {
    const blocked = Math.min(b.enemyBlock, dmg);
    b.enemyBlock -= blocked;
    const dealt = dmg - blocked;
    b.enemyHp = Math.max(0, b.enemyHp - dealt);
    pushLog(
      b,
      `打出「${card.name}」造成 ${dealt} 傷害${blocked ? `（擋 ${blocked}）` : ""}${usedKuaisou ? "【快手】" : ""}`
    );
  }

  if (card.block) {
    b.playerBlock += card.block;
    pushLog(b, `打出「${card.name}」獲得 ${card.block} 護盾`);
  }
  if (card.heal) {
    const before = b.playerHp;
    b.playerHp = Math.min(b.playerMaxHp, b.playerHp + card.heal);
    pushLog(b, `打出「${card.name}」回復 ${b.playerHp - before} HP`);
  }
  if (card.draw) {
    drawCards(b, card.draw);
    pushLog(b, `抽 ${card.draw} 張`);
  }
  if (card.mark) {
    b.enemyMark += card.mark;
    pushLog(b, `烙住跳電 ${card.mark}`);
  }

  if (card.type === "attack") {
    b.attacksPlayed += 1;
    if (b.attacksPlayed % 3 === 0) {
      b.kuaisouReady = true;
      pushLog(b, "【快手】下一張攻擊費用 −1 並 +3 傷害！");
    }
  }

  if (b.enemyHp <= 0) {
    b.over = "win";
    pushLog(b, "對手倒下！");
  }

  return { ok: true };
}

export function endTurn(b) {
  if (b.over) return;

  b.playerWeaken = 0;
  const intent = currentIntent(b);
  b.enemyBlock = 0;

  if (intent.kind === "attack") {
    const raw = intent.value + b.enemyAtkBonus;
    const blocked = Math.min(b.playerBlock, raw);
    b.playerBlock -= blocked;
    const dealt = raw - blocked;
    b.playerHp = Math.max(0, b.playerHp - dealt);
    pushLog(b, `${b.enemyName}：${intent.label} → 你受到 ${dealt} 傷害`);
  } else if (intent.kind === "block") {
    b.enemyBlock += intent.value;
    pushLog(b, `${b.enemyName}：${intent.label}`);
  } else if (intent.kind === "buff_attack") {
    b.enemyAtkBonus += intent.value;
    pushLog(b, `${b.enemyName}：${intent.label}（現攻加成 ${b.enemyAtkBonus}）`);
  } else if (intent.kind === "weaken") {
    b.playerWeaken = intent.value;
    pushLog(b, `${b.enemyName}：${intent.label}`);
  }

  if (b.playerHp <= 0) {
    b.over = "lose";
    pushLog(b, "你倒下了……");
    return;
  }

  b.intentIndex += 1;
  b.turn += 1;
  startPlayerTurn(b);
}
