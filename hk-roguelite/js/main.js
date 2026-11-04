/**
 * 《霓虹牌局》— 新專案入口骨架
 * 路徑：hk-roguelite/（與倉庫根目錄舊《香江 Card Game》demo 隔離）
 * 本檔僅 title／選角占位；戰鬥與垂直切片留待後續任務。
 */

const CHARACTERS = [
  {
    id: "mei",
    name: "阿美",
    short: "夜市攤檔養大的快手",
    initial: "美",
  },
  {
    id: "kai",
    name: "阿啟",
    short: "城寨巷仔的影子",
    initial: "啟",
  },
  {
    id: "yan",
    name: "阿欣",
    short: "天台收音機的守夜人",
    initial: "欣",
  },
];

const state = {
  screen: "title", // title | select | stub
  selectedId: null,
};

const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function render() {
  if (!app) return;

  if (state.screen === "stub") {
    const chosen = CHARACTERS.find((c) => c.id === state.selectedId);
    app.innerHTML = `
      <main class="screen" aria-label="占位畫面">
        <header class="brand-block">
          <h1 class="brand">霓虹牌局</h1>
          <p class="tagline">骨架就緒 · 垂直切片尚未接入</p>
        </header>
        <section class="panel">
          <h2>下一站</h2>
          <p style="margin:0;color:var(--ink-dim);line-height:1.55;font-size:0.92rem;">
            已選角色：<strong style="color:var(--ink)">${escapeHtml(chosen?.name ?? "—")}</strong><br />
            後續任務會在此接上：地圖 → 戰鬥 → 選牌 → Boss。
          </p>
        </section>
        <div class="actions">
          <button type="button" class="btn btn-ghost" data-action="back-select">返回選角</button>
        </div>
        <p class="foot-note">新專案目錄 hk-roguelite／不修改根目錄舊 demo</p>
      </main>
    `;
    return;
  }

  if (state.screen === "select") {
    const cards = CHARACTERS.map((c) => {
      const selected = state.selectedId === c.id ? " is-selected" : "";
      const pressed = state.selectedId === c.id ? "true" : "false";
      return `
        <li>
          <button
            type="button"
            class="char-card${selected}"
            data-select="${escapeHtml(c.id)}"
            aria-pressed="${pressed}"
          >
            <span class="avatar" aria-hidden="true">${escapeHtml(c.initial)}</span>
            <span class="char-meta">
              <span class="char-name">${escapeHtml(c.name)}</span>
              <span class="char-desc">${escapeHtml(c.short)}</span>
            </span>
          </button>
        </li>
      `;
    }).join("");

    app.innerHTML = `
      <main class="screen" aria-label="選角">
        <header class="brand-block">
          <h1 class="brand">霓虹牌局</h1>
          <p class="tagline">揀一個角色，準備闖港夜三區</p>
          <span class="badge">工作名 · 骨架</span>
        </header>
        <section class="panel">
          <h2>選擇角色</h2>
          <ul class="char-list">${cards}</ul>
        </section>
        <div class="actions">
          <button
            type="button"
            class="btn btn-primary"
            data-action="confirm"
            ${state.selectedId ? "" : "disabled"}
          >開始（占位）</button>
          <button type="button" class="btn btn-ghost" data-action="back-title">返回標題</button>
        </div>
        <p class="status" role="status">${
          state.selectedId
            ? `已選：${escapeHtml(CHARACTERS.find((c) => c.id === state.selectedId)?.name ?? "")}`
            : "請先揀一個角色"
        }</p>
        <p class="foot-note">占位角色 · 正式數值與被動另案</p>
      </main>
    `;
    return;
  }

  // title
  app.innerHTML = `
    <main class="screen" aria-label="標題">
      <header class="brand-block">
        <h1 class="brand">霓虹牌局</h1>
        <p class="tagline">香港霓虹街頭卡牌 Rogue-lite</p>
        <span class="badge">新專案骨架 · 非香江續作</span>
      </header>
      <section class="panel">
        <h2>一鋪一個傳奇</h2>
        <p style="margin:0;color:var(--ink-dim);line-height:1.55;font-size:0.92rem;">
          揀角色、組牌闖三區。短、上癮、想再來一局。<br />
          本畫面僅證明新入口可開。
        </p>
      </section>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="to-select">進入選角</button>
      </div>
      <p class="foot-note">入口：hk-roguelite/index.html</p>
    </main>
  `;
}

function onClick(event) {
  const target = event.target.closest("[data-action], [data-select]");
  if (!target) return;

  const selectId = target.getAttribute("data-select");
  if (selectId) {
    state.selectedId = selectId;
    render();
    return;
  }

  const action = target.getAttribute("data-action");
  switch (action) {
    case "to-select":
      state.screen = "select";
      break;
    case "back-title":
      state.screen = "title";
      state.selectedId = null;
      break;
    case "back-select":
      state.screen = "select";
      break;
    case "confirm":
      if (!state.selectedId) return;
      state.screen = "stub";
      break;
    default:
      return;
  }
  render();
}

app?.addEventListener("click", onClick);
render();
