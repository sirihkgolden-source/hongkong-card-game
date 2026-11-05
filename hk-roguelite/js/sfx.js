/**
 * 音效薄層（無音檔，全部用 WebAudio 即時合成）。
 *
 * 設計原則：
 *   - 無任何 .mp3/.wav 檔（禁止出檔／雲端），全部 oscillator 哔一聲
 *   - **預設音量低**：master gain 0.42，逐個音再乘本身 gain
 *   - 可靜音：撳掣 toggle，狀態存 localStorage（key `hk_sfx_muted`）
 *   - 靜音時**完全唔建立 master 節點**，連 oscillator 都唔開（省電）
 *   - 無 AudioContext（舊瀏覽器／Node 自測）→ 靜靜降級，唔 throw
 */

/* ---------- 常數（自測會讀） ---------- */

/** 靜音狀態嘅 localStorage key */
export const SFX_MUTED_KEY = "hk_sfx_muted";

/** 主音量：預設偏低（唔會一開聲就炸耳） */
export const MASTER_GAIN = 0.42;

/** 全部音效名（自測核對四類必需音都在） */
export const SFX_NAMES = [
  "card", // 出牌
  "hurt", // 受傷
  "coin", // 金幣
  "clear", // 通關
  "click",
  "whoosh",
  "hit",
  "block",
  "kuaisou",
  "win",
  "lose",
];

/* ---------- 內部狀態 ---------- */

let ctx = null;
let master = null;
let muted = readMuted();

function readMuted() {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(SFX_MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(v) {
  try {
    if (typeof localStorage === "undefined") return;
    if (v) localStorage.setItem(SFX_MUTED_KEY, "1");
    else localStorage.removeItem(SFX_MUTED_KEY);
  } catch {
    /* 私隱模式／額度滿都唔緊要，今次照樣可靜音 */
  }
}

function ac() {
  if (muted) return null;
  if (!ctx) {
    const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** 主音量節點：所有音都經佢，方便一次過調細／靜音 */
function masterNode(c) {
  if (!master) {
    master = c.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(c.destination);
  }
  return master;
}

/* ---------- 靜音控制（對外） ---------- */

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  writeMuted(muted);
  if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

/* ---------- 發聲 ---------- */

/**
 * 單音：freq(Hz) / dur(ms) / 波形 / 相對音量（會再乘 MASTER_GAIN）
 * delayMs：排隊延遲（做兩三粒音嘅小旋律）
 */
function beep(freq, durMs, type = "square", gain = 0.04, delayMs = 0) {
  const c = ac();
  if (!c) return;
  const start = c.currentTime + delayMs / 1000;
  const dur = durMs / 1000;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  // 短促包絡：快起慢落，避免「噗」聲同爆音
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(masterNode(c));
  o.start(start);
  o.stop(start + dur + 0.02);
}

export const sfx = {
  /* ── 四大必需音（本輪主線） ── */

  /** 出牌：一上一落兩個短音，似「甩牌」 */
  card() {
    beep(760, 34, "square", 0.05);
    beep(560, 40, "square", 0.042, 34);
  },

  /** 受傷：低頻鋸齒下沉，似被打中 */
  hurt() {
    beep(120, 78, "sawtooth", 0.062);
    beep(78, 60, "sawtooth", 0.05, 40);
  },

  /* 金幣 */
  coin() {
    beep(1180, 40, "triangle", 0.05);
    beep(1560, 56, "triangle", 0.042, 42);
  },

  /** 通關：四粒上行大調，收得響亮但唔長（≤420ms） */
  clear() {
    beep(523, 90, "triangle", 0.055, 0);
    beep(659, 90, "triangle", 0.055, 90);
    beep(784, 90, "triangle", 0.055, 180);
    beep(1047, 170, "triangle", 0.06, 270);
  },

  /* ── 其他（沿用／微調） ── */

  click() {
    beep(880, 38, "square", 0.035);
  },
  whoosh() {
    beep(220, 50, "triangle", 0.025);
  },
  hit() {
    beep(140, 55, "square", 0.05);
    beep(90, 40, "sawtooth", 0.03, 30);
  },
  block() {
    beep(520, 45, "triangle", 0.04);
  },
  kuaisou() {
    beep(660, 40, "square", 0.04);
    beep(990, 50, "square", 0.035, 45);
  },
  win() {
    beep(523, 60, "triangle", 0.04);
    beep(659, 70, "triangle", 0.04, 70);
  },
  lose() {
    beep(160, 120, "sawtooth", 0.045);
  },
};
