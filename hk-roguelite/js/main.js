/**
 * 《香江小風波》— 垂直切片入口（含手感／打擊感層）
 * 目錄暫名 hk-roguelite／產品名《香江小風波》
 * 與倉庫根目錄舊《香江 Card Game》demo 隔離；不修改根目錄主循環。
 */

import {
  META,
  CHARACTER,
  ACT1_MAP,
  EVENTS,
  CARDS,
  enemyById,
  cardById,
  pickRewardChoices,
} from "./data.js";
import {
  createBattle,
  startPlayerTurn,
  playCard,
  endTurn,
  getIntent,
  effectiveCost,
} from "./battle.js";
import { sfx } from "./sfx.js";
import {
  wait,
  pressCard,
  flyProjectile,
  floatText,
  impactTarget,
  playerHurtFlash,
  telegraphIntent,
  showKuaisouBanner,
  syncHpBars,
  clearFx,
} from "./feel.js";

/** @type {{
 *  screen: string,
 *  run: object|null,
 *  battle: object|null,
 *  rewardChoices: string[],
 *  eventResult: string|null,
 *  statusMsg: string,
 *  busy: boolean,
 *  pendingBossId: string|null,
 * }} */
const state = {
  screen: "title",
  run: null,
  battle: null,
  rewardChoices: [],
  eventResult: null,
  statusMsg: "",
  busy: false,
  pendingBossId: null,
};

const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createRun() {
  return {
    characterId: CHARACTER.id,
    hp: CHARACTER.maxHp,
    maxHp: CHARACTER.maxHp,
    gold: 0,
    deck: [...CHARACTER.starterDeck],
    mapIndex: 0,
    completed: /** @type {string[]} */ ([]),
    nextBattleEnergyPenalty: 0,
    victories: 0,
  };
}

function currentNode() {
  if (!state.run) return null;
  return ACT1_MAP[state.run.mapIndex] ?? null;
}

function syncRunHpFromBattle() {
  if (state.run && state.battle) {
    state.run.hp = state.battle.playerHp;
  }
}

/* ---------- card chrome ---------- */

function renderCardFace(cardId, opts = {}) {
  const card = cardById(cardId);
  if (!card) return "";
  const cost =
    opts.costOverride != null ? opts.costOverride : card.cost;
  const disabled = opts.disabled || state.busy ? " is-disabled" : "";
  const kuai = opts.kuaisou ? " is-kuaisou" : "";
  const idxAttr =
    opts.handIndex != null ? ` data-play="${opts.handIndex}"` : "";
  const pickAttr = opts.pickId ? ` data-pick="${escapeHtml(opts.pickId)}"` : "";
  const tag = opts.asButton !== false ? "button" : "div";
  const typeLabel = card.type === "attack" ? "攻擊" : "技能";
  const bits = [];
  if (card.dmg) bits.push(`傷 ${card.dmg}${card.dmgBonusOnLowHp ? "+" : ""}`);
  if (card.block) bits.push(`盾 ${card.block}`);
  if (card.heal) bits.push(`回 ${card.heal}`);
  if (card.draw) bits.push(`抽 ${card.draw}`);
  if (card.mark) bits.push(`烙 ${card.mark}`);

  return `
    <${tag} type="button" class="card-face${disabled}${kuai}"${idxAttr}${pickAttr}>
      <span class="card-cost" aria-label="費用">${cost}</span>
      <img class="card-art" src="${escapeHtml(card.art)}" alt="" loading="lazy" />
      <span class="card-name">${escapeHtml(card.name)}</span>
      <span class="card-type">${typeLabel}・${escapeHtml(card.rarity)}</span>
      <span class="card-stats">${escapeHtml(bits.join("／") || "—")}</span>
      <span class="card-blurb">${escapeHtml(card.blurb)}</span>
    </${tag}>
  `;
}

/* ---------- screens ---------- */

