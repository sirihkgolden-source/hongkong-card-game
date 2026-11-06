/**
 * 《香江小風波》戰鬥手感層：飛軌／飄字／震屏／色閃
 * 單次攻擊建議總延遲 ≤350ms
 */

export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fxRoot() {
  let el = document.getElementById("fx-root");
  if (!el) {
    el = document.createElement("div");
    el.id = "fx-root";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

/**
 * 卡面按下微縮 0.92 → ~0.1s 彈回
 */
export async function pressCard(el) {
  if (!el) return;
  el.classList.add("is-pressing");
  await wait(60);
  el.classList.remove("is-pressing");
  await wait(20);
}

/**
 * 小圖示由 fromRect 飛到 toRect（120–180ms）
 * @param {'attack'|'skill'} kind
 */
export function flyProjectile(fromRect, toRect, kind = "attack", duration = 150) {
  return new Promise((resolve) => {
    if (!fromRect || !toRect) {
      resolve();
      return;
    }
    const root = fxRoot();
    const x0 = fromRect.left + fromRect.width / 2;
    const y0 = fromRect.top + fromRect.height / 2;
    const x1 = toRect.left + toRect.width / 2;
    const y1 = toRect.top + toRect.height / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;

    // 主彈＋兩點殘影，飛軌更易睇到
    const dots = [0, 1, 2].map((i) => {
      const dot = document.createElement("div");
      dot.className = `fx-proj fx-proj--${kind}${i ? " fx-proj--ghost" : ""}`;
      dot.style.left = `${x0}px`;
      dot.style.top = `${y0}px`;
      if (i) dot.style.opacity = String(0.55 - i * 0.15);
      root.appendChild(dot);
      return dot;
    });
    void dots[0].offsetWidth;
    dots.forEach((dot, i) => {
      const delay = i * 28;
      dot.style.transition = `transform ${duration}ms cubic-bezier(.2,.8,.2,1) ${delay}ms, opacity ${duration}ms ease ${delay}ms`;
      dot.style.transform = `translate(${dx}px, ${dy}px) scale(${i ? 0.45 : 0.7})`;
      dot.style.opacity = "0.2";
    });
    const done = () => {
      dots.forEach((d) => d.remove());
      resolve();
    };
    dots[0].addEventListener("transitionend", done, { once: true });
    setTimeout(done, duration + 90);
  });
}

/**
 * 飄字傷害／擋／快手
 */
export function floatText(anchorEl, text, variant = "dmg") {
  const root = fxRoot();
  const rect = anchorEl?.getBoundingClientRect?.() || {
    left: window.innerWidth / 2,
    top: window.innerHeight / 3,
    width: 0,
    height: 0,
  };
  const node = document.createElement("div");
  node.className = `fx-float fx-float--${variant}`;
  node.textContent = text;
  node.style.left = `${rect.left + rect.width / 2 + (Math.random() * 18 - 9)}px`;
  node.style.top = `${rect.top + rect.height * 0.22}px`;
  root.appendChild(node);
  // 雙 rAF 確保 transition 由靜止態播起
  requestAnimationFrame(() => {
    requestAnimationFrame(() => node.classList.add("is-on"));
  });
  setTimeout(() => node.remove(), 950);
}

/**
 * 落點：肖像 scale + 色閃 + 可選 kickback／輕震屏
 * @param {{ kind?: "attack"|"skill", kick?: boolean, shake?: boolean }} [opts]
 */
export async function impactTarget(el, { kind = "attack", kick = true, shake = false } = {}) {
  if (!el) return;
  const flash = kind === "attack" ? "is-flash-red" : "is-flash-cyan";
  const screen = document.querySelector(".screen-battle");
  el.classList.add("is-impact", flash);
  if (kick && kind === "attack") el.classList.add("is-kickback");
  if (shake) screen?.classList.add("is-screen-shake");
  // 落點 scale／色閃／kickback；命中段 ≤100ms，配合飛軌使單次攻擊可視 FX ≤350ms
  await wait(shake || kick ? 100 : 70);
  el.classList.remove("is-impact", flash, "is-kickback");
  screen?.classList.remove("is-screen-shake");
}

/**
 * 就地更新 HP 條（保留 transition，避免整頁重繪瞬跳）
 */
export function syncHpBars(b) {
  if (!b) return;
  const enemyFill = document.getElementById("enemy-hp-fill");
  const enemyText = document.getElementById("enemy-hp-text");
  const playerFill = document.getElementById("player-hp-fill");
  const playerText = document.getElementById("player-hp-text");
  if (enemyFill) {
    enemyFill.style.width = `${Math.max(0, (b.enemyHp / b.enemyMaxHp) * 100)}%`;
  }
  if (enemyText) {
    enemyText.textContent = `${b.enemyHp}/${b.enemyMaxHp}${b.enemyBlock ? ` · 盾 ${b.enemyBlock}` : ""}`;
  }
  if (playerFill) {
    playerFill.style.width = `${Math.max(0, (b.playerHp / b.playerMaxHp) * 100)}%`;
  }
  if (playerText) {
    playerText.textContent = `${b.playerHp}/${b.playerMaxHp}`;
  }
  syncEnergyBlock(b);
  syncPileCounts(b);
}

/**
 * 能量／擋就地更新（唔重繪整頁），變動時彈一下。
 * 令 HUD 大數字同實際數值即時同步。
 */
export function syncEnergyBlock(b) {
  if (!b) return;
  const energyEl = document.getElementById("player-energy");
  const blockEl = document.getElementById("player-block");

  if (energyEl) {
    const num = energyEl.querySelector(".stat-num");
    const prev = num ? Number(num.textContent) : NaN;
    if (num) num.textContent = String(b.energy);
    energyEl.classList.toggle("is-empty", b.energy === 0);
    if (!Number.isNaN(prev) && prev !== b.energy) bump(energyEl);
  }

  if (blockEl) {
    const num = blockEl.querySelector(".stat-num");
    const prev = num ? Number(num.textContent) : NaN;
    const block = b.playerBlock || 0;
    if (num) num.textContent = String(block);
    blockEl.classList.toggle("is-on", block > 0);
    blockEl.classList.toggle("is-off", block <= 0);
    if (!Number.isNaN(prev) && prev !== block) bump(blockEl);
  }
}

/**
 * 牌堆數字就地更新：牌庫／棄牌／手牌。
 * 抽牌、棄牌、洗牌之後即時反映，唔使重繪。
 */
export function syncPileCounts(b) {
  if (!b) return;
  const setNum = (sel, val) => {
    const el = document.querySelector(`${sel} .pile-num`);
    if (!el) return false;
    const prev = Number(el.textContent);
    el.textContent = String(val);
    return !Number.isNaN(prev) && prev !== val;
  };
  const drawChanged = setNum("#pile-draw", b.drawPile?.length ?? 0);
  const discardChanged = setNum("#pile-discard", b.discard?.length ?? 0);
  setNum(".pile-hand", b.hand?.length ?? 0);

  if (drawChanged) bump(document.getElementById("pile-draw"));
  if (discardChanged) bump(document.getElementById("pile-discard"));
}

/** 洗返牌堆提示：牌庫膠囊閃一下 + 跳字 */
export function flashShuffle(b, recycled) {
  const row = document.querySelector(".pile-row");
  if (row) {
    row.classList.add("is-shuffling");
    setTimeout(() => row.classList.remove("is-shuffling"), 700);
  }
  setNumSafe("#pile-draw", b?.drawPile?.length ?? 0);
  const anchor = document.getElementById("pile-draw");
  if (anchor) {
    floatText(anchor, recycled ? `洗返牌堆 ${recycled} 張——袋口翻新一輪先` : "洗返牌堆——袋口翻新一輪先", "block");
  }
}

function setNumSafe(sel, val) {
  const el = document.querySelector(`${sel} .pile-num`);
  if (el) el.textContent = String(val);
}

/** 數字變動時彈一下 */
function bump(el) {
  if (!el) return;
  el.classList.remove("is-bump");
  void el.offsetWidth;
  el.classList.add("is-bump");
  setTimeout(() => el.classList.remove("is-bump"), 460);
}

/**
 * 玩家受擊：暗角紅閃 + 震
 */
export async function playerHurtFlash() {
  const screen = document.querySelector(".screen-battle") || document.getElementById("app");
  if (!screen) return;
  screen.classList.add("is-hurt-vignette", "is-screen-shake");
  await wait(160);
  screen.classList.remove("is-hurt-vignette", "is-screen-shake");
}

/**
 * 意圖預示放大（對手下一手——街口要睇清）
 */
export async function telegraphIntent(el, ms = 250) {
  if (!el) {
    await wait(ms);
    return;
  }
  el.classList.add("is-telegraph");
  await wait(ms);
  el.classList.remove("is-telegraph");
}

/**
 * 頂欄被動提示（快手／檔口／招牌眼／跌打）——港味短句
 * @param {string} text
 * @param {"kuaisou"|"dangkou"|"zhaopaiyan"|"seotong"} [variant]
 */
export function showPassiveBanner(text, variant = "kuaisou") {
  const root = fxRoot();
  const banner = document.createElement("div");
  banner.className = `fx-kuaisou-banner fx-passive-banner fx-passive-banner--${variant}`;
  banner.textContent = text;
  root.appendChild(banner);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => banner.classList.add("is-on"));
  });
  setTimeout(() => banner.remove(), 800);
}

