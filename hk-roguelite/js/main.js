/**
 * 《香江小風波》— 垂直切片入口（含手感／打擊感層）
 * 目錄暫名 hk-roguelite／產品名《香江小風波》
 * 與倉庫根目錄舊《香江 Card Game》demo 隔離；不修改根目錄主循環。
 */

import {
  META,
  START_GOLD,
  ACT_TRANSITIONS,
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
  branchOptionById,
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
  restShopForAct,
  shopCardIdForAct,
} from "./data.js";
import {
  createBattle,
  startPlayerTurn,
  playCard,
  endTurn,
  getIntent,
  effectiveCost,
} from "./battle.js";
import { sfx, isMuted, toggleMuted } from "./sfx.js";
import { listKeys, progressKeys, hasProgress, clearProgress } from "./storage.js";
import { hasSeenTutorial, markTutorialSeen } from "./tutorial.js";
import { pauseSummary, pauseLossLine, hasRunToLose } from "./pause.js";
import { saveRun, loadRun, clearRun, saveSummary, unpackRun } from "./save.js";
import {
  claimDaily,
  consumePendingGold,
  isClaimedToday,
  dailyStatusLine,
} from "./daily.js";
import { summarizeDeck, deckOverviewLine, battleDeckIds } from "./deckview.js";
import { cardDetail } from "./carddetail.js";
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
  syncPileCounts,
  flashShuffle,
  clearFx,
  floatGold,
  floatRunDeltas,
  confirmPick,
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
  eventChoiceLabel: "",
  eventChoiceText: "",
  statusMsg: "",
  busy: false,
  pendingBossId: null,
  shopMsg: "",
  shopRelics: /** @type {string[]} */ ([]),
  shopConsumables: /** @type {string[]} */ ([]),
  pendingGoldFloat: 0,
  pendingDeltas: /** @type {object|null} */ (null),
  pendingRestMsg: "",
  pendingTurnLine: "",
  actTransition: /** @type {object|null} */ (null),
  openingHint: "",
  /** 設定頁：清除進度二次確認狀態（"idle" → "confirm"） */
  clearConfirm: "idle",
  /** 設定頁：上次操作結果一句（清除後回饋） */
  settingsMsg: "",
  /** 暫停頁：返標題二次確認狀態（"idle" → "confirm"） */
  pauseConfirm: "idle",
  /** 暫停頁由邊度入（"battle" 或 "map"），純為文案 */
  pauseFrom: "map",
  /** 繼續時要返去邊個畫面 */
  pauseResumeTo: "map",
  /** 設定頁由邊度入（"pause" 就返暫停，唔好誤跳標題） */
  settingsReturnTo: null,
  /** 標題頁讀到嘅存檔（null = 冇得續） */
  savedRun: null,
  /** 新局覆蓋存檔二次確認（"idle" → "confirm"） */
  overwriteConfirm: "idle",
  /** 今次結算領到嘅每日獎勵（null = 今日已領過） */
  dailyReward: /** @type {object|null} */ (null),
  /** 選角頁：邊個角色嘅 starter 預覽展開咗（null = 全收起） */
  starterOpen: /** @type {string|null} */ (null),
  /** 戰鬥中：牌組預覽開關 */
  deckOpen: false,
  /** 長按卡牌：而家顯示詳情嘅牌 id（null = 冇開） */
  cardDetailId: /** @type {string|null} */ (null),
};

/** 現存角色 id（用嚟擋「角色已移除」嘅舊存檔） */
function knownCharIds() {
  return Object.keys(CHARACTERS);
}

/**
 * 自動存檔：每次畫面變化後都寫一次。
 *
 * 只在「有進行中一局」時寫；戰鬥中亦照存（下輪由該節點重入）。
 * **結算畫面（victory／defeat）唔存**——嗰時局已經完，再寫就
 * 會令標題頁錯誤噉顯示「繼續」。
 */
function autoSave() {
  if (!state.run) return false;
  if (state.screen === "victory" || state.screen === "defeat") return false;
  // 戰鬥中存 "battle"，重入時由該節點重新開打（唔存戰鬥內部狀態）
  const screen = state.screen === "battle" ? "battle" : state.screen;
  return saveRun(state.run, screen);
}

/** 重讀標題頁要顯示嘅存檔摘要 */
function refreshSavedRun() {
  const data = loadRun(knownCharIds());
  state.savedRun = data;
  return data;
}

/**
 * 每日鉤：今日第一次完局先派獎勵。
 * 回傳今次**新領到**嘅獎勵（今日已領過就回 null，唔會重複派）。
 */
function claimDailyOnce() {
  const res = claimDaily();
  if (res.claimed) {
    state.dailyReward = res.reward;
    sfx.coin();
    return res.reward;
  }
  state.dailyReward = null;
  return null;
}

/**
 * 結算頁（通關／敗北共用）：今日領到咩。
 * 今日已領過就唔顯示（唔好日日彈同一個 panel）。
 */
