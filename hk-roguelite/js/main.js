/**
 * 《香江小風波》— 垂直切片入口（含手感／打擊感層）
 * 目錄暫名 hk-roguelite／產品名《香江小風波》
 * 與倉庫根目錄舊《香江 Card Game》demo 隔離；不修改根目錄主循環。
 */

import {
  META,
  CHARACTERS,
  EVENTS,
  SHOP,
  CARDS,
  RELICS,
  enemyById,
  cardById,
  characterById,
  pickRewardChoices,
  battleGoldReward,
  mapForAct,
  actDisplayName,
  actBg,
  pickNodeEnemyId,
  enemyTag,
  pickEventId,
  EVENT_POOLS,
  eventById,
  relicBonuses,
  pickShopRelics,
  pickPackCard,
  relicById,
  CONSUMABLES,
  pickShopConsumables,
  consumableById,
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
  showPassiveBanner,
  syncHpBars,
  clearFx,
  floatGold,
  floatRunDeltas,
} from "./feel.js";

/** @type {{
 *  screen: string,
 *  selectedCharId: string,
 *  run: object|null,
 *  battle: object|null,
 *  rewardChoices: string[],
 *  eventResult: string|null,
 *  statusMsg: string,
 *  busy: boolean,
 *  pendingBossId: string|null,
 *  shopMsg: string,
 *  pendingGoldFloat: number,
 * }} */
const state = {
  screen: "title",
  selectedCharId: "oil",
  run: null,
  battle: null,
  rewardChoices: [],
  eventResult: null,
  statusMsg: "",
  busy: false,
  pendingBossId: null,
  shopMsg: "",
  shopRelics: /** @type {string[]} */ ([]),
  shopConsumables: /** @type {string[]} */ ([]),
  pendingGoldFloat: 0,
  pendingDeltas: /** @type {object|null} */ (null),
  pendingRestMsg: "",
};

const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function activeChar() {
  return characterById(state.run?.characterId || state.selectedCharId);
}

function createRun(characterId) {
  const c = characterById(characterId);
  return {
    characterId: c.id,
    act: 1,
    hp: c.maxHp,
    maxHp: c.maxHp,
    gold: 0,
    deck: [...c.starterDeck],
    mapIndex: 0,
    completed: /** @type {string[]} */ ([]),
    encounters: /** @type {object[]} */ ([]),
    nodeEnemies: /** @type {Record<string,string>} */ ({}),
    nodeEvents: /** @type {Record<string,string>} */ ({}),
    relics: /** @type {string[]} */ ([]),
    nextBattleEnergyPenalty: 0,
    nextBattleEnergyBonus: 0,
    nextBattleBlock: 0,
    victories: 0,
  };
}

function currentMap() {
  return mapForAct(state.run?.act || 1);
}

function currentNode() {
  if (!state.run) return null;
  return currentMap()[state.run.mapIndex] ?? null;
}

/** 打完區 Boss：同一局自動進下一 Act，保留牌組／HP／金幣 */
function enterAct(nextAct) {
  const run = state.run;
  run.act = nextAct;
  run.mapIndex = 0;
  run.completed = [];
  run.nodeEnemies = {};
  run.nodeEvents = {};
  run.nodeEventQueue = {};
  state.battle = null;
  state.eventResult = null;
  state.rewardChoices = [];
  state.statusMsg = "";
  state.shopMsg = "";
  state.pendingBossId = null;
  state.screen = "map";
  sfx.win();
}

/** Act1 Boss 勝 → Act2（保留舊名給自測用） */
function enterAct2() {
  enterAct(2);
}

/** Act2 Boss 勝 → Act3（城寨・天台） */
function enterAct3() {
  enterAct(3);
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
        <span class="badge">完整三區 · 後巷 → 旺角 → 城寨天台 · 三角色</span>
      </header>
      <section class="panel panel-hero-copy">
        <h2>一鋪一個傳奇</h2>
        <p class="lede">
          揀角色、組牌闖三區。短、上癮、想再來一局。<br />
          三角色開局 → 後巷・夜醒 → 旺角霓虹 → 城寨・天台 → 籠門之王 → 通關結算。
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
  const selected = characterById(state.selectedCharId);
  const list = [CHARACTERS.oil, CHARACTERS.asan, CHARACTERS.kauko]
    .map((c) => {
      const on = c.id === state.selectedCharId;
      // 立繪：有圖就用，onerror 就 fallback 字首漸層（唔會留破圖）
      const portrait = c.portrait
        ? `<img class="char-portrait" src="${escapeHtml(c.portrait)}" alt="${escapeHtml(c.name)}" loading="lazy"
             onerror="this.removeAttribute('src'); this.closest('.avatar').classList.add('is-fallback');" />`
        : "";
      return `
        <li>
          <button type="button" class="char-card${on ? " is-selected" : ""}" data-action="pick-char" data-char="${escapeHtml(c.id)}" aria-pressed="${on}">
            <span class="avatar avatar-portrait${c.portrait ? "" : " is-fallback"}" aria-hidden="true">
              ${portrait}
              <span class="avatar-fallback">${escapeHtml(c.initial)}</span>
            </span>
            <span class="char-meta">
              <span class="char-name">${escapeHtml(c.name)}</span>
              <span class="char-desc">${escapeHtml(c.short)}</span>
              <span class="char-route">${escapeHtml(c.route || "")}</span>
              <span class="char-playstyle">${escapeHtml(c.playstyle || "")}</span>
              <span class="char-passive-tag">被動・${escapeHtml(c.passive.name)}</span>
            </span>
          </button>
        </li>`;
    })
    .join("");

  return `
    <main class="screen" aria-label="選角">
      <header class="brand-block brand-compact">
        <h1 class="brand">${escapeHtml(META.title)}</h1>
        <p class="tagline">開局三揀一 · 同一條後巷</p>
      </header>
      <section class="panel">
        <h2>選擇角色</h2>
        <ul class="char-list">${list}</ul>
        <p class="passive-box">
          <strong>被動・${escapeHtml(selected.passive.name)}</strong><br />
          ${escapeHtml(selected.passive.desc)}
        </p>
        ${
          selected.rerunHook?.select
            ? `<p class="rerun-hook">「${escapeHtml(selected.rerunHook.select)}」</p>`
            : ""
        }
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="confirm-char">以${escapeHtml(selected.name)}開局</button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
    </main>
  `;
}

/** 節點類型：圖示／標籤／色系（一眼分到戰／事件／休息／店／Boss） */
function nodeTypeMeta(node) {
  if (!node) return { key: "battle", icon: "⚔", label: "戰鬥", cls: "" };
  if (node.type === "boss") {
    return { key: "boss", icon: "☠", label: node.subtitle || "Boss", cls: "node-boss" };
  }
  if (node.type === "event") {
    return { key: "event", icon: "？", label: "事件", cls: "node-event" };
  }
  if (node.type === "rest") {
    return { key: "shop", icon: "🛒", label: "休息／店", cls: "node-shop" };
  }
  if (node.type === "reward") {
    return { key: "reward", icon: "＋", label: "選牌", cls: "node-reward" };
  }
  if (node.enemyPool) {
    return { key: "elite", icon: "★", label: "精英", cls: "node-elite" };
  }
  return { key: "battle", icon: "⚔", label: "戰鬥", cls: "" };
}

