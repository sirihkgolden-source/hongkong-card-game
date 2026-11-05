/**
 * 成就／首通標（薄層）。
 *
 * 兩類標：
 *   - **角色首通**：`char_<id>` —— 用該角色打穿三區
 *   - **Boss 首殺**：`boss_<enemyId>` —— 第一次打贏該 Boss
 *
 * 每個標記只會解鎖一次，解鎖後永久保留（localStorage key `hk_badges_v1`）。
 * 未解鎖嘅標**唔會劇透**：只顯示「？？？」。
 *
 * 屬「進度」類資料 —— 設定頁「清除本機進度」會一併清走。
 */

/** 存讀 key */
export const BADGES_KEY = "hk_badges_v1";

/** 版本（將來改結構用） */
export const BADGES_VERSION = 1;

/* ---------- 標記定義 ---------- */

/** 角色首通標（key 用現有角色 id） */
export const CHAR_BADGES = {
  oil: {
    id: "char_oil",
    kind: "char",
    charId: "oil",
    name: "後巷走過三區",
    desc: "用阿油・後巷經紀打穿三個 Act。",
    flavor: "「快手」兩個字，以後街坊講起都會諗起你。",
  },
  asan: {
    id: "char_asan",
    kind: "char",
    charId: "asan",
    name: "茶記守到最後",
    desc: "用阿珊・茶記夜更打穿三個 Act。",
    flavor: "檔口收咗爐，但你把火冇熄過。",
  },
  kauko: {
    id: "char_kauko",
    kind: "char",
    charId: "kauko",
    name: "招牌最亮嗰盞",
    desc: "用九哥・招牌工打穿三個 Act。",
    flavor: "成條街嘅招牌都熄晒，淨返你嗰盞。",
  },
  sing: {
    id: "char_sing",
    kind: "char",
    charId: "sing",
    name: "跌打館之光",
    desc: "用勝仔・跌打館學徒打穿三個 Act。",
    flavor: "一身瘀傷行落天台，你仲識笑。",
  },
};

/** Boss 首殺標（key 用敵人 id；三大 Boss 名寫死，唔可以改） */
export const BOSS_BADGES = {
  E04: {
    id: "boss_E04",
    kind: "boss",
    enemyId: "E04",
    act: 1,
    name: "過閘",
    desc: "第一次打贏 Act1 Boss。",
    flavor: "鐵閘升起嗰一刻，你就唔再係生面孔。",
  },
  E05: {
    id: "boss_E05",
    kind: "boss",
    enemyId: "E05",
    act: 2,
    name: "散水",
    desc: "第一次打贏 Act2 Boss。",
    flavor: "月光底落數，你冇被人點錯。",
  },
  E12: {
    id: "boss_E12",
    kind: "boss",
    enemyId: "E12",
    act: 3,
    name: "籠門開",
    desc: "第一次打贏 Act3 最終 Boss。",
    flavor: "籠門開過一次，就唔會再關返。",
  },
};

/** 全部標記（id → 定義），方便查名 */
export const ALL_BADGES = {
  ...Object.fromEntries(Object.values(CHAR_BADGES).map((b) => [b.id, b])),
  ...Object.fromEntries(Object.values(BOSS_BADGES).map((b) => [b.id, b])),
};

/** 全部標記 id（穩定排序：角色先，再 Act1/2/3 Boss） */
export const BADGE_ORDER = [
  CHAR_BADGES.oil.id,
  CHAR_BADGES.asan.id,
  CHAR_BADGES.kauko.id,
  CHAR_BADGES.sing.id,
  BOSS_BADGES.E04.id,
  BOSS_BADGES.E05.id,
  BOSS_BADGES.E12.id,
];

/** 總數（4 角色 + 3 Boss = 7） */
export const BADGE_TOTAL = BADGE_ORDER.length;

/* ---------- 存讀 ---------- */

function safeStorage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** 空狀態 */
export function emptyBadges() {
  return { v: BADGES_VERSION, ids: [] };
}