function renderTitle() {
  return `
    <main class="screen screen-title" aria-label="標題">
      <header class="brand-block">
        <h1 class="brand">${escapeHtml(META.title)}</h1>
        <p class="tagline">香港霓虹街頭卡牌 Rogue-lite</p>
        <span class="badge">垂直切片 · 後巷・夜醒</span>
      </header>
      <section class="panel panel-hero-copy">
        <h2>一鋪一個傳奇</h2>
        <p class="lede">
          揀角色、組牌闖三區。短、上癮、想再來一局。<br />
          本切片：阿油・後巷經紀 → Act1 Boss 巷口鐵閘・睇場。
        </p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="to-select">進入選角</button>
      </div>
      <p class="foot-note">入口：hk-roguelite/index.html · 目錄暫名 hk-roguelite</p>
    </main>
  `;
}

function renderSelect() {
  const c = CHARACTER;
  return `
    <main class="screen" aria-label="選角">
      <header class="brand-block brand-compact">
        <h1 class="brand">${escapeHtml(META.title)}</h1>
        <p class="tagline">垂直切片只開放一角</p>
      </header>
      <section class="panel">
        <h2>選擇角色</h2>
        <ul class="char-list">
          <li>
            <button type="button" class="char-card is-selected" data-action="confirm-char" aria-pressed="true">
              <span class="avatar" aria-hidden="true">${escapeHtml(c.initial)}</span>
              <span class="char-meta">
                <span class="char-name">${escapeHtml(c.name)}</span>
                <span class="char-desc">${escapeHtml(c.short)}</span>
              </span>
            </button>
          </li>
          <li class="char-locked" aria-disabled="true">
            <div class="char-card is-locked">
              <span class="avatar muted">珊</span>
              <span class="char-meta">
                <span class="char-name">阿珊・茶記夜更</span>
                <span class="char-desc">未開放（三角色另案）</span>
              </span>
            </div>
          </li>
          <li class="char-locked" aria-disabled="true">
            <div class="char-card is-locked">
              <span class="avatar muted">九</span>
              <span class="char-meta">
                <span class="char-name">九哥・招牌霓虹</span>
                <span class="char-desc">未開放（三角色另案）</span>
              </span>
            </div>
          </li>
        </ul>
        <p class="passive-box">
          <strong>被動・${escapeHtml(c.passive.name)}</strong><br />
          ${escapeHtml(c.passive.desc)}
        </p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="confirm-char">以阿油開局</button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
    </main>
  `;
}

function renderMap() {
  const run = state.run;
  const nodes = ACT1_MAP.map((node, i) => {
    const done = run.completed.includes(node.id);
    const current = i === run.mapIndex;
    const locked = i > run.mapIndex;
    let cls = "map-node";
    if (done) cls += " is-done";
    if (current) cls += " is-current";
    if (locked) cls += " is-locked";
    if (node.type === "boss") cls += " is-boss";
    const action = current && !done ? ` data-action="enter-node"` : "";
    return `
      <li class="${cls}"${action} ${current ? 'aria-current="step"' : ""}>
        <span class="map-idx">${i + 1}</span>
        <span class="map-body">
          <span class="map-sub">${escapeHtml(node.subtitle)}</span>
          <span class="map-title">${escapeHtml(node.title)}</span>
        </span>
        ${current ? '<span class="map-cta">進入</span>' : ""}
        ${done ? '<span class="map-done">✓</span>' : ""}
      </li>
    `;
  }).join("");

  return `
    <main class="screen screen-wide" aria-label="地圖">
      <header class="run-bar">
        <div>
          <p class="eyebrow">${escapeHtml(META.actName)}</p>
          <h1 class="run-title">${escapeHtml(CHARACTER.name)}</h1>
        </div>
        <div class="run-stats" role="group" aria-label="狀態">
          <span>HP ${run.hp}/${run.maxHp}</span>
          <span>金幣 ${run.gold}</span>
          <span>牌組 ${run.deck.length}</span>
        </div>
      </header>
      <section class="panel map-panel" style="--map-bg:url('${escapeHtml(currentNode()?.bg ?? ACT1_MAP[0].bg)}')">
        <h2>節點路線</h2>
        <ol class="map-list">${nodes}</ol>
      </section>
      <p class="foot-note">被動「快手」全程生效 · ${escapeHtml(META.isolationNote)}</p>
    </main>
  `;
}