function renderMap() {
  const run = state.run;
  const char = activeChar();
  const map = currentMap();
  const actName = actDisplayName(run.act);
  const actStrip = [1, 2, 3]
    .map((n) => {
      let cls = "act-pip";
      if (n < run.act) cls += " is-cleared";
      if (n === run.act) cls += " is-active";
      return `<li class="${cls}"><span>Act${n}</span><strong>${escapeHtml(actDisplayName(n))}</strong></li>`;
    })
    .join("");
  const nodes = map.map((node, i) => {
    const done = run.completed.includes(node.id);
    const current = i === run.mapIndex;
    const locked = i > run.mapIndex;
    let cls = "map-node";
    if (done) cls += " is-done";
    if (current) cls += " is-current";
    if (locked) cls += " is-locked";
    if (node.type === "boss") cls += " is-boss";
    if (node.enemyPool) cls += " is-choice";
    const action = current && !done ? ` data-action="enter-node"` : "";
    // 未行到嘅格唔預先揭對手（行到先抽定）
    const revealPool = node.enemyPool && i <= run.mapIndex;
    const pooledName = revealPool ? enemyById(nodeEnemyId(node))?.name : null;
    // 事件格：行到／已過先顯示抽中嘅事件名（未知就顯示節點副標）
    const isEvent = node.type === "event";
    const knownEventId = isEvent && run.nodeEvents?.[node.id];
    const knownEventName = knownEventId ? eventById(knownEventId).title : null;
    const baseSub = node.subtitle;
    const subParts = [baseSub];
    if (pooledName) subParts.push(pooledName);
    if (knownEventName) subParts.push(knownEventName);
    const subText = subParts.join("・");
    const titleText = knownEventName || node.title;
    if (isEvent) cls += " is-event";
    // 節點類型：圖示 + 色帶（一眼分到戰／事件／休息／店／Boss）
    const typeMeta = nodeTypeMeta(node);
    if (typeMeta.cls) cls += ` ${typeMeta.cls}`;
    return `
      <li class="${cls}"${action} ${current ? 'aria-current="step"' : ""}>
        <span class="map-idx map-idx--${typeMeta.key}" aria-hidden="true">${typeMeta.icon}</span>
        <span class="map-body">
          <span class="map-type">${typeMeta.label}</span>
          <span class="map-sub">${escapeHtml(subText)}</span>
          <span class="map-title">${escapeHtml(titleText)}</span>
        </span>
        ${current ? '<span class="map-cta">進入</span>' : ""}
        ${done ? '<span class="map-done">✓ 行過</span>' : ""}
      </li>
    `;
  }).join("");

  return `
    <main class="screen screen-wide" aria-label="地圖">
      <header class="run-bar">
        <div>
          <p class="eyebrow">Act${run.act}・${escapeHtml(actName)}</p>
          <h1 class="run-title">${escapeHtml(char.name)}</h1>
        </div>
        <div class="run-stats" role="group" aria-label="狀態">
          <span>HP ${run.hp}/${run.maxHp}</span>
          <span>金幣 ${run.gold}</span>
          <span>牌組 ${run.deck.length}</span>
          <span>遺物 ${(run.relics || []).length}</span>
        </div>
      </header>
      <ol class="act-strip" aria-label="三區進度">${actStrip}</ol>
      ${
        state.statusMsg
          ? `<p class="status status-map" role="status">${escapeHtml(state.statusMsg)}</p>`
          : ""
      }
      <section class="panel map-panel">
        <h2>節點路線</h2>
        <ol class="map-list">${nodes}</ol>
      </section>
      <p class="foot-note">被動「${escapeHtml(char.passive.name)}」全程生效 · ${escapeHtml(META.isolationNote)}</p>
    </main>
  `;
}

function renderBossGate() {
  const enemy = enemyById(state.pendingBossId || "E04");
  const isFinal = !!enemy.isFinalBoss;
  const actName = actDisplayName(state.run?.act || 1);
  return `
    <main class="screen screen-boss-gate${isFinal ? " is-final" : ""}" aria-label="Boss 戰前">
      <header class="brand-block brand-compact">
        <p class="eyebrow">${isFinal ? `最終 Boss・Act${state.run?.act || 3} ${escapeHtml(actName)}` : "區 Boss"}</p>
        <h1 class="section-title">${escapeHtml(enemy.name)}</h1>
      </header>
      <figure class="boss-gate-art">
        <img src="${escapeHtml(enemy.art)}" alt="${escapeHtml(enemy.name)}" />
      </figure>
      <blockquote class="boss-gate-quote">「${escapeHtml(enemy.flavor)}」</blockquote>
      <p class="boss-gate-hint">${isFinal ? "打完呢場，就係呢一鋪嘅結算。" : "停一停，睇清楚對手先入場。"}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="boss-continue">${isFinal ? "落場" : "繼續"}</button>
      </div>
    </main>
  `;
}