function renderDailyReward() {
  const r = state.dailyReward;
  if (!r) return "";
  const body =
    r.kind === "gold"
      ? `<p class="daily-body">下一局開局 <strong>+${r.value} 金</strong>（會自動入袋）。</p>`
      : `<p class="daily-body">${escapeHtml(r.text)}</p>`;
  return `
    <section class="panel daily-panel">
      <h2>今日一局</h2>
      <p class="daily-lede">今日第一次完局——收低呢份。</p>
      ${body}
    </section>`;
}

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
  // 每日鉤：上一日／之前幾日累積落嚟嘅金幣獎勵，喺開局一次過加
  const dailyGold = consumePendingGold();
  return {
    characterId: c.id,
    act: 1,
    hp: c.maxHp,
    maxHp: c.maxHp,
    // 開局畀 12 金：夠買最便宜消耗品（6）兩件，或一件＋找贖，
    // 避免「0 金入第一間士多乜都買唔到」嘅死局。
    gold: START_GOLD + dailyGold,
    /** 每日鉤加咗幾多（結算頁可講返） */
    dailyBonusGold: dailyGold,
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
/** 清事件狀態（連「你揀咗」記憶一齊清，避免上一件事嘅選擇殘留） */
function clearEventState() {
  state.eventResult = null;
  state.eventChoiceLabel = "";
  state.eventChoiceText = "";
}

function enterAct(nextAct) {
  const run = state.run;
  run.act = nextAct;
  run.mapIndex = 0;
  run.completed = [];
  run.nodeEnemies = {};
  run.nodeEvents = {};
  run.nodeEventQueue = {};
  state.battle = null;
  clearEventState();
  state.rewardChoices = [];
  state.statusMsg = "";
  state.openingHint = "";
  state.shopMsg = "";
  state.pendingBossId = null;
  // Act 銜接過場：入新區前講一句，唔好斷戲
  const trans = ACT_TRANSITIONS[nextAct];
  if (trans) {
    state.actTransition = trans;
    state.screen = "act-transition";
  } else {
    state.actTransition = null;
    state.screen = "map";
  }
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
  if (card.dmg) bits.push(`傷 ${card.dmg}`);
  if (card.block) bits.push(`盾 ${card.block}`);
  if (card.heal) bits.push(`回 ${card.heal}`);
  if (card.draw) bits.push(`抽 ${card.draw}`);
  // 「烙」對玩家唔直觀，改用「下回合再痛 N」講清楚
  if (card.mark) bits.push(`下回合再痛 ${card.mark}`);
  // 低血加成：卡面直接寫出幾多，唔好只寫個「+」
  if (card.dmgBonusOnLowHp) bits.push(`半血以下 +${card.dmgBonusOnLowHp} 傷`);

  return `
    <${tag} type="button" class="card-face${disabled}${kuai}"${idxAttr}${pickAttr} data-card="${escapeHtml(card.id)}">
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

/**
 * 牌組預覽：共用元件（選角頁 / 戰鬥頁都用）。
 *
 * 用 <ul> 列，每行：費用圓章 + 名 + 類型 + ×N。
 * 唔用卡面圖（太多張會 load 一堆圖、又會撐爆 390 版面），
 * 改為「一眼睇數」嘅清單 —— 呢個係預覽，唔係揀牌。
 *
 * @param {string[]} ids 牌 id
 * @param {{heading?:string, limit?:number}} [opts]
 */
function renderDeckPreview(ids, opts = {}) {
  const s = summarizeDeck(ids, CARDS);
  if (s.total === 0) {
    return `<p class="deck-empty">牌組未有牌。</p>`;
  }
  const rows = s.rows
    .map(
      (r) => `
      <li class="deck-row">
        <span class="deck-cost" aria-label="費用">${r.cost}</span>
        <span class="deck-name">${escapeHtml(r.name)}</span>
        <span class="deck-type">${r.type === "attack" ? "攻擊" : r.type === "skill" ? "技能" : "—"}</span>
        <span class="deck-count">×${r.count}</span>
      </li>`
    )
    .join("");
  return `
    <p class="deck-overview">${escapeHtml(deckOverviewLine(s))}</p>
    <ul class="deck-list-preview">${rows}</ul>`;
}

/**
 * 選角頁：starter 牌組（開局前就知自己玩咩）。
 * 可摺疊：預設收起，撳「睇 starter」展開 —— 唔想睇嘅玩家唔會被長列表擋住。
 */
function renderStarterPreview(c) {
  const open = state.starterOpen === c.id;
  if (!open) {
    return `
      <button type="button" class="btn btn-ghost btn-pressable deck-toggle" data-action="toggle-starter" data-char="${escapeHtml(c.id)}">
        睇 starter 牌組<span class="btn-sub">${c.starterDeck.length} 張</span>
      </button>`;
  }
  return `
    <section class="panel deck-panel">
      <h2>${escapeHtml(c.name)} 嘅 starter</h2>
      ${renderDeckPreview(c.starterDeck)}
      <button type="button" class="btn btn-ghost btn-pressable deck-toggle" data-action="toggle-starter" data-char="${escapeHtml(c.id)}">
        收起
      </button>
    </section>`;
}

function renderTitle() {
  // 每次畫標題都同 localStorage 對一次，避免 state.savedRun 變 stale
  // （例如覆蓋存檔之後、或者另一個 tab 清咗進度）
  refreshSavedRun();
  return `
    <main class="screen screen-title" aria-label="標題">
      <header class="brand-block">
        <h1 class="brand">${escapeHtml(META.title)}</h1>
        <p class="tagline">後巷夜醒 · 霓虹街頭卡牌</p>
        <span class="badge">三區一路 · 後巷 → 旺角 → 天台 · 四角落場</span>
      </header>
      <section class="panel panel-hero-copy">
        <h2>一鋪一個傳奇</h2>
        <p class="lede">
          揀邊個落場、執牌闖三區。短、上癮、想再嚟一鋪。<br />
          四角開局 → 後巷・夜醒 → 旺角霓虹 → 城寨・天台 → 籠門之王 → 通關結算。
        </p>
      </section>
      <div class="actions">
        ${
          state.overwriteConfirm === "confirm" && state.savedRun
            ? `<div class="overwrite-confirm" role="alert">
                 <p class="overwrite-title">開新局會蓋走而家呢一鋪存檔。</p>
                 <p class="overwrite-body">${escapeHtml(saveSummary(state.savedRun))}</p>
                 <p class="overwrite-body">蓋走之後冇得返轉頭。想留住呢一鋪就撳「唔好」。</p>
                 <div class="overwrite-actions">
                   <button type="button" class="btn btn-danger btn-pressable" data-action="confirm-overwrite">係，開新局</button>
                   <button type="button" class="btn btn-ghost btn-pressable" data-action="cancel-overwrite">唔好，留住呢鋪</button>
                 </div>
               </div>`
            : `${
                // 有存檔先顯示「繼續」——冇存檔唔應該出一個撳完冇反應嘅掣
                state.savedRun
                  ? `<button type="button" class="btn btn-primary btn-pressable btn-continue" data-action="continue-run">
                 <span class="btn-continue-main">繼續呢一鋪</span>
                 <span class="btn-continue-sub">${escapeHtml(saveSummary(state.savedRun))}</span>
               </button>`
                  : ""
              }
        <button type="button" class="btn btn-${state.savedRun ? "ghost" : "primary"} btn-pressable" data-action="to-select">${
          state.savedRun ? "新局（會蓋走存檔）" : "去選角"
        }</button>
        <button type="button" class="btn btn-ghost btn-pressable" data-action="to-settings">設定</button>`
        }
      </div>
      <p class="daily-line${isClaimedToday() ? " is-claimed" : " is-todo"}">${escapeHtml(dailyStatusLine())}</p>
      ${renderSfxToggle()}
      <p class="foot-note">《香江小風波》· 同舊 demo 隔離 · 街口自理</p>
    </main>
  `;
}

/**
 * 設定頁：靜音記憶 + 清除本機進度（二次確認）。
 *
 * 設計重點：
 *   - 靜音狀態由 `sfx.js` 嘅 localStorage 驅動，重開瀏覽器仍生效
 *   - 清除進度要**撳兩下**：第一下變成紅色「確定清除？」並顯示會清走咩，
 *     第二下才真係清；中間有「取消」可以全身而退
 *   - 清除**唔會**洗走音效設定（純設定 key 有白名單）
 *   - 冇任何進度時，清除掣禁用並講明「本機未有進度」
 */
function renderSettings() {
  const off = isMuted();
  const keys = progressKeys();
  const confirming = state.clearConfirm === "confirm";
  const anyProgress = keys.length > 0;

  const keyList = keys.length
    ? `<ul class="settings-keys">${keys.map((k) => `<li><code>${escapeHtml(k)}</code></li>`).join("")}</ul>`
    : `<p class="settings-empty">本機未有進度——打過一局、遇過敵人、解鎖過嘢，先會喺度見到。</p>`;

  const confirmBlock = confirming
    ? `
      <div class="settings-confirm" role="alert">
        <p class="settings-confirm-title">真係要清？街口進度一清就冇得救。</p>
        <p class="settings-confirm-body">會清走上面列住嘅本機進度（圖鑑、名冊、解鎖）。音效設定會留低。</p>
        <div class="settings-confirm-actions">
          <button type="button" class="btn btn-danger btn-pressable" data-action="confirm-clear">係，清走</button>
          <button type="button" class="btn btn-ghost btn-pressable" data-action="cancel-clear">唔好，留住</button>
        </div>
      </div>`
    : `
      <button type="button" class="btn btn-ghost btn-pressable settings-clear-btn" data-action="ask-clear"
        ${anyProgress ? "" : "disabled"}>
        ${anyProgress ? "清除本機進度" : "清除本機進度（冇進度可清）"}
      </button>`;

  return `
    <main class="screen screen-settings" aria-label="設定">
      <header class="brand-block brand-compact">
        <h1 class="brand">設定</h1>
        <p class="tagline">街口設定 · 資料唔會上雲</p>
      </header>

      <section class="panel">
        <h2>音效</h2>
        <p class="lede">而家：<strong>${off ? "關" : "開"}</strong>。記住喺你部機，重開瀏覽器都仍然生效。</p>
        <button type="button" class="sfx-toggle${off ? " is-muted" : ""}" data-action="toggle-sfx"
          aria-pressed="${off ? "true" : "false"}" aria-label="${off ? "音效已關，撳一下開啟" : "音效已開，撳一下靜音"}">
          <span class="sfx-toggle-icon" aria-hidden="true">${off ? "🔇" : "🔊"}</span>
          <span class="sfx-toggle-text">${off ? "音效：關" : "音效：開"}</span>
        </button>
      </section>

      <section class="panel settings-howto">
        <h2>街頭操作（一句）</h2>
        <ul class="howto-list">
          <li><strong>撳牌</strong>就出手；<strong>撳住牌 0.4 秒</strong>睇詳情（唔會落場）。</li>
          <li>對手頭上寫住呢回合想打幾多——睇清先決定擋定打。</li>
          <li>冇牌打就撳「結束回合」，對手出手；捱完再摸牌、回滿格氣。</li>
        </ul>
      </section>

      <section class="panel">
        <h2>本機進度</h2>
        <p class="lede">呢啲只存喺你部機（localStorage）——冇上雲、冇帳號、街口自理。</p>
        ${keyList}
        ${confirmBlock}
        ${
          state.settingsMsg
            ? `<p class="settings-result" role="status">${escapeHtml(state.settingsMsg)}</p>`
            : ""
        }
      </section>

      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="back-title">${
          state.settingsReturnTo === "pause" ? "返停一停" : "返標題"
        }</button>
      </div>
    </main>
  `;
}

/**
 * 靜音掣：全遊戲共用一個樣式，狀態存 localStorage。
 * 文案講清「而家係開定關」，唔靠顏色分辨（色弱都睇得明）。
 */
function renderSfxToggle() {
  const off = isMuted();
  return `
    <button type="button" class="sfx-toggle${off ? " is-muted" : ""}" data-action="toggle-sfx"
      aria-pressed="${off ? "true" : "false"}" aria-label="${off ? "音效已關，撳一下開啟" : "音效已開，撳一下靜音"}">
      <span class="sfx-toggle-icon" aria-hidden="true">${off ? "🔇" : "🔊"}</span>
      <span class="sfx-toggle-text">${off ? "音效：關" : "音效：開"}</span>
    </button>`;
}

/**
 * 新手教學：一頁講清「出牌／擋／結束回合」三件事。
 * 只喺首局出現（見 `to-select` 判斷），睇完或跳過都會寫入 `hk_tutorial_seen`。
 *
 * 設計：唔用長文，用三張「牌」講三件事，每張一句港味 + 一句實際操作。
 * 全部內容同戰鬥頁真實 UI 對得上（能量／擋／結束回合），唔會教錯。
 */
function renderTutorial() {
  const steps = [
    {
      icon: "🃏",
      key: "出手",
      title: "揀張牌，撳落去",
      body: "手牌喺最底。撳一張就出手——攻擊打過去，技能留俾自己。",
      note: "每張牌左上角係費用，你要有咁多⚡先打得。",
    },
    {
      icon: "🛡",
      key: "擋",
      title: "擋住先，唔急",
      body: "有啲牌會畀你「擋」。對手回合幫你食傷，捱完就清。",
      note: "對手頭上寫住呢回合想打幾多——睇清再決定。",
    },
    {
      icon: "🔚",
      key: "結束回合",
      title: "冇牌打就收手",
      body: "撳「結束回合」，對手就出手。捱完之後再摸牌、回滿⚡。",
      note: "唔夠費用嘅牌打唔出，唔好死撳——留返下一回合。",
    },
  ];

  const cards = steps
    .map(
      (s, i) => `
      <li class="tut-step">
        <span class="tut-num" aria-hidden="true">${i + 1}</span>
        <div class="tut-body">
          <p class="tut-head">
            <span class="tut-icon" aria-hidden="true">${s.icon}</span>
            <strong class="tut-title">${escapeHtml(s.title)}</strong>
            <span class="tut-key">${escapeHtml(s.key)}</span>
          </p>
          <p class="tut-text">${escapeHtml(s.body)}</p>
          <p class="tut-note">${escapeHtml(s.note)}</p>
        </div>
      </li>`
    )
    .join("");

  return `
    <main class="screen screen-tutorial" aria-label="教學">
      <header class="brand-block brand-compact">
        <h1 class="brand">點玩？</h1>
        <p class="tagline">三樣識咗，條街就行得</p>
      </header>

      <section class="panel tut-panel">
        <p class="lede">呢條街唔會等人。學識呢三樣，你就唔會白死。</p>
        <ol class="tut-list">${cards}</ol>
      </section>

      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="finish-tutorial">明白，落場</button>
        <button type="button" class="btn btn-ghost btn-pressable" data-action="finish-tutorial">跳過教學</button>
      </div>
      <p class="foot-note">之後想再睇：設定頁清走本機進度</p>
    </main>
  `;
}

/**
 * 暫停頁：戰中／地圖共用。
 *
 * 兩件事要講清：
 *   1. **繼續**（返去原本畫面，乜都唔變）
 *   2. **返回標題**（呢一局即刻報銷）—— 所以要二次確認，並列出會丟失咩
 *
 * 刻意唔提供「自動續局」：本作冇存檔機制，講「可以續」就係呃人。
 * 所以文案直接寫「冇得續」，玩家自己決定走唔走。
 */
function renderPause() {
  const run = state.run;
  const s = pauseSummary(run, { totalNodes: currentMap().length });
  const confirming = state.pauseConfirm === "confirm";
  const fromBattle = state.pauseFrom === "battle";

  const items = s.ok
    ? `<ul class="pause-losses">${s.items.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
    : "";

  const confirmBlock = confirming
    ? `
      <div class="pause-confirm" role="alert">
        <p class="pause-confirm-title">返標題？而家會幫你存起呢一局。</p>
        <p class="pause-confirm-body">下次入遊戲撳「繼續」就返得嚟。想開新局先要蓋走存檔。</p>
        <div class="pause-confirm-actions">
          <button type="button" class="btn btn-danger btn-pressable" data-action="confirm-quit">係，返標題</button>
          <button type="button" class="btn btn-ghost btn-pressable" data-action="cancel-quit">唔好，繼續打</button>
        </div>
      </div>`
    : `
      <button type="button" class="btn btn-ghost btn-pressable pause-quit-btn" data-action="ask-quit"
        ${s.ok ? "" : "disabled"}>
        返回標題${s.ok ? "" : "（未有進行中嘅一局）"}
      </button>`;

  return `
    <main class="screen screen-pause" aria-label="停一停">
      <header class="brand-block brand-compact">
        <h1 class="brand">停一停</h1>
        <p class="tagline">${fromBattle ? "巷口交手 · 唞吓氣" : "地圖路邊 · 唞吓氣"}</p>
      </header>

      <section class="panel pause-panel">
        <h2>而家呢一鋪</h2>
        ${s.ok ? items : `<p class="lede">未有進行中嘅一局。</p>`}
        <p class="pause-warn">${escapeHtml(pauseLossLine(s))}</p>
      </section>

      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="resume">繼續行</button>
        ${confirmBlock}
        <button type="button" class="btn btn-ghost btn-pressable" data-action="to-settings">設定</button>
      </div>
    </main>
  `;
}

function renderSelect() {
  const selected = characterById(state.selectedCharId);  const list = [CHARACTERS.oil, CHARACTERS.asan, CHARACTERS.kauko, CHARACTERS.sing]
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
        <p class="tagline">四角開局 · 同一條後巷夜醒</p>
      </header>
      <section class="panel">
        <h2>揀邊個落場</h2>
        <ul class="char-list">${list}</ul>
        <p class="passive-box">
          <strong>打法・${escapeHtml(selected.playstyle || "")}</strong><br />
          被動「${escapeHtml(selected.passive.name)}」——${escapeHtml(selected.passive.desc)}
        </p>
        ${
          selected.rerunHook?.select
            ? `<p class="rerun-hook">「${escapeHtml(selected.rerunHook.select)}」</p>`
            : ""
        }
      </section>
      ${renderStarterPreview(selected)}
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="confirm-char">以${escapeHtml(selected.name)}開局</button>
        <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
      </div>
      ${renderSfxToggle()}
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
  if (node.type === "branch") {
    // Act3 硬路 enemyPool 可能抽到精英——地圖要標 ★，唔好淨係寫「分支」
    const opts = node.options || [];
    const hasElite = opts.some((o) =>
      (o.enemyPool || []).some((id) => enemyById(id)?.isElite)
    );
    if (hasElite) {
      return { key: "elite", icon: "★", label: "分支／精英", cls: "node-branch node-elite" };
    }
    return { key: "branch", icon: "⑂", label: "分支", cls: "node-branch" };
  }
  if (node.enemyPool) {
    return { key: "elite", icon: "★", label: "精英", cls: "node-elite" };
  }
  return { key: "battle", icon: "⚔", label: "戰鬥", cls: "" };
}

/** Act 銜接過場：打完本區 Boss，行去下一區之前嘅一句 */
function renderActTransition() {
  const t = state.actTransition;
  const act = state.run?.act || 2;
  const actName = actDisplayName(act);
  const char = activeChar();
  if (!t) return renderMap();
  return `
    <main class="screen screen-act-transition" aria-label="過場">
      <header class="brand-block brand-compact">
        <p class="eyebrow">Act${act}・${escapeHtml(actName)}</p>
        <h1 class="section-title">${escapeHtml(t.to)}</h1>
      </header>
      <section class="panel act-trans-panel">
        <p class="act-trans-from">由${escapeHtml(t.from)}行過嚟</p>
        <p class="act-trans-line">${escapeHtml(t.line)}</p>
        <p class="act-trans-note">「${escapeHtml(t.note)}」</p>
        <p class="run-inline">${escapeHtml(char.name)} · 血 ${state.run.hp}/${state.run.maxHp} · 袋口 ${state.run.deck.length} 張 · ${state.run.gold} 金</p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="continue-act">行入${escapeHtml(t.to)}</button>
      </div>
    </main>
  `;
}

/**
 * 地圖 HUD 遺物列：每件遺物一粒 chip，點一下講效果人話。
 * 專屬遺物加「專屬」標，一眼分到。
 */
function relicBar(run) {
  const ids = run?.relics || [];
  if (!ids.length) return "";
  const chips = ids
    .map((id) => {
      const r = RELICS[id];
      if (!r) return "";
      const isOwn = !!r.owner;
      // 別角專屬：標示「唔適用」，唔好令玩家以為有件貨但冇效果
      const notApplicable = isOwn && r.owner !== run?.characterId;
      const cls = notApplicable
        ? " is-other"
        : isOwn
          ? " is-owner"
          : "";
      const tag = notApplicable
        ? '<span class="relic-chip-tag is-other">唔適用</span>'
        : isOwn
          ? '<span class="relic-chip-tag">專屬</span>'
          : "";
      return `<button type="button" class="relic-chip${cls}"
        data-action="relic-info" data-relic="${escapeHtml(id)}"
        aria-label="${escapeHtml(r.name)}：${escapeHtml(relicPlainText(r))}">
        <span class="relic-chip-name">${escapeHtml(r.name)}</span>
        ${tag}
      </button>`;
    })
    .join("");
  return `<div class="relic-bar" role="group" aria-label="持有遺物">${chips}</div>`;
}

/** 遺物效果一句人話（唔用機械描述） */
function relicPlainText(r) {
  if (!r) return "";
  const e = r.effect || {};
  if (e.startEnergy) return `開閘多 ${e.startEnergy} 格氣——出手多一次。`;
  if (e.firstTurnEnergy) return `首回合多 ${e.firstTurnEnergy} 格氣——起手快一拍。`;
  if (e.startBlock) return `開波自帶 ${e.startBlock} 擋——第一下唔驚。`;
  if (e.startDraw) return `開波多摸 ${e.startDraw} 張——起手袋口厚。`;
  if (e.drawPerTurn) return `每回合多摸 ${e.drawPerTurn} 張——牌唔會斷。`;
  if (e.attackBonus) return `每記攻擊痛多 ${e.attackBonus}——拳頭有斤兩。`;
  if (e.attackPerCard) return `每張攻擊牌再加 ${e.attackPerCard} 傷——指節上鐵。`;
  if (e.healOnWin) return `打贏回 ${e.healOnWin} HP——唔使成日入士多。`;
  if (e.healOnWinBonus) return `勝場回血再多 ${e.healOnWinBonus} HP——甜品加成。`;
  if (e.goldBonus) return `打贏小怪多 ${e.goldBonus} 金——袋口積少成多。`;
  if (e.healBonusFirst) return `每場首次回血多 ${e.healBonusFirst} HP——一劑頂兩劑。`;
  if (e.instantMaxHp) return `入手即最大生命 +${e.instantMaxHp}——身子硬一截。`;
  if (e.instantGold) return `入手即多 ${e.instantGold} 金——庫銀落袋。`;
  return r.desc;
}

/** Act 內分支：二揀一，兩邊都必改局 */
function renderBranch() {
  const node = currentNode();
  const opts = node?.options || [];
  if (!opts.length) return renderMap();
  const char = activeChar();
  const act = state.run?.act || 1;
  // 三區分支 lede 唔共用「企喺巷口」——按場景換句
  const branchLede =
    act === 3
      ? `${char.name}企喺梯口，上頂定攀外牆——兩邊都唔會白行。`
      : act === 2
        ? `${char.name}企喺天橋底，前面兩條路——拆定兜，兩邊都改局。`
        : `${char.name}企喺鐵閘前，前面兩條路——頂硬定繞，兩邊都唔會白行。`;
  const cards = opts
    .map(
      (o) => `
      <button type="button" class="branch-choice" data-action="pick-branch" data-branch="${escapeHtml(o.id)}">
        <strong>${escapeHtml(o.label)}</strong>
        <span class="branch-effect">${escapeHtml(o.effectText)}</span>
      </button>`
    )
    .join("");
  return `
    <main class="screen" aria-label="分支">
      <header class="brand-block brand-compact">
        <h1 class="section-title">${escapeHtml(node.title || "兩條路")}</h1>
        <p class="tagline">行邊條路由你話事</p>
      </header>
      <section class="panel">
        <p class="lede">${escapeHtml(branchLede)}</p>
        <div class="branch-list">${cards}</div>
      </section>
    </main>
  `;
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
        ${current ? '<span class="map-cta">行入</span>' : ""}
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
        <button type="button" class="pause-btn" data-action="to-pause" aria-label="停一停">停一停<span class="pause-btn-icon" aria-hidden="true">❚❚</span></button>
        <div class="run-stats" role="group" aria-label="狀態">
          <span>HP ${run.hp}/${run.maxHp}</span>
          <span>金幣 ${run.gold}</span>
          <span>牌組 ${run.deck.length}</span>
          <span>遺物 ${(run.relics || []).length}</span>
        </div>
      </header>
      ${relicBar(run)}
      <ol class="act-strip" aria-label="三區進度">${actStrip}</ol>
      ${
        state.openingHint
          ? `<div class="opening-block">
        <p class="opening-line">${escapeHtml(state.statusMsg || "")}</p>
        <p class="opening-passive">${escapeHtml(state.openingHint)}</p>
      </div>`
          : state.statusMsg
            ? `<p class="status status-map" role="status">${escapeHtml(state.statusMsg)}</p>`
            : ""
      }
      <section class="panel map-panel">
        <h2>今晚路線</h2>
        <ol class="map-list">${nodes}</ol>
      </section>
      <p class="foot-note">打法「${escapeHtml(char.playstyle || char.passive.name)}」全程生效 · 被動「${escapeHtml(char.passive.name)}」</p>
    </main>
  `;
}

function renderBossGate() {
  const enemy = enemyById(state.pendingBossId || "E04");
  const isFinal = !!enemy.isFinalBoss;
  const isElite = !!enemy.isElite && !enemy.isBoss;
  const actName = actDisplayName(state.run?.act || 1);
  const eyebrow = isFinal
    ? `最終 Boss・Act${state.run?.act || 3} ${actName}`
    : isElite
      ? `精英遭遇・Act${state.run?.act || 3} ${actName}`
      : "區 Boss";
  const hint = isFinal
    ? "打完呢場，就係呢一鋪嘅結算。"
    : isElite
      ? "呢班人唔係普通雜魚——停一停，睇清楚先入場。"
      : "停一停，睇清楚對手先入場。";
  const cta = isFinal ? "落場" : isElite ? "硬上" : "繼續";
  const aria = isElite ? "精英戰前" : "Boss 戰前";
  return `
    <main class="screen screen-boss-gate${isFinal ? " is-final" : ""}${isElite ? " is-elite" : ""}" aria-label="${aria}">
      <header class="brand-block brand-compact">
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1 class="section-title">${escapeHtml(enemy.name)}</h1>
      </header>
      <figure class="boss-gate-art">
        <img src="${escapeHtml(enemy.art)}" alt="${escapeHtml(enemy.name)}" />
      </figure>
      <blockquote class="boss-gate-quote">「${escapeHtml(enemy.flavor)}」</blockquote>
      <p class="boss-gate-hint">${escapeHtml(hint)}</p>
      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="boss-continue">${escapeHtml(cta)}</button>
      </div>
    </main>
  `;
}

/** 被動觸發時，HUD 短標閃一下（配合跳字／banner） */
function flashPassiveChip() {
  const chip = document.querySelector(".passive-chip");
  if (!chip) return;
  chip.classList.remove("is-flash");
  void chip.offsetWidth;
  chip.classList.add("is-flash");
  setTimeout(() => chip.classList.remove("is-flash"), 600);
}

/** 意圖圖示：一眼分到攻／擋／強化／削弱 */
function intentIcon(kind) {
  switch (kind) {
    case "attack":
      return "⚔";
    case "block":
      return "🛡";
    case "buff_attack":
    case "buff":
      return "↑";
    case "weaken":
      return "↓";
    default:
      return "•";
  }
}

/** 意圖分類短語（港味） */
function intentKindText(kind) {
  switch (kind) {
    case "attack":
      return "準備出手";
    case "block":
      return "守緊";
    case "buff_attack":
    case "buff":
      return "蓄勢";
    case "weaken":
      return "出陰招";
    default:
      return "未知";
  }
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

  // 戰後一句：所有敵人都可以有（Boss 用 .boss-afterword，普通戰用同一 class 唔影響版面）
  const bossAfterword =
    b.over === "win" && b.afterword
      ? `<blockquote class="boss-afterword">「${escapeHtml(b.afterword)}」</blockquote>`
      : "";

  const readyHint =
    b.kuaisouReady
      ? " · 快手就緒——下一記平一費"
      : b.passiveId === "dangkou" && !b.dangkouUsed
        ? " · 檔口待命——捱打下先觸"
        : b.passiveId === "zhaopaiyan"
          ? b.zhaopaiyanUsed
            ? " · 招牌眼已亮——抽過"
            : " · 招牌眼待命——首次技能抽"
          : b.passiveId === "seotong"
            ? b.seotongUsed
              ? " · 跌打已用——回過"
              : " · 跌打待命——首次技能回"
            : "";

  // HUD 被動短標：一眼見到自己被動叫咩、狀態係待命／就緒／用過
  const passiveChip = (() => {
    const name = b.passiveName || "";
    if (!name) return "";
    let state = "idle";
    let stateText = "待命";
    if (b.passiveId === "kuaisou") {
      if (b.kuaisouReady) {
        state = "ready";
        stateText = "就緒";
      } else {
        stateText = `${b.attacksPlayed % 3}/3`;
      }
    } else if (b.passiveId === "dangkou") {
      if (b.dangkouUsed) {
        state = "used";
        stateText = "用過";
      }
    } else if (b.passiveId === "zhaopaiyan") {
      if (b.zhaopaiyanUsed) {
        state = "used";
        stateText = "已亮";
      }
    } else if (b.passiveId === "seotong") {
      if (b.seotongUsed) {
        state = "used";
        stateText = "用過";
      }
    }
    return `<span class="passive-chip passive-chip--${b.passiveId} is-${state}">
      <span class="passive-chip-name">${escapeHtml(name)}</span>
      <span class="passive-chip-state">${escapeHtml(stateText)}</span>
    </span>`;
  })();

  return `
    <main class="screen screen-battle${state.busy ? " is-busy" : ""}" aria-label="戰鬥">
      <header class="battle-top">
        <div class="fighter enemy" id="fighter-enemy">
          <img id="enemy-portrait" src="${escapeHtml(b.enemyArt)}" alt="${escapeHtml(b.enemyName)}" />
          <div class="fighter-meta">
            <strong>${escapeHtml(b.enemyName)}${b.isFinalBoss ? " · 最終 Boss" : b.isBoss ? " · Boss" : ""}</strong>
            <div class="hp-bar"><span id="enemy-hp-fill" style="width:${Math.max(0, (b.enemyHp / b.enemyMaxHp) * 100)}%"></span></div>
            <span class="hp-text" id="enemy-hp-text">${b.enemyHp}/${b.enemyMaxHp}${b.enemyBlock ? ` · 盾 ${b.enemyBlock}` : ""}</span>
            <span class="intent intent--${intent.kind}" id="enemy-intent" title="${escapeHtml(intentKindText(intent.kind))}">
              <span class="intent-icon" aria-hidden="true">${intentIcon(intent.kind)}</span>
              <span class="intent-kind">${intentKindText(intent.kind)}</span>
              <span class="intent-label">${escapeHtml(intent.label)}</span>
            </span>
            ${
              b.enemyFlavor && b.turn <= 1 && !b.over
                ? `<p class="enemy-flavor-line" id="enemy-flavor">「${escapeHtml(b.enemyFlavor)}」</p>`
                : ""
            }
          </div>
        </div>
        <div class="fighter player" id="fighter-player">
          <div class="fighter-meta">
            <strong id="player-anchor">${escapeHtml(char.name)}</strong>
            <span class="battle-route">${escapeHtml(char.route || "")}</span>
            ${passiveChip}
            <div class="hp-bar player"><span id="player-hp-fill" style="width:${Math.max(0, (b.playerHp / b.playerMaxHp) * 100)}%"></span></div>
            <span class="hp-text" id="player-hp-text">${b.playerHp}/${b.playerMaxHp}</span>
            <div class="stat-row">
              <span class="stat-pill stat-energy${b.energy === 0 ? " is-empty" : ""}" id="player-energy">
                <span class="stat-icon" aria-hidden="true">⚡</span>
                <strong class="stat-num">${b.energy}</strong>
                <span class="stat-max">/${b.maxEnergy}</span>
              </span>
              <span class="stat-pill stat-block${b.playerBlock > 0 ? " is-on" : " is-off"}" id="player-block">
                <span class="stat-icon" aria-hidden="true">🛡</span>
                <strong class="stat-num">${b.playerBlock}</strong>
                <span class="stat-max">擋</span>
              </span>
            </div>
            ${readyHint ? `<span class="energy-hint">${escapeHtml(readyHint.replace(/^ · /, ""))}</span>` : ""}
          </div>
        </div>
      </header>
      ${overBanner}
      ${bossAfterword}
      <div class="pile-row" role="group" aria-label="牌堆">
        <span class="pile-pill pile-draw" id="pile-draw">
          <span class="pile-icon" aria-hidden="true">🂠</span>
          <span class="pile-label">牌庫</span>
          <strong class="pile-num">${b.drawPile.length}</strong>
        </span>
        <span class="pile-pill pile-discard" id="pile-discard">
          <span class="pile-icon" aria-hidden="true">♻</span>
          <span class="pile-label">棄牌</span>
          <strong class="pile-num">${b.discard.length}</strong>
        </span>
        <span class="pile-pill pile-hand">
          <span class="pile-icon" aria-hidden="true">✋</span>
          <span class="pile-label">手牌</span>
          <strong class="pile-num">${b.hand.length}</strong>
        </span>
        <button type="button" class="pile-pill pile-deck-btn" data-action="toggle-deck"
          aria-expanded="${state.deckOpen ? "true" : "false"}" aria-label="睇成副牌組">
          <span class="pile-icon" aria-hidden="true">📚</span>
          <span class="pile-label">牌組</span>
          <strong class="pile-num">${battleDeckIds(b).length}</strong>
        </button>
      </div>
      ${
        state.deckOpen
          ? `<section class="panel deck-panel deck-panel--battle">
              <h2>成副牌組</h2>
              ${renderDeckPreview(battleDeckIds(b))}
              <button type="button" class="btn btn-ghost btn-pressable deck-toggle" data-action="toggle-deck">收起牌組</button>
            </section>`
          : ""
      }
      <div class="hand" role="list" aria-label="手牌（可左右滑）">${hand || '<p class="empty-hand">沒有手牌</p>'}</div>
      <div class="battle-actions">
        ${
          b.over === "win"
            ? `<button type="button" class="btn btn-primary btn-pressable" data-action="battle-win">收取戰果</button>`
            : b.over === "lose"
              ? `<button type="button" class="btn btn-primary btn-pressable" data-action="to-defeat">結算</button>`
              : `<button type="button" class="btn btn-ghost" data-action="end-turn" ${state.busy ? "disabled" : ""}>結束回合</button>`
        }
        <button type="button" class="pause-btn pause-btn--battle" data-action="to-pause" aria-label="停一停">停一停<span class="pause-btn-icon" aria-hidden="true">❚❚</span></button>
      </div>
      <ul class="battle-log" aria-live="polite">
        ${b.log.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
      </ul>
      ${renderSfxToggle()}
    </main>
  `;
}

/** 選牌後一句人話：講清呢張牌實際幫到你咩 */
function pickFeedback(card) {
  if (!card) return "執咗入袋——街口多一隻手牌。";
  const name = card.name;
  if (card.dmg && card.dmg >= 12) {
    return `執咗「${name}」——重手一記，鐵閘都震。`;
  }
  if (card.dmg && card.draw) {
    return `執咗「${name}」——打得又摸得，牌唔會斷。`;
  }
  if (card.dmg) {
    return `執咗「${name}」——多一隻出擊，唔使淨靠起手。`;
  }
  if (card.block && card.heal) {
    return `執咗「${name}」——擋得又補得，捱夜更穩。`;
  }
  if (card.block) {
    return `執咗「${name}」——多一層擋，命硬啲。`;
  }
  if (card.heal) {
    return `執咗「${name}」——有得補血，唔使咁快落街。`;
  }
  if (card.draw) {
    return `執咗「${name}」——袋口多摸，牌路順啲。`;
  }
  return `執咗「${name}」——袋口厚一分，街口好行啲。`;
}

function renderReward() {
  const act = state.run?.act || 1;
  const rewardTitle =
    act === 3 ? "水塔邊三揀一" : act === 2 ? "夜檔尾三揀一" : "巷口三揀一";
  const rewardTag =
    act === 3
      ? `天台風大 · 揀一張入袋 · 金幣 ${state.run.gold}`
      : act === 2
        ? `霓虹未熄 · 揀一張入袋 · 金幣 ${state.run.gold}`
        : `雨未停 · 揀一張入袋 · 金幣 ${state.run.gold}`;
  const choices = state.rewardChoices
    .map((id) => {
      const card = cardById(id);
      return `
        <div class="reward-cell">
          ${renderCardFace(id, { pickId: id })}
          <p class="reward-why">${escapeHtml(pickFeedback(card).replace(/^執咗「.*?」——/, ""))}</p>
        </div>`;
    })
    .join("");
  return `
    <main class="screen screen-wide" aria-label="選牌">
      <header class="brand-block brand-compact">
        <h1 class="section-title">${escapeHtml(rewardTitle)}</h1>
        <p class="tagline">${escapeHtml(rewardTag)}</p>
      </header>
      <div class="reward-grid">${choices}</div>
      <div class="actions">
        <button type="button" class="btn btn-ghost" data-action="skip-reward">唔執（跳過）</button>
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
          ${
            state.eventChoiceLabel
              ? `<p class="event-picked"><span>你揀咗</span><strong>${escapeHtml(state.eventChoiceLabel)}</strong></p>`
              : ""
          }
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
  // 事件頁眉：唔再用「短事件／機械效果」系統腔；按區換港味副句
  const act = state.run?.act || 1;
  const eventTagline =
    act === 3
      ? "天台一事 · 點揀都會改局"
      : act === 2
        ? "霓虹底一事 · 點揀都會改局"
        : "巷口一事 · 點揀都會改局";
  return `
    <main class="screen" aria-label="事件">
      <header class="brand-block brand-compact">
        <h1 class="section-title">${escapeHtml(ev.title)}</h1>
        <p class="tagline">${escapeHtml(eventTagline)}</p>
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
  const act = state.run.act || 1;
  const flavor = restShopForAct(act);
  const cardId = shopCardIdForAct(act);
  const canHealBuy = has(SHOP.healCost);
  const canCardBuy = has(SHOP.cardCost);
  const canRelicBuy = has(SHOP.relicCost) && state.shopRelics.length > 0;
  const canPackBuy = has(SHOP.packCost);
  const canReroll = has(SHOP.rerollCost) && state.shopRelics.length > 0;
  const shopCard = cardById(cardId);
  const node = currentNode();
  const restTitle =
    node?.title ||
    (act === 3 ? "天台搭棚歇腳" : act === 2 ? "通宵便利店" : "簷篷底歇腳");
  const restSub = flavor.subtitle;
  const penalty = state.run.nextBattleEnergyPenalty || 0;
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
          <span>${escapeHtml(r.flavor || r.desc)} · 花 ${SHOP.relicCost}（${escapeHtml(r.desc)}）${canRelicBuy ? "" : "（金幣不足）"}</span>
        </button>`
    )
    .join("");
  // 消耗品貨架（每局洗一次，一定有 1 件）——主句用 flavor，機械 desc 留括號
  const consumableStock = (state.shopConsumables || [])
    .map((id) => CONSUMABLES[id])
    .filter(Boolean)
    .map((c) => {
      const affordable = has(c.price);
      return `
        <button type="button" class="event-choice${affordable ? "" : " is-disabled"}" data-action="buy-consumable" data-consumable="${escapeHtml(c.id)}" ${affordable ? "" : "disabled"}>
          <strong>${escapeHtml(c.name)}<span class="relic-rarity">消耗</span></strong>
          <span>${escapeHtml(c.flavor || c.desc)} · 花 ${c.price}（${escapeHtml(c.desc)}）${affordable ? "" : "（金幣不足）"}</span>
        </button>`;
    })
    .join("");
  const relicSell = ownedRelics
    .map(
      (r) => `
        <button type="button" class="event-choice is-sell" data-action="sell-relic" data-relic="${escapeHtml(r.id)}">
          <strong>賣・${escapeHtml(r.name)}</strong>
          <span>+${SHOP.sellRelicGain} 金幣 · ${escapeHtml(r.flavor || r.desc)}</span>
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
        <p class="lede">現時 HP ${state.run.hp}/${state.run.maxHp} · 金幣 ${state.run.gold} · 牌組 ${state.run.deck.length}。揀一項：</p>
        <div class="event-choices">
          <button type="button" class="event-choice" data-action="rest-heal">
            <strong>${escapeHtml(flavor.restHealLabel)}</strong>
            <span>${escapeHtml(flavor.restHealDesc(healAmt))}</span>
          </button>
          <button type="button" class="event-choice" data-action="rest-upgrade">
            <strong>${escapeHtml(flavor.restUpgradeLabel)}</strong>
            <span>${escapeHtml(flavor.restUpgradeDesc)}</span>
          </button>
          <button type="button" class="event-choice" data-action="rest-cleanse">
            <strong>${escapeHtml(flavor.restCleanseLabel)}</strong>
            <span>${escapeHtml(
              penalty > 0 ? flavor.restCleanseClear(penalty) : flavor.restCleansePlain
            )}</span>
          </button>
          <button type="button" class="event-choice${canHealBuy ? "" : " is-disabled"}" data-action="shop-heal" ${canHealBuy ? "" : "disabled"}>
            <strong>${escapeHtml(flavor.shopHealLabel)}</strong>
            <span>${escapeHtml(flavor.shopHealDesc)}${canHealBuy ? "" : "（金幣不足）"}</span>
          </button>
          <button type="button" class="event-choice${canCardBuy ? "" : " is-disabled"}" data-action="shop-card" ${canCardBuy ? "" : "disabled"}>
            <strong>${escapeHtml(flavor.shopCardLabel)}</strong>
            <span>花 ${SHOP.cardCost} 金幣入手「${escapeHtml(shopCard?.name ?? cardId)}」${canCardBuy ? "" : "（金幣不足）"}</span>
          </button>
          <button type="button" class="event-choice${canPackBuy ? "" : " is-disabled"}" data-action="shop-pack" ${canPackBuy ? "" : "disabled"}>
            <strong>${escapeHtml(flavor.shopPackLabel)}</strong>
            <span>${escapeHtml(flavor.shopPackDesc)}${canPackBuy ? "" : "（金幣不足）"}</span>
          </button>
        </div>
        ${state.shopMsg ? `<p class="status" role="status">${escapeHtml(state.shopMsg)}</p>` : ""}
      </section>

      ${
        consumableStock
          ? `<section class="panel panel-shop">
        <h2>${escapeHtml(flavor.consumableTitle)}</h2>
        <div class="event-choices">${consumableStock}</div>
      </section>`
          : ""
      }

      ${
        relicStock || ownedRelics.length
          ? `<section class="panel panel-shop">
        <h2>${escapeHtml(flavor.relicTitle)}</h2>
        <div class="event-choices">${relicStock || `<p class="lede">${escapeHtml(flavor.shopRerollEmpty)}</p>`}</div>
        ${
          state.shopRelics.length
            ? `<button type="button" class="event-choice is-sell${canReroll ? "" : " is-disabled"}" data-action="shop-reroll" ${canReroll ? "" : "disabled"}>
            <strong>${escapeHtml(flavor.shopRerollLabel)}</strong>
            <span>${escapeHtml(flavor.shopRerollDesc)}${canReroll ? "" : "（金幣不足）"}</span>
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
        <h2>${escapeHtml(flavor.sellTitle)}</h2>
        <div class="event-choices">${sellableCards}</div>
      </section>`
          : ""
      }

      <div class="actions">
        <button type="button" class="btn btn-primary btn-pressable" data-action="leave-shop">${escapeHtml(flavor.leaveLabel)}</button>
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
/** 通關結算「本局關鍵」一句：金幣／遺物／主路線，用港味串起 */
function runKeyLine(run, char) {
  const gold = run?.gold || 0;
  const relics = (run?.relics || []).length;
  const route = char?.route || "";
  const parts = [];

  // 金幣：分三檔
  if (gold >= 40) parts.push(`袋住 ${gold} 個大洋`);
  else if (gold >= 15) parts.push(`剩 ${gold} 個大洋`);
  else parts.push(`金幣使剩 ${gold}`);

  // 遺物
  if (relics >= 5) parts.push(`孭住 ${relics} 件貨`);
  else if (relics >= 2) parts.push(`${relics} 件遺物傍身`);
  else if (relics === 1) parts.push("只得一件遺物");
  else parts.push("一件遺物都冇攞");

  // 主路線
  if (route) parts.push(`行${route}條路`);

  return `${parts.join("，")}——三區都行晒。`;
}

function renderVictory() {
  const run = state.run || { deck: [], hp: 0, maxHp: 0, gold: 0, encounters: [] };
  const char = activeChar();
  state._resultBarSub = `通關 · ${char.route || "三區打穿"} · 再開一局`;
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
        <p class="tagline result-sub">通關 · 三區打穿——街口記得你</p>
      </header>
      <section class="panel clear-hero">
        <p class="clear-badge">★ 通關 · 三區打穿 · 仲企得住 ★</p>
        <p class="eyebrow">Act3・${escapeHtml(META.act3Name)}</p>
        <h2>天台無燈，你仲企得住</h2>
        <p class="lede">
          ${escapeHtml(char.name)}喺「籠門之王」籠邊站到最後。<br />
          被動「${escapeHtml(char.passive.name)}」由後巷一路帶到天台。
        </p>
        ${
          char.clearSummary
            ? `<p class="clear-summary">「${escapeHtml(char.clearSummary)}」</p>`
            : ""
        }
        ${
          char.rerunHook?.clear
            ? `<p class="rerun-hook">「${escapeHtml(char.rerunHook.clear)}」</p>`
            : ""
        }
        <ul class="clear-stats">
          <li><span>剩血</span><strong>${run.hp}/${run.maxHp}</strong></li>
          <li><span>袋口大洋</span><strong>${run.gold}</strong></li>
          <li><span>袋口牌</span><strong>${run.deck.length} 張</strong></li>
          <li><span>身家遺物</span><strong>${(run.relics || []).length} 件</strong></li>
          <li><span>勝場</span><strong>${run.victories || 0}</strong></li>
          <li><span>主路線</span><strong>${escapeHtml(char.route || "—")}</strong></li>
        </ul>
        <p class="clear-keys">
          <span class="clear-keys-label">本局關鍵——街口記住</span>
          <span class="clear-keys-line">${escapeHtml(runKeyLine(run, char))}</span>
        </p>
        <div class="next-run next-run-clear">
          <p class="next-run-title">再開一局——街口唔會停</p>
          <ul class="next-run-list">
            <li><strong>同路線：</strong>繼續行「${escapeHtml(char.route || "")}」——${escapeHtml(char.playstyle || "")}</li>
            <li><strong>換口味：</strong>試吓其他三角色／勝仔，睇邊條路更啱你。</li>
          </ul>
        </div>
      </section>
      ${
        // 次要資料收埋：主掣先可見，玩家想睇細節自己展開
        `<details class="result-details">
              <summary class="result-details-summary">睇本局細節（遺物／遭遇／牌組／名片）</summary>
              <div class="result-details-body">
                ${
                  (run.relics || []).length
                    ? `<section class="panel">
                        <h2>遺物</h2>
                        <ul class="relic-list">${(run.relics || [])
                          .map((id) => {
                            const r = RELICS[id];
                            if (!r) return "";
                            const isOwn = !!r.owner;
                            const notApplicable = isOwn && r.owner !== run?.characterId;
                            const tag = notApplicable
                              ? '<span class="relic-owner-tag is-other">唔適用</span>'
                              : isOwn
                                ? '<span class="relic-owner-tag">專屬</span>'
                                : "";
                            return `<li>
                              <span class="relic-name">${escapeHtml(r.name)}${tag}</span>
                              <span class="relic-plain">${escapeHtml(relicPlainText(r))}</span>
                            </li>`;
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
              </div>
            </details>`
      }
      ${renderDailyReward()}
    </main>
  `;
}

/** 近失種類人話標籤（結算一眼明） */
const NEAR_MISS_LABELS = {
  boss: "差喺 Boss 門口",
  hp: "差喺血量——補早啲",
  energy: "差喺能量——格氣唔夠",
  deck: "差喺牌組——袋口太薄",
  relic: "差喺遺物——身家少",
};

/**
 * 下一鋪建議：按呢局死因，講清可以點換角／換构筑。
 * 港味 + 具體（唔係空泛「再試一次」）。
 */
function nextRunAdvice(near) {
  const char = activeChar();
  const others = ["oil", "asan", "kauko", "sing"].filter((id) => id !== char.id);
  // 推薦一個對應死因嘅角色（含勝仔回血線）
  const suggestByKind = {
    hp: char.id === "asan" ? "sing" : "asan", // 血唔夠 → 守／回血
    energy: "kauko",
    deck: "kauko",
    relic: "asan",
    boss: others.includes("sing") ? "sing" : others[0],
  };
  const targetId = suggestByKind[near.kind] || others[0];
  const target = CHARACTERS[targetId] || CHARACTERS.oil;

  const buildHint = {
    hp: "下次早啲入士多補血／飲廿四味，或者袋多幾張擋同回血。",
    energy: "下次入士多執「提神能量飲品」，或者袋多幾張 0 費牌。",
    deck: "下次戰後唔好跳過選牌——袋口夠厚先撐到尾。",
    relic: "下次記得行士多——身家遺物白賺，專屬貨只對自己有效。",
    boss: "下次見 Boss 之前留爆發牌；勝仔回血線更捱得。",
  };

  return {
    targetId,
    targetName: target.name,
    targetRoute: target.route || "",
    line: buildHint[near.kind] || "下次換個打法——街口唔認第二次。",
    barSub: `${NEAR_MISS_LABELS[near.kind] || "差一點"} · 換角或換牌路再出街`,
  };
}

function renderDefeat() {
  const char = activeChar();
  const run = state.run || {};
  const map = currentMap();
  const act = run.act || 1;
  const actTitles = {
    1: "後巷吞沒你",
    2: "霓虹吞沒你",
    3: "天台吞沒你",
  };
  const near = nearMissInfo();
  const advice = nextRunAdvice(near);
  const nodeN = Math.min((run.mapIndex || 0) + 1, map.length);
  const b = state.battle;
  const enemyLine = b
    ? `${b.enemyName} ${b.enemyHp}/${b.enemyMaxHp}`
    : "—";
  // 畀 render() 用動態底欄副標
  state._resultBarSub = advice.barSub;
  return `
    <main class="screen screen-result is-lose" aria-label="敗北">
      <header class="brand-block">
        <h1 class="brand result-title dim">${escapeHtml(META.title)}</h1>
        <p class="tagline result-sub">仆街 · Act${act}・第 ${nodeN}/${map.length} 格</p>
      </header>
      <section class="panel">
        <h2>${escapeHtml(actTitles[act] || actTitles[1])}</h2>
        <p class="near-miss" data-near-kind="${escapeHtml(near.kind)}">
          <strong>${escapeHtml(NEAR_MISS_LABELS[near.kind] || "差一點")}</strong>
          <span>${escapeHtml(near.text)}</span>
        </p>
        <ul class="clear-stats near-miss-stats" aria-label="本局尾聲數字">
          <li><span>你嘅 HP</span><strong>${run.hp || 0}/${run.maxHp || 0}</strong></li>
          <li><span>對手</span><strong>${escapeHtml(enemyLine)}</strong></li>
          <li><span>牌組</span><strong>${(run.deck || []).length} 張</strong></li>
          <li><span>遺物</span><strong>${(run.relics || []).length} 件</strong></li>
          <li><span>金幣</span><strong>${run.gold || 0}</strong></li>
          <li><span>能量（終局）</span><strong>${b ? b.energy : "—"}</strong></li>
        </ul>
        <p class="lede">
          呢鋪完。行到「${escapeHtml(actDisplayName(act))}」第 ${nodeN} 格就企唔穩。
        </p>
        <div class="next-run">
          <p class="next-run-title">再開一局 · 可以咁試</p>
          <ul class="next-run-list">
            <li><strong>換牌路：</strong>${escapeHtml(advice.line)}</li>
            <li><strong>換角色：</strong>試吓「${escapeHtml(advice.targetName)}」——${escapeHtml(advice.targetRoute)}。${escapeHtml(CHARACTERS[advice.targetId]?.playstyle || "")}</li>
            <li><strong>唔換都得：</strong>用返「${escapeHtml(char.passive.name)}」（${escapeHtml(char.route || "")}），今次行遠啲。</li>
          </ul>
        </div>
        ${
          char.rerunHook?.defeat
            ? `<p class="rerun-hook">「${escapeHtml(char.rerunHook.defeat)}」</p>`
            : ""
        }
      </section>
      ${renderDailyReward()}
    </main>
  `;
}

/**
 * 結算頁底部固定欄（再來一局／返回標題）。
 *
 * 點解要獨立掛 body：`.screen-result.is-lose` 有 `filter`、`.is-win` 有
 * `animation`，兩者都會令 `position: fixed` 改以該元素為包含塊，
 * 底欄就唔會貼住視口（實測 bottom 854 > 844）。掛 body 就冇呢個問題。
 */
function renderResultBar(subText) {
  const existing = document.getElementById("result-bar");
  // 已存在就只更新副標文字，唔重建（避免每次 render 都整走焦點／重播動畫）
  if (existing) {
    const sub = existing.querySelector(".btn-rerun-sub");
    if (sub && sub.textContent !== subText) sub.textContent = subText;
    return;
  }
  const wrap = document.createElement("div");
  wrap.id = "result-bar";
  wrap.innerHTML = `
    <div class="result-bar">
      <button type="button" class="btn btn-primary btn-pressable btn-rerun" data-action="again">
        <span class="btn-rerun-main">再來一局</span>
        <span class="btn-rerun-sub">${escapeHtml(subText)}</span>
      </button>
      <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
    </div>`;
  document.body.appendChild(wrap);
  // 底欄喺 body，click 要喺 document 層接
  wrap.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    onClick(event);
  });
}

/** 離開結算頁就拆走底欄 */
function clearResultBar() {
  const el = document.getElementById("result-bar");
  if (el) el.remove();
}

/** 敗北畫面用嘅「就差咁一點」診斷：指出差喺血／牌／遺物／能量邊一項 */
function nearMissInfo() {
  const run = state.run || {};
  const b = state.battle;
  const char = activeChar();
  const pack = (kind, text) => ({
    kind,
    label: NEAR_MISS_LABELS[kind] || "差一點",
    text,
  });

  // 0) 敗給 Boss／精英：用專屬港味 nearMiss（最優先）
  if (b && (b.isBoss || b.isElite)) {
    const bossDef = enemyById(b.enemyId);
    if (bossDef?.nearMiss) {
      const pct =
        b.enemyMaxHp > 0 ? Math.round((b.enemyHp / b.enemyMaxHp) * 100) : 0;
      const hpNote =
        b.enemyHp > 0
          ? ` 對手仲有 ${b.enemyHp}/${b.enemyMaxHp}（${pct}%）——就差呢截。`
          : "";
      return pack("boss", `${bossDef.nearMiss}${hpNote}`);
    }
  }

  // 1) 差喺血：對手殘血未死
  if (b && b.enemyHp > 0 && b.enemyMaxHp > 0) {
    const pct = b.enemyHp / b.enemyMaxHp;
    if (pct <= 0.25) {
      return pack(
        "hp",
        `${b.enemyName} 得返 ${b.enemyHp}/${b.enemyMaxHp} 血（${Math.round(pct * 100)}%）。再多一擊，就係你企喺度。`
      );
    }
  }

  // 2) 差喺能量：手牌仍然有牌，但出唔到
  if (b && Array.isArray(b.hand) && b.hand.length > 0 && b.energy === 0) {
    const playable = b.hand.filter((id) => {
      const c = cardById(id);
      return c && (c.cost || 0) === 0;
    });
    if (playable.length === 0) {
      const costs = b.hand
        .map((id) => cardById(id)?.cost)
        .filter((n) => typeof n === "number");
      const minCost = costs.length ? Math.min(...costs) : "?";
      return pack(
        "energy",
        `手牌仲有 ${b.hand.length} 張，能量 0；最平都要 ${minCost} 費。差嗰一點能量。`
      );
    }
  }

  // 3) 差喺牌：牌組太薄
  if ((run.deck || []).length <= 11) {
    return pack(
      "deck",
      `牌組只得 ${(run.deck || []).length} 張（建議 ≥12）。抽到後段已經冇牌接力。`
    );
  }

  // 4) 差喺遺物：一件都冇／只得一件
  const relicCount = (run.relics || []).length;
  if (relicCount <= 1) {
    return pack(
      "relic",
      relicCount === 0
        ? "全場一件遺物都冇攞——士多行少咗轉，白賺嘅貨冇入袋。"
        : "全場只得一件遺物，差多一件就撐得住。"
    );
  }

  // 5) 兜底：差喺血（自己）
  const hp = run.hp || 0;
  const maxHp = run.maxHp || 1;
  return pack(
    "hp",
    `${char.name} 頂到最後得返 ${hp}/${maxHp}。下一局留返一口氣，早啲補血。`
  );
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
    return `你行出士多，風一吹先發覺——得返 ${hp}/${maxHp}。下次早啲補血。`;
  }
  // 有遺物：講返件貨
  if (relicCount > 0) {
    return `袋住 ${relicCount} 件身家行出去，老闆喺後面嗌：「記得返嚟呀。」`;
  }
  // 金多：講錢
  if (gold >= 30) {
    return `袋住 ${gold} 個大洋走——呢條街，有錢就有底氣。`;
  }
  // 兜底
  return "兩手空空行出士多，但至少抖順咗一口氣。";
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
    case "act-transition":
      html = renderActTransition();
      break;
    case "branch":
      html = renderBranch();
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
    case "settings":
      html = renderSettings();
      break;
    case "tutorial":
      html = renderTutorial();
      break;
    case "pause":
      html = renderPause();
      break;
    default:
      html = renderTitle();
  }
  patchScreen(html);
  applyActBackdrop();
  flushGoldFloat();
  flushRunDeltas();
  flushTurnLine();
  // 每次畫面更新都自動存一次（有 run 才存）
  autoSave();
  // 卡牌詳情彈層：獨立掛喺 body，唔受 patchScreen 影響
  renderCardDetail();
  // 結算頁底欄：獨立掛 body（見 renderResultBar 註解）
  if (state.screen === "victory") {
    const char = activeChar();
    renderResultBar(
      state._resultBarSub ||
        `通關 · ${char?.route || "再闖"} · 再開一局`
    );
  } else if (state.screen === "defeat") {
    renderResultBar(
      state._resultBarSub || "同一條後巷，唔同嘅打法"
    );
  } else {
    state._resultBarSub = "";
    clearResultBar();
  }
}

/**
 * 卡牌詳情彈層（長按卡觸發）。
 *
 * 掛喺 body 而唔係 `.screen` 入面，原因有兩個：
 *   1. `patchScreen` 只換 `.screen` 內部內容，放喺入面會被重繪沖走
 *   2. 彈層要蓋住成個 viewport（`position: fixed`），唔應該受 screen 寬度限制
 *
 * 因為掛喺 body，而 `onClick` 只綁喺 `#app`，所以關閉要靠獨立嘅 document 監聽
 * （見下面 `bindCardDetailEvents`）。
 */
function renderCardDetail() {
  const existing = document.getElementById("card-detail-overlay");
  const id = state.cardDetailId;
  if (!id) {
    if (existing) existing.remove();
    return;
  }
  const card = cardById(id);
  const d = cardDetail(card);
  const html = `
    <div class="card-detail" role="dialog" aria-modal="true" aria-label="${escapeHtml(d.name)} 詳情">
      <div class="card-detail-box">
        <p class="card-detail-top">
          <span class="card-detail-cost">${d.cost}</span>
          <span class="card-detail-name">${escapeHtml(d.name)}</span>
          <span class="card-detail-meta">${escapeHtml(d.typeLabel)}・${escapeHtml(d.rarity)}</span>
        </p>
        <ul class="card-detail-lines">
          ${d.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}
        </ul>
        ${d.whenToUse ? `<p class="card-detail-when">${escapeHtml(d.whenToUse)}</p>` : ""}
        ${d.blurb ? `<p class="card-detail-blurb">「${escapeHtml(d.blurb)}」</p>` : ""}
        <button type="button" class="btn btn-primary btn-pressable card-detail-close" data-action="close-card-detail">知道</button>
      </div>
    </div>`;
  if (existing) {
    existing.outerHTML = html;
  } else {
    const wrap = document.createElement("div");
    wrap.id = "card-detail-overlay";
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
  }
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
  // 金幣音：入袋先響（扣錢唔響，免得誤導）
  if (pending > 0) sfx.coin();
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
    // 唔夠費：卡面震一下 + 跳字 + 能量欄閃紅，唔好靜靜點唔到
    state.statusMsg = `格氣唔夠——要 ${cost}，得 ${b.energy}`;
    if (cardEl) {
      cardEl.classList.remove("is-shake-no");
      void cardEl.offsetWidth;
      cardEl.classList.add("is-shake-no");
      setTimeout(() => cardEl.classList.remove("is-shake-no"), 420);
      floatText(cardEl, `要 ${cost} 能量`, "low-energy");
    }
    const energyEl = document.getElementById("player-energy");
    if (energyEl) {
      energyEl.classList.remove("is-bump");
      void energyEl.offsetWidth;
      energyEl.classList.add("is-bump");
      setTimeout(() => energyEl.classList.remove("is-bump"), 460);
    }
    state.pendingTurnLine = `能量唔夠——呢張要 ${cost}，你仲有 ${b.energy}。`;
    flushTurnLine();
    sfx.click();
    return;
  }

  state.busy = true;
  const from = cardEl.getBoundingClientRect();
  // 出牌音：同按卡動畫同步（唔等飛軌，令手上一撳就有聲）
  sfx.card();
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
      flashPassiveChip();
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

  // 抽牌跳字：任何卡（攻擊或技能）有抽牌都要見到，唔止被動觸發先有
  if (result.drew > 0) {
    floatText(
      document.getElementById("player-anchor"),
      `抽 +${result.drew}`,
      "zhaopaiyan"
    );
  }

  if (result.kuaisouArmed) {
    showPassiveBanner("快手！", "kuaisou");
    sfx.kuaisou();
    floatText(document.getElementById("player-anchor"), "快手！−1／+3", "kuaisou");
    flashPassiveChip();
    await wait(120);
  }

  if (result.zhaopaiyanDrew) {
    showPassiveBanner("招牌眼 抽 1", "zhaopaiyan");
    sfx.kuaisou();
    flashPassiveChip();
    floatText(document.getElementById("player-anchor"), "招牌眼 抽 1", "zhaopaiyan");
    await wait(120);
  }

  // 跌打：首次技能牌回血
  if (result.seotongHealed > 0) {
    showPassiveBanner(`跌打 +${result.seotongHealed} HP`, "seotong");
    sfx.block();
    flashPassiveChip();
    floatText(
      document.getElementById("fighter-player"),
      `跌打 +${result.seotongHealed}`,
      "heal"
    );
    syncHpBars(state.battle);
    await wait(140);
  }

  // 飄字／kickback 收束後再重繪（不計入 ≤350ms 命中預算）
  await wait(30);
  state.busy = false;
  render();
}

/** 敵行動結果：喺敵人名牌旁出一個短標記，令「意圖 → 執行」順序可見 */
function flashEnemyAct(result, kind) {
  const meta = document.querySelector(".fighter.enemy .fighter-meta");
  if (!meta || !result) return;
  const label =
    kind === "attack"
      ? result.dealt > 0
        ? `出手 ${result.dealt}`
        : "全擋"
      : kind === "block"
        ? "加擋"
        : kind === "buff_attack"
          ? "蓄勢"
          : kind === "weaken"
            ? "陰招"
            : "行動";
  meta.classList.remove("is-acting");
  void meta.offsetWidth;
  meta.classList.add("is-acting");
  meta.setAttribute("data-act", label);
  setTimeout(() => {
    meta.classList.remove("is-acting");
    meta.removeAttribute("data-act");
  }, 900);
}

async function endTurnWithFeel() {
  if (state.busy || !state.battle || state.battle.over) return;
  state.busy = true;
  // 按下即有回饋：掣轉文字 + 禁用，唔好靜過
  const btnEl = document.querySelector('[data-action="end-turn"]');
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.classList.add("is-pending");
    btnEl.innerHTML = `<span class="end-turn-pending">對面行動中…</span>`;
  }
  sfx.click();

  const preview = getIntent(state.battle);
  const intentEl = document.getElementById("enemy-intent");

  // 敵行動預示：所有 kind 都閃一下，唔止攻擊
  await telegraphIntent(intentEl, preview?.kind === "attack" ? 240 : 180);

  const result = endTurn(state.battle);
  syncRunHpFromBattle();
  syncHpBars(state.battle);

  // 洗牌提示：棄牌堆回收時明確講一聲
  if (state.battle?.lastReshuffle > 0) {
    flashShuffle(state.battle, state.battle.lastReshuffle);
    state.battle.lastReshuffle = 0;
    await wait(180);
  }

  if (result?.kind === "attack") {
    const player = document.getElementById("fighter-player");
    // 敵行動結果：喺敵人欄出「出手」標記，順序一目了然
    flashEnemyAct(result, "attack");
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
      flashPassiveChip();
      await wait(140);
    }
  } else if (result) {
    // 非攻擊意圖（block／buff／weaken）：都要有可見行動，唔好靜跳
    flashEnemyAct(result, result.kind);
    const enemy = document.getElementById("enemy-portrait");
    if (result.kind === "block") {
      floatText(enemy, `擋 +${result.intent?.value ?? ""}`, "block");
    } else if (result.kind === "buff_attack" || result.kind === "buff") {
      floatText(enemy, "蓄勢", "kuaisou");
    } else if (result.kind === "weaken") {
      floatText(enemy, "陰招", "dangkou");
    } else {
      floatText(enemy, "行動", "block");
    }
    await wait(220);
  } else {
    await wait(60);
  }

  // 回合結束回饋：唔好靜過——講一句短港味 + 顯示關鍵數字
  const b = state.battle;
  if (b && !b.over) {
    if (result?.kind === "attack") {
      const dealt = result.dealt || 0;
      const blocked = result.blocked || 0;
      if (dealt > 0) {
        state.pendingTurnLine = blocked > 0
          ? `擋咗 ${blocked}，仲食咗 ${dealt} 傷害。`
          : `硬食 ${dealt} 傷害——下回合要小心。`;
      } else if (blocked > 0) {
        state.pendingTurnLine = `全擋 ${blocked}——一啖都冇漏。`;
      } else {
        state.pendingTurnLine = "捱過咗一下。";
      }
    } else if (result?.kind === "block") {
      state.pendingTurnLine = "對面守緊——下回合要撞穿佢。";
    } else if (result?.kind === "buff_attack" || result?.kind === "buff") {
      state.pendingTurnLine = "對面喺度蓄勢，下擊會更痛。";
    } else if (result?.kind === "weaken") {
      state.pendingTurnLine = "被踩一腳——下張攻擊會鈍啲。";
    } else {
      state.pendingTurnLine = "輪到你——手牌仲喺度。";
    }
  } else if (b?.over === "win") {
    state.pendingTurnLine = "對面企唔住喇——收工。";
  } else if (b?.over === "lose") {
    state.pendingTurnLine = "頂唔住……";
  }

  state.busy = false;
  render();
}

/** 回合結束短回饋：render 之後插入戰鬥日誌頂，1.8 秒後淡出 */
function flushTurnLine() {
  const text = state.pendingTurnLine;
  if (!text) return;
  state.pendingTurnLine = "";
  const log = document.querySelector(".battle-log");
  if (!log) return;
  const el = document.createElement("li");
  el.className = "turn-line";
  el.textContent = text;
  log.prepend(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("is-on"));
  });
  setTimeout(() => el.classList.remove("is-on"), 1800);
  setTimeout(() => el.remove(), 2400);
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
  // 非 Boss 亦要有戰前一句：寫入戰鬥日誌（Boss 已有 gate 大字）
  if (enemy?.flavor && state.battle) {
    state.battle.log = state.battle.log || [];
    if (!enemy.isBoss) {
      state.battle.log.unshift(`「${enemy.flavor}」`);
      if (state.battle.log.length > 8) state.battle.log.pop();
    }
  }
  state.pendingBossId = null;
  state.screen = "battle";
}