function renderBossGate() {
  const enemy = enemyById(state.pendingBossId || "E04");
  return `
    <main class="screen screen-boss-gate" aria-label="Boss 戰前">
      <header class="brand-block brand-compact">
        <p class="eyebrow">區 Boss</p>
        <h1 class="section-title">${escapeHtml(enemy.name)}</h1>
      </header>
      <figure class="boss-gate-art">
        <img src="${escapeHtml(enemy.art)}" alt="${escapeHtml(enemy.name)}" />
      </figure>
      <blockquote class="boss-gate-quote">「${escapeHtml(enemy.flavor)}」</blockquote>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="boss-continue">繼續</button>
      </div>
    </main>
  `;
}

function renderBattle() {
  const b = state.battle;
  const intent = getIntent(b);
  const hand = b.hand
    .map((id, i) => {
      const cost = effectiveCost(b, id);
      const can = !b.over && !state.busy && b.energy >= cost;
      return renderCardFace(id, {
        handIndex: i,
        costOverride: cost,
        disabled: !can,
        kuaisou: b.kuaisouReady && CARDS[id]?.type === "attack",
      });
    })
    .join("");

  const overBanner =
    b.over === "win"
      ? `<div class="battle-banner win">勝利！</div>`
      : b.over === "lose"
        ? `<div class="battle-banner lose">你倒下了</div>`
        : "";

  return `
    <main class="screen screen-battle${state.busy ? " is-busy" : ""}" aria-label="戰鬥">
      <header class="battle-top">
        <div class="fighter enemy" id="fighter-enemy">
          <img id="enemy-portrait" src="${escapeHtml(b.enemyArt)}" alt="${escapeHtml(b.enemyName)}" />
          <div class="fighter-meta">
            <strong>${escapeHtml(b.enemyName)}${b.isBoss ? " · Boss" : ""}</strong>
            <div class="hp-bar"><span id="enemy-hp-fill" style="width:${Math.max(0, (b.enemyHp / b.enemyMaxHp) * 100)}%"></span></div>
            <span class="hp-text" id="enemy-hp-text">${b.enemyHp}/${b.enemyMaxHp}${b.enemyBlock ? ` · 盾 ${b.enemyBlock}` : ""}</span>
            <span class="intent" id="enemy-intent">意圖：${escapeHtml(intent.label)}</span>
          </div>
        </div>
        <div class="fighter player" id="fighter-player">
          <div class="fighter-meta">
            <strong id="player-anchor">${escapeHtml(CHARACTER.name)}</strong>
            <div class="hp-bar player"><span id="player-hp-fill" style="width:${Math.max(0, (b.playerHp / b.playerMaxHp) * 100)}%"></span></div>
            <span class="hp-text" id="player-hp-text">${b.playerHp}/${b.playerMaxHp}${b.playerBlock ? ` · 盾 ${b.playerBlock}` : ""}</span>
            <span class="energy">⚡ ${b.energy}/${b.maxEnergy}${b.kuaisouReady ? " · 快手就緒" : ""}</span>
          </div>
        </div>
      </header>
      ${overBanner}
      <div class="hand" role="list">${hand || '<p class="empty-hand">沒有手牌</p>'}</div>
      <div class="battle-actions">
        ${
          b.over === "win"
            ? `<button type="button" class="btn btn-primary btn-pressable" data-action="battle-win">收取戰果</button>`
            : b.over === "lose"
              ? `<button type="button" class="btn btn-primary btn-pressable" data-action="to-defeat">結算</button>`
              : `<button type="button" class="btn btn-ghost" data-action="end-turn" ${state.busy ? "disabled" : ""}>結束回合</button>`
        }
      </div>
      <ul class="battle-log" aria-live="polite">
        ${b.log.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
      </ul>
    </main>
  `;
}

function renderReward() {
  const choices = state.rewardChoices
    .map((id) => renderCardFace(id, { pickId: id }))
    .join("");
  return `
    <main class="screen screen-wide" aria-label="選牌">
      <header class="brand-block brand-compact">
        <h1 class="section-title">三選一・壯大牌組</h1>
        <p class="tagline">揀一張加入本局牌組</p>
      </header>
      <div class="reward-grid">${choices}</div>
      <div class="actions">
        <button type="button" class="btn btn-ghost" data-action="skip-reward">跳過（不取牌）</button>
      </div>
      <p class="status" role="status">${escapeHtml(state.statusMsg)}</p>
    </main>
  `;
}