function renderBattle() {
  const b = state.battle;
  const char = activeChar();
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

  // Boss 戰後一句（只有打贏 Boss 先出）
  const bossAfterword =
    b.over === "win" && (b.isBoss || b.isFinalBoss) && b.afterword
      ? `<blockquote class="boss-afterword">「${escapeHtml(b.afterword)}」</blockquote>`
      : "";

  const readyHint =
    b.kuaisouReady
      ? " · 快手就緒"
      : b.passiveId === "dangkou" && !b.dangkouUsed
        ? " · 檔口待命"
        : b.passiveId === "zhaopaiyan"
          ? b.zhaopaiyanUsed
            ? " · 招牌眼已亮"
            : " · 招牌眼待命"
          : "";

  return `
    <main class="screen screen-battle${state.busy ? " is-busy" : ""}" aria-label="戰鬥">
      <header class="battle-top">
        <div class="fighter enemy" id="fighter-enemy">
          <img id="enemy-portrait" src="${escapeHtml(b.enemyArt)}" alt="${escapeHtml(b.enemyName)}" />
          <div class="fighter-meta">
            <strong>${escapeHtml(b.enemyName)}${b.isFinalBoss ? " · 最終 Boss" : b.isBoss ? " · Boss" : ""}</strong>
            <div class="hp-bar"><span id="enemy-hp-fill" style="width:${Math.max(0, (b.enemyHp / b.enemyMaxHp) * 100)}%"></span></div>
            <span class="hp-text" id="enemy-hp-text">${b.enemyHp}/${b.enemyMaxHp}${b.enemyBlock ? ` · 盾 ${b.enemyBlock}` : ""}</span>
            <span class="intent" id="enemy-intent">意圖：${escapeHtml(intent.label)}</span>
          </div>
        </div>
        <div class="fighter player" id="fighter-player">
          <div class="fighter-meta">
            <strong id="player-anchor">${escapeHtml(char.name)}</strong>
            <span class="battle-route">${escapeHtml(char.route || "")}</span>
            <div class="hp-bar player"><span id="player-hp-fill" style="width:${Math.max(0, (b.playerHp / b.playerMaxHp) * 100)}%"></span></div>
            <span class="hp-text" id="player-hp-text">${b.playerHp}/${b.playerMaxHp}${b.playerBlock ? ` · 盾 ${b.playerBlock}` : ""}</span>
            <span class="energy">⚡ ${b.energy}/${b.maxEnergy}${readyHint}</span>
          </div>
        </div>
      </header>
      ${overBanner}
      ${bossAfterword}
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
        <p class="tagline">揀一張加入本局牌組 · 金幣 ${state.run.gold}</p>
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
  const ev = currentNodeEvent();
  if (state.eventResult) {
    const queue = eventQueueOf(currentNode());
    const idx = queue.indexOf(state.run.nodeEvents?.[currentNode()?.id]);
    const hasNext = idx >= 0 && idx < queue.length - 1;
    return `
      <main class="screen" aria-label="事件結果">
        <header class="brand-block brand-compact">
          <h1 class="section-title">${escapeHtml(ev.title)}</h1>
          ${hasNext ? `<p class="tagline">仲有一件事喺前面</p>` : ""}
        </header>
        <section class="panel">
          <p class="lede">${escapeHtml(state.eventResult)}</p>
          <p class="run-inline">HP ${state.run.hp}/${state.run.maxHp} · 牌組 ${state.run.deck.length} · 金幣 ${state.run.gold}</p>
        </section>
        <div class="actions">
          <button type="button" class="btn btn-primary btn-pressable" data-action="finish-event">${hasNext ? "行埋下一件" : "繼續地圖"}</button>
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
  const has = (n) => state.run.gold >= n;
  const canHealBuy = has(SHOP.healCost);
  const canCardBuy = has(SHOP.cardCost);
  const canRelicBuy = has(SHOP.relicCost) && state.shopRelics.length > 0;
  const canPackBuy = has(SHOP.packCost);
  const canReroll = has(SHOP.rerollCost) && state.shopRelics.length > 0;
  const shopCard = cardById(SHOP.cardId);
  const node = currentNode();
  const isAct3 = (state.run.act || 1) === 3;
  const restTitle = node?.title || (isAct3 ? "天台搭棚歇腳" : "簷篷底歇腳");
  const restSub = isAct3 ? "鐵皮滴水 · 樓下士多仲未關門" : "雨聲滴鐵皮 · 便利店燈仲亮";
  const ownedRelics = (state.run.relics || [])
    .map((id) => RELICS[id])
    .filter(Boolean);
  const relicStock = state.shopRelics
    .map((id) => RELICS[id])
    .filter(Boolean)
    .map(
      (r) => `
        <button type="button" class="event-choice${canRelicBuy ? "" : " is-disabled"}" data-action="shop-relic" data-relic="${escapeHtml(r.id)}" ${canRelicBuy ? "" : "disabled"}>
          <strong>${escapeHtml(r.name)}<span class="relic-rarity">${escapeHtml(r.rarity)}</span></strong>
          <span>花 ${SHOP.relicCost} 金幣 · ${escapeHtml(r.desc)}${canRelicBuy ? "" : "（金幣不足）"}</span>
        </button>`
    )
    .join("");
  // 消耗品貨架（每局洗一次，一定有 1 件）
  const consumableStock = (state.shopConsumables || [])
    .map((id) => CONSUMABLES[id])
    .filter(Boolean)
    .map((c) => {
      const affordable = has(c.price);
      return `
        <button type="button" class="event-choice${affordable ? "" : " is-disabled"}" data-action="buy-consumable" data-consumable="${escapeHtml(c.id)}" ${affordable ? "" : "disabled"}>
          <strong>${escapeHtml(c.name)}<span class="relic-rarity">消耗</span></strong>
          <span>花 ${c.price} 金幣 · ${escapeHtml(c.desc)}${affordable ? "" : "（金幣不足）"}</span>
        </button>`;
    })
    .join("");
  const relicSell = ownedRelics
    .map(
      (r) => `
        <button type="button" class="event-choice is-sell" data-action="sell-relic" data-relic="${escapeHtml(r.id)}">
          <strong>賣・${escapeHtml(r.name)}</strong>
          <span>+${SHOP.sellRelicGain} 金幣（${escapeHtml(r.desc)}）</span>
        </button>`
    )
    .join("");
  // 賣牌：列出牌組內重複度最高嘅頭幾張（避免一次列 20 張）
  const deckCount = {};
  for (const id of state.run.deck) deckCount[id] = (deckCount[id] || 0) + 1;
  const sellableCards = Object.entries(deckCount)
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(
      ([id, n]) => `
        <button type="button" class="event-choice is-sell" data-action="sell-card" data-card="${escapeHtml(id)}">
          <strong>賣・${escapeHtml(cardById(id)?.name ?? id)} ×${n}</strong>
          <span>+${SHOP.sellCardGain} 金幣（牌組 −1 張）</span>
        </button>`
    )
    .join("");
  return `
    <main class="screen" aria-label="休息">
      <header class="brand-block brand-compact">
        <h1 class="section-title">${escapeHtml(restTitle)}</h1>
        <p class="tagline">${escapeHtml(restSub)}</p>
      </header>
      <section class="panel">
        <p class="lede">現時 HP ${state.run.hp}/${state.run.maxHp} · 金幣 ${state.run.gold}。揀一項：</p>
        <div class="event-choices">
          <button type="button" class="event-choice" data-action="rest-heal">
            <strong>眯一陣</strong>
            <span>回復 ${healAmt} HP（約三成）</span>
          </button>
          <button type="button" class="event-choice" data-action="rest-upgrade">
            <strong>磨刀（寶箱感）</strong>
            <span>牌組加入「廊燈直拳」；回復 4 HP</span>
          </button>
          <button type="button" class="event-choice" data-action="rest-cleanse">
            <strong>沖個涼（清狀態）</strong>
            <span>${
              (state.run.nextBattleEnergyPenalty || 0) > 0
                ? `清走「下戰 −${state.run.nextBattleEnergyPenalty} 能量」；回復 6 HP`
                : "冇負面狀態；純粹回復 6 HP"
            }</span>
          </button>
          <button type="button" class="event-choice${canHealBuy ? "" : " is-disabled"}" data-action="shop-heal" ${canHealBuy ? "" : "disabled"}>
            <strong>便利店・回血</strong>
            <span>花 ${SHOP.healCost} 金幣回復 ${SHOP.healAmt} HP${canHealBuy ? "" : "（金幣不足）"}</span>
          </button>
          <button type="button" class="event-choice${canCardBuy ? "" : " is-disabled"}" data-action="shop-card" ${canCardBuy ? "" : "disabled"}>
            <strong>便利店・執牌</strong>
            <span>花 ${SHOP.cardCost} 金幣入手「${escapeHtml(shopCard?.name ?? SHOP.cardId)}」${canCardBuy ? "" : "（金幣不足）"}</span>
          </button>
          <button type="button" class="event-choice${canPackBuy ? "" : " is-disabled"}" data-action="shop-pack" ${canPackBuy ? "" : "disabled"}>
            <strong>便利店・抽卡包</strong>
            <span>花 ${SHOP.packCost} 金幣抽一張稀有／專屬牌${canPackBuy ? "" : "（金幣不足）"}</span>
          </button>
        </div>
        ${state.shopMsg ? `<p class="status" role="status">${escapeHtml(state.shopMsg)}</p>` : ""}
      </section>

      ${
        consumableStock
          ? `<section class="panel panel-shop">
        <h2>士多・消耗品</h2>
        <div class="event-choices">${consumableStock}</div>
      </section>`
          : ""
      }

      ${
        relicStock || ownedRelics.length
          ? `<section class="panel panel-shop">
        <h2>士多・遺物</h2>
        <div class="event-choices">${relicStock || '<p class="lede">今晚冇新貨。</p>'}</div>
        ${
          state.shopRelics.length
            ? `<button type="button" class="event-choice is-sell${canReroll ? "" : " is-disabled"}" data-action="shop-reroll" ${canReroll ? "" : "disabled"}>
            <strong>換貨</strong>
            <span>花 ${SHOP.rerollCost} 金幣叫老闆換過批貨${canReroll ? "" : "（金幣不足）"}</span>
          </button>`
            : ""
        }
        ${
          relicSell
            ? `<p class="shop-sub">變賣（換金）</p><div class="event-choices">${relicSell}</div>`
            : ""
        }
      </section>`
          : ""
      }

      ${
        sellableCards
          ? `<section class="panel panel-shop">
        <h2>變賣牌組</h2>
        <div class="event-choices">${sellableCards}</div>
      </section>`
          : ""
      }

      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="leave-shop">離開（繼續地圖）</button>
      </div>
    </main>
  `;
}