/** @deprecated 用 showPassiveBanner("快手！平一費", "kuaisou") */
export function showKuaisouBanner() {
  showPassiveBanner("快手！平一費——節奏嚟喇喂！！", "kuaisou");
}

/**
 * 選牌確認動感：卡片放大高亮 + 輕輕上彈，然後才離開畫面。
 * 令「揀咗邊張入袋」有明確回饋，唔會一 click 就跳走。
 */
export async function confirmPick(el, ms = 260) {
  if (!el) {
    await wait(ms);
    return;
  }
  el.classList.add("is-picked");
  await wait(ms);
  el.classList.remove("is-picked");
}

export function clearFx() {
  const root = document.getElementById("fx-root");
  if (root) root.replaceChildren();
}

/**
 * 金幣變動跳字：+N 金色上彈、−N 淡紅。
 * 錨定順序：跑圖狀態列金幣 span → 畫面中央偏上（fallback）。
 * @param {number} delta 正數賺、負數花
 */
export function floatGold(delta) {
  if (!delta) return;
  const goldEl = findGoldAnchor();
  const text = delta > 0 ? `+${delta} 大洋入簿` : `${delta} 大洋出水口邊`;
  floatText(goldEl, text, delta > 0 ? "gold" : "gold-spend");
}

/**
 * 跑圖畫面（選牌／事件／士多）嘅改動回饋：
 * 一次顯示多項 delta，例如 +12 HP、+1 張牌、−8 金幣。
 * 全部用 fx-float，錨定畫面中央偏上，唔會遮住按鈕。
 * @param {{hp?:number,maxHp?:number,deck?:number,block?:number,energy?:number,gold?:number}} deltas
 * @param {(s:string)=>void} [pushLine] 可選：同時寫入文字摘要
 */