function beginBattle(enemyId) {
  const enemy = enemyById(enemyId);
  if (!enemy) {
    state.statusMsg = "對手未定";
    return;
  }
  // Boss／精英都先停閘口一句，唔好直接跳入戰鬥
  if (enemy.isBoss || enemy.isElite) {
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
  // 分支節點：如果已揀「打」嗰邊，用該選項嘅敵人
  const run = state.run;
  if (!run) return null;
  run.nodeEnemies = run.nodeEnemies || {};
  if (node.type === "branch") {
    const opt = branchOptionById(node, run.branchPicks?.[node.id]);
    if (!opt) return null;
    if (opt.enemyId) return opt.enemyId;
    const pool = opt.enemyPool || [];
    if (!pool.length) return null;
    // 抽定就記住，唔好每次重抽
    const key = `${node.id}::${opt.id}`;
    if (!run.nodeEnemies[key]) {
      run.nodeEnemies[key] = pool[Math.floor(Math.random() * pool.length)] || pool[0];
    }
    return run.nodeEnemies[key];
  }
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
    state.eventChoiceLabel = "";
    state.eventChoiceText = "";
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
  clearEventState();
  state.rewardChoices = [];
  state.statusMsg = "";
  state.openingHint = "";
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
      // 通關：存檔使命完成，清走（唔會再彈「繼續」）
      clearRun();
      // 每日鉤：今日第一次完局先派（通關都算）
      claimDailyOnce();
      sfx.clear();
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
  // 開場提示只在第一格之前顯示，入咗節點就收走
  state.openingHint = "";
  if (node.type === "battle" || node.type === "boss") {
    beginBattle(nodeEnemyId(node));
  } else if (node.type === "branch") {
    state.screen = "branch";
  } else if (node.type === "reward") {
    openReward();
  } else if (node.type === "event") {
    nodeEventId(node); // 入場先抽定，之後重繪／結果頁都用同一個
    state.eventResult = null;
    state.eventChoiceLabel = "";
    state.eventChoiceText = "";
    state.screen = "event";
  } else if (node.type === "rest") {
    state.shopMsg = "";
    // 每局入店洗一次貨：1 件消耗品 + 2 件遺物（消耗品跟 Act 偏重）
    if (!state.shopConsumables?.length) {
      state.shopConsumables = pickShopConsumables(1, Math.random, state.run.act || 1);
    }
    if (!state.shopRelics?.length) {
      state.shopRelics = pickShopRelics(state.run, 2);
    }
    state.screen = "rest";
  }
}

function onClick(event) {
  // 長按睇完詳情之後放手，會補一個 click —— 唔可以當成出牌。
  // 但詳情層自己嘅掣（例如「知道」）要放行，所以先檢查係唔係喺 .card-detail 入面。
  if (state.cardDetailId && !event.target.closest?.(".card-detail")) {
    state.cardDetailId = null;
    renderCardDetail();
    return;
  }
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
    if (state.busy) return;
    state.busy = true;
    const card = cardById(pickId);
    const before = runSnapshot();
    // 短動感：卡片放大高亮，同時出跳字，之後才離開
    const cardEl = t.closest(".card-face") || t;
    sfx.click();
    floatText(cardEl, "入手！", "kuaisou");
    confirmPick(cardEl, 240).then(() => {
      state.run.deck.push(pickId);
      const msg = pickFeedback(card);
      showRunDeltas(before);
      state.busy = false;
      advanceMap();
      // advanceMap 會清 statusMsg，所以推進之後才設定，令地圖畫面顯示得到
      state.statusMsg = msg;
      render();
    });
    return;
  }

  const evChoice = t.getAttribute("data-event-choice");
  if (evChoice) {
    if (state.busy) return;
    const ev = currentNodeEvent();
    const choice = ev?.choices.find((c) => c.id === evChoice);
    if (choice) {
      state.busy = true;
      const before = runSnapshot();
      const choiceEl = t.closest(".event-choice") || t;
      // 過程感：選項先亮一下、跳字跟住出，之後才轉結果頁
      choiceEl.classList.add("is-chosen");
      sfx.click();
      floatText(choiceEl, "揀咗", "kuaisou");
      setTimeout(() => {
        state.eventResult = choice.apply(state.run);
        // 記住揀咗邊個選項，結果頁顯示「你揀咗…」
        state.eventChoiceLabel = choice.label;
        state.eventChoiceText = choice.effectText;
        showRunDeltas(before);
        state.busy = false;
        render();
      }, 220);
      return;
    }
    render();
    return;
  }

  const action = t.getAttribute("data-action");
  switch (action) {
    case "to-pause":
      // 記住由邊度入，繼續時返原位（戰鬥保持戰鬥、地圖保持地圖）
      state.pauseFrom = state.screen === "battle" ? "battle" : "map";
      state.pauseConfirm = "idle";
      state.pauseResumeTo = state.screen;
      state.screen = "pause";
      break;
    case "resume":
      // 乜都唔重算，原畫面原狀態返去
      state.pauseConfirm = "idle";
      state.screen = state.pauseResumeTo || "map";
      break;
    case "ask-quit":
      if (!hasRunToLose(state.run)) {
        state.screen = "pause";
        break;
      }
      state.pauseConfirm = "confirm";
      sfx.click();
      break;
    case "cancel-quit":
      state.pauseConfirm = "idle";
      break;
    case "confirm-quit":
      // 真係走：清走記憶體中嘅局況，但**保留存檔**（下次可以續）
      state.pauseConfirm = "idle";
      state.run = null;
      state.battle = null;
      state.pendingBossId = null;
      state.pauseResumeTo = "map";
      state.screen = "title";
      refreshSavedRun();
      break;
    case "to-select":
      // 有存檔時，開新局會覆蓋——先問清楚
      if (loadRun(knownCharIds())) {
        state.overwriteConfirm = "confirm";
        state.screen = "title";
        break;
      }
      // 首局先教一次：睇過就直接入選角
      state.screen = hasSeenTutorial() ? "select" : "tutorial";
      break;
    case "confirm-overwrite": {
      // 玩家確認：舊存檔作廢，照常入選角（教學照首局規則）
      clearRun();
      state.savedRun = null;
      state.overwriteConfirm = "idle";
      // **必須一齊清走記憶體中嘅舊 run**：否則 render() 之後嘅 autoSave()
      // 會即刻將舊局寫返入存檔，變成「話覆蓋咗但其實冇」。
      state.run = null;
      state.battle = null;
      state.pendingBossId = null;
      state.screen = hasSeenTutorial() ? "select" : "tutorial";
      break;
    }
    case "cancel-overwrite":
      state.overwriteConfirm = "idle";
      break;
    case "continue-run": {
      const data = loadRun(knownCharIds());
      if (!data) {
        state.savedRun = null;
        state.overwriteConfirm = "idle";
        break;
      }
      state.run = unpackRun(data);
      state.selectedCharId = state.run.characterId;
      state.battle = null;
      state.pendingBossId = null;
      // 一律回地圖：戰鬥入面嘅存檔都係由該節點重入（唔存戰鬥內部狀態）
      state.screen = "map";
      state.statusMsg = `續上次——Act${state.run.act}，第 ${state.run.mapIndex + 1}／${currentMap().length} 格。`;
      state.openingHint = "";
      break;
    }
    case "finish-tutorial":
      // 睇完或跳過都係同一條路：記住 + 入選角
      markTutorialSeen();
      state.screen = "select";
      break;
    case "toggle-sfx": {
      const nowMuted = toggleMuted();
      state.statusMsg = nowMuted ? "音效已關——街口靜咗。" : "音效已開——街口有聲。";
      // 開啟時即刻「叮」一聲，證明真係有聲（靜音時當然唔響）
      if (!nowMuted) sfx.coin();
      break;
    }
    case "to-settings":
      // 由暫停頁入設定：記住要返去暫停，唔好一跳就變咗標題
      state.settingsReturnTo = state.screen === "pause" ? "pause" : null;
      state.screen = "settings";
      // 每次入嚟都由「未確認」開始，唔會殘留上一次嘅紅色確認狀態
      state.clearConfirm = "idle";
      state.settingsMsg = "";
      break;
    case "ask-clear": {
      // 第一下：只係問，唔清任何嘢
      if (!hasProgress()) {
        state.settingsMsg = "本機未有進度可清。";
        break;
      }
      state.clearConfirm = "confirm";
      state.settingsMsg = "";
      sfx.click();
      break;
    }
    case "cancel-clear":
      state.clearConfirm = "idle";
      state.settingsMsg = "冇清到任何嘢。";
      break;
    case "confirm-clear": {
      // 第二下：真係清，但只清進度，音效設定保留
      const before = progressKeys().length;
      const res = clearProgress();
      state.clearConfirm = "idle";
      state.settingsMsg = res.ok
        ? `已清除 ${before} 項本機進度。音效設定保留。`
        : "清除失敗（瀏覽器可能封鎖咗本機儲存）。";
      break;
    }
    case "back-title":
      // 由暫停頁入設定 → 「返暫停」，唔會唔覺意丟局
      if (state.settingsReturnTo === "pause") {
        state.settingsReturnTo = null;
        state.screen = "pause";
        state.clearConfirm = "idle";
        state.settingsMsg = "";
        break;
      }
      state.screen = "title";
      state.run = null;
      state.battle = null;
      state.pendingBossId = null;
      // 離開設定頁就清走確認狀態，唔會下次入嚟仍然紅色
      state.clearConfirm = "idle";
      state.settingsMsg = "";
      state.overwriteConfirm = "idle";
      // 由結算／暫停返標題：重讀存檔摘要（存檔已被清 = 唔再顯示「繼續」）
      refreshSavedRun();
      break;
    case "pick-char": {
      const id = t.getAttribute("data-char");
      if (id && CHARACTERS[id]) {
        // 換角色就收起上一個嘅 starter 預覽，唔好殘留
        if (state.starterOpen !== id) state.starterOpen = null;
        state.selectedCharId = id;
      }
      break;
    }
    case "toggle-starter": {
      const id = t.getAttribute("data-char") || state.selectedCharId;
      state.starterOpen = state.starterOpen === id ? null : id;
      sfx.click();
      break;
    }
    case "toggle-deck":
      state.deckOpen = !state.deckOpen;
      sfx.click();
      break;
    case "close-card-detail":
      state.cardDetailId = null;
      renderCardDetail();
      break;
    case "confirm-char":
      state.run = createRun(state.selectedCharId);
      state.screen = "map";
      // 選角 → 第一戰唔好斷戲：講一句開場，同時提醒被動
      {
        const c = characterById(state.selectedCharId);
        state.statusMsg = c.openLine || "";
        state.openingHint = `${c.playstyle || c.passive.name} · 被動「${c.passive.name}」開工`;
      }
      break;
    case "relic-info": {
      const id = t.getAttribute("data-relic");
      const r = RELICS[id];
      if (!r) return;
      state.statusMsg = `${r.name}：${relicPlainText(r)}`;
      break;
    }
    case "continue-act":
      state.actTransition = null;
      state.screen = "map";
      break;
    case "pick-branch": {
      const branchId = t.getAttribute("data-branch");
      const node = currentNode();
      const opt = branchOptionById(node, branchId);
      if (!opt || !node) break;
      const before = runSnapshot();
      state.run.branchPicks = state.run.branchPicks || {};
      state.run.branchPicks[node.id] = opt.id;
      // 兩邊都要有即時可見回報
      if (opt.bonusGold) state.run.gold += opt.bonusGold;
      if (opt.bonusHp) state.run.hp = Math.min(state.run.maxHp, state.run.hp + opt.bonusHp);
      showRunDeltas(before);
      if (opt.kind === "battle") {
        // 用 nodeEnemyId（已處理 enemyPool 抽樣）
        beginBattle(nodeEnemyId(node));
      } else {
        // 事件路線：用指定事件
        state.run.nodeEvents = state.run.nodeEvents || {};
        state.run.nodeEvents[node.id] = opt.eventId || pickEventId(state.run.act || 1);
        state.run.nodeEventQueue = state.run.nodeEventQueue || {};
        state.run.nodeEventQueue[node.id] = [state.run.nodeEvents[node.id]];
        state.eventResult = null;
        state.eventChoiceLabel = "";
        state.eventChoiceText = "";
        state.screen = "event";
      }
      break;
    }
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
      // 遺物：勝場回血（含 healOnWinBonus 叠層）
      const winHeal = (bonuses.healOnWin || 0) + (bonuses.healOnWinBonus || 0);
      if (winHeal > 0) {
        state.run.hp = Math.min(state.run.maxHp, state.run.hp + winHeal);
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
      // 敗北：呢一局結束，清走存檔（唔會再彈「繼續」）
      clearRun();
      // 每日鉤：失敗都算完一局
      claimDailyOnce();
      sfx.lose();
      break;
    case "skip-reward":
      // 唔要都有回饋：講清你放棄咗咩、之後要靠咩
      advanceMap();
      state.statusMsg =
        (state.run.deck || []).length <= 10
          ? "唔執——袋口仲薄，下一場要惜力。"
          : "唔執呢張。袋口冇變，慳返個位。";
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
      const flavor = restShopForAct(state.run.act || 1);
      const healAmt = Math.floor(state.run.maxHp * 0.3);
      const before = runSnapshot();
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + healAmt);
      state.pendingRestMsg = flavor.restHealMsg(healAmt);
      showRunDeltas(before);
      advanceMap();
      break;
    }
    case "rest-upgrade": {
      const flavor = restShopForAct(state.run.act || 1);
      const before = runSnapshot();
      state.run.deck.push(flavor.restUpgradeCardId);
      state.run.hp = Math.min(
        state.run.maxHp,
        state.run.hp + (flavor.restUpgradeHeal || 4)
      );
      state.pendingRestMsg = flavor.restUpgradeMsg;
      showRunDeltas(before);
      advanceMap();
      break;
    }
    case "rest-cleanse": {
      const flavor = restShopForAct(state.run.act || 1);
      const before = runSnapshot();
      const hadPenalty = state.run.nextBattleEnergyPenalty || 0;
      state.run.nextBattleEnergyPenalty = 0;
      state.run.hp = Math.min(state.run.maxHp, state.run.hp + 6);
      state.pendingRestMsg = hadPenalty
        ? flavor.restCleanseMsgClear(hadPenalty)
        : flavor.restCleanseMsgPlain;
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
        const flavor = restShopForAct(state.run.act || 1);
        const before = runSnapshot();
        state.run.gold -= SHOP.healCost;
        state.run.hp = Math.min(state.run.maxHp, state.run.hp + SHOP.healAmt);
        state.shopMsg = flavor.shopHealMsg(SHOP.healAmt);
        showRunDeltas(before);
      } else {
        state.shopMsg = "金幣不足";
      }
      break;
    case "shop-card":
      if (state.run.gold >= SHOP.cardCost) {
        const flavor = restShopForAct(state.run.act || 1);
        const cardId = shopCardIdForAct(state.run.act || 1);
        const before = runSnapshot();
        state.run.gold -= SHOP.cardCost;
        state.run.deck.push(cardId);
        state.shopMsg = flavor.shopCardMsg(cardById(cardId)?.name ?? cardId);
        showRunDeltas(before);
      } else {
        state.shopMsg = "金幣不足";
      }
      break;
    case "shop-pack": {
      const flavor = restShopForAct(state.run.act || 1);
      if (state.run.gold < SHOP.packCost) {
        state.shopMsg = "金幣不足";
        break;
      }
      const packCardId = pickPackCard(state.run.characterId);
      if (!packCardId) {
        state.shopMsg = flavor.shopRerollEmpty;
        break;
      }
      const before = runSnapshot();
      state.run.gold -= SHOP.packCost;
      state.run.deck.push(packCardId);
      const pc = cardById(packCardId);
      state.shopMsg = flavor.shopPackMsg(pc?.name ?? packCardId, pc?.rarity ?? "");
      showRunDeltas(before);
      break;
    }
    case "shop-reroll": {
      const flavor = restShopForAct(state.run.act || 1);
      if (state.run.gold < SHOP.rerollCost) {
        state.shopMsg = "金幣不足";
        break;
      }
      const before = runSnapshot();
      state.run.gold -= SHOP.rerollCost;
      state.shopRelics = pickShopRelics(state.run, 2);
      state.shopConsumables = pickShopConsumables(
        1,
        Math.random,
        state.run.act || 1
      );
      state.shopMsg = state.shopRelics.length
        ? flavor.shopRerollMsg(
            state.shopRelics.map((id) => relicById(id)?.name ?? id).join("、")
          )
        : flavor.shopRerollEmpty;
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
      // 開新局：清走上一局嘅每日獎勵提示，唔會殘留到今次結算
      state.dailyReward = null;
      // 牌組預覽亦收起，避免一入戰鬥就展開
      state.deckOpen = false;
      state.screen = "select";
      break;
    default:
      return;
  }
  render();
}