/** 遭遇紀錄一排（結算用） */
function encounterList(run) {
  const list = run.encounters || [];
  if (!list.length) return '<li class="enc-empty">（未記錄遭遇）</li>';
  return list
    .map(
      (e) => `
      <li>
        <span class="enc-tag">${escapeHtml(e.tag)}</span>
        <span class="enc-name">${escapeHtml(e.name)}</span>
        <span class="enc-act">Act${e.act}</span>
      </li>`
    )
    .join("");
}

/** 通關結算：Act3 最終 Boss 打完 */
function renderVictory() {
  const run = state.run || { deck: [], hp: 0, maxHp: 0, gold: 0, encounters: [] };
  const char = activeChar();
  const deckCount = {};
  for (const id of run.deck) deckCount[id] = (deckCount[id] || 0) + 1;
  const deckLines = Object.entries(deckCount)
    .map(
      ([id, n]) =>
        `<li><span>${escapeHtml(cardById(id)?.name ?? id)}</span><span class="deck-n">×${n}</span></li>`
    )
    .join("");

  return `
    <main class="screen screen-result is-win is-clear" aria-label="通關結算">
      <header class="brand-block">
        <h1 class="brand result-title">${escapeHtml(META.title)}</h1>
        <p class="tagline result-sub">通關 · 三區打穿</p>
      </header>
      <section class="panel clear-hero">
        <p class="clear-badge">★ 通關 CLEAR ★</p>
        <p class="eyebrow">Act3・${escapeHtml(META.act3Name)}</p>
        <h2>天台無燈，你仲企得住</h2>
        <p class="lede">
          ${escapeHtml(char.name)}喺「籠門之王」籠邊站到最後。<br />
          被動「${escapeHtml(char.passive.name)}」由後巷一路帶到天台。
        </p>
        ${
          char.rerunHook?.clear
            ? `<p class="rerun-hook">「${escapeHtml(char.rerunHook.clear)}」</p>`
            : ""
        }
        <ul class="clear-stats">
          <li><span>剩餘 HP</span><strong>${run.hp}/${run.maxHp}</strong></li>
          <li><span>金幣</span><strong>${run.gold}</strong></li>
          <li><span>牌組</span><strong>${run.deck.length} 張</strong></li>
          <li><span>遺物</span><strong>${(run.relics || []).length} 件</strong></li>
          <li><span>勝場</span><strong>${run.victories || 0}</strong></li>
        </ul>
      </section>
      ${
        (run.relics || []).length
          ? `<section class="panel">
        <h2>遺物</h2>
        <ul class="relic-list">${(run.relics || [])
          .map((id) => {
            const r = RELICS[id];
            if (!r) return "";
            return `<li><span class="relic-name">${escapeHtml(r.name)}</span><span class="relic-desc">${escapeHtml(r.desc)}</span></li>`;
          })
          .join("")}</ul>
      </section>`
          : ""
      }
      <section class="panel">
        <h2>遭遇</h2>
        <ol class="enc-list">${encounterList(run)}</ol>
      </section>
      <section class="panel">
        <h2>牌組構成</h2>
        <ul class="deck-list">${deckLines || "<li>（空）</li>"}</ul>
      </section>
      <section class="panel stub-card">
        <h2>名片（stub）</h2>
        <p class="lede">
          《香江小風波》・${escapeHtml(char.name)}<br />
          三區通關 · 被動「${escapeHtml(char.passive.name)}」<br />
          <span class="stub-note">分享名片功能下一版先開；呢格留位。</span>
        </p>
      </section>
      <div class="actions result-actions">
        <button type="button" class="btn btn-primary btn-pressable btn-rerun" data-action="again">
          <span class="btn-rerun-main">再來一局</span>
          <span class="btn-rerun-sub">換角色・換牌路・再闖三區</span>
        </button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
    </main>
  `;
}

function renderDefeat() {
  const char = activeChar();
  const map = currentMap();
  const act = state.run?.act || 1;
  const actTitles = {
    1: "後巷吞沒你",
    2: "霓虹吞沒你",
    3: "天台吞沒你",
  };
  const near = nearMissInfo();
  return `
    <main class="screen screen-result is-lose" aria-label="敗北">
      <header class="brand-block">
        <h1 class="brand result-title dim">${escapeHtml(META.title)}</h1>
        <p class="tagline result-sub">敗北 · 這一鋪完結了</p>
      </header>
      <section class="panel">
        <h2>${escapeHtml(actTitles[act] || actTitles[1])}</h2>
        <p class="near-miss">
          <strong>差一點</strong>
          <span>${escapeHtml(near.text)}</span>
        </p>
        <p class="lede">
          死亡＝本局結束。下一局可再試「${escapeHtml(char.passive.name)}」，或換角色換嘴感。<br />
          Act${act}「${escapeHtml(actDisplayName(act))}」走到節點 ${Math.min(state.run?.mapIndex + 1 || 1, map.length)}／${map.length}。
        </p>
        ${
          char.rerunHook?.defeat
            ? `<p class="rerun-hook">「${escapeHtml(char.rerunHook.defeat)}」</p>`
            : ""
        }
      </section>
      <div class="actions result-actions">
        <button type="button" class="btn btn-primary btn-pressable btn-rerun" data-action="again">
          <span class="btn-rerun-main">再來一局</span>
          <span class="btn-rerun-sub">同一條後巷，唔同嘅打法</span>
        </button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
    </main>
  `;
}

