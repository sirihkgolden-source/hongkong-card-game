## t326（2026-10-28 ~05:46 HKT）
- **總導演封測價**：扭蛋膠幣 **單抽＝1、十連＝10**（取代 15／135）
- `gachaPriceSingle`／`gachaPriceTen`；UI 副標／掣價／扣費／不足判斷／滿星退回皆跟常數
- 副標去掉「九折」（10＝10×單抽，無折）
- 唔改權重／pity／★1／t325 機圖
- 改 `app.js`／`index.html`（`?v=t326-1`）／STATUS／`_selftest_t326.js`
- 已推桌面 DESKTOP-KFH3ACB

## t325（2026-10-28 ~05:45 HKT）
- **總導演：機圖白邊太難看** — `assets/gacha/machine-ref.webp` 深色／霓虹底有白 fringe／白 matte
- **修法**：由 `machine-ref.bak-pre-t325.webp` 重出 RGBA；flood 外圍近白／低飽和暈 → alpha0；core 收縮；白 matte un-premultiply；輪廓近白／灰 rim 多輪剔除
- **驗收**：紅機身左右輪廓邊緣樣本為深紅（非 240+ 白）；partial 亮 fringe 清零；QA 合成 `/workspace/gacha-t325-defringe-neon.png`／black
- **bak**：`machine-ref.bak-pre-t325.webp`（去邊前）；`machine-ref.bak-checker.webp`（更早棋盤）
- **唔改玩法**；t324 拆 top-up 維持
- 改 `assets/gacha/machine-ref.webp`／`app.js`（img `?v=t325-1`）／`index.html`（`?v=t325-1`）／STATUS
- 已推桌面 DESKTOP-KFH3ACB：`C:\Users\dinoy\香江CardGame-試玩demo-lite\`

## t324（2026-10-28 ~05:40 HKT）
- **膠幣唔鎖定 260**（GitHub Pages 前）：開局／新人生／`abandonLife` 仍 `SOUL_START=260`；**拆掉** `loadGame`「soul&lt;260 就補到 260」。讀檔跟舊值，可正常扣減、可歸零。
- **top-up 已拆證據**：`app.js` `loadGame` 僅 `state.soul = Math.max(0, num(data.soul, SOUL_START) | 0)`＋註解「t324…唔再 top-up」；`rg` **無** `(state.soul|0) < SOUL_START) state.soul = SOUL_START`。唯一 `state.soul = SOUL_START` 在 `abandonLife`（預期）。
- **自測** `_selftest_t324.js`：**49/49 ALL PASS**（見 `_selftest_t324_report.json`）
  | # | 項目 | 結果 |
  |---|------|------|
  | 1 | 扭蛋主圖 `assets/gacha/machine-ref.webp` | PASS |
  | 2 | 單15／十連135；不足 toast「膠幣不足」；soul=10 唔 top-up；可扣到 0 | PASS |
  | 3 | 新卡★1；複本升星；★5 退 15 膠幣文案 | PASS |
  | 4 | 返回可撳；結果卡 help wire | PASS |
  | 5 | 玩家字「膠幣」；`ui.resource` | PASS |
  | 6 | GACHA_WEIGHTS 70/20/8/2；kind 65/20/15 | PASS |
  | 7 | 店鋪 `shopPriceForRarity`／`viewShop`／四選 | PASS |
  | 8 | `card_trade`／`star_up` 事件 | PASS |
  | 9 | `skillFieldTaken`／同場禁重複 | PASS |
  | — | `node --check` app.js／data.js；index `?v=t324-1` | PASS |
- 改 `app.js`／`index.html`（`?v=t324-1`）／STATUS／`_selftest_t324.js`。
- 已推桌面 DESKTOP-KFH3ACB：`C:\Users\dinoy\香江CardGame-試玩demo-lite\`

## t323（2026-10-28 ~05:36 HKT）
- **總導演：主視覺圖換上扭蛋機**（`assets/gacha/machine-ref.webp`：紅圓罩＋彩蛋＋粗金屬轉柄＋底部出蛋口；透明底；281×500）
- **唔改**：價錢／pity／升星／滿星退膠幣／SOUL_START 260／膠幣文案／t322 權重／★1／返回／toast／result 藏機全露卡／撳卡說明
- **機身**：idle／coin／spin／egg_out 以 `<img class="gm-art">` 為主視覺；純 CSS 示意機（`.gm-dome` 等）包入 `.gm-css-schematic` 並 `display:none`
- **素材**：原 webp 帶棋盤格 bake；已 flood-key 成真正 RGBA 透明底（bak：`machine-ref.bak-checker.webp`）
- **叠字**：圖上方小條 `.gm-brand-tag`「廟街扭蛋／NEON」——唔遮罩／轉柄／出蛋口
- **提示**：機下方 `.gm-hint-bar`「投入膠幣，扭出霓虹塑膠蛋」實色高對比（t322 方向）
- **spin**：`.gm-art` 輕微 rotate／shake（`gm-art-shake`），唔重畫
- 截圖：`/workspace/gacha-t323-machine.png`（idle 見新圖）
- 改 `app.js`／`styles.css`／`index.html`（`?v=t323-1`）／STATUS；`node --check`
- 已推桌面 DESKTOP-KFH3ACB：`C:\Users\dinoy\香江CardGame-試玩demo-lite\`（含 `assets/gacha/machine-ref.webp`）

## t322（2026-10-28 ~05:35 HKT）
- **總導演：普通戰鬥卡佔太少**＋**新卡預設★1**＋**機身提示字對比**
- **唔改**：價錢（單15／十連135）／pity（20／40）／升星／滿星退膠幣／SOUL_START 260／膠幣文案
- **1) 技能／裝備補齊 rarity**
  - skills 72 張全補：普通 36／稀有 26／史詩 8／最高級 2（強技偏高）
  - equipment：保留 common20／rare12；legend 拆成 epic5＋legend3（原 8 legend）
  - `gachaItemRarity`：無 rarity **唔再默認普通當池填料**（回 null 跳過；有 id 啟發式兜底）；優先 data
- **2) 抽卡兩段**
  - 先 kind：`GACHA_KIND_WEIGHTS` **fighters 65／skills 20／gear 15**
  - 再稀有度 → 該 kind＋稀有度池均勻抽
  - 池空 fallback：①同級戰鬥卡 → ②同 kind 降稀有度 → ③再降 → ④任意戰鬥卡
- **3) 稀有度權重「正常」**：`GACHA_WEIGHTS` **普通 70／稀有 20／史詩 8／最高級 2**（合計100）；pity 仍按稀有／史詩 rank
- **4) 新卡預設★1**
  - `albumMarkNewCardStar1`／`albumGainOne`：首次入冊明確寫 `fighterStars`／`skillStars`／`equipStars[id]=1`
  - 接線：扭蛋 `applyGachaGrant`、店鋪、換技、交換、demo 種子、C03 補、舊檔 backfill
  - UI：`albumStarsHtml` 至少亮★1；扭蛋結果卡顯示 `稀有度 · ★N`
- **5) 機身提示字（對截圖 gacha-blurry-hint）**
  - 提示移入機底 **`gm-hint-bar`** 實色橫條（出蛋口／底座下方）；idle 舞台清空，**唔再半透明蓋轉扭／投幣**
  - 高對比：深底＋金描邊／陰影／字略大；全文「投入膠幣，扭出霓虹塑膠蛋」
  - 旁觀：粗搖手（`gm-knob-grip`＋加粗把手）、出蛋槽加高加框；十連結果 **5 欄×2 列**減捲
- **自測模擬**（200 抽／另 20×十連；含 pity）
  - 權重最終：稀有度 **70／20／8／2**；kind **65／20／15**
  - 200 抽：rolled kind 戰鬥≈65.5%／技能25%／裝備9.5%；**fighters×普通 ≈46%**（明顯多數）
  - 20×十連：fighters×普通 ≈43%
- 改 `app.js`／`data.js`／`data.json`／`styles.css`／`index.html`（`?v=t322-1`）／STATUS；`node --check`；`_selftest_t322.js`
- 已推桌面 DESKTOP-KFH3ACB：`C:\Users\dinoy\香江CardGame-試玩demo-lite\`

## t321（2026-10-28 ~05:29 HKT）
- **玩家可見資源名「魂焰」→「膠幣」**（扭蛋貨幣；書面語繁中）——**唔改**價錢／池／保底／升星／滿星退款數字（仍：單 15／十連 135；開局／補滿 260）
- **玩家字**：`ui.resource`、HUD chip、toast「膠幣不足」、扭蛋價文案（「15 膠幣」等）、滿星退回文案、事件 `reward_blurb`／`reward` 行／`desc`、結果結算、教學 tip、卡 effect／blurb 等一律「膠幣」
- **內部保留**：`state.soul`、persist `soul`、變數名、技術註解可暫留「魂焰」（少改存檔）
- **確認 t320b**：`loadGame` 若 `(state.soul|0) < SOUL_START` → 補到 260（已在；本輪未改邏輯）
- 改 `app.js`／`data.js`／`data.json`／`index.html`（`?v=t321-1`）／STATUS。`node --check`；`_selftest_t321.js`。已推桌面 DESKTOP-KFH3ACB。

## t320b（2026-10-28 ~05:28 HKT）
- **舊檔亦要有 260 魂焰**（總導演：畫面仍然冇 260）
  - `loadGame` 讀檔後若 `(state.soul|0) < SOUL_START` → 補到 `SOUL_START`（260）；高於 260 唔削。
  - 方便試玩十連 135；真機＋結果說明照 t320。
- 改 `app.js`／`index.html`（`?v=t320b-1`）／STATUS。已推桌面 DESKTOP-KFH3ACB。

## t320（2026-10-28 ~05:35 HKT）
- **總導演必修兩點＋測焰**——**唔改**價錢／池／保底／升星／滿星退焰（仍：單 15／十連 135；pity 20／40；★5 退 15）
- **機身輪廓重畫成真扭蛋機**：高瘦 silhouette；**大半球透明罩**（視覺主角）＋**密密彩蛋**（28 顆層次）；中段霓虹燈箱「廟街扭蛋／NEON」；右側**粗大金屬轉扭**（金屬圈＋把手＋中軸）；下方**金屬出蛋槽／門**。禁扁方盒／微波爐輪廓。idle／coin／spin／egg_out 見真機；reveal／result 繼續藏機（保 t319）。
- **出卡後撳卡顯示說明**：結果卡（單抽＋十連每張）click／長按 → `showHelpTip`；跟 `kind`（fighters／skills／gear）走 `fighterHelpText`／`fighterHelpRichHtml`／`skillHelpText`／`equipHelpText`。`.gacha-card` 加 `data-id`／`data-kind`／`data-gacha-idx`、`cursor:pointer`、hint「點擊查看說明」。help-tip z-index **500** 蓋過扭蛋 UI。
- **預設魂焰 30→260**：`SOUL_START = 260`；`state.soul` 初始、`abandonLife`／新人生重置用 260。**讀舊檔唔洗**現有魂焰（load 有值跟舊；缺欄先用 SOUL_START）。方便測十連 135。
- 截圖：`/workspace/gacha-t320-machine.png`、`/workspace/gacha-t320-card-help.png`
- 改 `app.js`／`styles.css`／`index.html`（`?v=t320-1`）／STATUS。`node --check`；`_selftest_t320.js`。已推桌面 DESKTOP-KFH3ACB。

## t319（2026-10-28 ~05:25 HKT）
- **旁觀 Partial 必修＋總導演升級**——**唔改**價錢／池／保底／升星／滿星退焰（仍：單 15／十連 135；pity 20／40；★5 退 15）
- **P0 返回卡死根因**：`doPull` → `render(phase=coin)` 時「返回」寫入 `disabled`；其後 `applyGachaPhaseDom` 只解鎖 `.gacha-actions` 內掣，**唔碰** `#btn-gacha-back`（在 `.gacha-cta`）→ result 仍 disabled。
  - **修法**：`viewGacha` 返回永遠唔寫 disabled；`applyGachaPhaseDom` 各 phase 強制 `removeAttribute("disabled")`；onclick 唔再 busy early-return，離開必 `clearGachaAnim`＋reset phase。
