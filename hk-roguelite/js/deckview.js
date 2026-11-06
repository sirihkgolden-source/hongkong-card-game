/**
 * 牌組預覽（純函式）：把牌組 id 陣列整理成「一眼睇得明」嘅結構。
 *
 * 兩個地方用：
 *   - **選角頁**：睇該角色 starter 有咩牌（開局前就知自己玩咩）
 *   - **戰鬥中**：開預覽睇成個牌組（抽牌堆 + 手牌 + 棄牌堆全部計）
 *
 * 純函式（唔讀 localStorage、唔讀 DOM），所以 smoke 可以直接測。
 */

/**
 * 把牌組分組並排序。
 *
 * 排序規則（刻意固定，唔用 Object 插入序）：
 *   1. 攻擊 → 技能（同類聚埋，一眼睇到比例）
 *   2. 同類內按費用升序
 *   3. 同費按牌名（localeCompare，中文有穩定序）
 *
 * @param {string[]} deck 牌 id 陣列（可含重複）
 * @param {Record<string, {name:string, type:string, cost:number}>} cards 牌資料
 * @returns {{total:number, rows:Array<{id:string,name:string,type:string,cost:number,count:number}>,
 *            attacks:number, skills:number, avgCost:string}}
 */
export function summarizeDeck(deck, cards) {
  const list = Array.isArray(deck) ? deck : [];
  /** @type {Map<string, {id:string,name:string,type:string,cost:number,count:number}>} */
  const map = new Map();

  for (const id of list) {
    const c = cards?.[id];
    const row = map.get(id);
    if (row) {
      row.count += 1;
      continue;
    }
    map.set(id, {
      id,
      name: c?.name ?? id,
      type: c?.type ?? "unknown",
      cost: Number.isFinite(c?.cost) ? c.cost : 0,
      count: 1,
    });
  }

  const rows = [...map.values()].sort((a, b) => {
    // 攻擊排先（玩家最關心打得出幾多）
    const ta = a.type === "attack" ? 0 : 1;
    const tb = b.type === "attack" ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return String(a.name).localeCompare(String(b.name), "zh-Hant");
  });

  let attacks = 0;
  let skills = 0;
  let costSum = 0;
  let costN = 0;
  for (const row of rows) {
    if (row.type === "attack") attacks += row.count;
    else skills += row.count;
    costSum += row.cost * row.count;
    costN += row.count;
  }

  return {
    total: costN,
    rows,
    attacks,
    skills,
    avgCost: costN > 0 ? (costSum / costN).toFixed(1) : "0.0",
  };
}

/**
 * 一句概覽（預覽標題下面）。
 * @param {ReturnType<typeof summarizeDeck>} s
 */
export function deckOverviewLine(s) {
  if (!s || s.total === 0) return "袋口空——仲未有牌入袋，出街先執兩張傍身先啦喂。";
  return `袋口共 ${s.total} 張 · 攻擊 ${s.attacks} · 技能 ${s.skills} · 平均 ${s.avgCost} 費／張——街口盤數清楚晒喇喂`;
}

/**
 * 戰鬥中嘅牌組總數（抽牌堆 + 手牌 + 棄牌堆）。
 * 用嚟畀預覽顯示「成副牌幾多張」，唔會因為抽咗牌而少咗。
 *
 * @param {{drawPile?:string[], hand?:string[], discard?:string[]}} battle
 * @returns {string[]}
 */
export function battleDeckIds(battle) {
  if (!battle) return [];
  const draw = Array.isArray(battle.drawPile) ? battle.drawPile : [];
  const hand = Array.isArray(battle.hand) ? battle.hand : [];
  const discard = Array.isArray(battle.discard) ? battle.discard : [];
  return [...draw, ...hand, ...discard];
}
