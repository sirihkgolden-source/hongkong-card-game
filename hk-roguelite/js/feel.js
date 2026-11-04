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
 * 卡面按下微縮
 */
export async function pressCard(el) {
  if (!el) return;
  el.classList.add("is-pressing");
  await wait(90);
  el.classList.remove("is-pressing");
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
    const dot = document.createElement("div");
    dot.className = `fx-proj fx-proj--${kind}`;
    const x0 = fromRect.left + fromRect.width / 2;
    const y0 = fromRect.top + fromRect.height / 2;
    const x1 = toRect.left + toRect.width / 2;
    const y1 = toRect.top + toRect.height / 2;
    dot.style.left = `${x0}px`;
    dot.style.top = `${y0}px`;
    root.appendChild(dot);
    // force layout
    void dot.offsetWidth;
    dot.style.transition = `transform ${duration}ms cubic-bezier(.2,.8,.2,1), opacity ${duration}ms ease`;
    dot.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) scale(0.6)`;
    dot.style.opacity = "0.35";
    const done = () => {
      dot.remove();
      resolve();
    };
    dot.addEventListener("transitionend", done, { once: true });
    setTimeout(done, duration + 40);
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
  node.style.left = `${rect.left + rect.width / 2}px`;
  node.style.top = `${rect.top + rect.height * 0.25}px`;
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add("is-on"));
  setTimeout(() => node.remove(), 900);
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
  await wait(shake ? 100 : 80);
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
    playerText.textContent = `${b.playerHp}/${b.playerMaxHp}${b.playerBlock ? ` · 盾 ${b.playerBlock}` : ""}`;
  }
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
 * 意圖預示放大
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
 * 頂欄「快手！」提示
 */
export function showKuaisouBanner() {
  const root = fxRoot();
  const banner = document.createElement("div");
  banner.className = "fx-kuaisou-banner";
  banner.textContent = "快手！";
  root.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add("is-on"));
  setTimeout(() => banner.remove(), 750);
}

export function clearFx() {
  const root = document.getElementById("fx-root");
  if (root) root.replaceChildren();
}
