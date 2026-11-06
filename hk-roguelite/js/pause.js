/**
 * 暫停／返回標題嘅「會丟失咩」計算。
 *
 * 獨立成一個純函式，因為呢段文案最容易講錯（講少咗＝呃玩家，講多咗＝唔敢出街）。
 * 放喺模組就可以畀 smoke 直接測，唔需要開瀏覽器。
 *
 * 規則：返回標題 = 呢一局即刻報銷，冇得「續上次」。所以一定要講清：
 *   - 打到邊（Act N，第幾格／共幾格）
 *   - 袋住幾多金、幾多 HP、幾多張牌、幾多件遺物
 */

/** 呢一局有冇嘢會丟失？ */
export function hasRunToLose(run) {
  return !!run && typeof run === "object";
}

/**
 * 砌「會丟失」清單。
 * @param {object|null} run
 * @param {{actName?: (n:number)=>string, totalNodes?: number}} [opts]
 * @returns {{ok: boolean, act: number, done: number, total: number, hp: number,
 *            maxHp: number, gold: number, deck: number, relics: number, items: string[]}}
 */
export function pauseSummary(run, opts = {}) {
  const total = Number.isFinite(opts.totalNodes) ? opts.totalNodes : 6;
  if (!hasRunToLose(run)) {
    return {
      ok: false,
      act: 0,
      done: 0,
      total,
      hp: 0,
      maxHp: 0,
      gold: 0,
      deck: 0,
      relics: 0,
      items: [],
    };
  }

  const act = Number.isFinite(run.act) ? run.act : 1;
  const done = Array.isArray(run.completed) ? run.completed.length : 0;
  const hp = Number.isFinite(run.hp) ? run.hp : 0;
  const maxHp = Number.isFinite(run.maxHp) ? run.maxHp : 0;
  const gold = Number.isFinite(run.gold) ? run.gold : 0;
  const deck = Array.isArray(run.deck) ? run.deck.length : 0;
  const relics = Array.isArray(run.relics) ? run.relics.length : 0;

  // 逐項砌成人話；用嘅都是真實數值，冇一項係估
  const items = [
    `Act${act} · 街口行到第 ${Math.min(done + 1, total)}／${total} 格——未散`,
    `血 ${hp}／${maxHp}`,
    `${gold} 個大洋——袋口`,
    `袋口 ${deck} 張牌——街口盤數`,
  ];
  if (relics > 0) items.push(`身家 ${relics} 件遺物傍身`);

  return { ok: true, act, done, total, hp, maxHp, gold, deck, relics, items };
}

/**
 * 一句總結（按鈕上面嗰句），港味但唔含糊。
 *
 * 注意：第八輪加咗存檔之後，「返標題」**唔再等於報銷**——
 * 局會留在存檔，下次撳「繼續」返得嚟。文案必須跟住改，
 * 否則會呃玩家（上一輪寫死「冇得續」）。
 *
 * @param {ReturnType<typeof pauseSummary>} s
 */
export function pauseLossLine(s) {
  if (!s || !s.ok) return "而家未有進行中嘅一鋪——出街先，返嚟再講。";
  return `返標題會幫你存起呢一鋪（Act${s.act} 街口第 ${Math.min(s.done + 1, s.total)}／${s.total} 格），下次撳「繼續」就返得嚟——街口唔會白行。`;
}