/** 敗北畫面用嘅「就差咁一點」診斷：指出差喺血／牌／遺物／能量邊一項 */
function nearMissInfo() {
  const run = state.run || {};
  const b = state.battle;
  const char = activeChar();

  // 0) 敗給 Boss：用該 Boss 專屬港味一句（最優先）
  if (b && b.isBoss) {
    const bossDef = enemyById(b.enemyId);
    if (bossDef?.nearMiss) {
      const hpNote =
        b.enemyHp > 0 ? `（佢得返 ${b.enemyHp}/${b.enemyMaxHp} 血）` : "";
      return { kind: "boss", text: `${bossDef.nearMiss}${hpNote}` };
    }
  }

  // 1) 差喺血：對手殘血未死
  if (b && b.enemyHp > 0 && b.enemyMaxHp > 0) {
    const pct = b.enemyHp / b.enemyMaxHp;
    if (pct <= 0.25) {
      return {
        kind: "hp",
        text: `${b.enemyName} 得返 ${b.enemyHp}/${b.enemyMaxHp} 血。再多一擊，就係你企喺度。`,
      };
    }
  }

  // 2) 差喺能量：手牌仍然有牌，但出唔到
  if (b && Array.isArray(b.hand) && b.hand.length > 0 && b.energy === 0) {
    const playable = b.hand.filter((id) => {
      const c = cardById(id);
      return c && (c.cost || 0) === 0;
    });
    if (playable.length === 0) {
      return {
        kind: "energy",
        text: `手牌仲有 ${b.hand.length} 張，但張張都要費。差嗰一點能量。`,
      };
    }
  }

  // 3) 差喺牌：牌組太薄
  if ((run.deck || []).length <= 11) {
    return {
      kind: "deck",
      text: `牌組只得 ${(run.deck || []).length} 張，抽到後段已經冇牌接力。`,
    };
  }

  // 4) 差喺遺物：一件都冇／只得一件
  const relicCount = (run.relics || []).length;
  if (relicCount <= 1) {
    return {
      kind: "relic",
      text:
        relicCount === 0
          ? "全場一件遺物都冇攞——士多行少咗轉。"
          : "全場只得一件遺物，差件貨就撐得住。",
    };
  }

  // 5) 兜底：差喺血（自己）
  const hp = run.hp || 0;
  const maxHp = run.maxHp || 1;
  return {
    kind: "hp",
    text: `${char.name} 頂到最後得返 ${hp}/${maxHp}。下一局留返一口氣。`,
  };
}

/** 跑圖改動快照：用嚟算出「揀完之後改咗咩」 */
function runSnapshot() {
  const run = state.run || {};
  return {
    hp: run.hp || 0,
    maxHp: run.maxHp || 0,
    deck: (run.deck || []).length,
    gold: run.gold || 0,
    relics: (run.relics || []).length,
    nextBlock: run.nextBattleBlock || 0,
    nextEnergy: run.nextBattleEnergyBonus || 0,
  };
}

/** 對比兩次快照，回傳 delta（只含有變嘅欄位） */
function diffSnapshot(before) {
  const after = runSnapshot();
  const d = {};
  for (const k of Object.keys(after)) {
    const delta = after[k] - before[k];
    if (delta !== 0) d[k] = delta;
  }
  return d;
}

/** 跑圖改動回饋：跳字 + 一句文字摘要 */
function showRunDeltas(before, extraText) {
  const d = diffSnapshot(before);
  const map = {
    hp: "hp",
    maxHp: "maxHp",
    deck: "deck",
    gold: "gold",
    nextBlock: "block",
    nextEnergy: "energy",
  };
  const deltas = {};
  for (const [k, v] of Object.entries(d)) {
    const key = map[k];
    if (key) deltas[key] = (deltas[key] || 0) + v;
  }
  // 遺物數量變動另外標示，唔好當成「張牌」
  if (d.relics) {
    deltas.relic = d.relics;
  }
  // 畫面即將重繪，所以暫存起，等 render 之後先播
  state.pendingDeltas = deltas;
  return d;
}

/** render 完之後播暫存嘅改動跳字 */
function flushRunDeltas() {
  const deltas = state.pendingDeltas;
  const restMsg = state.pendingRestMsg;
  state.pendingDeltas = null;
  state.pendingRestMsg = "";
  if (restMsg) {
    // 休息節點行完會返地圖，用 statusMsg 顯示一句港味回饋
    state.statusMsg = restMsg;
    const statusEl = document.querySelector(".status");
    if (statusEl) statusEl.textContent = restMsg;
  }
  if (!deltas || !Object.keys(deltas).length) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => floatRunDeltas(deltas));
  });
}

/** 離開士多時嘅一句（唔好空白過場） */
function shopLeaveLine() {
  const run = state.run || {};
  const hp = run.hp || 0;
  const maxHp = run.maxHp || 1;
  const ratio = hp / maxHp;
  const relicCount = (run.relics || []).length;
  const gold = run.gold || 0;

  // 血少：提醒下次要補
  if (ratio <= 0.35) {
    return `你行出士多，風一吹先發覺——得返 ${hp}/${maxHp}。下次記住補血。`;
  }
  // 有遺物：講返件貨
  if (relicCount > 0) {
    return `袋住 ${relicCount} 件貨行出去，老闆喺後面嗌：「記得返嚟呀。」`;
  }
  // 金多：講錢
  if (gold >= 30) {
    return `袋住 ${gold} 個大洋走——呢條街，有錢就有底氣。`;
  }
  // 兜底
  return "兩手空空行出去，但至少抖順咗一口氣。";
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
  patchScreen(html);
  applyActBackdrop();
  flushGoldFloat();
  flushRunDeltas();
}

/**
 * 局部更新畫面：同一個 screen（同 aria-label）就只換內部內容，
 * 保留最外層 <main class="screen"> 節點 —— 背景圖層與進入動畫都唔會重播，
 * 避免換畫面／點選項時全屏白閃。
 * screen 真係轉咗（例如地圖 → 戰鬥）先整份換。
 */
function patchScreen(html) {
  const nextKey = screenKeyOf(html);
  const current = app.querySelector(".screen");
  const currentLabel = current ? current.getAttribute("aria-label") || "" : "";
  const currentKey = currentLabel ? screenGroupOf(currentLabel) : "";

  if (current && nextKey !== null && nextKey === currentKey) {
    // 同一畫面：只換內容，保留 .screen 節點同 has-act-bg class
    if (current.outerHTML === html) return; // 完全一樣，連 patch 都免
    // 關鍵：先移除轉場標記，否則新插入的子節點會跟住播 rise-in → 白閃
    app.classList.remove("is-screen-swap");
    preserveScrollAndPatch(current, html);
    return;
  }

  // 換畫面：整份替換。先加 is-screen-swap 再插 DOM，令新節點一入場就有動畫
  app.classList.add("is-screen-swap");
  app.innerHTML = html;
  // 轉場動畫播完就解除，避免之後局部更新仍被 is-screen-swap 影響
  setTimeout(() => app.classList.remove("is-screen-swap"), 700);
}

/** 局部更新：完全唔加 is-screen-swap，所以子節點無進場動畫 → 唔會白閃 */
function suppressEnterAnimations(screenEl) {
  // 保留函式名以免其他呼叫點壞掉；實際靠「冇 is-screen-swap」達成
  screenEl.classList.remove("is-local-patch");
}

/** 由 HTML 字串取出 screen 的 aria-label（用作「係唔係同一個畫面」判斷） */
function screenKeyOf(html) {
  const m = /<main[^>]*class="[^"]*\bscreen\b[^"]*"[^>]*aria-label="([^"]*)"/.exec(html);
  if (m) return screenGroupOf(m[1]);
  // 冇 aria-label 就退而用整個 class 字串做 key
  const c = /<main[^>]*class="([^"]*)"/.exec(html);
  return c ? `__class__${c[1]}` : null;
}

