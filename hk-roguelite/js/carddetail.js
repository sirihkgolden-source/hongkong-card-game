/**
 * 卡牌詳情（長按用）：把牌嘅數值砌成人話。
 *
 * 卡面本身只有「傷 5／盾 3」呢種短標，長按想睇多啲：
 *   - 完整效果句（人話）
 *   - 費用／類型／稀有度
 *   - 幾時特別有用（一句提示）
 *
 * 純函式（唔讀 DOM／localStorage），smoke 可直接測。
 */

/**
 * 一句人話講清張牌做咩。
 * @param {object} card `CARDS[id]`
 */
export function cardEffectLines(card) {
  if (!card) return ["（冇資料）"];
  const out = [];

  // 傷害：分開講「半血加成」同「標記」兩種特別情況
  if (card.dmg) {
    let dmgLine = `出拳打落 ${card.dmg} 傷。`;
    if (card.dmgBonusOnLowHp) {
      dmgLine += `自己半血以下再加 ${card.dmgBonusOnLowHp} 傷——血少氣旺。`;
    }
    out.push(dmgLine);
  }

  if (card.block) out.push(`加 ${card.block} 擋——呢回合打入嚟嘅先頂住。`);

  if (card.heal) out.push(`回 ${card.heal} 滴血——身子骨駁返。`);

  if (card.draw) out.push(`摸 ${card.draw} 張——袋口再開。`);

  if (card.mark) out.push(`留低標記：下回合對面再痛 ${card.mark}。`);

  if (out.length === 0) out.push("冇即時數值——多數係舖路、起手或者觸發被動。");
  return out;
}

/**
 * 一句「幾時用」提示（港味、具體）。
 * @param {object} card
 */
export function cardWhenToUse(card) {
  if (!card) return "";
  const cost = card.cost ?? 0;

  if (card.dmg && card.dmg >= 12) {
    return "重手——留返對手血薄收尾，或者 Boss 拆盾嗰下。";
  }
  if (card.dmg && card.draw) {
    return "打得又摸得，牌唔會斷——開場就可以落。";
  }
  if (card.block && card.block >= 8) {
    return "對手寫住大數嗰下先出，慳返條命。";
  }
  if (card.block) {
    return "捱打前出——擋幾多得幾多，唔好等拳頭落嚟。";
  }
  if (card.heal) {
    return "唔好等血見底——早啲補，街口先捱得耐。";
  }
  if (card.draw && !card.dmg) {
    return "手牌乾嘅時候出，幫你搵返出擊牌。";
  }
  if (cost === 0) {
    return "免費牌——有空位就落，唔會蝕。";
  }
  return "睇場合用——冇硬性限制，街口隨機應變。";
}

/**
 * 砌成一個詳情物件（畀 UI 一次過 render）。
 * @param {object} card
 * @returns {{name:string,cost:number,typeLabel:string,rarity:string,blurb:string,
 *            lines:string[],whenToUse:string}}
 */
export function cardDetail(card) {
  if (!card) {
    return {
      name: "（冇資料）",
      cost: 0,
      typeLabel: "—",
      rarity: "—",
      blurb: "",
      lines: ["（冇資料）"],
      whenToUse: "",
    };
  }
  return {
    name: card.name || "（無名）",
    cost: Number.isFinite(card.cost) ? card.cost : 0,
    typeLabel: card.type === "attack" ? "攻擊" : card.type === "skill" ? "技能" : "—",
    rarity: card.rarity || "—",
    blurb: card.blurb || "",
    lines: cardEffectLines(card),
    whenToUse: card.whenToUse ? card.whenToUse : cardWhenToUse(card),
  };
}