function renderEvent() {
  const node = currentNode();
  const ev = EVENTS[node.eventId];
  if (state.eventResult) {
    return `
      <main class="screen" aria-label="事件結果">
        <header class="brand-block brand-compact">
          <h1 class="section-title">${escapeHtml(ev.title)}</h1>
        </header>
        <section class="panel">
          <p class="lede">${escapeHtml(state.eventResult)}</p>
          <p class="run-inline">HP ${state.run.hp}/${state.run.maxHp} · 牌組 ${state.run.deck.length} · 金幣 ${state.run.gold}</p>
        </section>
        <div class="actions">
          <button type="button" class="btn btn-primary btn-pressable" data-action="finish-event">繼續地圖</button>
        </div>
      </main>
    `;
  }
  const choices = ev.choices
    .map(
      (ch) => `
      <button type="button" class="event-choice" data-event-choice="${escapeHtml(ch.id)}">
        <strong>${escapeHtml(ch.label)}</strong>
        <span>${escapeHtml(ch.effectText)}</span>
      </button>`
    )
    .join("");
  return `
    <main class="screen" aria-label="事件">
      <header class="brand-block brand-compact">
        <h1 class="section-title">${escapeHtml(ev.title)}</h1>
        <p class="tagline">短事件 · 選項改機械效果</p>
      </header>
      <figure class="event-art">
        <img src="${escapeHtml(ev.art)}" alt="" />
      </figure>
      <section class="panel">
        <p class="lede">${escapeHtml(ev.body)}</p>
        <div class="event-choices">${choices}</div>
      </section>
    </main>
  `;
}

function renderRest() {
  const healAmt = Math.floor(state.run.maxHp * 0.3);
  return `
    <main class="screen" aria-label="休息">
      <header class="brand-block brand-compact">
        <h1 class="section-title">簷篷底歇腳</h1>
        <p class="tagline">雨聲滴鐵皮，喘一口氣</p>
      </header>
      <section class="panel">
        <p class="lede">現時 HP ${state.run.hp}/${state.run.maxHp}。揀一項：</p>
        <div class="event-choices">
          <button type="button" class="event-choice" data-action="rest-heal">
            <strong>眯一陣</strong>
            <span>回復 ${healAmt} HP（約三成）</span>
          </button>
          <button type="button" class="event-choice" data-action="rest-upgrade">
            <strong>磨刀（寶箱感）</strong>
            <span>牌組加入「廊燈直拳」；回復 4 HP</span>
          </button>
        </div>
      </section>
    </main>
  `;
}

function renderVictory() {
  return `
    <main class="screen screen-result is-win" aria-label="通關">
      <header class="brand-block">
        <h1 class="brand result-title">${escapeHtml(META.title)}</h1>
        <p class="tagline result-sub">勝利 · Act1「${escapeHtml(META.actName)}」打通</p>
      </header>
      <section class="panel">
        <h2>過咗鐵閘</h2>
        <p class="lede">
          阿油闖過「巷口鐵閘・睇場」。牌組 ${state.run.deck.length} 張・剩餘 HP ${state.run.hp}。<br />
          Act2／三角色尚未實作——本切片到此。
        </p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="again">再來一局</button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
    </main>
  `;
}

function renderDefeat() {
  return `
    <main class="screen screen-result is-lose" aria-label="敗北">
      <header class="brand-block">
        <h1 class="brand result-title dim">${escapeHtml(META.title)}</h1>
        <p class="tagline result-sub">敗北 · 這一鋪完結了</p>
      </header>
      <section class="panel">
        <h2>後巷吞沒你</h2>
        <p class="lede">
          死亡＝本局結束。下一局可再試「快手」節奏，或搏事件硬頂。<br />
          走到節點 ${Math.min(state.run?.mapIndex + 1 || 1, ACT1_MAP.length)}／${ACT1_MAP.length}。
        </p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="again">再來一局</button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
    </main>
  `;
}