/**
 * 畫面「組」：同一組共用同一個 .screen 節點，局部更新唔重播進場動畫。
 * 事件／事件結果係同一個畫面的兩個狀態，唔應該當轉場（會全屏閃）。
 */
function screenGroupOf(label) {
  const groups = {
    事件: "event",
    事件結果: "event",
    選牌: "reward",
    通關結算: "result",
    敗北: "result",
  };
  return groups[label] || label;
}

/**
 * 就地替換 .screen 的內部 HTML，但要保住：
 * - 外層 .screen（連 background 層、has-act-bg）
 * - 焦點元素（用 data-action 記住）
 * - 滾動位置
 */
function preserveScrollAndPatch(screenEl, html) {
  const scrollY = window.scrollY;
  const focused = document.activeElement?.closest?.("[data-action]");
  const focusAction = focused?.getAttribute("data-action") || null;

  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const incoming = tmp.querySelector(".screen");
  if (!incoming) {
    app.innerHTML = html;
    return;
  }

  // 保留外層屬性：新舊 class 取聯集，確保 has-act-bg 唔會被洗走
  const keepBg = screenEl.classList.contains("has-act-bg");
  screenEl.className = incoming.className;
  if (keepBg && !screenEl.classList.contains("has-act-bg")) {
    screenEl.classList.add("has-act-bg");
  }
  suppressEnterAnimations(screenEl);
  screenEl.replaceChildren(...Array.from(incoming.childNodes));

  if (focusAction) {
    const again = screenEl.querySelector(`[data-action="${focusAction}"]`);
    if (again) again.focus({ preventScroll: true });
  }
  window.scrollTo(0, scrollY);
}

/**
 * 畫面 render 完之後才播金幣跳字（此時金幣顯示元素已存在）。
 * 用 rAF 等 layout 穩定，避免錨點位置係 0。
 */
function flushGoldFloat() {
  const pending = state.pendingGoldFloat;
  if (!pending) return;
  state.pendingGoldFloat = 0;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      floatGold(pending);
      pulseGoldStat(pending > 0 ? "up" : "down");
    });
  });
}

/** 地圖／選牌狀態列的金幣數字彈一下（配合跳字） */
function pulseGoldStat(dir) {
  for (const el of document.querySelectorAll(".run-stats span")) {
    if (el.textContent.includes("金幣")) {
      el.classList.remove("is-gold-up", "is-gold-down");
      void el.offsetWidth;
      el.classList.add(dir === "up" ? "is-gold-up" : "is-gold-down");
      setTimeout(() => el.classList.remove("is-gold-up", "is-gold-down"), 620);
      return;
    }
  }
}

/** 當前節點背景；冇節點（選角／結算）就用 run.act 或 Act1 */
function currentBackdrop() {
  const node = currentNode();
  if (node?.bg) return node.bg;
  const act = state.run?.act || 1;
  return actBg(act);
}

/**
 * 把 Act 背景套落有 `.screen` 嘅畫面（戰鬥／事件／選牌／休息／Boss gate／地圖）。
 * 唔郁玩法 layout，只用 CSS 變數 + ::before 圖層；缺圖會自動降級（CSS fallback）。
 */
function applyActBackdrop() {
  const bg = currentBackdrop();
  const screen = app?.querySelector(".screen");
  if (!screen || !bg) return;
  // CSS 自訂屬性裡面嘅相對 url() 會按「樣式表」路徑解析（會變 /css/assets/…），
  // 所以呢度先解析成絕對路徑再寫入變數。
  let abs = bg;
  try {
    abs = new URL(bg, document.baseURI).href;
  } catch {
    abs = bg;
  }
  const nextValue = `url("${abs}")`;
  // 同一個背景就唔重設，避免背景圖層重新解碼／重新淡入造成閃
  if (screen.style.getPropertyValue("--act-bg") !== nextValue) {
    screen.style.setProperty("--act-bg", nextValue);
  }
  if (!screen.classList.contains("has-act-bg")) {
    screen.classList.add("has-act-bg");
  }
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
  // 按卡 ~80ms ＋飛軌 120ms（規格 120–180）＋命中 ≤100ms → 單次攻擊可視 FX ≤300ms（≤350ms）
  await flyProjectile(from, flyTo, card.type === "attack" ? "attack" : "skill", 120);

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
      showPassiveBanner("快手！", "kuaisou");
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
    showPassiveBanner("快手！", "kuaisou");
    sfx.kuaisou();
    floatText(document.getElementById("player-anchor"), "快手！−1／+3", "kuaisou");
    await wait(120);
  }

  if (result.zhaopaiyanDrew) {
    showPassiveBanner("招牌眼 抽 1", "zhaopaiyan");
    sfx.kuaisou();
    floatText(document.getElementById("player-anchor"), "招牌眼 抽 1", "zhaopaiyan");
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

    if (result.dangkou?.triggered) {
      syncHpBars(state.battle);
      showPassiveBanner(`檔口 +${result.dangkou.block} 擋`, "dangkou");
      sfx.block();
      floatText(player, `檔口 +${result.dangkou.block} 擋`, "dangkou");
      await wait(140);
    }
  } else {
    await wait(60);
  }

  state.busy = false;
  render();
}

/* ---------- flow helpers ---------- */

/** 記錄遭遇（結算畫面用；只記戰鬥節點） */
function recordEncounter(node) {
  if (!node || !state.battle) return;
  const enemy = enemyById(state.battle.enemyId);
  if (!enemy) return;
  state.run.encounters = state.run.encounters || [];
  state.run.encounters.push({
    name: enemy.name,
    tag: enemyTag(enemy),
    act: state.run.act,
  });
}

function startBattleNow(enemyId) {
  const enemy = enemyById(enemyId);
  state.battle = createBattle(state.run, enemy);
  startPlayerTurn(state.battle);
  state.pendingBossId = null;
  state.screen = "battle";
}

function beginBattle(enemyId) {
  const enemy = enemyById(enemyId);
  if (!enemy) {
    state.statusMsg = "對手未定";
    return;
  }
  if (enemy.isBoss) {
    state.pendingBossId = enemyId;
    state.screen = "boss-gate";
    return;
  }
  startBattleNow(enemyId);
}

/** 節點敵人：同一節點抽到就記住（重試／預覽一致） */
function nodeEnemyId(node) {
  if (!node) return null;
  if (node.enemyId) return node.enemyId;
  const run = state.run;
  if (!run) return null;
  run.nodeEnemies = run.nodeEnemies || {};
  if (!run.nodeEnemies[node.id]) {
    run.nodeEnemies[node.id] = pickNodeEnemyId(node);
  }
  return run.nodeEnemies[node.id];
}

/** 節點事件：行到先由該 Act 事件池抽，抽定就記住 */
function nodeEventId(node) {
  if (!node) return null;
  const run = state.run;
  run.nodeEvents = run.nodeEvents || {};
  if (!run.nodeEvents[node.id]) {
    const act = run.act || 1;
    const pool = EVENT_POOLS[act] || EVENT_POOLS[1];
    // 每局抽 2 個（唔重複），令同一格都有機會走唔同路線
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picks = node.eventId ? [node.eventId] : shuffled.slice(0, Math.min(2, pool.length));
    run.nodeEvents[node.id] = picks[0] || pool[0];
    run.nodeEventQueue = run.nodeEventQueue || {};
    run.nodeEventQueue[node.id] = picks;
  }
  return run.nodeEvents[node.id];
}