- **P1 魂焰不足 toast**：不足時用 class `is-broke`＋`aria-disabled`，**唔**用 `disabled` 屬性擋 click；CSS `pointer-events:auto`；click／`pullGacha` 失敗 → `toast("魂焰不足")`。
- **P0 UX 結果卡全露**：reveal／result **隱藏機身**；stage 透明無灰框、`z-index:8`；單抽用 `single`＋`gacha-card-big`，立繪 `max-height:240`，名／稀有／新獲得同屏可見。截圖：`/workspace/gacha-t319-result-fullcard.png`
- **機身重畫成真扭蛋機**：半球玻璃圓頂 `gm-dome`＋艙內彩蛋＋機櫃投幣／大轉扭／出蛋槽／底座；禁方盒微波爐輪廓。idle 截圖：`/workspace/gacha-t319-idle-machine.png`
- **華麗**：裂蛋兩半位移＋碎片／裂縫 glow；史詩粒子 span；最高級光柱＋burst＋「爆」加長 reveal（~1200ms）
- **自測**：`node --check app.js`；`node _selftest_t319.js`（返回 result 無 disabled、不足 toast 路徑、扣 15／135、規則字串、機身／裂蛋／z 層）**ALL PASS**
- 改 `app.js`／`styles.css`／`index.html`（cache `?v=t319-1`）／STATUS。已推桌面 DESKTOP-KFH3ACB。

