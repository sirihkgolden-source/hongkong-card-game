/**
 * 永久成長（meta）存讀層。
 *
 * 只存三樣：
 *   owned    已解鎖嘅 meta 獎勵 id
 *   buff     下一局生效嘅 buff id（每局用完清空）
 *   seen     已遇過嘅敵人 id（圖鑑用，唔劇透未遇）
 *   cleared  已通關嘅角色 id（名冊用）
 *
 * 全部用 localStorage；讀寫失敗（私隱模式／額度滿）會靜靜降級，
 * 唔會令遊戲崩。
 */

const KEY = "hk_meta_v1";

/** @typedef {{owned:string[], buff:string|null, seen:string[], cleared:string[]}} MetaState */

/** @returns {MetaState} */
export function emptyMeta() {
  return { owned: [], buff: null, seen: [], cleared: [] };
}

/** 讀取（壞資料／無 localStorage 都回空值，唔 throw） */
export function loadMeta() {
  try {
    if (typeof localStorage === "undefined") return emptyMeta();
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw);
    return {
      owned: Array.isArray(parsed.owned) ? parsed.owned.filter((x) => typeof x === "string") : [],
      buff: typeof parsed.buff === "string" ? parsed.buff : null,
      seen: Array.isArray(parsed.seen) ? parsed.seen.filter((x) => typeof x === "string") : [],
      cleared: Array.isArray(parsed.cleared) ? parsed.cleared.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return emptyMeta();
  }
}

/** 寫入（失敗靜靜降級，回傳是否成功） */
export function saveMeta(meta) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

/** 清空（自測用） */
export function resetMeta() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/** 加入已遇敵人（去重） */
export function markSeen(meta, enemyId) {
  if (!enemyId) return meta;
  if (!meta.seen.includes(enemyId)) meta.seen.push(enemyId);
  return meta;
}

/** 加入已通關角色（去重） */
export function markCleared(meta, charId) {
  if (!charId) return meta;
  if (!meta.cleared.includes(charId)) meta.cleared.push(charId);
  return meta;
}

/** 加入已解鎖 meta 獎勵（去重） */
export function markOwned(meta, rewardId) {
  if (!rewardId) return meta;
  if (!meta.owned.includes(rewardId)) meta.owned.push(rewardId);
  return meta;
}

/** 設定下局 buff（覆蓋舊嘅，每局最多一層） */
export function setBuff(meta, rewardId) {
  meta.buff = rewardId || null;
  return meta;
}

/** 消耗 buff（開局讀完就清） */
export function consumeBuff(meta) {
  const b = meta.buff;
  meta.buff = null;
  saveMeta(meta);
  return b;
}