/* ---------- 長按卡牌睇詳情（手機為主） ---------- */

/** 長按判定時長（ms）：太短會誤觸、太長似壞 */
export const HOLD_MS = 420;

let holdTimer = null;
let holdStart = null;

/**
 * 開始計時。撳住卡面 420ms 就開詳情。
 *
 * 關鍵：手指一郁多過 10px 就當「滑動」，取消計時 ——
 * 否則玩家想捲頁睇手牌，會被誤判成長按。
 */
function onPointerDown(event) {
  const cardEl = event.target.closest?.(".card-face[data-card]");
  if (!cardEl) return;
  holdStart = { x: event.clientX, y: event.clientY, id: cardEl.getAttribute("data-card") };
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    if (!holdStart) return;
    state.cardDetailId = holdStart.id;
    sfx.click();
    renderCardDetail();
    holdStart = null;
  }, HOLD_MS);
}

function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
  holdStart = null;
}

/** 手指移動：郁得多就唔算長按 */
function onPointerMove(event) {
  if (!holdStart) return;
  const dx = event.clientX - holdStart.x;
  const dy = event.clientY - holdStart.y;
  if (Math.hypot(dx, dy) > 10) cancelHold();
}

app?.addEventListener("pointerdown", onPointerDown);
app?.addEventListener("pointermove", onPointerMove);
app?.addEventListener("pointerup", cancelHold);
app?.addEventListener("pointercancel", cancelHold);
app?.addEventListener("pointerleave", cancelHold);