/** 該事件節點仲有幾多個未行嘅事件（每局抽 2 個） */
function eventQueueOf(node) {
  const run = state.run;
  if (!run?.nodeEventQueue || !node) return [];
  return run.nodeEventQueue[node.id] || [];
}

/** 事件節點前進到下一個事件；冇下一個就返 false */
function advanceEventQueue() {
  const node = currentNode();
  if (!node) return false;
  const queue = eventQueueOf(node);
  const idx = queue.indexOf(state.run.nodeEvents[node.id]);
  if (idx >= 0 && idx < queue.length - 1) {
    state.run.nodeEvents[node.id] = queue[idx + 1];
    state.eventResult = null;
    return true;
  }
  return false;
}

/** 目前事件節點對應嘅事件定義 */
function currentNodeEvent() {
  const node = currentNode();
  if (!node) return null;
  return eventById(nodeEventId(node));
}

function advanceMap(opts = {}) {
  const { autoScreen = true } = opts;
  const node = currentNode();
  if (node && !state.run.completed.includes(node.id)) {
    state.run.completed.push(node.id);
  }
  state.run.mapIndex += 1;
  state.battle = null;
  state.eventResult = null;
  state.rewardChoices = [];
  state.statusMsg = "";
  state.shopMsg = "";
  state.shopRelics = [];
  state.shopConsumables = [];
  state.pendingBossId = null;
  if (state.run.mapIndex >= currentMap().length) {
    if (state.run.act === 1) {
      // Act1 Boss 勝 → 自動進 Act2「旺角霓虹」
      enterAct(2);
    } else if (state.run.act === 2) {
      // Act2 Boss 勝 → 自動進 Act3「城寨・天台」
      enterAct(3);
    } else {
      // Act3 最終 Boss 勝 → 通關結算
      state.screen = "victory";
      sfx.win();
    }
  } else if (autoScreen) {
    state.screen = "map";
  }
}

function openReward() {
  state.rewardChoices = pickRewardChoices(3, [], state.run.characterId);
  state.screen = "reward";
  state.statusMsg = "揀一張加入牌組";
}

function enterNode() {
  const node = currentNode();
  if (!node) return;
  if (node.type === "battle" || node.type === "boss") {
    beginBattle(nodeEnemyId(node));
  } else if (node.type === "reward") {
    openReward();
  } else if (node.type === "event") {
    nodeEventId(node); // 入場先抽定，之後重繪／結果頁都用同一個
    state.eventResult = null;
    state.screen = "event";
  } else if (node.type === "rest") {
    state.shopMsg = "";
    // 每局入店洗一次貨：1 件消耗品 + 2 件遺物
    if (!state.shopConsumables?.length) {
      state.shopConsumables = pickShopConsumables(1);
    }
    if (!state.shopRelics?.length) {
      state.shopRelics = pickShopRelics(state.run, 2);
    }
    state.screen = "rest";
  }
}