## t328（2026-10-28 ~05:15 HKT）
- **只換 art**——唔改戰鬥數值／池／扭蛋邏輯／id／name／技能
- **11 張戰鬥卡換圖**（jfif → 既有 `assets/fighters/` 同路徑同副檔名；舊檔備份 `_inbox_cards_t328/backup_pre_t328/`）
  | 來源 jfif | → | 最終路徑 | 名 |
  |---|---|---|---|
  | 01M5ZK2RMACYWN34K96P1AH2MX.jfif | → | assets/fighters/C09.jpg | 牆字皇帝 |
  | 01M5ZK2RM924M4HHDTPRPS561Y.jfif | → | assets/fighters/C50.png | 舊數簿記 |
  | 01M5ZK2RMADCF18SXQA3CY6XKC.jfif | → | assets/fighters/C51.png | 通宵士多 |
  | 01M5ZK2RMAYZR09JBSJVCC2M2K.jfif | → | assets/fighters/C59.png | 天台雜草 |
  | 01M5ZK2RMAE1SWY1RNTTX3ZD9N.jfif | → | assets/fighters/C61.png | 糖水外賣 |
  | 01M5ZK2RM9G86S4E4DE5VV1QYY.jfif | → | assets/fighters/C04.jpg | 大牌檔火鑊 |
  | 01M5ZK2YPZGFNAFYNDJ1N2G8WQ.jfif | → | assets/fighters/C244.png | 纜車廂 |
  | 01M5ZK300WZN6X3J7DHCP2JESN.jfif | → | assets/fighters/C52.png | 月台廣播 |
  | 01M5ZK31FDCRQ39VBS8X9MVGT8.jfif | → | assets/fighters/C116.png | 雪糕車 |
  | 01M5ZK336AA24SRBNGPJZK1632.jfif | → | assets/fighters/C40.png | 天星水手 |
  | 01M5ZK33ZTK56CMGCEJHS6SZ1N.jfif | → | assets/fighters/C173.png | 籃球場 |