function render() {
  if (!app) return;
  if (state.screen !== "battle") clearFx();
  let html = "";
  switch (state.screen) {
    case "select":
      html = renderSelect();
      break;
    case "map":
      html = renderMap();
      break;
    case "boss-gate":
      html = renderBossGate();
      break;
    case "battle":
      html = renderBattle();
      break;
    case "reward":
      html = renderReward();
      break;
    case "event":
      html = renderEvent();
      break;
    case "rest":
      html = renderRest();
      break;
    case "victory":
      html = renderVictory();
      break;
    case "defeat":
      html = renderDefeat();
      break;
    default:
      html = renderTitle();
  }
  app.innerHTML = html;
}

/* ---------- feel sequences ---------- */

async function playCardWithFeel(handIndex, cardEl) {
  if (state.busy || !state.battle || state.battle.over) return;
  const b = state.battle;
  const cardId = b.hand[handIndex];
  const card = CARDS[cardId];
  if (!card) return;
  const cost = effectiveCost(b, cardId);
  if (b.energy < cost) {
    state.statusMsg = "能量不足";
    return;
  }

  state.busy = true;
  const from = cardEl.getBoundingClientRect();
  sfx.click();
  await pressCard(cardEl);

  const toEnemy = document.getElementById("enemy-portrait");
  const toPlayer = document.getElementById("fighter-player");
  const flyTo =
    card.type === "attack"
      ? toEnemy?.getBoundingClientRect()
      : toPlayer?.getBoundingClientRect();

  sfx.whoosh();
  // 飛軌 140ms（規格 120–180）＋命中 ≤120ms → 單次攻擊可視 FX ≤350ms（含按卡約 320ms）
  await flyProjectile(from, flyTo, card.type === "attack" ? "attack" : "skill", 140);

  const result = playCard(b, handIndex);
  syncRunHpFromBattle();

  if (!result.ok) {
    state.busy = false;
    render();
    return;
  }

  // 先就地扣血／上盾，再播命中 FX（避免整頁重繪令 HP／kickback 瞬跳消失）
  syncHpBars(b);

  if (result.cardType === "attack") {
    const portrait = document.getElementById("enemy-portrait");
    sfx.hit();
    if (result.dealt > 0) {
      floatText(portrait, `-${result.dealt}`, result.usedKuaisou ? "kuaisou" : "dmg");
    }
    if (result.enemyBlocked) {
      floatText(portrait, `擋 ${result.enemyBlocked}`, "block");
    }
    if (result.usedKuaisou) {
      floatText(document.getElementById("player-anchor"), "費用−1", "kuaisou");
      floatText(portrait, "+3 傷", "kuaisou");
      showKuaisouBanner();
      sfx.kuaisou();
    }
    await impactTarget(portrait, {
      kind: "attack",
      kick: true,
      shake: true,
    });
  } else {
    const player = document.getElementById("fighter-player");
    if (result.blockGained) {
      sfx.block();
      floatText(player, `+${result.blockGained} 盾`, "block");
    }
    if (result.healed) {
      floatText(player, `+${result.healed}`, "heal");
    }
    await impactTarget(player, { kind: "skill", kick: false });
  }

  if (result.kuaisouArmed) {
    showKuaisouBanner();
    sfx.kuaisou();
    floatText(document.getElementById("player-anchor"), "快手！−1／+3", "kuaisou");
    await wait(120);
  }

  // 飄字／kickback 收束後再重繪（不計入 ≤350ms 命中預算）
  await wait(30);
  state.busy = false;
  render();
}

async function endTurnWithFeel() {
  if (state.busy || !state.battle || state.battle.over) return;
  state.busy = true;
  const preview = getIntent(state.battle);
  const intentEl = document.getElementById("enemy-intent");

  // 只有即將出手攻擊先預示 0.2–0.3s
  if (preview?.kind === "attack") {
    await telegraphIntent(intentEl, 240);
  }

  const result = endTurn(state.battle);
  syncRunHpFromBattle();
  syncHpBars(state.battle);

  if (result?.kind === "attack") {
    const player = document.getElementById("fighter-player");
    if (result.blocked) {
      sfx.block();
      floatText(player, `擋 ${result.blocked}`, "block");
    }
    if (result.dealt > 0) {
      sfx.hurt();
      floatText(player, `-${result.dealt}`, "dmg");
      player?.classList.add("is-flash-red");
      await playerHurtFlash();
      player?.classList.remove("is-flash-red");
    } else if (result.blocked) {
      await impactTarget(player, { kind: "skill", kick: false });
    }
  } else {
    await wait(60);
  }

  state.busy = false;
  render();
}

