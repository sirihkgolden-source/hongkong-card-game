/**
 * 本機存儲層：統一管理 localStorage 上所有 `hk_` 開頭嘅資料。
 *
 * 分兩類：
 *   - **進度**（meta／圖鑑／名冊／教學記憶…）→ 「清除本機進度」會清
 *   - **設定**（音效開關…）→ 清除進度時**保留**，唔會連靜音設定都洗走
 *
 * 教學記憶 `hk_tutorial_seen` 刻意歸「進度」：玩家清乾淨之後再開，
 * 就當第一次玩，會再教一次（清進度＝重新開始，合理）。
 *
 * 全部操作 try/catch 降級：私隱模式／額度滿都唔會令遊戲崩。
 */

/** 所有本遊戲會寫入嘅 key 都以此開頭 */
export const KEY_PREFIX = "hk_";

/** 純設定用途嘅 key（清除進度時唔清） */
export const SETTING_KEYS = ["hk_sfx_muted"];

function safeStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** 列出本遊戲寫入過嘅所有 key */
export function listKeys() {
  const s = safeStorage();
  if (!s) return [];
  try {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(KEY_PREFIX)) out.push(k);
    }
    return out;
  } catch {
    return [];
  }
}

/** 進度類 key（排除純設定） */
export function progressKeys() {
  return listKeys().filter((k) => !SETTING_KEYS.includes(k));
}

/** 有冇任何進度？（設定頁用嚟決定撳落去會唔會真係有嘢清） */
export function hasProgress() {
  return progressKeys().length > 0;
}

/**
 * 清除本機進度：只清進度類 key，保留設定。
 * @returns {{removed: string[], kept: string[], ok: boolean}}
 */
export function clearProgress() {
  const s = safeStorage();
  if (!s) return { removed: [], kept: [], ok: false };
  const keep = progressKeys().length ? listKeys().filter((k) => SETTING_KEYS.includes(k)) : [];
  const removed = [];
  try {
    for (const k of progressKeys()) {
      s.removeItem(k);
      removed.push(k);
    }
    return { removed, kept: keep, ok: true };
  } catch {
    return { removed, kept: keep, ok: false };
  }
}