- **3 張 held**（唔入冊／唔換任何卡）→ `_inbox_cards_t328/held/`
  - 01M5ZK31FNZREG1Y1JHGRQ682R.jfif（曼聯波衫）
  - 01M5ZK322G5438CQMWN9FTPYK2.jfif（白襯碎樹）
  - 01M5ZK32M2QVZ6Q5094RXWXSXB.jfif（德育課室）
- data.js／data.json／index cache bust：**未改**（副檔名已匹配現有 art 字串）

## t318b（2026-10-28 ~05:20 HKT）
- **魂焰扭蛋華麗演出升格（人生目標級主菜）**——**唔改**價錢／池／保底／升星／滿星退焰邏輯（仍：單 15／十連 135；權重 55／30／12／3；保底 20 稀有／40 史詩；滿星退 15）
  - **入場全屏機身**：CSS 燈箱頂欄＋玻璃窗塑膠蛋堆＋投幣口＋大轉鈕＋出蛋槽；標題「廟街霓虹扭蛋機」；魂焰大字；保底進度；「扭一蛋／十連扭蛋」大掣
  - **階段節奏** `state.gachaPhase`／`.gacha-panel.phase-*`：`idle → coin(400) → spin(560) → egg_out(480) → crack(420) → reveal(520–900) → result`；最高級 reveal 加長；十連最後一張 `gacha-finale` 加強；「略過動畫」跳去 result
  - **稀有度特效**：普通淡光＋scale；稀有藍光柱／邊框脈衝；史詩紫光＋CSS 閃片；最高級金／霓虹＋短暫全屏 glow overlay「爆」
  - **入口**：HUD／home／prep 文案改 **「霓虹扭蛋」**（高對比粉金 chip，唔再細隱身）
  - **音效**：極短 WebAudio beep（optional，失敗忽略）
  - 改 `app.js`／`styles.css`／STATUS。`node --check` 驗收。已推桌面 DESKTOP-KFH3ACB。

## t318（2026-10-28 ~05:10 HKT）
- **魂焰扭蛋首版・廟街霓虹扭蛋機**（`screen:"gacha"`／`viewGacha`）
  - **包裝**：扭蛋（街邊／遊戲廳感）；入口「扭一蛋」；掣「扭一蛋／十連扭蛋」。流程：出蛋 → 開蛋 → 卡面浮現（CSS）
  - **開蛋特效（按稀有度分色）**：普通淡白灰光；稀有藍光；史詩紫光；最高級金／霓虹 pulse 稍長；scale＋fade ~0.4–0.8s；十連 stagger（`animation-delay`），唔卡死可再扭
  - **貨幣**：魂焰 `state.soul`（開局／新人生＝30）；**唔用金幣抽卡**
  - **價錢**：單次 **15**；十連 **135**（九折）；不足 → toast「魂焰不足」，唔扣唔發
  - **池**：單一綜合池（戰鬥＋技能＋裝備；含 C03 等 magic）。權重：**普通 55／稀有 30／史詩 12／最高級 3**
  - **保底（帳號級 persist `gachaPityRare`／`gachaPityEpic`）**：**20** 次內至少稀有（含以上）；**40** 次內至少史詩（含以上）。中稀有重置稀有計；中史詩／最高級重置史詩＋稀有計
  - **入冊／複本升星＝自動**：新卡入冊「新獲得」；已擁有未滿星 → **★＋1、淨持有不變**；戰鬥／技能／裝備各用自有 star map
  - **滿星退焰**：已 ★5 → 唔加複本、唔升星；**全額退單次價 15 魂焰**（十連每格滿星各退 15）；UI「已滿星，退回 15 魂焰」／`flag:refund`
  - **入口**：人生 HUD＋主頁／準備頁「扭一蛋」；結果 2 列；**不做**限定池／碎片店／付費／大動畫庫
  - 改 `app.js`／`styles.css`／STATUS。`node --check` 驗收。已推桌面 DESKTOP-KFH3ACB。

# 香江 Card Game · 試玩 demo-lite · STATUS