function onClick(event) {
  const t = event.target.closest(
    "[data-action], [data-play], [data-pick], [data-event-choice], .map-node.is-current"
  );  if (!t) return;
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
    const before = runSnapshot();
    state.run.deck.push(pickId);
    state.statusMsg = `已加入「${cardById(pickId)?.name ?? pickId}」`;
    showRunDeltas(before);
    advanceMap();
    render();
    return;
  }

  const evChoice = t.getAttribute("data-event-choice");
  if (evChoice) {
    const ev = currentNodeEvent();
    const choice = ev?.choices.find((c) => c.id === evChoice);
    if (choice) {
      const before = runSnapshot();
      state.eventResult = choice.apply(state.run);
      showRunDeltas(before);
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
    case "pick-char": {
      const id = t.getAttribute("data-char");
      if (id && CHARACTERS[id]) state.selectedCharId = id;
      break;
    }
    case "confirm-char":
      state.run = createRun(state.selectedCharId);
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
    case "battle-win": {
      syncRunHpFromBattle();
      state.run.victories += 1;
      const node = currentNode();
      const bonuses = relicBonuses(state.run);
      const isBossFight = node?.type === "boss";
      const baseGold = battleGoldReward(isBossFight);
      // 遺物：小怪勝場額外金
      const gold = baseGold > 0 ? baseGold + (bonuses.goldBonus || 0) : 0;
      if (gold > 0) {
        state.run.gold += gold;
        // 等新畫面（選牌／地圖）render 完，錨定金幣顯示位置再跳字
        state.pendingGoldFloat = gold;
      }
      // 遺物：勝場回血
      if (bonuses.healOnWin > 0) {
        state.run.hp = Math.min(state.run.maxHp, state.run.hp + bonuses.healOnWin);
      }
      recordEncounter(node);
      if (node?.type === "boss") {
        // Act1 Boss → Act2；Act2 Boss → Act3；Act3 最終 Boss → 通關結算
        advanceMap();
      } else {
        const map = currentMap();
        const next = map[state.run.mapIndex + 1];
        if (next?.type === "reward") {
          // 戰後下一格係選牌節點 → 先推進再開選牌
          advanceMap({ autoScreen: false });
          openReward();
        } else {
          // 其餘：選牌疊喺戰鬥節點上，揀完先推進
          openReward();
        }
        if (gold > 0) state.statusMsg = `揀一張加入牌組 · 獲 ${gold} 金幣`;
      }
      break;
    }
    case "to-defeat":
      syncRunHpFromBattle();
      state.screen = "defeat";
      sfx.lose();
      break;
    case "skip-reward":
      advanceMap();
      break;
    case "finish-event":
      // 每局事件節點抽 2 個：行完第一個接第二個，行完先返地圖
      if (advanceEventQueue()) {
        render();
        return;
      }
      advanceMap();
      break;
    case "rest-heal": {
      const healAmt = Math.floor(state.run.maxHp * 0.3);
      const before = runSnapshot();
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + healAmt);
      state.pendingRestMsg = `眯咗一陣，回咗 ${healAmt} HP。`;
      showRunDeltas(before);
      advanceMap();
      break;
    }
    case "rest-upgrade": {
      const before = runSnapshot();
      state.run.deck.push("S15");
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + 4);
      state.pendingRestMsg = "磨好把刀——牌組加入「廊燈直拳」，順手回 4 HP。";
      showRunDeltas(before);
      advanceMap();
      break;
    }
    case "rest-cleanse": {
      const before = runSnapshot();
      const hadPenalty = state.run.nextBattleEnergyPenalty || 0;
      state.run.nextBattleEnergyPenalty = 0;
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + 6);
      state.pendingRestMsg = hadPenalty
        ? `沖走一身晦氣——清咗下戰 −${hadPenalty} 能量，兼回 6 HP。`
        : "沖個涼，人都醒神——回 6 HP。";
      showRunDeltas(before);
      // 清狀態要自己補一個跳字（energy 由負變 0 唔會入 delta）
      if (hadPenalty) {
        state.pendingDeltas = state.pendingDeltas || {};
        state.pendingDeltas.energy = hadPenalty;
      }
      advanceMap();
      break;
    }
    case "shop-heal":
      if (state.run.gold >= SHOP.healCost) {
        const before = runSnapshot();
        state.run.gold -= SHOP.healCost;
        state.run.hp = Math.min(state.run.maxHp, state.run.hp + SHOP.healAmt);
        state.shopMsg = `阿姐遞過嚟一碗熱嘢——回咗 ${SHOP.healAmt} HP，人都醒神。`;
        showRunDeltas(before);
      } else {
        state.shopMsg = "金幣不足";
      }
      break;
    case "shop-card":
      if (state.run.gold >= SHOP.cardCost) {
        const before = runSnapshot();
        state.run.gold -= SHOP.cardCost;
        state.run.deck.push(SHOP.cardId);
        state.shopMsg = `執咗張「${cardById(SHOP.cardId)?.name ?? SHOP.cardId}」入袋——用得着嘅。`;
        showRunDeltas(before);
      } else {
        state.shopMsg = "金幣不足";
      }
      break;
    case "shop-pack": {
      if (state.run.gold < SHOP.packCost) {
        state.shopMsg = "金幣不足";
        break;
      }
      const packCardId = pickPackCard(state.run.characterId);
      if (!packCardId) {
        state.shopMsg = "今晚卡包賣晒。";
        break;
      }
      const before = runSnapshot();
      state.run.gold -= SHOP.packCost;
      state.run.deck.push(packCardId);
      const pc = cardById(packCardId);
      state.shopMsg = `拆開卡包——「${pc?.name ?? packCardId}」，${pc?.rarity ?? ""}牌，手氣唔錯。`;
      showRunDeltas(before);
      break;
    }
    case "shop-reroll": {
      if (state.run.gold < SHOP.rerollCost) {
        state.shopMsg = "金幣不足";
        break;
      }
      const before = runSnapshot();
      state.run.gold -= SHOP.rerollCost;
      state.shopRelics = pickShopRelics(state.run, 2);
      state.shopConsumables = pickShopConsumables(1);
      state.shopMsg = state.shopRelics.length
        ? `老闆換咗批貨：${state.shopRelics.map((id) => relicById(id)?.name ?? id).join("、")}。`
        : "老闆話今晚冇新貨喇。";
      showRunDeltas(before);
      break;
    }
    case "buy-consumable": {
      const csId = t.getAttribute("data-consumable");
      const cs = CONSUMABLES[csId];
      if (!cs) break;
      if (state.run.gold < cs.price) {
        state.shopMsg = "金幣不足";
        break;
      }
      const before = runSnapshot();
      state.run.gold -= cs.price;
      const msg = cs.apply(state.run);
      // 買完即用，貨架移走該件
      state.shopConsumables = (state.shopConsumables || []).filter((id) => id !== csId);
      state.shopMsg = `老闆遞過嚟「${cs.name}」——${msg}`;
      showRunDeltas(before);
      break;
    }
    case "shop-relic": {
      const relicId = t.getAttribute("data-relic");
      const relic = relicById(relicId);
      if (!relic) return;
      if (state.run.gold < SHOP.relicCost) {
        state.shopMsg = "金幣不足";
        break;
      }
      if ((state.run.relics || []).includes(relicId)) {
        state.shopMsg = "已經有你件貨。";
        break;
      }
      const before = runSnapshot();
      state.run.gold -= SHOP.relicCost;
      state.run.relics = state.run.relics || [];
      state.run.relics.push(relicId);
      state.shopRelics = state.shopRelics.filter((id) => id !== relicId);
      // 即時型遺物即刻生效
      const eff = relic.effect || {};
      if (eff.instantMaxHp) {
        state.run.maxHp += eff.instantMaxHp;
        state.run.hp = Math.min(state.run.maxHp, state.run.hp + eff.instantMaxHp);
      }
      if (eff.instantGold) state.run.gold += eff.instantGold;
      state.shopMsg = `老闆娘包起「${relic.name}」遞你——${relic.desc}`;
      showRunDeltas(before);
      break;
    }
    case "sell-relic": {
      const relicId = t.getAttribute("data-relic");
      const relic = relicById(relicId);
      if (!relic || !(state.run.relics || []).includes(relicId)) return;
      const before = runSnapshot();
      state.run.relics = state.run.relics.filter((id) => id !== relicId);
      state.run.gold += SHOP.sellRelicGain;
      // 賣走即時型遺物要扣返（最低保 1 HP）
      const eff = relic.effect || {};
      if (eff.instantMaxHp) {
        state.run.maxHp = Math.max(1, state.run.maxHp - eff.instantMaxHp);
        state.run.hp = Math.max(1, Math.min(state.run.hp, state.run.maxHp));
      }
      state.shopMsg = `放手「${relic.name}」，袋返 +${SHOP.sellRelicGain} 金幣。`;
      showRunDeltas(before);
      break;
    }
    case "sell-card": {
      const cardId = t.getAttribute("data-card");
      const idx = state.run.deck.indexOf(cardId);
      if (idx < 0) return;
      const before = runSnapshot();
      state.run.deck.splice(idx, 1);
      state.run.gold += SHOP.sellCardGain;
      state.shopMsg = `放手「${cardById(cardId)?.name ?? cardId}」，袋返 +${SHOP.sellCardGain} 金幣。`;
      showRunDeltas(before);
      break;
    }
    case "leave-shop":
      // 唔好空白過場：走之前講一句，連埋呢次買賣嘅總結
      state.pendingRestMsg = shopLeaveLine();
      advanceMap();
      break;
    case "again":
      state.run = null;
      state.battle = null;
      state.pendingBossId = null;
      state.screen = "select";
      break;
    default:
      return;
  }
  render();
}

app?.addEventListener("click", onClick);
render();

// 通知 index.html 的兜底腳本：引擎已成功啟動（唔會再誤報載入失敗）
if (typeof window !== "undefined" && typeof window.__HK_BOOTED__ === "function") {
  window.__HK_BOOTED__();
}

/** 自測／截圖用：不改玩法，只暴露只讀狀態與跳關 */
if (typeof window !== "undefined") {
  window.__HK = {
    getState: () => state,
    render,
    /** 強制當前戰鬥勝利（保留 feel 以外嘅流程） */
    forceBattleWin() {
      if (!state.battle) return false;
      state.battle.enemyHp = 0;
      state.battle.over = "win";
      state.battle.log.push("（自測）強制勝利");
      render();
      return true;
    },
    /** 跳到當前 Act 指定節點（0-based） */
    jumpToNode(index) {
      if (!state.run) return false;
      const map = currentMap();
      if (index < 0 || index >= map.length) return false;
      state.run.mapIndex = index;
      state.run.completed = map.slice(0, index).map((n) => n.id);
      state.battle = null;
      state.screen = "map";
      render();
      return true;
    },
    enterAct2: () => {
      enterAct2();
      render();
    },
    enterAct3: () => {
      enterAct3();
      render();
    },
    /** 直接跳去當前 Act 第 6 格（Boss 前） */
    goBossGate() {
      if (!state.run) return false;
      const map = currentMap();
      const bossIdx = map.findIndex((n) => n.type === "boss");
      if (bossIdx < 0) return false;
      this.jumpToNode(bossIdx);
      enterNode();
      render();
      return true;
    },
  };
}
