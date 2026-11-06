/**
 * 存檔層：自動存當前局到 localStorage，令玩家關掉瀏覽器都可以續玩。
 *
 * 只存「一局」的狀態（single slot），key `hk_run_v1`。
 * 刻意**唔存**進行中的戰鬥 detail（`state.battle`）—— 戰鬥係即時運算，
 * 中途存會出現「回合數／意圖／手牌」對唔上嘅情況，寧願由該節點重入。
 *
 * 設計原則：
 *   - 只存資料，唔存函式（JSON 可序列化）
 *   - 版本號 `v` 對唔上就當冇存檔（防止舊格式爆）
 *   - 角色 id 對唔上（角色被移除）都當冇存檔
 *   - 任何讀寫錯誤都靜靜降級，唔會令遊戲崩
 */

/** 存檔 key（屬「進度」類，清進度會清走） */
export const SAVE_KEY = "hk_run_v1";

/** 存檔格式版本；將來改結構要加 */
export const SAVE_VERSION = 1;

function safeStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * 由 run 抽出要存嘅欄位（白名單，避免不小心存咗大object）。
 * @param {object|null} run
 * @param {string} [screen] 玩家而家喺邊個畫面
 */
export function packRun(run, screen) {
  if (!run || typeof run !== "object") return null;
  return {
    v: SAVE_VERSION,
    at: Date.now(),
    screen: typeof screen === "string" ? screen : "map",
    characterId: run.characterId,
    act: run.act,
    hp: run.hp,
    maxHp: run.maxHp,
    gold: run.gold,
    deck: Array.isArray(run.deck) ? [...run.deck] : [],
    relics: Array.isArray(run.relics) ? [...run.relics] : [],
    mapIndex: run.mapIndex,
    completed: Array.isArray(run.completed) ? [...run.completed] : [],
    encounters: Array.isArray(run.encounters) ? [...run.encounters] : [],
    nodeEnemies: run.nodeEnemies && typeof run.nodeEnemies === "object" ? { ...run.nodeEnemies } : {},
    nodeEvents: run.nodeEvents && typeof run.nodeEvents === "object" ? { ...run.nodeEvents } : {},
    nextBattleEnergyPenalty: Number(run.nextBattleEnergyPenalty) || 0,
    nextBattleEnergyBonus: Number(run.nextBattleEnergyBonus) || 0,
    nextBattleBlock: Number(run.nextBattleBlock) || 0,
    victories: Number(run.victories) || 0,
  };
}

/**
 * 檢查一個存檔物件係唔係可以用。
 * @param {any} data
 * @param {string[]} [knownChars] 現存角色 id（用來擋「角色已移除」嘅舊存檔）
 */
export function validateSave(data, knownChars) {
  if (!data || typeof data !== "object") return false;
  if (data.v !== SAVE_VERSION) return false;
  if (typeof data.characterId !== "string" || !data.characterId) return false;
  if (Array.isArray(knownChars) && knownChars.length && !knownChars.includes(data.characterId)) {
    return false;
  }
  if (!Number.isFinite(data.act) || data.act < 1 || data.act > 3) return false;
  if (!Number.isFinite(data.mapIndex) || data.mapIndex < 0) return false;
  if (!Number.isFinite(data.maxHp) || data.maxHp <= 0) return false;
  if (!Array.isArray(data.deck) || data.deck.length === 0) return false;
  return true;
}

/**
 * 還原成 run 物件（補齊缺欄位）。
 * @param {object} data 已驗證嘅存檔
 */
export function unpackRun(data) {
  return {
    characterId: data.characterId,
    act: data.act,
    hp: data.hp,
    maxHp: data.maxHp,
    gold: Number(data.gold) || 0,
    deck: [...data.deck],
    relics: Array.isArray(data.relics) ? [...data.relics] : [],
    mapIndex: data.mapIndex,
    completed: Array.isArray(data.completed) ? [...data.completed] : [],
    encounters: Array.isArray(data.encounters) ? [...data.encounters] : [],
    nodeEnemies: data.nodeEnemies && typeof data.nodeEnemies === "object" ? { ...data.nodeEnemies } : {},
    nodeEvents: data.nodeEvents && typeof data.nodeEvents === "object" ? { ...data.nodeEvents } : {},
    nextBattleEnergyPenalty: Number(data.nextBattleEnergyPenalty) || 0,
    nextBattleEnergyBonus: Number(data.nextBattleEnergyBonus) || 0,
    nextBattleBlock: Number(data.nextBattleBlock) || 0,
    victories: Number(data.victories) || 0,
  };
}

/** 寫入存檔（回傳是否成功） */
export function saveRun(run, screen) {
  const s = safeStorage();
  if (!s) return false;
  const packed = packRun(run, screen);
  if (!packed) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(packed));
    return true;
  } catch {
    return false;
  }
}

/** 讀取存檔（壞資料／舊版本／角色不存在都回 null） */
export function loadRun(knownChars) {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!validateSave(parsed, knownChars)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 清走存檔（通關／敗北／玩家主動放棄／新局覆蓋時用） */
export function clearRun() {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** 有冇存檔可以續？（只做 key 存在＋基本驗證，唔回完整資料） */
export function hasSave(knownChars) {
  return loadRun(knownChars) !== null;
}

/**
 * 一句摘要，畀標題頁「繼續」掣顯示。
 * 用真實數值，唔靠估。
 * @param {object|null} data
 */
export function saveSummary(data) {
  if (!data) return "";
  const act = Number(data.act) || 1;
  const done = Array.isArray(data.completed) ? data.completed.length : 0;
  const hp = Number(data.hp) || 0;
  const maxHp = Number(data.maxHp) || 0;
  const gold = Number(data.gold) || 0;
  const deck = Array.isArray(data.deck) ? data.deck.length : 0;
  return `Act${act}・街口行到第 ${Math.min(done + 1, 6)}／6 格 · 血 ${hp}／${maxHp} · ${gold} 金 · ${deck} 張牌——續得返嚟打`;
}