## t317（2026-10-28 ~04:58 HKT）
- **旁觀補驗：C03 魔標試玩攞唔到卡**（方案 1＋可選小刀）
  - **A. Demo 種子強制擁有 C03「霓虹咒匠」**：`albumEnsureState` 每次 ensure 後若 `cardCounts.C03 < 1` 則設為至少 1（只補，**唔** bump／重置隨機 5+5+5，避免洗走玩家收藏）。註解：demo 旁觀驗「普攻・魔／自帶・魔」用。開遊戲／讀檔後卡冊應有霓虹咒匠；準備出發由已擁有選入口袋即可驗出戰詳情。
  - **B. 卡冊詳情標籤對齊**：`fighterHelpText` 自帶攻擊型加括號物／魔（例 `自帶：壞管連閃（魔）——…`），用 `innatePowerTagLabel`／`resolveInnatePower` 與出戰「自帶・魔」語義一致；純輔助不加括號。普攻行維持 `（物／魔）`。
  - **唔改** 店鋪定價、鎖定、t316、物魔公式。
  - 改 `app.js`／STATUS。`node --check` 驗收。已推桌面 DESKTOP-KFH3ACB。

## t316（2026-10-28 ~04:55 HKT）
- **同場禁重複技能（softlock 防範）**：`state.team` 各卡 `loadout` 同一 `skillId` **只能裝一張出戰卡**；即使 album 有多張複本亦不可分裝上陣。
  - 新增 `skillFieldTaken(sid, exceptFid)`（`skillEquipCount>0` → 不可裝）。
  - `claimSkillForFighter`：其他出戰卡已有此 sid → return（維持唔轉移）。
  - `reconcileTeamSkillUniqueness`：全隊同一 sid **最多 1**（唔理 owned）；多餘清 null。讀檔／`ensureDefaultLoadout` 路徑仍會 reconcile。
  - 揀技池 locked＝「其他卡已裝」；文案「已鎖定 · 同場不可重複 · 裝於「卡名」」；彈窗 hint：「同一技能同場只能裝在一張出戰卡（即使持有複本亦不可分裝上陣）。」
  - Auto-fill 同樣守唯一（`used >= 1` 跳過）。
  - **唔改** 店鋪／交換／升星／物魔／RPG／幫派；**唔回滾 t315**。
  - 改 `app.js`／STATUS。`node --check` 驗收。已推桌面 DESKTOP-KFH3ACB。


## t315／t315b／t315c（2026-10-28 ~04:55 HKT）
- **t315 人生店鋪・金幣四選一**：`shop_equip`／`shop_fighter`／`shop_skill` 不再免費 stub；`pickEvent` → `state.shop`＋`screen=shop`。
  - 定價：普通／common **15**｜稀有／rare **25**｜史詩／epic **40**｜最高級／legend **60**｜無法辨識 **20**。
  - `buildShopOffers` 抽最多 4 張不重複；`viewShop` 2×2；夠錢購入（只買 1）；不足灰＋「金幣不足」toast；離開 soft 無獎（`shopLeftEmpty`，唔發事件魂焰／經驗）。
  - `grantShopItem`／`buyShopOffer`／`leaveShop`；`skill_swap` 仍舊 stub。
  - EV25–EV30 `reward_blurb`→「…四選一・金幣購買」。
- **t315b 交換卡 `card_trade`**：EV44「巷口換卡檔」。交出己有戰鬥卡（team 則移走＋清 loadout；album−1）→ 四選一換入（未持有優先；album＋1，有位入 team）。不扣金幣；離開無獎。`rollYearEvents` 自由年約 40% 注入。
- **t315c 升星 `star_up`**：EV45「夜市升星攤」。可升星戰鬥卡（star<max；team 優先）→ 金幣價 **15×當前星**；成功 `fighterStars`＋1（唔燒合卡複本）；離開無獎。與卡冊合卡升星／RPG level 相容。
- 改 `app.js`／`styles.css`／`data.js`／`data.json`／STATUS。`node --check` 驗收。已推桌面 DESKTOP-KFH3ACB。


## t314c（2026-10-28 ~04:47 HKT）
- **攻擊型自帶技亦分物／魔（power）**：法師向卡自帶 `power` 改／確認 magic——`C03` 霓虹咒匠、`C10` 兄弟帖影、`C45` 盂蘭街景（已）、`C46` 中秋燈籠、`C73` 霓虹修燈、`C109` 紙紮舖（已）、`C243` 燈籠街；`C01` 仍 phys。
  - Runtime：`resolveInnatePower`（明確 power 優先，缺則 fallback `fighterBasicPower`）；`innatePowerTagLabel`（攻擊型「自帶・物／魔」，純輔助「自帶」）；`skillCombatSpec` 讀 fighter 缺 power 時可走 basic_power；`startBattle`／自帶 `innateSpec` 寫入 resolve 後 power。**唔改**裝備技能卡語義。
  - UI：出戰詳情／`battleCardSkillSlotsHtml`／inspect／長按自帶格標「自帶・物」／「自帶・魔」（可連 CD：`自帶・魔｜CD 3`）；`skillCombatSummary` 物攻／魔攻跟 resolve power；普攻「普攻・物／魔」維持。
  - **t314 鎖定不變**（`claimSkillForFighter` free≤0、`skillEquippedOnName`、池「已鎖定 · 裝於「卡名」」）。
  - 改 `data.json`／`data.js`／`app.js`／STATUS。`node --check` SYNTAX_OK。已推桌面 DESKTOP-KFH3ACB。

