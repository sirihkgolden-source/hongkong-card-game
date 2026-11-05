/**
 * 新手教學「睇過未」嘅本機記憶。
 *
 * 只記一個 boolean：`hk_tutorial_seen`。
 *   - 睇完／跳過 → 寫 1
 *   - 之後每次入選角都唔再彈
 *   - 屬「進度」類 key：設定頁「清除本機進度」會一併清走，
 *     令玩家可以當第一次玩咁再睇一次（清進度＝重新開始，合理）
 *
 * 全部 try/catch 降級：私隱模式／額度滿都唔會令遊戲崩。
 */

/** 教學記憶嘅 localStorage key */
export const TUTORIAL_KEY = "hk_tutorial_seen";

function safeStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** 睇過未？（讀唔到都當「未睇過」，寧願教多一次都唔好漏教） */
export function hasSeenTutorial() {
  const s = safeStorage();
  if (!s) return false;
  try {
    return s.getItem(TUTORIAL_KEY) === "1";
  } catch {
    return false;
  }
}

/** 標記為睇過（睇完或跳過都用呢個） */
export function markTutorialSeen() {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(TUTORIAL_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** 清走記憶（自測用；設定頁清進度亦會連帶清走） */
export function resetTutorial() {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.removeItem(TUTORIAL_KEY);
    return true;
  } catch {
    return false;
  }
}
