/**
 * 平衡探針（唔入 commit 流程用都可）：最終 Boss 對四角色嘅粗勝率
 * 用法：cd hk-roguelite && node js/probe-act3.mjs
 * 政策：打得就打（費用夠、優先攻擊），唔夠費就結束回合（唔保留擋牌策略）——偏保守下限。
 */
import { CHARACTERS, CARDS, enemyById } from "./data.js";
import { createBattle, playCard, endTurn, startPlayerTurn, effectiveCost } from "./battle.js";

function runFight(deck, charId, enemyId, startHpRatio = 1) {
  const c = CHARACTERS[charId];
  const hp = Math.max(1, Math.round(c.maxHp * startHpRatio));
  const run = {
    characterId: charId,
    hp,
    maxHp: c.maxHp,
    deck: [...deck],
    nextBattleEnergyBonus: 0,
    nextBattleEnergyPenalty: 0,
    nextBattleBlock: 0,
  };
  const b = createBattle(run, enemyById(enemyId));
  startPlayerTurn(b);
  let guard = 0;
  while (!b.over && guard < 120) {
    guard += 1;
    let played = false;
    // 合理下限打法：夠費就打攻擊（輸出優先），冇攻擊就打技能
    const order = [...b.hand.keys()].map((i) => ({ i, c: CARDS[b.hand[i]] }));
    order.sort((x, y) => {
      const rank = (c) => (c.type === "attack" ? 0 : 1);
      return rank(x.c) - rank(y.c);
    });
    for (const { i } of order) {
      const card = CARDS[b.hand[i]];
      if (!card) continue;
      if (b.energy >= effectiveCost(b, b.hand[i])) {
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
  }
  return { win: b.over === "win", lose: b.over === "lose", timeout: !b.over, turns: guard, hp: b.playerHp, enemyHp: b.enemyHp };
}

/** 粗略「打完三區」牌組：起始 ＋ 每戰／選牌加牌
 *  假設玩家會在每 3 張牌中揀 1 張攻擊牌（純防禦牌組打唔死 Boss，唔算合理下限） */
function realisticDeck(charId, extra = 8) {
  const c = CHARACTERS[charId];
  const deck = [...c.starterDeck];
  const bias = c.rewardBias || Object.keys(CARDS);
  const attacks = bias.filter((id) => CARDS[id]?.type === "attack");
  const others = bias.filter((id) => CARDS[id]?.type !== "attack");
  for (let i = 0; i < extra; i++) {
    const pool = i % 3 === 0 && attacks.length ? attacks : others.length ? others : bias;
    deck.push(pool[Math.floor(i / 3) % pool.length] || bias[0]);
  }
  return deck;
}

const scenarios = [
  { name: "fullHp", ratio: 1 },
  { name: "arriveAt60%", ratio: 0.6 },
  { name: "arriveAt40%", ratio: 0.4 },
];

const out = {};
for (const charId of ["oil", "asan", "kauko"]) {
  const deck = realisticDeck(charId);
  out[charId] = { deckSize: deck.length };
  for (const sc of scenarios) {
    let wins = 0;
    let losses = 0;
    let timeouts = 0;
    const samples = 300;
    let hpSum = 0;
    for (let i = 0; i < samples; i++) {
      const r = runFight(deck, charId, "E12", sc.ratio);
      if (r.win) {
        wins += 1;
        hpSum += r.hp;
      } else if (r.lose) losses += 1;
      else timeouts += 1;
    }
    out[charId][sc.name] = `勝 ${Math.round((wins / samples) * 100)}%／敗 ${Math.round(
      (losses / samples) * 100
    )}%／超時 ${Math.round((timeouts / samples) * 100)}%${wins ? `（剩 HP 均值 ${Math.round(hpSum / wins)}）` : ""}`;
  }
}
console.log(JSON.stringify({ finalBoss: enemyById("E12").name, hp: enemyById("E12").hp, out }, null, 2));