## t314b（2026-10-28 ~04:45 HKT）
- **普攻亦分物攻／魔攻（basic_power）**：戰鬥卡新增獨立欄 `basic_power: "phys"|"magic"`（缺省 phys；**唔改**既有技能／自帶 `power` 語義）。
  - Magic 卡：`C03` 霓虹咒匠、`C10` 兄弟帖影、`C45` 盂蘭街景、`C46` 中秋燈籠、`C73` 霓虹修燈、`C109` 紙紮舖、`C243` 燈籠街；敵方 `E01` 後巷影亦標 magic。
  - Helper：`fighterBasicPower`／`basicPowerTagLabel`／`basicPowerParenLabel`；`startBattle`／`buildEnemyRoster` 寫入 unit.`basic_power`。
  - `!useSkill` 普攻改走 `attackBaseForPower(actor, bp)`＋`calcDamage(..., bp)`（magic→atk+matk／mdef；phys→atk／def）。
  - UI：出戰詳情／`battleCardSkillSlotsHtml`／inspect／長按／卡冊詳情標「普攻・物」／「普攻・魔」（或「普攻：…（物／魔）」）。
  - **t314 鎖定不變**（`claimSkillForFighter` free≤0、`skillEquippedOnName`、池「已鎖定 · 裝於「卡名」」）。
  - 改 `data.json`／`data.js`／`app.js`／STATUS。`node --check` SYNTAX_OK。

## t314（2026-10-28 ~04:43 HKT）
- **技能卡已掛其他出戰卡 → 鎖定＋加強提示（不再自動轉移）**：`claimSkillForFighter` 若 `skillFreeCopies<=0` 直接 return，刪「由其他卡卸走」轉移 loop。揀技池仍可見已裝於他人之技，標「已鎖定 · 裝於「卡名」」，用 `.fd-pool-item.locked`（無 `data-equip-sid`）。新增 `skillEquippedOnName`；彈窗加「同一張技能同一時間只能裝在一張出戰卡；持有多張複本方可分裝。」；click handler 再 guard free≤0。改 `app.js`／`styles.css`／STATUS。`node --check` SYNTAX_OK。已推桌面 DESKTOP-KFH3ACB。

## t313（2026-10-28 ~04:25 HKT）
- **④ 卡牌 RPG 元素（可驗收切片）**：以 **A 卡牌等級**為主；**B 升星**沿用卡冊合卡，唔重做。
  - **帳號級** `fighterLevels`／`fighterXp`（跟 cardCounts／album，跨人生；舊存缺欄＝Lv.1／0 xp）。
  - 刻度 **Lv.1–5**；升下一級需 xp＝**10×當前等級**（1→2＝10，2→3＝20…）；滿級多餘 xp 歸零。
  - 戰鬥勝利：本場**參戰卡**各＋**10** 卡經驗（自動分，存活／陣亡同得）。
  - 等級加成：每級高於 1 → **物攻＋2、HP＋10**；升星加成：每星高於 1 → **物攻＋1、HP＋5**；**兩者可疊加**。寫入 `startBattle`／`fighterPreviewStats`。
  - UI：卡冊格／詳情、準備出發、出戰位、出戰詳情、結算「卡牌成長」、長按說明可見 Lv.n 與數值。
  - persist／load 讀寫新欄；唔動急救／技能結構化／存檔閘／EV39／幫派好感 v0。
  - 改 `app.js`／`styles.css`／STATUS。`node --check` SYNTAX_OK。已推桌面。

## t312（2026-10-28 ~04:20 HKT）
- **修幫派 v0**：① `rollYearEvents`——`facPool` 有 eligible `require_faction` 回報卡（EV42／EV43）時**必出回報格**（唔再被 intro EV40／EV41 蓋死）；無回報時仍約 65% 抽介紹。仍只 1 格勢力、唔搶 main／minigame、宿敵年唔出。② 勢力結算好感句去重——`favorNote`／`note`／`extraNotes` 正規化＋／− 後剔重複，選邊結果「廟街義氣＋1」只顯示一次。③ 結果畫面出現時頂欄魂焰／經驗／金幣／attrs／flag 已入帳（`rewardApplied`，同 EV39）；「繼續」只兜底＋推進年。改 `app.js`。`node --check` SYNTAX_OK。

## t311（2026-10-28 ~04:10 HKT）
- **③ 幫派支線原型（好感 v0）**：兩團「廟街義氣」「城寨兄弟」；好感刻度 **0–5**（今世 `state.factions`，persist／load／abandon 跟）。事件 EV40／EV41 遭遇選邊（幫／中立／拒）改好感＋魂焰／金幣；EV42／EV43 好感≥2 解鎖回報（幸運／力量＋金幣；`flag_on_complete` 防重複）。`rollYearEvents` 自由年約 65% 注入 1 格勢力（宿敵年唔出、唔搶 special_battle／main／minigame）。卡標勢力名、結果可見「廟街義氣＋1」、HUD／聲望顯示兩團好感。改 `data.js`／`data.json`／`app.js`／`styles.css`。`node --check` SYNTAX_OK。