/**
 * 詳情彈層掛喺 body，所以要喺 document 層接「知道」同「撳外面關閉」。
 * 用捕獲階段，確保喺 `onClick`（綁喺 #app）之前處理。
 */
document.addEventListener(
  "click",
  (event) => {
    if (!state.cardDetailId) return;
    const inDetail = event.target.closest?.(".card-detail");
    if (!inDetail) return; // 詳情以外嘅撳法交返 onClick 處理（佢會關詳情）
    // 喺詳情層入面：只認「知道」掣同撳背景
    const isClose = event.target.closest?.("[data-action='close-card-detail']");
    const isBackdrop = event.target.classList?.contains("card-detail");
    if (isClose || isBackdrop) {
      event.stopPropagation();
      state.cardDetailId = null;
      renderCardDetail();
    }
  },
  true
);

// 桌機：右鍵都當「睇詳情」（唔會觸發 click，唔會誤出牌）
app?.addEventListener("contextmenu", (event) => {
  const cardEl = event.target.closest?.(".card-face[data-card]");
  if (!cardEl) return;
  event.preventDefault();
  state.cardDetailId = cardEl.getAttribute("data-card");
  renderCardDetail();
});
app?.addEventListener("click", onClick);
// 啟動時先讀存檔，標題頁才知道要唔要出「繼續」
refreshSavedRun();
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
