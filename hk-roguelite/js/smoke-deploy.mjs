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