/**
 * 讀取已解鎖標記。
 * 壞資料／版本唔對 → 回空（唔會 throw）。
 * @returns {{v:number, ids:string[]}}
 */
export function loadBadges() {
  const s = safeStorage();
  if (!s) return emptyBadges();
  try {
    const raw = s.getItem(BADGES_KEY);
    if (!raw) return emptyBadges();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== BADGES_VERSION) return emptyBadges();
    // 只保留認得嘅 id（防止舊 id 殘留）
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.filter((id) => typeof id === "string" && ALL_BADGES[id])
      : [];
    return { v: BADGES_VERSION, ids };
  } catch {
    return emptyBadges();
  }
}

/** 寫入（回傳成功與否） */
export function saveBadges(data) {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(BADGES_KEY, JSON.stringify({ v: BADGES_VERSION, ids: data.ids || [] }));
    return true;
  } catch {
    return false;
  }
}

/**
 * 解鎖一個標記。
 * @returns {{data: object, isNew: boolean}} isNew=true 表示今次先解鎖（用嚟出提示）
 */
export function unlockBadge(data, badgeId) {
  const base = data && Array.isArray(data.ids) ? data : emptyBadges();
  if (!ALL_BADGES[badgeId]) return { data: base, isNew: false };
  if (base.ids.includes(badgeId)) return { data: base, isNew: false };
  const next = { v: BADGES_VERSION, ids: [...base.ids, badgeId] };
  return { data: next, isNew: true };
}

/**
 * 通關時一次過結算兩個標（角色首通 + 最終 Boss 首殺）。
 * @returns {{data: object, unlocked: object[]}} unlocked 係今次新解鎖嘅定義
 */
export function unlockOnClear(data, charId, finalBossEnemyId) {
  let cur = data && Array.isArray(data.ids) ? data : emptyBadges();
  const unlocked = [];

  const charBadge = CHAR_BADGES[charId];
  if (charBadge) {
    const r = unlockBadge(cur, charBadge.id);
    cur = r.data;
    if (r.isNew) unlocked.push(charBadge);
  }

  const bossBadge = BOSS_BADGES[finalBossEnemyId];
  if (bossBadge) {
    const r = unlockBadge(cur, bossBadge.id);
    cur = r.data;
    if (r.isNew) unlocked.push(bossBadge);
  }

  return { data: cur, unlocked };
}

/**
 * Boss 戰勝時結算 Boss 首殺標。
 * @returns {{data: object, unlocked: object|null}}
 */
export function unlockOnBossWin(data, enemyId) {
  const base = data && Array.isArray(data.ids) ? data : emptyBadges();
  const def = BOSS_BADGES[enemyId];
  if (!def) return { data: base, unlocked: null };
  const r = unlockBadge(base, def.id);
  return { data: r.data, unlocked: r.isNew ? def : null };
}

/** 已解鎖幾多個（0–7） */
export function badgeCount(data) {
  if (!data || !Array.isArray(data.ids)) return 0;
  return data.ids.filter((id) => ALL_BADGES[id]).length;
}

/** 查某個標記解鎖未 */
export function hasBadge(data, badgeId) {
  if (!data || !Array.isArray(data.ids)) return false;
  return data.ids.includes(badgeId);
}

/**
 * 砌圖鑑用嘅清單：已解鎖給真資料，未解鎖只給「？？？」（唔劇透）。
 * @returns {Array<{id:string, kind:string, unlocked:boolean, name:string, desc:string, flavor:string, tag:string}>}
 */
export function badgeList(data) {
  return BADGE_ORDER.map((id) => {
    const def = ALL_BADGES[id];
    const unlocked = hasBadge(data, id);
    const tag = def.kind === "char" ? "角色首通" : `Act${def.act} Boss`;
    if (!unlocked) {
      return {
        id,
        kind: def.kind,
        unlocked: false,
        name: "？？？",
        desc: "未解鎖",
        flavor: "",
        tag,
      };
    }
    return {
      id,
      kind: def.kind,
      unlocked: true,
      name: def.name,
      desc: def.desc,
      flavor: def.flavor,
      tag,
    };
  });
}
