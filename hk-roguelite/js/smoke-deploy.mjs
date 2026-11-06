/**
 * 部署前自檢：確認 `hk-roguelite/` 可以純靜態託管（GitHub Pages）同離線開。
 *
 * 檢查四件事：
 *   1. **所有相對路徑引用嘅檔案真係存在**（HTML link/script、資料層 assets）
 *   2. **冇絕對路徑**（`/xxx`）—— Pages 會掛喺 `/hongkong-card-game/hk-roguelite/` 底下，
 *      絕對路徑會 404
 *   3. **冇外部 CDN 依賴**（`https://…`）—— 否則「離線開」唔成立
 *   4. **冇 `_` 開頭嘅檔名**（Jekyll 會無視，雖然本 repo 有 .nojekyll）
 *
 * 純 Node，唔需要瀏覽器。用法：node js/smoke-deploy.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let checks = 0;
const failures = [];

function assert(cond, msg) {
  checks += 1;
  if (!cond) failures.push(msg);
}

/* ---------- 1. index.html 引用 ---------- */

const html = readFileSync(join(ROOT, "index.html"), "utf8");

// 抓 href / src（排除 preconnect / 外鏈，稍後獨立檢查）
const refRegex = /(?:href|src)="([^"]+)"/g;
const htmlRefs = [];
let m;
while ((m = refRegex.exec(html))) htmlRefs.push(m[1]);

const localHtmlRefs = htmlRefs.filter((u) => !u.startsWith("http") && !u.startsWith("//") && !u.startsWith("data:"));
assert(localHtmlRefs.length > 0, "index.html 應該有本地引用（css/js）");

for (const ref of localHtmlRefs) {
  // 去掉 ?v=xxx 查詢字串
  const clean = ref.split("?")[0];
  assert(!clean.startsWith("/"), `index.html 有絕對路徑（Pages 子目錄會 404）：${ref}`);
  const full = join(ROOT, clean);
  assert(existsSync(full), `index.html 引用嘅檔案唔存在：${ref}`);
}

// 明確要有 css 同 js 入口
assert(
  localHtmlRefs.some((r) => r.startsWith("css/")),
  "index.html 應該引用 css/main.css"
);
assert(
  localHtmlRefs.some((r) => r.startsWith("js/")),
  "index.html 應該引用 js/main.js"
);

/* ---------- 2. 外部依賴（離線要求） ---------- */

const external = htmlRefs.filter((u) => u.startsWith("http://") || u.startsWith("https://") || u.startsWith("//"));
assert(
  external.length === 0,
  `index.html 仍然有外部依賴（離線開會失敗／拖慢）：\n    ${external.join("\n    ")}`
);

/* ---------- 3. 資料層 assets 路徑 ---------- */

const dataSrc = readFileSync(join(ROOT, "js", "data.js"), "utf8");
const assetRefs = [...dataSrc.matchAll(/(?:art|portrait|bg):\s*"([^"]+)"/g)].map((x) => x[1]);
assert(assetRefs.length > 0, "data.js 應該有 art／portrait／bg 路徑");