## t309（2026-10-28 ~03:47 HKT）
- **EV39 街機破關 UX**：① CSS 裁邊——`.mg-sub`／`.mg-msg` 廢 line-clamp＋max-height 衝突，改 `display:block`／`white-space:normal`／`overflow-wrap`／`width:100%`；`.mg-hud` 加 `flex-wrap`＋`>span` nowrap；`.mg-wrap` `min-width:0`／`width:100%`。② 頂欄入帳——`endRun` 結果 paint 前即 apply 魂焰／經驗／金幣（`rewardApplied`），與 `attrs_delta`／戰鬥一致；`settleMinigameToLife` 只兜底唔雙計。改 `styles.css`／`app.js`。`node --check` SYNTAX_OK。DESKTOP-KFH3ACB 離線——無 CopyFromBox。

## t305（2026-10-28）
- **小遊戲事件原型（②）**：新增 `EV39`「街機破關」（`category:minigame`／標「小遊戲」）。選中→`screen=minigame` 記憶鍵位破關（約 20–40s；可放棄＝半獎）。勝：滿獎魂焰／經驗／可選金幣＋`attrs_delta`＋`lifeFlags.arcade_clear`；敗／放棄：半獎，人生繼續（唔 wipe、唔 pendingDefeat）。`rollYearEvents`：非宿敵年且自由遭遇年≥1 時約 70% 注入 1 格；命運年／`isSpecialBattleYear` 唔出。教學期自由年亦可出。改 `data.js`／`data.json`／`app.js`／`styles.css`。`node --check` SYNTAX_OK。


## t304（2026-10-28）
- **存檔／重載閘（P0）**：`pendingDefeat`（`startBattle` 寫、`endBattle`／`abandonLife` 清）＋持久化 `lastResult`；`settlePendingDefeat` 視作敗（教學 soft／非教學 `advanceYear`）；`shouldResumeToResult` 於 boot／`enterLife` 強制 `result`（堵戰中滿血重打、lifeWiped／壽命完未結算入 events）。`goStory` 清 `lastResult`。唔改急救／技能結構化。`node --check` SYNTAX_OK。DESKTOP-KFH3ACB 離線——無 CopyFromBox。

## t287（2026-10-28）
- **自動存檔**「繼續上次未完人生」：`SAVE_KEY=hkcg-demo-lite-save-v1`；`persistSnapshot`／`saveGame`／`loadGame`（校驗 fighter／skill／origin／fate／event／equip id）；`render` 尾＋`visibilitychange`／`pagehide` 存；boot：`loadGame`→`albumEnsureState`→`ensureLifeSkills`→`ensureDefaultLoadout(lifePrepped?false:true)`→有人生則 `screen=home`；`abandonLife`／`endLife` 後 `saveGame`（lifePrepped false）。help／toast：自動存檔、讀取上次存檔。唔存 battle／screen／UI modal。`node --check` SYNTAX_OK。


- **2026-10-27 ~23:50 HKT（t280）：** 出戰詳情技能格撳／長按冇內容——① `.help-tip` z-index 80→**200**（高過 detail-mask 80／ally 70）；② filled 格恢復 `data-help`＋`skillHelpText`；`wireLongPressHelp` 對 `.fds-off/[data-unequip]` 唔 arm 長按，卸下仍 `stopImmediatePropagation`；③ `.fd-skill.fixed/.filled` 短按 `showHelpTip`（唔開空＋、唔擋卸下；長按後 `helpBlockClickUntil` 防雙開）。固定格文案對齊 skillHelpText（含自帶 effect／CD）。`fd-pool` 長按不變。`node --check` SYNTAX_OK。CopyFromBox app.js＋styles.css＋STATUS → desktop。

- **2026-10-27 ~23:40 HKT（t279）：** 戰鬥卡長按／inspect 顯示技能欄位（有圖）——共享 `battleCardSkillSlotsHtml`（普攻／自帶／ally 已裝技，複用 `.fd-skill`）；`showHelpTip` 支援 `{ html:true }`；`enemy-card`／`prep-fighter`／`deploy-slot`／`ally-face` 長按出 rich tip（敵方只普攻＋自帶）；`openCardInspect` 改用視覺 skill slots；出戰 equipped 帶 `art`。`node --check` SYNTAX_OK。CopyFromBox app.js＋styles.css＋STATUS → desktop。

- **2026-10-27 ~23:28 HKT（t277）：** Bug A 卸下不到——`viewEncounter` 每次 `ensureDefaultLoadout(false)`，卸到空就 auto-fill。加 `state.loadoutInited[fid]`：已 init 只 strip burned／保留 null 洞，唔 collapse、唔 refill；force／未 init 先填再標 inited。清 `loadoutInited`：離隊／`abandonLife`／清晒／陣亡／pruneUnowned。Bug B 第4格＋「冇可裝技能」——池改 `skillOwnedCopies>0`（唔再要 free>0）；free≤0 仍列，「其他卡有裝·會轉移」；claim 會轉移。卸下：filled 格唔掛 data-help＋stopImmediatePropagation＋`.fds-off` z-index。`node --check` SYNTAX_OK。CopyFromBox app.js＋styles.css → desktop。

