/**
 * 每日一局鉤（本機日期）。
 *
 * 規則（薄）：
 *   - 每日**第一次**完局（通關或失敗都算）派 1 個薄獎勵
 *   - 獎勵輪換：有時係「下局多幾個大洋」，有時係「一句名片句」
 *   - 同一天內再完局**唔會**再派
 *   - 日期用**本機時間**（`new Date()` 嘅本地年月日），唔用 UTC，
 *     否則香港玩家半夜打機會計錯日
 *
 * 存 localStorage key `hk_daily_v1`：
 *   { v, date:"YYYY-MM-DD", kind:"gold"|"line", value:number, text:string, pendingGold:number }
 *
 * 屬「進度」類：設定頁清除本機進度會一併清走。
 * 全部 try/catch 降級，唔會令遊戲崩。
 */

/** 存讀 key */
export const DAILY_KEY = "hk_daily_v1";

/** 格式版本 */
export const DAILY_VERSION = 1;

/* ---------- 獎勵池（薄，唔影響平衡） ---------- */

/** 金幣獎勵（下局開局多幾多） */
export const DAILY_GOLD = [
  { kind: "gold", value: 6, name: "街坊請食", desc: "下一鋪開波袋口多 6 個大洋。" },
  { kind: "gold", value: 8, name: "士多找贖聲", desc: "下一鋪開波袋口多 8 個大洋。" },
  { kind: "gold", value: 10, name: "手氣順過街口", desc: "下一鋪開波袋口多 10 個大洋。" },
];

/** 名片句（純文字收藏） */
export const DAILY_LINES = [
  { kind: "line", name: "今日一句", text: "「條街唔會記得你贏幾多次，淨係記得你有冇再嚟。」" },
  { kind: "line", name: "今日一句", text: "「霓虹燈壞咗會有人整，人散咗就冇人執。」" },
  { kind: "line", name: "今日一句", text: "「你以為自己行得快，其實係條巷短。」" },
  { kind: "line", name: "今日一句", text: "「每個睇場都有第一日；每個第一日都想返屋企。」" },
  { kind: "line", name: "今日一句", text: "「天台冇燈，但都有人喺上面等緊你。」" },
  { kind: "line", name: "今日一句", text: "「跌打酒醫得瘀傷，醫唔到唔服氣。」" },
  { kind: "line", name: "今日一句", text: "「便利店燈亮過街燈，但照唔到你個袋口。」" },
  { kind: "line", name: "今日一句", text: "「鐵閘一落，成條巷先記得邊個仲企喺出面。」" },
  { kind: "line", name: "今日一句", text: "「旺角冇夜深，淨係有人未散。」" },
  { kind: "line", name: "今日一句", text: "「天台風大，吹散嘅唔止係煙。」" },
  { kind: "line", name: "今日一句", text: "「士多櫃檯燈一閃，找贖聲比你心跳大聲。」" },
  { kind: "line", name: "今日一句", text: "「後巷唔講規矩，講邊個仲企得住。」" },
  { kind: "line", name: "今日一句", text: "「籠門一開，賭嘅唔止係注碼。」" },
  { kind: "line", name: "今日一句", text: "「你袋口幾厚，街口都睇得出。」" },
  { kind: "line", name: "今日一句", text: "「簷篷底眯一陣，雨聲都替你數數。」" },
  { kind: "line", name: "今日一句", text: "「便利店雪櫃風，吹唔散你袋口嘅火氣。」" },
  { kind: "line", name: "今日一句", text: "「天台無燈，但你鞋底仲印住三區塵。」" },
];

/** 全部可能獎勵（測試用） */
export const DAILY_POOL = [...DAILY_GOLD, ...DAILY_LINES];

/* ---------- 日期 ---------- */

/**
 * 本機日期字串 `YYYY-MM-DD`。
 * 刻意唔用 `toISOString()`（嗰個係 UTC，香港會差 8 個鐘）。
 * @param {Date} [d]
 */