for (const p of assetRefs) {
  assert(!p.startsWith("/"), `data.js 有絕對路徑：${p}`);
  assert(!/^https?:\/\//.test(p), `data.js 有外部圖（唔可以出網）：${p}`);
  assert(existsSync(join(ROOT, p)), `data.js 指向嘅圖唔存在：${p}`);
}

/* ---------- 4. CSS 內 url() ---------- */

const css = readFileSync(join(ROOT, "css", "main.css"), "utf8");
const cssUrls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((x) => x[1]);
for (const u of cssUrls) {
  if (u.startsWith("data:")) continue;
  assert(!u.startsWith("/"), `CSS 有絕對路徑：${u}`);
  assert(!/^https?:\/\//.test(u), `CSS 有外部資源（離線會失敗）：${u}`);
  assert(existsSync(join(ROOT, "css", u)), `CSS url() 指向嘅檔唔存在：${u}`);
}

/* ---------- 5. Jekyll 敏感檔名 ---------- */

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(ROOT);
const underscore = allFiles.filter((f) => {
  const rel = f.slice(ROOT.length + 1).replaceAll("\\", "/");
  return rel.split("/").some((part) => part.startsWith("_"));
});
// 有 .nojekyll 就冇問題；冇就要留意
const hasNojekyll = existsSync(join(ROOT, "..", ".nojekyll"));
if (!hasNojekyll) {
  assert(underscore.length === 0, `冇 .nojekyll 但有 _ 開頭路徑（Jekyll 會忽略）：${underscore.join(", ")}`);
}

/* ---------- 6. 必要檔案齊 ---------- */

for (const need of ["index.html", "css/main.css", "js/main.js", "js/data.js", "js/battle.js"]) {
  assert(existsSync(join(ROOT, need)), `缺少必要檔案：${need}`);
}

/* ---------- 7. 窄屏置中（390 / 320 唔可以偏右、唔可以出水平捲軸） ---------- */

/*
 * 曾經出事：手牌橫滑容器（.hand）用 flex 但冇 min-width:0，
 * 卡片 min-content 撐爆 grid 行，令整個畫面被推右、右邊被裁。
 * 呢度驗 CSS 有冇嗰幾條關鍵規則（Node 冇 DOM，只能驗規則存在）。
 */
{
  // 根容器：grid 單欄 minmax(0,1fr) + justify-items:center（唔可以只用 place-items）
  const appBlock = /^\.app\s*\{([^}]*)\}/m.exec(css);
  assert(appBlock, "搵唔到 .app 規則");
  const appCss = appBlock[1];
  assert(
    /grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(appCss),
    ".app 要用 grid-template-columns: minmax(0, 1fr)（否則子項內容會撐闊整行、畫面偏右）"
  );
  assert(
    /justify-items:\s*center/.test(appCss),
    ".app 要 justify-items: center（水平置中）"
  );
  assert(
    !/place-items:\s*center/.test(appCss),
    ".app 唔應該用 place-items: center（會同時置中垂直，長內容會偏）"
  );

  // 所有 screen 都要 min-width:0（grid／flex 子項預設 min-width:auto 會撐爆）
  const screenBlocks = [...css.matchAll(/\.screen(?:-wide|-battle)?\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert(screenBlocks.length >= 2, "應該搵到多個 screen 規則");
  const anyWithMinWidthZero = screenBlocks.some((b) => /min-width:\s*0/.test(b));
  assert(anyWithMinWidthZero, "screen 規則要包含 min-width: 0（防內容撐闊）");

  // body 要禁水平捲動（注意：CSS 有 `html, body` 同獨立 `body` 兩段，要搵有 overflow-x 嗰段）
  const bodyBlocks = [...css.matchAll(/(?:^|\n)\s*(?:html,\s*)?body\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert(bodyBlocks.length > 0, "搵唔到 body 規則");
  assert(
    bodyBlocks.some((b) => /overflow-x:\s*(hidden|clip)/.test(b)),
    "body 要 overflow-x: hidden 或 clip（禁水平捲動）"
  );

  // 手牌容器：min-width:0 + overflow-x:auto（橫滑，但唔撐爆外層）
  const handBlock2 = /^\.hand\s*\{([^}]*)\}/m.exec(css);
  assert(handBlock2, "搵唔到 .hand 規則");
  const handCss2 = handBlock2[1];
  assert(/min-width:\s*0/.test(handCss2), ".hand 要 min-width: 0（否則卡片撐爆容器）");
  assert(/max-width:\s*100%/.test(handCss2), ".hand 要 max-width: 100%");
  assert(/overflow-x:\s*auto/.test(handCss2), ".hand 要 overflow-x: auto（橫滑）");
  // 唔可以有重複宣告（曾經出現兩個 overflow-x: auto）
  const overflowXCount = (handCss2.match(/overflow-x:/g) || []).length;
  assert(overflowXCount === 1, `.hand 唔應該有重複 overflow-x（實際 ${overflowXCount} 次）`);

  // 戰鬥頂部 HUD 都要 minmax(0,1fr)
  const battleTop = /^\.battle-top\s*\{([^}]*)\}/m.exec(css);
  assert(battleTop, "搵唔到 .battle-top 規則");
  assert(
    /grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(battleTop[1]) || /min-width:\s*0/.test(battleTop[1]),
    ".battle-top 要有 minmax(0,1fr) 或 min-width: 0（防敵人卡撐闊）"
  );

  // 選牌獎卡：唔可以跟手牌 `flex: 0 0 118px`（直向 .reward-cell 會鎖死高度，
  // 令青字 .card-stats 溢出壓住橙金 .reward-why）
  const rewardFace = /\.reward-cell\s+\.card-face\s*\{([^}]*)\}/m.exec(css);
  assert(rewardFace, "搵唔到 .reward-cell .card-face 規則（防選牌叠字）");
  assert(
    /flex:\s*0\s+0\s+auto/.test(rewardFace[1]),
    ".reward-cell .card-face 要 flex: 0 0 auto（高度跟內容，唔鎖 118px）"
  );
  assert(/height:\s*auto/.test(rewardFace[1]), ".reward-cell .card-face 要 height: auto");
  assert(
    /\.reward-why\s*\{[^}]*color:\s*var\(--neon-amber\)/s.test(css),
    ".reward-why 要保持橙金短述（var(--neon-amber)）"
  );
}

/* ---------- 8. 手機橫屏（主驗收尺寸） ---------- */

/*
 * 橫屏高度只有 360–430px，垂直堆疊一定唔夠位。
 * 所以另開 css/landscape.css 喺 `(orientation: landscape) and (max-height: 500px)`
 * 之下改三欄佈局。呢度驗：
 *   ① 檔案存在、有被 index.html 引入
 *   ② 有正確嘅 media query（唔會誤中桌面）
 *   ③ 戰鬥頁真係三欄 grid
 *   ④ 手牌同操作欄各自有 grid-area（唔會疊埋）
 */
{
  const landscapePath = join(ROOT, "css", "landscape.css");
  assert(existsSync(landscapePath), "缺少 css/landscape.css（橫屏佈局）");
  assert(
    /css\/landscape\.css/.test(html),
    "index.html 未引入 css/landscape.css"
  );

  const land = readFileSync(landscapePath, "utf8");

  // ① media query：一定要 landscape + 高度上限（防桌面誤中）
  assert(
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*\d+px\)/.test(land),
    "landscape.css 要用 (orientation: landscape) and (max-height: Npx)，否則桌面都會中"
  );
  const heightCap = /max-height:\s*(\d+)px/.exec(land);
  assert(
    heightCap && Number(heightCap[1]) <= 520,
    `橫屏高度上限應 ≤520px（實測手機橫屏 360–430），實際 ${heightCap && heightCap[1]}`
  );

  // ② 戰鬥頁：三區 grid（左敵 / 中日誌 / 右 HUD + 操作）
  // 注意：landscape.css 有多個 .screen-battle 區塊，要搵「有三欄 + areas」嗰個
  const sbBlocks = [...land.matchAll(/\.screen-battle\s*\{([\s\S]*?)\n  \}/g)].map((m) => m[1]);
  assert(sbBlocks.length > 0, "landscape.css 應該有 .screen-battle 規則");
  const bl = sbBlocks.find((b) => /grid-template-areas/.test(b)) || sbBlocks[0];
  assert(/display:\s*grid/.test(bl), "橫屏 .screen-battle 要用 grid");
  // 三欄
  const colCount = (bl.match(/minmax\(0,/g) || []).length;
  assert(colCount >= 3, `橫屏 .screen-battle 應該係三欄，實際 ${colCount} 個 minmax`);
  assert(/grid-template-areas/.test(bl), "橫屏 .screen-battle 應該用 grid-template-areas 排位");
  assert(/max-height/.test(bl), "橫屏 .screen-battle 要限高（否則一定溢出）");
  assert(/overflow:\s*hidden/.test(bl), "橫屏 .screen-battle 要 overflow: hidden（禁上下拉）");

  // ②b 版面方向：左敵、中日誌、右 HUD（唔係上下堆疊）
  assert(
    /"enemy\s+log\s+player"/.test(bl),
    "橫屏第一行應該係 enemy | log | player（左敵 / 中日誌 / 右 HUD）"
  );
  assert(/"piles\s+piles\s+player"/.test(bl), "橫屏第二行：牌堆跨左中，右邊仍然係 player");
  assert(/"hand\s+hand\s+act"/.test(bl), "橫屏第三行：手牌跨左中，右邊係 act（操作）");
  // battle-top 要用 display:contents 拆開，令敵人／玩家成為 grid item
  assert(
    /\.battle-top\s*\{[^}]*display:\s*contents/.test(land),
    "橫屏 .battle-top 要 display: contents（否則敵人／玩家排唔到左右）"
  );

  // ③ 各區 grid-area
  assert(/#fighter-enemy\s*\{[^}]*grid-area:\s*enemy/.test(land), "橫屏 #fighter-enemy 要 grid-area: enemy");
  assert(
    /#fighter-player\s*\{[^}]*grid-area:\s*player/.test(land),
    "橫屏 #fighter-player 要 grid-area: player"
  );
  assert(/\.battle-log\s*\{[^}]*grid-area:\s*log/.test(land), "橫屏 .battle-log 要 grid-area: log");
  assert(/\.hand\s*\{[^}]*grid-area:\s*hand/.test(land), "橫屏 .hand 要 grid-area: hand");
  assert(
    /\.battle-actions\s*\{[^}]*grid-area:\s*act/.test(land),
    "橫屏 .battle-actions 要 grid-area: act（結束回合固定右下）"
  );
  // 日誌要可滾，唔可以撐高
  assert(
    /\.battle-log\s*\{[^}]*overflow-y:\s*auto/.test(land),
    "橫屏 .battle-log 要 overflow-y: auto（日誌自己滾，唔撐版面）"
  );

  // ④ 橫屏卡片要縮細（一屏見到多幾張）
  const cardLand = /\.hand \.card-face,\s*\.card-face\s*\{([^}]*)\}/.exec(land);
  assert(cardLand, "landscape.css 應該有卡片縮細規則");
  const cardW = /width:\s*(\d+)px/.exec(cardLand[1]);
  assert(
    cardW && Number(cardW[1]) <= 110,
    `橫屏卡片闊度應 ≤110px（直版 118），實際 ${cardW && cardW[1]}`
  );

  // ⑤ 地圖要三欄（6 格 → 2 行）
  assert(
    /\.map-list\s*\{[^}]*grid-template-columns:\s*repeat\(3,/.test(land),
    "橫屏 .map-list 應該係 3 欄（6 格 → 2 行）"
  );

  // ⑥ 事件選項要橫排三欄
  assert(
    /\.event-choices\s*\{[^}]*grid-template-columns:\s*repeat\(3,/.test(land),
    "橫屏 .event-choices 應該係 3 欄（三選一橫排）"
  );

  // ⑦ 結算底欄：橫向並排，並收起副標（省高度）
  assert(
    /\.result-bar\s*\{[^}]*flex-direction:\s*row/.test(land),
    "橫屏 .result-bar 應該 flex-direction: row（兩粒掣並排，省高度）"
  );
  assert(
    /\.result-bar \.btn-rerun-sub\s*\{[^}]*display:\s*none/.test(land),
    "橫屏應該收起 .btn-rerun-sub（副標題佔高度）"
  );

  // ⑧ 直版唔受影響：landscape.css 唔可以改到 portrait
  assert(
    !/@media\s*\(orientation:\s*portrait\)/.test(land),
    "landscape.css 唔應該有 portrait 查詢（直版由 main.css 負責）"
  );
}

/* ---------- 9. 橫屏高度預算（三列佈局） ---------- */

/*
 * 新佈局係 3 行：
 *   row1 = enemy / log / player（minmax(0,1fr) 自適應）
 *   row2 = piles（auto，約 24px）
 *   row3 = hand / act（minmax(0,0.95fr) 自適應）
 * 所以固定高度 = app padding + 2 個 row-gap + piles。
 * 只要固定部分 + 最小可接受高度 ≤ 320，就一屏。
 */
{
  const land = readFileSync(join(ROOT, "css", "landscape.css"), "utf8");

  // row-gap：喺整份 landscape.css 搵（唔局限於某個 block）
  const gapMatch = /row-gap:\s*([\d.]+)rem/.exec(land);
  assert(gapMatch, "橫屏要定義 row-gap（三列佈局高度緊）");
  const rowGap = parseFloat(gapMatch[1]) * 16;
  assert(rowGap <= 6, `橫屏 row-gap 應 ≤6px（三列佈局高度緊），實際 ${rowGap}px`);

  // height 用 calc(100vh - Nrem)；允許後面再加 100dvh（真機可見視口）
  const hMatch = /height:\s*calc\(100vh\s*-\s*([\d.]+)rem\)/.exec(land);
  assert(hMatch, "橫屏 .screen-battle 高度要用 calc(100vh - Nrem)");
  const hOffset = parseFloat(hMatch[1]) * 16;
  assert(hOffset <= 12, `橫屏 100vh 減少量應 ≤12px，實際 ${hOffset}px`);
  assert(
    /height:\s*calc\(100dvh\s*-\s*[\d.]+rem\)/.test(land),
    "橫屏應該同時提供 100dvh（防手機瀏覽器 chrome 裁底）"
  );

  // app 上下 padding（搵第一個 .app 區塊）
  const appMatch = /\.app\s*\{([\s\S]*?)\}/.exec(land);
  assert(appMatch, "landscape.css 應該有 .app 規則");
  const padMatch = /padding:\s*([\d.]+)rem/.exec(appMatch[1]);
  assert(padMatch, "橫屏 .app 要有明確 padding");
  const padY = parseFloat(padMatch[1]) * 16 * 2;
  assert(padY <= 12, `橫屏 .app 上下 padding 合計應 ≤12px，實際 ${padY}px`);

  // 最矮可接受：320 高（Galaxy 橫屏）。row1 需 ≥110、row2 ≥24、row3 需 ≥100
  const MIN_VIEWPORT = 320;
  const fixed = padY + rowGap * 2 + 24;
  const flexibleNeed = 110 + 100;
  assert(
    fixed + flexibleNeed <= MIN_VIEWPORT,
    `橫屏固定高度 ${Math.round(fixed)} + 最小內容 ${flexibleNeed} = ${Math.round(fixed + flexibleNeed)}px 超出 ${MIN_VIEWPORT} 視口`
  );

  // 卡片闊度（新值 92）
  const cardBlock = /\.hand \.card-face,\s*\.card-face\s*\{([^}]*)\}/.exec(land);
  const cw = cardBlock ? /width:\s*(\d+)px/.exec(cardBlock[1]) : null;
  const cardWidth = cw ? Number(cw[1]) : 118;
  assert(
    cardWidth >= 80 && cardWidth <= 110,
    `橫屏卡片闊度應 80–110px，實際 ${cardWidth}px`
  );

  console.log("  ✓ 橫屏高度預算（三列佈局：row-gap／padding／最小內容喺 320 內）");
}
/* ---------- 結果 ---------- */

if (failures.length) {
  console.log(`✗ 部署自檢失敗（${failures.length}／${checks} 項）`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checks,
      externalRefs: external.length,
      localHtmlRefs: localHtmlRefs.length,
      assetRefs: assetRefs.length,
      cssUrls: cssUrls.length,
      hasNojekyll,
    },
    null,
    2
  )
);