- **2026-10-27 ~23:25 HKT（t276）：** 出戰卡詳情預設技有圖——`skillArtByName`／`fixedSlotIcoHtml`：普通攻擊／自帶優先 `DATA.skills` 同名 `art`，否則用 `f.art`；`.fds-ico` 改 `<img>`（唔再用 ⚔／✦）。玩家文案「成隊」→「全隊」（data.js／data.json 各 74→0 成隊、75 全隊；含既有 1）；`inferStatusMaps` 同時認 成隊|全隊。`node --check` SYNTAX_OK。CopyFromBox app.js＋data.js＋data.json → desktop。


- **2026-10-27 ~23:22 HKT（t275）：** viewEvents 紅筆區暗影——`rewards_preview` 第三粒「可能開打」＋ fightHint 同 tag 撞埋，`.event-card{overflow:hidden}` 剪斷 label 底。修：chip 剔「可能開打／直接收工」；底下加 `.ev-card-blurb`（`reward_blurb`，色 `#c9b8d8`）；唔再 append fightHint。CSS：card flex column、label `flex:0 0 auto`＋padding-bottom、pick-4 img `max-height:68px`（base 78px）。全 event 卡適用。`node --check` SYNTAX_OK。CopyFromBox app.js＋styles.css → desktop。

- **2026-10-27 ~23:20 HKT（t274）：** 身世改四揀一 2×2 有圖（2增益＋2減益）。ORIGINS＝茶記學徒／城寨細路（buff）＋天台夜青／報紙檔細路（debuff）；`viewOrigin` 用 `event-grid pick-4-grid` 同 fate 卡樣；CSS origin 綠／紅邊。HELP 加 `origin-pick`。`node --check` SYNTAX_OK。CopyFromBox → desktop。

- **2026-10-27 ~23:15 HKT（t273）：** 卡冊只顯示已擁有——`albumFilteredEntries` 加 `albumCardCount(e.id)>0`；空格文案「未持有任何卡」／「呢頁未有已擁有卡」。點擊 `.album-cell-art`（及整格）開詳情 modal（升星／說明）；唔掛 `data-help`。唔改全域長按。`node --check` SYNTAX_OK。CopyFromBox → desktop。

- **2026-10-27 ~23:00 HKT（t271）：** Demo 收藏種子——`demoSeedVersion`／`DEMO_CARD_COUNTS_SEED=271`：缺或過期則 `albumEnsureState` 重種子，戰鬥／技能／裝備各隨機 **5** 張 `count=1`，其餘已知 id＝`0`（卡冊仍列全目錄紅名 x0）。`skillOwnedCopies`→`albumCardCount`；`obtainedSkillsSorted`／`openPocketFighters`／prep 裝備 modal 只睇已擁有；`ensureLifeSkills` 由已擁有技能種子並剔未擁有；`pruneUnownedRefs` 清隊／loadout／accountGear。Album skills 列表改用全 `DATA.skills`（唔跟 obtained）。`node --check app.js` SYNTAX_OK。Desktop offline——無 CopyFromBox。
## t278（2026-10-27）
- 結算頁去掉重複「繼續故事」；只留一個「繼續」（同放棄今世）。
## t281（2026-10-27）
- 遇敵頁：盟友底欄貼底；玩家出戰卡同敵方卡同等大（3:4 圖）。
## t282（2026-10-27）
- 卡牌說明／help-tip 自動收起由 4.2s 改為 **20s**。
## t283（2026-10-28）
- 遇敵「算吧／返去」→「放棄，重新開始！」；掣縮小唔擋出戰卡。
## t284（2026-10-28）
- 卡牌說明／help-tip 改頂端置中顯示。
## t285（2026-10-28）
- 戰鬥卡 inspect 技能格撳／長按可顯示說明內容。
## t286（2026-10-28）
- 主頁「入故事」→「開始人生」＋「繼續上次未完人生」；底欄荷包刪除，改放卡冊。
## t288（2026-10-28）
- 清走玩家可見 stub／同類 placeholder（遭遇卡 reward_blurb、商店／換技 softNote）。
## t289（2026-10-28）
- 遇敵頁：玩家出戰卡同屏唔使拉落；「開始戰鬥」收細（唔再全闊）。
## t290（2026-10-28）
- 敵方長按說明入面技能格可撳出內容；修 tip 嵌套即關。
## t291（2026-10-28）
- 出戰詳情：收細卡圖／技能格，全技能同屏唔使拉落。
## t292（2026-10-28）
- 出戰詳情「＋」另開揀技彈窗（唔再塞詳情底；絕對唔使拉落詳情）。
## t293（2026-10-28）
- 結果頁：panel 字唔再被擋；「繼續」全闊收矮；「放棄今世」縮小。
## t294（2026-10-28）
- 審核事件／戰鬥介面：soft／遭遇四揀一／確認窗／戰鬥舞台／inspect 禁下拉、防裁字。