export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 由日期字串穩定咁揀一個獎勵（同一天永遠同一個）。
 * @param {string} key `YYYY-MM-DD`
 */
export function rewardForDate(key) {
  // 簡單字串 hash（穩定、唔用 Math.random，否則同一天會變）
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % 1000003;
  }
  return DAILY_POOL[h % DAILY_POOL.length];
}

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
export function emptyDaily() {
  return { v: DAILY_VERSION, date: "", kind: "", value: 0, text: "", pendingGold: 0 };
}

/** 讀取（壞資料／版本唔對 → 回空，唔 throw） */
export function loadDaily() {
  const s = safeStorage();
  if (!s) return emptyDaily();
  try {
    const raw = s.getItem(DAILY_KEY);
    if (!raw) return emptyDaily();
    const p = JSON.parse(raw);
    if (!p || p.v !== DAILY_VERSION) return emptyDaily();
    return {
      v: DAILY_VERSION,
      date: typeof p.date === "string" ? p.date : "",
      kind: typeof p.kind === "string" ? p.kind : "",
      value: Number(p.value) || 0,
      text: typeof p.text === "string" ? p.text : "",
      pendingGold: Number(p.pendingGold) || 0,
    };
  } catch {
    return emptyDaily();
  }
}

/** 寫入（回傳成功與否） */
export function saveDaily(data) {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(
      DAILY_KEY,
      JSON.stringify({
        v: DAILY_VERSION,
        date: data.date || "",
        kind: data.kind || "",
        value: Number(data.value) || 0,
        text: data.text || "",
        pendingGold: Number(data.pendingGold) || 0,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/** 今日領咗未？ */
export function isClaimedToday(d = new Date()) {
  const data = loadDaily();
  return data.date === dateKey(d);
}

/**
 * 今日領取（每日只成功一次）。
 * @param {Date} [d] 可注入日期（測試用）
 * @returns {{ok:boolean, claimed:boolean, reward:object|null, data:object}}
 *   claimed=true 表示今次真係領到；false = 今日已領過（reward 係今日已經派咗嗰個）
 */
export function claimDaily(d = new Date()) {
  const key = dateKey(d);
  const cur = loadDaily();
  if (cur.date === key) {
    // 今日已領：照樣回今日嗰個獎勵（畀結算頁顯示），但唔會再加
    return {
      ok: true,
      claimed: false,
      reward: { kind: cur.kind, value: cur.value, text: cur.text },
      data: cur,
    };
  }
  const reward = rewardForDate(key);
  const next = {
    v: DAILY_VERSION,
    date: key,
    kind: reward.kind,
    value: reward.kind === "gold" ? reward.value : 0,
    text: reward.kind === "line" ? reward.text : "",
    pendingGold: (cur.pendingGold || 0) + (reward.kind === "gold" ? reward.value : 0),
  };
  const ok = saveDaily(next);
  return { ok, claimed: true, reward, data: next };
}

/**
 * 下一局開局時攞走 pendingGold（攞完即清，唔會累積）。
 * @returns {number}
 */
export function consumePendingGold() {
  const data = loadDaily();
  const g = Number(data.pendingGold) || 0;
  if (g > 0) {
    saveDaily({ ...data, pendingGold: 0 });
  }
  return g;
}

/** 清走（自測用；設定頁清進度亦會連帶清走） */
export function resetDaily() {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.removeItem(DAILY_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * 標題頁用嘅一句狀態。
 * @param {Date} [d]
 */
export function dailyStatusLine(d = new Date()) {
  const data = loadDaily();
  if (data.date !== dateKey(d)) return "今日未領——打完一鋪（贏輸都計）就有得收。";
  if (data.kind === "gold") return `今日已領：下一鋪開波 +${data.value} 大洋入袋。`;
  if (data.kind === "line") return "今日已領：街口一句收低。";
  return "今日已領。";
}