export function floatRunDeltas(deltas, pushLine) {
  const lines = [];
  const { hp = 0, maxHp = 0, deck = 0, block = 0, energy = 0, gold = 0, relic = 0 } = deltas || {};
  if (hp) {
    lines.push({ text: hp > 0 ? `+${hp} 血回籠收齊` : `${hp} 血出水口，睇實`, variant: hp > 0 ? "heal" : "dmg" });
  }
  if (maxHp) {
    lines.push({ text: maxHp > 0 ? `+${maxHp} 最大血` : `${maxHp} 最大血出水`, variant: "heal" });
  }
  if (deck) {
    lines.push({ text: deck > 0 ? `+${deck} 張入袋口傍身` : `${deck} 張出水口`, variant: "kuaisou" });
  }
  if (relic) {
    lines.push({ text: relic > 0 ? `+${relic} 件身家入袋口傍身` : `${relic} 件身家出水口`, variant: "kuaisou" });
  }
  if (block) {
    lines.push({ text: block > 0 ? `+${block} 擋上身撑場` : `${block} 擋散晒`, variant: "block" });
  }
  if (energy) {
    lines.push({ text: energy > 0 ? `+${energy} 格氣落手` : `${energy} 格氣出水口`, variant: "kuaisou" });
  }
  if (gold) {
    lines.push({ text: gold > 0 ? `+${gold} 大洋入簿` : `${gold} 大洋出水口`, variant: gold > 0 ? "gold" : "gold-spend" });
  }
  if (!lines.length) return;

  // 錨定：面板標題附近，逐行向下錯開
  const anchor =
    document.querySelector(".panel h2") ||
    document.querySelector(".section-title") ||
    document.querySelector(".brand");
  const rect = anchor?.getBoundingClientRect?.();
  const baseTop = rect ? rect.top + rect.height + 18 : 140;
  const baseLeft = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;

  lines.forEach((line, i) => {
    floatText(
      {
        getBoundingClientRect: () => ({
          left: baseLeft,
          top: baseTop + i * 30,
          width: 0,
          height: 0,
        }),
      },
      line.text,
      line.variant
    );
  });

  if (typeof pushLine === "function") {
    pushLine(lines.map((l) => l.text).join(" · "));
  }
}

/** 搵「金幣」所在嘅狀態列 span，搵唔到就用畫面中央 */
function findGoldAnchor() {
  const selectors = [
    ".run-stats span",
    ".run-inline",
    ".panel .tagline",
    ".panel .lede",
    ".panel h2 + p",
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (el.textContent && el.textContent.includes("金幣")) return el;
    }
  }
  // 選牌／事件畫面冇顯示金幣：錨定頂部面板標題，視線自然落點
  return document.querySelector(".panel h2") || document.querySelector(".brand");
}