/* ---------- flow helpers ---------- */

function startBattleNow(enemyId) {
  const enemy = enemyById(enemyId);
  state.battle = createBattle(state.run, enemy);
  startPlayerTurn(state.battle);
  state.pendingBossId = null;
  state.screen = "battle";
}

function beginBattle(enemyId) {
  const enemy = enemyById(enemyId);
  if (enemy.isBoss) {
    state.pendingBossId = enemyId;
    state.screen = "boss-gate";
    return;
  }
  startBattleNow(enemyId);
}

function advanceMap() {
  const node = currentNode();
  if (node) state.run.completed.push(node.id);
  state.run.mapIndex += 1;
  state.battle = null;
  state.eventResult = null;
  state.rewardChoices = [];
  state.statusMsg = "";
  state.pendingBossId = null;
  if (state.run.mapIndex >= ACT1_MAP.length) {
    state.screen = "victory";
    sfx.win();
  } else {
    state.screen = "map";
  }
}

function openReward() {
  state.rewardChoices = pickRewardChoices(3);
  state.screen = "reward";
  state.statusMsg = "揀一張加入牌組";
}

function enterNode() {
  const node = currentNode();
  if (!node) return;
  if (node.type === "battle" || node.type === "boss") {
    beginBattle(node.enemyId);
  } else if (node.type === "reward") {
    openReward();
  } else if (node.type === "event") {
    state.eventResult = null;
    state.screen = "event";
  } else if (node.type === "rest") {
    state.screen = "rest";
  }
}

function onClick(event) {
  const t = event.target.closest(
    "[data-action], [data-play], [data-pick], [data-event-choice], .map-node.is-current"
  );
  if (!t) return;
  if (state.busy && !t.getAttribute("data-action")?.startsWith("boss")) return;

  if (t.classList?.contains("map-node") && t.classList.contains("is-current")) {
    enterNode();
    render();
    return;
  }

  const playIdx = t.getAttribute("data-play");
  if (playIdx != null && state.battle) {
    const cardEl = t.closest(".card-face") || t;
    playCardWithFeel(Number(playIdx), cardEl);
    return;
  }

  const pickId = t.getAttribute("data-pick");
  if (pickId) {
    state.run.deck.push(pickId);
    state.statusMsg = `已加入「${cardById(pickId)?.name ?? pickId}」`;
    advanceMap();
    render();
    return;
  }

  const evChoice = t.getAttribute("data-event-choice");
  if (evChoice) {
    const node = currentNode();
    const ev = EVENTS[node.eventId];
    const choice = ev.choices.find((c) => c.id === evChoice);
    if (choice) {
      state.eventResult = choice.apply(state.run);
    }
    render();
    return;
  }

  const action = t.getAttribute("data-action");
  switch (action) {
    case "to-select":
      state.screen = "select";
      break;
    case "back-title":
      state.screen = "title";
      state.run = null;
      state.battle = null;
      state.pendingBossId = null;
      break;
    case "confirm-char":
      state.run = createRun();
      state.screen = "map";
      break;
    case "enter-node":
      enterNode();
      break;
    case "boss-continue":
      if (state.pendingBossId) startBattleNow(state.pendingBossId);
      break;
    case "end-turn":
      endTurnWithFeel();
      return;
    case "battle-win":
      syncRunHpFromBattle();
      state.run.victories += 1;
      if (currentNode()?.type === "boss") {
        advanceMap();
      } else {
        openReward();
      }
      break;
    case "to-defeat":
      syncRunHpFromBattle();
      state.screen = "defeat";
      sfx.lose();
      break;
    case "skip-reward":
      advanceMap();
      break;
    case "finish-event":
      advanceMap();
      break;
    case "rest-heal": {
      const healAmt = Math.floor(state.run.maxHp * 0.3);
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + healAmt);
      advanceMap();
      break;
    }
    case "rest-upgrade":
      state.run.deck.push("S15");
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + 4);
      advanceMap();
      break;
    case "again":
      state.run = createRun();
      state.battle = null;
      state.pendingBossId = null;
      state.screen = "map";
      break;
    default:
      return;
  }
  render();
}

app?.addEventListener("click", onClick);
render();
